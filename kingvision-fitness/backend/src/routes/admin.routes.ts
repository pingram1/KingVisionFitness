import express, { Request, Response, Router } from 'express';
import { auth, authorizeRoles } from '../middleware/auth';
import User from '../models/User';
import WorkoutSession from '../models/WorkoutSession';
import { TIER_CATALOG } from '../config/tierCatalog';

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

export default router;
