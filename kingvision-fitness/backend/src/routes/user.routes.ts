import express, { Router } from 'express';
import User from '../models/User';
import Group from '../models/Group';
import { auth, authorizeRoles } from '../middleware/auth';
import {
  calculatePerformanceGrade,
} from '../utils/performanceScoring';
import { parseAthleteStatsPayload } from '../utils/athleteStatsPayload';
import { parseEverydayStatsPayload, parseBodyWeightLbs } from '../utils/everydayStatsPayload';
import { applyAthleteStatsUpdate } from '../services/athleteStats.service';
import {
  applyEverydayStatsUpdate,
  calculateEverydayFitnessScore,
  resolveBodyWeightLbs,
} from '../services/everydayStats.service';
import {
  ATHLETIC_TRACK_EVERYDAY_FORBIDDEN_MESSAGE,
  EVERYDAY_TRACK_FORBIDDEN_MESSAGE,
  isAthleticTrackEligible,
} from '../utils/fitnessTrack';

const router: Router = express.Router();

async function loadUserForTrackGuard(userId: string) {
  const user = await User.findById(userId)
    .select('groupMemberships athleteDesignation profile.initialWeight athleteStats.bodyWeight')
    .lean();

  if (!user?.groupMemberships?.length) return user;

  const groupIds = user.groupMemberships.map((m) => m.group);
  const athleticGroups = await Group.find({
    _id: { $in: groupIds },
    groupType: 'athletic_team',
  })
    .select('_id')
    .lean();
  const athleticGroupIds = new Set(athleticGroups.map((g) => String(g._id)));

  return {
    ...user,
    groupMemberships: user.groupMemberships.filter((m) =>
      athleticGroupIds.has(String(m.group))
    ),
  };
}

function formatEverydayStatsResponse(stats: {
  pushUpsMax?: number | null;
  pullUpsMax?: number | null;
  sitUpsMax?: number | null;
  curlsWeight?: number | null;
  curlsReps?: number | null;
  plankSeconds?: number | null;
  burpeesCount?: number | null;
  everydayFitnessScore?: number | null;
  lastUpdated?: Date | null;
  bodyWeightLbs?: number | null;
}) {
  return {
    pushUpsMax: stats.pushUpsMax ?? null,
    pullUpsMax: stats.pullUpsMax ?? null,
    sitUpsMax: stats.sitUpsMax ?? null,
    curlsWeight: stats.curlsWeight ?? null,
    curlsReps: stats.curlsReps ?? null,
    plankSeconds: stats.plankSeconds ?? null,
    burpeesCount: stats.burpeesCount ?? null,
    bodyWeightLbs: stats.bodyWeightLbs ?? null,
    everydayFitnessScore: stats.everydayFitnessScore ?? 0,
    lastUpdated: stats.lastUpdated ?? null,
  };
}

// ─── Athlete-stats helpers ────────────────────────────────────────────────

// @route   GET /api/users/active-clients
// @desc    List ACTIVE_CLIENT tier users for custom workout assignment
// @access  Private — SUPER_ADMIN only (interim until per-trainer scoping)
router.get(
  '/active-clients',
  auth,
  authorizeRoles('SUPER_ADMIN'),
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
// @desc    Update user profile (name, contact, bio, fitness level)
// @access  Private
router.put('/profile', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { firstName, lastName, phone, bio, fitnessLevel } = req.body ?? {};
    const errors: string[] = [];

    if (firstName !== undefined) {
      const value = String(firstName).trim();
      if (!value) errors.push('First name cannot be empty');
      else if (value.length > 50) errors.push('First name cannot exceed 50 characters');
      else user.profile.firstName = value;
    }

    if (lastName !== undefined) {
      const value = String(lastName).trim();
      if (!value) errors.push('Last name cannot be empty');
      else if (value.length > 50) errors.push('Last name cannot exceed 50 characters');
      else user.profile.lastName = value;
    }

    if (phone !== undefined) {
      const cleared = phone === null || phone === '';
      if (cleared) {
        user.profile.phone = undefined;
      } else {
        const value = String(phone).trim();
        if (value.length > 20) errors.push('Phone cannot exceed 20 characters');
        else user.profile.phone = value;
      }
    }

    if (bio !== undefined) {
      const value = bio === null ? '' : String(bio).trim();
      if (value.length > 500) errors.push('Bio cannot exceed 500 characters');
      else user.profile.bio = value;
    }

    if (fitnessLevel !== undefined) {
      const allowed = ['beginner', 'intermediate', 'advanced'];
      if (!allowed.includes(fitnessLevel)) {
        errors.push('fitnessLevel must be beginner, intermediate, or advanced');
      } else {
        user.profile.fitnessLevel = fitnessLevel;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated',
      data: user,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Profile validation failed',
        errors: Object.values(error.errors).map((e: any) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
    });
  }
});

