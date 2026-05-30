import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { auth } from '../middleware/auth';
import { env } from '../config/env';
import { TIER_CATALOG } from '../config/tierCatalog';

const router: Router = express.Router();

type PaidTier = Exclude<keyof typeof TIER_CATALOG, 'BASIC'>;
const PAID_TIERS: readonly PaidTier[] = ['SPECIFIED', 'ACTIVE_CLIENT'];

function isPaidTier(value: unknown): value is PaidTier {
  return typeof value === 'string' && (PAID_TIERS as readonly string[]).includes(value);
}

/**
 * POST /api/billing/create-checkout-session
 *
 * SCAFFOLD: returns a placeholder payload describing the session that *would*
 * be created. Replace the body with a real `stripe.checkout.sessions.create`
 * call once Stripe keys + price IDs are wired up. The frontend already speaks
 * this contract, so swapping the implementation will be drop-in.
 */
router.post('/create-checkout-session', auth, async (req: Request, res: Response) => {
  try {
    const requestedTier = req.body?.tier;

    if (!isPaidTier(requestedTier)) {
      return res.status(400).json({
        success: false,
        message: `tier must be one of: ${PAID_TIERS.join(', ')}`,
      });
    }

    const catalogEntry = TIER_CATALOG[requestedTier];

    return res.status(501).json({
      success: false,
      message: 'Stripe Checkout is not yet provisioned. Use POST /api/billing/dev-upgrade in non-production environments to bypass.',
      data: {
        tier: requestedTier,
        priceCents: catalogEntry.priceCents,
        interval: catalogEntry.interval,
        checkoutUrl: null,
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
 *
 * This makes the route useless to a leaked build that mis-sets NODE_ENV,
 * because the secret header is also required.
 */
router.post('/dev-upgrade', auth, async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  if (!env.DEV_BYPASS_SECRET) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  // Constant-time compare so the response time can't leak how many characters
  // of the secret are correct.
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

export default router;
