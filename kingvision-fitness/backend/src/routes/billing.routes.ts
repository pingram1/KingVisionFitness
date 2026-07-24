import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { auth } from '../middleware/auth';
import { env } from '../config/env';
import { TIER_CATALOG } from '../config/tierCatalog';
import User from '../models/User';
import {
  createCheckoutSession,
  createBillingPortalSession,
  isPaidCatalogTier,
  isStripeCheckoutReady,
} from '../services/stripeBilling.service';

const router: Router = express.Router();

/**
 * POST /api/billing/create-checkout-session
 *
 * Creates a Stripe Checkout session for SPECIFIED or ACTIVE_CLIENT tiers.
 * Returns { checkoutUrl, sessionId } when Stripe is fully configured.
 */
router.post('/create-checkout-session', auth, async (req: Request, res: Response) => {
  try {
    const requestedTier = req.body?.tier;

    if (!isPaidCatalogTier(requestedTier)) {
      return res.status(400).json({
        success: false,
        message: 'tier must be one of: SPECIFIED, ACTIVE_CLIENT',
      });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isStripeCheckoutReady()) {
      const catalogEntry = TIER_CATALOG[requestedTier];
      return res.status(503).json({
        success: false,
        message:
          'Stripe Checkout is not configured on this server. Add STRIPE_SECRET_KEY, webhook secret, and price IDs.',
        data: {
          tier: requestedTier,
          priceCents: catalogEntry.priceCents,
          interval: catalogEntry.interval,
          checkoutUrl: null,
        },
      });
    }

    const { checkoutUrl, sessionId } = await createCheckoutSession(user, requestedTier);

    return res.json({
      success: true,
      message: 'Checkout session created',
      data: {
        tier: requestedTier,
        priceCents: TIER_CATALOG[requestedTier].priceCents,
        interval: TIER_CATALOG[requestedTier].interval,
        checkoutUrl,
        sessionId,
      },
    });
  } catch (error) {
    console.error('[billing] create-checkout-session failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/billing/dev-upgrade
 *
 * DEVELOPER BYPASS — instantly promotes the authenticated user to
 * `ACTIVE_CLIENT` without touching Stripe. Defense in depth:
 *   1. NODE_ENV must not be `production`
 *   2. Caller must send `X-Dev-Bypass-Secret` matching env.DEV_BYPASS_SECRET
 *      (when configured). If the env var is unset, the endpoint is 404.
 */
router.post('/dev-upgrade', auth, async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  if (!env.ALLOW_DEV_BYPASS || !env.DEV_BYPASS_SECRET) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  const providedSecret = req.header('x-dev-bypass-secret') ?? '';
  const expected = Buffer.from(env.DEV_BYPASS_SECRET);
  const provided = Buffer.from(providedSecret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    req.user.subscriptionTier = 'ACTIVE_CLIENT';

    if (req.user.subscription) {
      req.user.subscription.tier = 'active-client';
      req.user.subscription.status = 'active';
    }

    await req.user.save();

    return res.json({
      success: true,
      message: 'Dev bypass: upgraded to ACTIVE_CLIENT',
      data: req.user,
    });
  } catch (error) {
    console.error('[billing] dev-upgrade failed:', error);
    res.status(500).json({ success: false, message: 'Failed to upgrade subscription' });
  }
});

/**
 * POST /api/billing/create-portal-session
 *
 * Opens the Stripe Customer Portal for subscription management (cancel, invoices).
 */
router.post('/create-portal-session', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isStripeCheckoutReady()) {
      return res.status(503).json({
        success: false,
        message: 'Stripe billing portal is not configured on this server.',
      });
    }

    const { portalUrl } = await createBillingPortalSession(user);

    return res.json({
      success: true,
      message: 'Billing portal session created',
      data: { portalUrl },
    });
  } catch (error) {
    console.error('[billing] create-portal-session failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create billing portal session' });
  }
});

export default router;