// @route   GET /api/users/me/athlete-stats
// @desc    Return this athlete's stored combine measurements + cached grade.
// @access  Private — team athletes, captains, or individual elite clients
router.get('/me/athlete-stats', auth, async (req: any, res: any) => {
  try {
    const trackUser = await loadUserForTrackGuard(req.user._id);
    if (!trackUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!isAthleticTrackEligible(trackUser)) {
      return res.status(403).json({
        success: false,
        message: EVERYDAY_TRACK_FORBIDDEN_MESSAGE,
      });
    }

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
// @access  Private — team athletes, captains, or individual elite clients
router.put('/me/athlete-stats', auth, async (req: any, res: any) => {
  try {
    const trackUser = await loadUserForTrackGuard(req.user._id);
    if (!trackUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!isAthleticTrackEligible(trackUser)) {
      return res.status(403).json({
        success: false,
        message: EVERYDAY_TRACK_FORBIDDEN_MESSAGE,
      });
    }

    const { stats: incoming, errors } = parseAthleteStatsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid athlete stats payload',
        errors,
      });
    }

    const applied = await applyAthleteStatsUpdate(req.user._id, incoming);

    return res.json({
      success: true,
      data: {
        bodyWeight: applied.bodyWeight,
        height: applied.height,
        squatMax: applied.squatMax,
        benchMax: applied.benchMax,
        deadliftMax: applied.deadliftMax,
        pushUpCount: applied.pushUpCount,
        sitUpCount: applied.sitUpCount,
        fortyYardDash: applied.fortyYardDash,
        performanceGrade: applied.performanceGrade,
        performanceBreakdown: applied.performanceBreakdown,
        statHistory: applied.statHistory,
        lastUpdatedAt: applied.lastUpdatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating athlete stats',
    });
  }
});

// @route   POST /api/users/me/athlete-stats/preview
// @desc    Stateless grade preview — lets the frontend show a live score as
//          the athlete edits fields, without committing the change.
// @access  Private — team athletes, captains, or individual elite clients
router.post('/me/athlete-stats/preview', auth, async (req: any, res: any) => {
  try {
    const trackUser = await loadUserForTrackGuard(req.user._id);
    if (!trackUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!isAthleticTrackEligible(trackUser)) {
      return res.status(403).json({
        success: false,
        message: EVERYDAY_TRACK_FORBIDDEN_MESSAGE,
      });
    }

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

// @route   GET /api/users/me/everyday-stats
// @desc    Return this user's Everyday Client Fitness Test log + wellness score.
// @access  Private — all authenticated users (no subscription-tier gate)
router.get('/me/everyday-stats', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id)
      .select('everydayFitnessStats profile.initialWeight athleteStats.bodyWeight progressTracking')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stats = user.everydayFitnessStats ?? {};
    const bodyWeightLbs = resolveBodyWeightLbs(user) ?? null;
    return res.json({
      success: true,
      data: formatEverydayStatsResponse({ ...stats, bodyWeightLbs }),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching everyday fitness stats',
    });
  }
});

// @route   PUT /api/users/me/everyday-stats
// @desc    Submit / update everyday fitness measurements. Partial updates allowed.
// @access  Private — non-athletic track users only
router.put('/me/everyday-stats', auth, async (req: any, res: any) => {
  try {
    const trackUser = await loadUserForTrackGuard(req.user._id);
    if (!trackUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (isAthleticTrackEligible(trackUser)) {
      return res.status(403).json({
        success: false,
        message: ATHLETIC_TRACK_EVERYDAY_FORBIDDEN_MESSAGE,
      });
    }

    const { stats: incoming, errors } = parseEverydayStatsPayload(req.body);
    const { bodyWeightLbs: incomingBodyWeight, errors: weightErrors } = parseBodyWeightLbs(req.body);
    errors.push(...weightErrors);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid everyday stats payload',
        errors,
      });
    }

    if (Object.keys(incoming).length === 0 && incomingBodyWeight === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one stat field to update',
      });
    }

    const applied = await applyEverydayStatsUpdate(req.user._id, incoming, {
      bodyWeightLbs: incomingBodyWeight,
    });

    return res.json({
      success: true,
      data: formatEverydayStatsResponse(applied),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating everyday fitness stats',
    });
  }
});

