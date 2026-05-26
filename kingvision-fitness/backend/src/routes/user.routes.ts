import express, { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Group from '../models/Group';
import { auth, authorizeRoles } from '../middleware/auth';
import {
  calculatePerformanceGrade,
  AthleteStats,
} from '../utils/performanceScoring';
import { buildStatHistoryEntries } from '../utils/statAudit';
import type { IAthleteStats } from '../models/User';

const router: Router = express.Router();

// ─── Athlete-stats helpers ────────────────────────────────────────────────

const ATHLETE_STAT_FIELDS: ReadonlyArray<keyof AthleteStats> = [
  'bodyWeight',
  'height',
  'squatMax',
  'benchMax',
  'deadliftMax',
  'pushUpCount',
  'sitUpCount',
  'fortyYardDash',
];

/** Plausible ranges so a fat-fingered "1000 lb bench" doesn't poison the grade. */
const STAT_BOUNDS: Record<keyof AthleteStats, { min: number; max: number }> = {
  bodyWeight: { min: 50, max: 500 },
  height: { min: 36, max: 96 },
  squatMax: { min: 0, max: 1500 },
  benchMax: { min: 0, max: 1000 },
  deadliftMax: { min: 0, max: 1500 },
  pushUpCount: { min: 0, max: 500 },
  sitUpCount: { min: 0, max: 500 },
  fortyYardDash: { min: 3.5, max: 12 },
};

/**
 * Pull only the known stat fields from an arbitrary payload and coerce them
 * to numbers. Returns `{ stats, errors }` so the caller can 400 on bad input
 * instead of silently storing garbage.
 */
function parseAthleteStatsPayload(body: any): {
  stats: AthleteStats;
  errors: string[];
} {
  const stats: AthleteStats = {};
  const errors: string[] = [];

  for (const field of ATHLETE_STAT_FIELDS) {
    const raw = body?.[field];
    if (raw === undefined || raw === null || raw === '') continue;

    const num = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      errors.push(`${field} must be a finite number`);
      continue;
    }

    const { min, max } = STAT_BOUNDS[field];
    if (num < min || num > max) {
      errors.push(`${field} must be between ${min} and ${max}`);
      continue;
    }

    stats[field] = num;
  }

  return { stats, errors };
}

// @route   GET /api/users/active-clients
// @desc    List ACTIVE_CLIENT tier users for custom workout assignment
// @access  Private — SUPER_ADMIN | TRAINER
router.get(
  '/active-clients',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const clients = await User.find({ subscriptionTier: 'ACTIVE_CLIENT' })
        .select('_id email profile.firstName profile.lastName')
        .sort({ 'profile.lastName': 1, 'profile.firstName': 1 })
        .lean();

      res.json({
        success: true,
        data: clients.map((client) => ({
          _id: client._id,
          email: client.email,
          firstName: client.profile?.firstName ?? '',
          lastName: client.profile?.lastName ?? '',
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching active clients',
      });
    }
  }
);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req: any, res: any) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req: any, res: any) => {
  try {
    // TODO: Implement profile update
    res.json({
      success: true,
      message: 'Update profile endpoint',
      data: req.body
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @route   GET /api/users/me/athlete-stats
// @desc    Return this athlete's stored combine measurements + cached grade.
// @access  Private
router.get('/me/athlete-stats', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id)
      .select('athleteStats')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stats = user.athleteStats ?? {};
    return res.json({
      success: true,
      data: {
        bodyWeight: stats.bodyWeight ?? null,
        height: stats.height ?? null,
        squatMax: stats.squatMax ?? null,
        benchMax: stats.benchMax ?? null,
        deadliftMax: stats.deadliftMax ?? null,
        pushUpCount: stats.pushUpCount ?? null,
        sitUpCount: stats.sitUpCount ?? null,
        fortyYardDash: stats.fortyYardDash ?? null,
        performanceGrade: stats.performanceGrade ?? 0,
        performanceBreakdown: stats.performanceBreakdown ?? null,
        statHistory: stats.statHistory ?? [],
        lastUpdatedAt: stats.lastUpdatedAt ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching athlete stats',
    });
  }
});

// @route   PUT /api/users/me/athlete-stats
// @desc    Submit / update an athlete's combine measurements. Recomputes the
//          performance grade and fans the cached grade out to every athletic
//          team this user belongs to.
// @access  Private
router.put('/me/athlete-stats', auth, async (req: any, res: any) => {
  try {
    const { stats: incoming, errors } = parseAthleteStatsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid athlete stats payload',
        errors,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Merge so a partial PUT only updates the supplied fields. Athletes can
    // submit their bench today and their 40 next week.
    const currentStats = (user.get('athleteStats') ?? {}) as IAthleteStats;
    const current: AthleteStats = currentStats;
    const merged: AthleteStats = { ...current, ...incoming };
    const existingHistory = currentStats.statHistory ?? [];

    const statHistory = buildStatHistoryEntries(current, merged, existingHistory);
    const breakdown = calculatePerformanceGrade(merged);

    user.set('athleteStats', {
      ...merged,
      performanceGrade: breakdown.overall,
      performanceBreakdown: breakdown,
      statHistory,
      lastUpdatedAt: new Date(),
    });
    await user.save();

    // Fan the cached grade out to every athletic-team membership so the
    // team leaderboard stays fresh without a recomputation pass per request.
    const userId = new mongoose.Types.ObjectId(String(user._id));
    await Group.updateMany(
      {
        groupType: 'athletic_team',
        'memberships.user': userId,
      },
      {
        $set: {
          'memberships.$[m].performanceGrade': breakdown.overall,
          'memberships.$[m].performanceBreakdown': breakdown,
          'memberships.$[m].lastGradedAt': new Date(),
        },
      },
      { arrayFilters: [{ 'm.user': userId }] }
    );

    return res.json({
      success: true,
      data: {
        bodyWeight: merged.bodyWeight ?? null,
        height: merged.height ?? null,
        squatMax: merged.squatMax ?? null,
        benchMax: merged.benchMax ?? null,
        deadliftMax: merged.deadliftMax ?? null,
        pushUpCount: merged.pushUpCount ?? null,
        sitUpCount: merged.sitUpCount ?? null,
        fortyYardDash: merged.fortyYardDash ?? null,
        performanceGrade: breakdown.overall,
        performanceBreakdown: breakdown,
        statHistory,
        lastUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating athlete stats',
    });
  }
});

// @route   POST /api/users/me/athlete-stats/preview
// @desc    Stateless grade preview — lets the frontend show a live score as
//          the athlete edits fields, without committing the change.
// @access  Private
router.post('/me/athlete-stats/preview', auth, async (req: any, res: any) => {
  try {
    const { stats, errors } = parseAthleteStatsPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid athlete stats payload',
        errors,
      });
    }

    const breakdown = calculatePerformanceGrade(stats);
    return res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error previewing athlete stats',
    });
  }
});

// @route   POST /api/users/progress
// @desc    Log progress entry
// @access  Private
router.post('/progress', auth, async (req: any, res: any) => {
  try {
    // TODO: Implement progress logging
    res.json({
      success: true,
      message: 'Log progress endpoint',
      data: req.body
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging progress'
    });
  }
});

// @route   GET /api/users/progress
// @desc    Get progress history
// @access  Private
router.get('/progress', auth, async (req: any, res: any) => {
  try {
    // TODO: Implement progress history retrieval
    res.json({
      success: true,
      message: 'Progress history endpoint',
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching progress history'
    });
  }
});

export default router;