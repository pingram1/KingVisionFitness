import express, { Router } from 'express';
import { auth } from '../middleware/auth';

const router: Router = express.Router();

const NOT_IMPLEMENTED = {
  success: false,
  message:
    'Subscription management has moved to /api/billing. Use POST /api/billing/checkout-session for upgrades.',
};

// @route   GET /api/subscriptions/current
// @desc    Deprecated — use GET /api/users/profile (subscriptionTier field)
// @access  Private
router.get('/current', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// @route   POST /api/subscriptions/upgrade
// @desc    Deprecated — use POST /api/billing/checkout-session
// @access  Private
router.post('/upgrade', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// @route   POST /api/subscriptions/cancel
// @desc    Deprecated — use Stripe Customer Portal via /api/billing/portal-session
// @access  Private
router.post('/cancel', auth, async (_req: any, res: any) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

export default router;