// @route   POST /api/users/me/everyday-stats/preview
// @desc    Stateless wellness score preview for live UI updates.
// @access  Private — non-athletic track users only
router.post('/me/everyday-stats/preview', auth, async (req: any, res: any) => {
  try {
    const trackUser = await loadUserForTrackGuard(req.user._id);
    if (!trackUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (isAthleticTrackEligible(trackUser)) {
      return res.status(403).json({
        success: false,
        message: ATHLETIC_TRACK_EVERYDAY_FORBIDDEN_MESSAGE,
      });
    }

    const { stats, errors } = parseEverydayStatsPayload(req.body);
    const { bodyWeightLbs: previewBodyWeight, errors: weightErrors } = parseBodyWeightLbs(req.body);
    errors.push(...weightErrors);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid everyday stats payload',
        errors,
      });
    }

    const user = await User.findById(req.user._id)
      .select('everydayFitnessStats profile.initialWeight athleteStats.bodyWeight progressTracking')
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const current = user.everydayFitnessStats ?? {};
    const merged = {
      pushUpsMax: stats.pushUpsMax ?? current.pushUpsMax,
      pullUpsMax: stats.pullUpsMax ?? current.pullUpsMax,
      sitUpsMax: stats.sitUpsMax ?? current.sitUpsMax,
      curlsWeight: stats.curlsWeight ?? current.curlsWeight,
      curlsReps: stats.curlsReps ?? current.curlsReps,
      plankSeconds: stats.plankSeconds ?? current.plankSeconds,
      burpeesCount: stats.burpeesCount ?? current.burpeesCount,
    };

    const bodyWeightLbs = resolveBodyWeightLbs(user, previewBodyWeight);
    const breakdown = calculateEverydayFitnessScore(merged, bodyWeightLbs);
    return res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error previewing everyday fitness stats',
    });
  }
});

