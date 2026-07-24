import express, { Request, Response, Router } from 'express';
import { auth, authorizeRoles } from '../middleware/auth';
import User from '../models/User';
import WorkoutSession from '../models/WorkoutSession';
import { TIER_CATALOG } from '../config/tierCatalog';
import {
  getStripeDashboardUrl,
  getStripeMode,
  isStripeCheckoutReady,
  isStripeConfigured,
} from '../services/stripeBilling.service';
import { getLastWebhookInfo } from '../services/stripeWebhook.service';

const router: Router = express.Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminAnalyticsPayload {
  users: {
    total: number;
    byTier: {
      BASIC: number;
      SPECIFIED: number;
      ACTIVE_CLIENT: number;
    };
    activeCoaches: number;
  };
  engagement: {
    workoutsCompletedLast7Days: number;
  };
  revenue: {
    estimatedMrrCents: number;
    activeClientCount: number;
    pricePerClientCents: number;
  };
  generatedAt: string;
}

/**
 * GET /api/admin/analytics
 * SUPER_ADMIN command-center metrics — user tiers, weekly engagement, estimated MRR.
 */
router.get(
  '/analytics',
  auth,
  authorizeRoles('SUPER_ADMIN'),
  async (_req: Request, res: Response) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

      const [
        totalUsers,
        basicCount,
        specifiedCount,
        activeClientCount,
        activeCoaches,
        workoutsCompletedLast7Days,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ subscriptionTier: 'BASIC' }),
        User.countDocuments({ subscriptionTier: 'SPECIFIED' }),
        User.countDocuments({ subscriptionTier: 'ACTIVE_CLIENT' }),
        User.countDocuments({ 'groupMemberships.role': 'coach' }),
        WorkoutSession.countDocuments({ endTime: { $gte: sevenDaysAgo } }),
      ]);

      const pricePerClientCents = TIER_CATALOG.ACTIVE_CLIENT.priceCents;
      const estimatedMrrCents = activeClientCount * pricePerClientCents;

      const data: AdminAnalyticsPayload = {
        users: {
          total: totalUsers,
          byTier: {
            BASIC: basicCount,
            SPECIFIED: specifiedCount,
            ACTIVE_CLIENT: activeClientCount,
          },
          activeCoaches,
        },
        engagement: {
          workoutsCompletedLast7Days,
        },
        revenue: {
          estimatedMrrCents,
          activeClientCount,
          pricePerClientCents,
        },
        generatedAt: new Date().toISOString(),
      };

      res.json({ success: true, data });
    } catch (error) {
      console.error('Admin analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching admin analytics',
      });
    }
  }
);

export interface AdminBillingStatusPayload {
  stripeConfigured: boolean;
  checkoutReady: boolean;
  mode: 'test' | 'live' | 'disabled';
  webhookHealthy: boolean;
  dashboardUrl: string;
  lastWebhookReceivedAt: string | null;
  lastWebhookEventType: string | null;
}

/**
 * GET /api/admin/billing/status
 * SUPER_ADMIN — Stripe connection readiness (no live Stripe API calls).
 */
router.get(
  '/billing/status',
  auth,
  authorizeRoles('SUPER_ADMIN'),
  async (_req: Request, res: Response) => {
    const webhookInfo = await getLastWebhookInfo();
    const receivedAt = webhookInfo.receivedAt ? new Date(webhookInfo.receivedAt) : null;
    const webhookHealthy =
      isStripeConfigured() &&
      receivedAt !== null &&
      Date.now() - receivedAt.getTime() < 7 * 24 * 60 * 60 * 1000;

    const data: AdminBillingStatusPayload = {
      stripeConfigured: isStripeConfigured(),
      checkoutReady: isStripeCheckoutReady(),
      mode: getStripeMode(),
      webhookHealthy,
      dashboardUrl: getStripeDashboardUrl(),
      lastWebhookReceivedAt: webhookInfo.receivedAt,
      lastWebhookEventType: webhookInfo.eventType,
    };

    res.json({ success: true, data });
  }
);

/**
 * PATCH /api/admin/users/:userId/athlete-designation
 * SUPER_ADMIN — assign individual elite-track designation for private clients.
 */
router.patch(
  '/users/:userId/athlete-designation',
  auth,
  authorizeRoles('SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { athleteDesignation } = req.body ?? {};

      const allowed = ['none', 'pro', 'collegiate', 'semi-pro', 'independent_hs'];
      if (typeof athleteDesignation !== 'string' || !allowed.includes(athleteDesignation)) {
        return res.status(400).json({
          success: false,
          message: `athleteDesignation must be one of: ${allowed.join(', ')}`,
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            athleteDesignation,
            // Clear legacy flag when designation is explicitly set
            isProAthlete: athleteDesignation !== 'none',
          },
        },
        { new: true, runValidators: true }
      ).select('_id email athleteDesignation profile.firstName profile.lastName');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const label =
        athleteDesignation === 'none'
          ? 'Everyday Fitness track'
          : `${athleteDesignation} elite combine access`;

      res.json({
        success: true,
        message: `User assigned to ${label}`,
        data: user,
      });
    } catch (error) {
      console.error('Athlete designation update error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating athlete designation',
      });
    }
  }
);

export default router;
