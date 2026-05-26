import express, { Request, Response, Router } from 'express';
import { auth } from '../middleware/auth';

const router: Router = express.Router();

/**
 * Catalog of product tiers exposed by the paywall. The price/interval are
 * placeholders until Stripe products are provisioned — the frontend may render
 * them as the "marketing" price for now.
 */
const TIER_CATALOG = {
  BASIC: { priceCents: 0, interval: 'month' },
  SPECIFIED: { priceCents: 1999, interval: 'month' },
  ACTIVE_CLIENT: { priceCents: 4999, interval: 'month' },
} as const;

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
 * `ACTIVE_CLIENT` without touching Stripe. Hard-disabled in production via the
 * NODE_ENV guard so it cannot leak to live billing. Returns the updated user
 * payload (same shape as /users/profile) so the client can swap the local
 * AuthContext state without a follow-up fetch.
 */
router.post('/dev-upgrade', auth, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
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