// @route   GET /api/users/me/fitness-track
// @desc    Which biometric track this user belongs on (athletic vs everyday).
// @access  Private
router.get('/me/fitness-track', auth, async (req: any, res: any) => {
  try {
    const user = await loadUserForTrackGuard(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const athletic = isAthleticTrackEligible(user);
    return res.json({
      success: true,
      data: {
        track: athletic ? 'athletic' : 'everyday',
        athleteDesignation: user.athleteDesignation ?? 'none',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resolving fitness track',
    });
  }
});

type BodyMeasurements = {
  chest?: number;
  waist?: number;
  hips?: number;
  thighs?: number;
  arms?: number;
};

const MEASUREMENT_BOUNDS: Record<keyof BodyMeasurements, { min: number; max: number }> = {
  chest: { min: 10, max: 80 },
  waist: { min: 10, max: 80 },
  hips: { min: 10, max: 80 },
  thighs: { min: 10, max: 40 },
  arms: { min: 5, max: 30 },
};

function parseBodyMeasurements(raw: unknown): { measurements?: BodyMeasurements; errors: string[] } {
  const errors: string[] = [];
  if (raw == null || typeof raw !== 'object') {
    return { measurements: undefined, errors };
  }
  const measurements: BodyMeasurements = {};
  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(MEASUREMENT_BOUNDS) as Array<keyof BodyMeasurements>) {
    const value = source[key];
    if (value === undefined || value === null || value === '') continue;
    const num = typeof value === 'string' ? Number(value) : value;
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      errors.push(`${key} must be a number`);
      continue;
    }
    const { min, max } = MEASUREMENT_BOUNDS[key];
    if (num < min || num > max) {
      errors.push(`${key} must be between ${min} and ${max} inches`);
      continue;
    }
    measurements[key] = num;
  }
  return {
    measurements: Object.keys(measurements).length > 0 ? measurements : undefined,
    errors,
  };
}

// @route   PUT /api/users/push-token
// @desc    Register Expo push token for mobile alerts
// @access  Private
router.put('/push-token', auth, async (req: any, res: any) => {
  try {
    const { expoPushToken } = req.body ?? {};
    if (typeof expoPushToken !== 'string' || !expoPushToken.trim()) {
      return res.status(400).json({ success: false, message: 'expoPushToken is required' });
    }
    const token = expoPushToken.trim();
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return res.status(400).json({ success: false, message: 'Invalid Expo push token format' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.expoPushToken = token;
    await user.save();

    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('Push token registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering push token' });
  }
});

// @route   DELETE /api/users/push-token
// @desc    Clear Expo push token (e.g. on logout)
// @access  Private
router.delete('/push-token', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.expoPushToken = undefined;
    await user.save();
    res.json({ success: true, message: 'Push token cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing push token' });
  }
});

// @route   POST /api/users/progress
// @desc    Log progress entry
// @access  Private
router.post('/progress', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const errors: string[] = [];
    const entry: {
      date: Date;
      weight?: number;
      bodyMeasurements?: Record<string, number>;
      notes?: string;
    } = { date: new Date() };

    if (req.body?.weight !== undefined && req.body?.weight !== null && req.body?.weight !== '') {
      const weight = Number(req.body.weight);
      if (!Number.isFinite(weight) || weight < 50 || weight > 500) {
        errors.push('weight must be between 50 and 500 lbs');
      } else {
        entry.weight = weight;
      }
    }

    const { measurements, errors: measureErrors } = parseBodyMeasurements(req.body?.bodyMeasurements);
    errors.push(...measureErrors);
    if (measurements) entry.bodyMeasurements = measurements;

    if (req.body?.notes !== undefined && req.body?.notes !== null) {
      const notes = String(req.body.notes).trim();
      if (notes.length > 500) errors.push('notes cannot exceed 500 characters');
      else if (notes) entry.notes = notes;
    }

    if (!entry.weight && !entry.bodyMeasurements && !entry.notes) {
      errors.push('Provide at least weight, a body measurement, or notes');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    user.progressTracking.push(entry as never);
    await user.save();

    const created = user.progressTracking[user.progressTracking.length - 1];

    res.status(201).json({
      success: true,
      message: 'Progress logged',
      data: created,
    });
  } catch (error) {
    console.error('Progress log error:', error);
    res.status(500).json({ success: false, message: 'Error logging progress' });
  }
});

// @route   GET /api/users/progress
// @desc    Get progress history
// @access  Private
router.get('/progress', auth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id).select('progressTracking').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const limitRaw = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

    const history = [...(user.progressTracking ?? [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Progress history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching progress history' });
  }
});

export default router;