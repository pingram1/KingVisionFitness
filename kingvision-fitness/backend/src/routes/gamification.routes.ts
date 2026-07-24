import express, { Router } from 'express';
import { auth } from '../middleware/auth';
import User from '../models/User';
import {
  calculateUserConsistency,
  logAppSession,
  logNutritionVerification,
  nextTierProgress,
  resolveTimezone,
  tierRule,
} from '../utils/consistencyEngine';

const router: Router = express.Router();

/** Single foreground session cap — anything above this is clock-drift noise. */
const MAX_SESSION_MINUTES = 240;

function readTimezoneHeader(req: { headers: Record<string, unknown> }): string | undefined {
  const preferred = req.headers['x-user-timezone'];
  if (typeof preferred === 'string' && preferred.trim().length > 0) {
    return preferred.trim();
  }
  const legacy = req.headers['x-timezone'];
  return typeof legacy === 'string' && legacy.trim().length > 0 ? legacy.trim() : undefined;
}

async function resolveRequestTimezone(
  userId: string,
  headerTimezone?: string
): Promise<string> {
  const user = await User.findById(userId).select('settings.timezone').lean();
  return resolveTimezone(user?.settings?.timezone, headerTimezone);
}

function formatEvaluationPayload(
  evaluation: Awaited<ReturnType<typeof calculateUserConsistency>>
) {
  const progress = nextTierProgress(
    evaluation.tier,
    evaluation.pillarBreakdown.overallScore,
    evaluation.tierProgression
  );
  const rule = tierRule(evaluation.tier);

  return {
    currentTier: evaluation.tier,
    badgeLabel: evaluation.badgeLabel,
    rollingConsistencyScore: evaluation.pillarBreakdown.overallScore,
    pillarBreakdown: evaluation.pillarBreakdown,
    currentStreakDays: evaluation.currentStreakDays,
    pillarMetrics: evaluation.pillarMetrics,
    maintenanceFloor: rule.maintenanceFloor,
    nextTier: progress.nextTier,
    nextTierThreshold: progress.nextTierThreshold,
    nextTierProgressPercent: progress.progressPercent,
    tierProgression: evaluation.tierProgression,
    verificationDaysRequired: progress.verificationDaysRequired,
    verificationDaysCompleted: progress.verificationDaysCompleted,
    minimumStreakRequired: progress.minimumStreakRequired,
    promoted: evaluation.promoted,
    demoted: evaluation.demoted,
    lastEvaluatedAt: evaluation.lastEvaluatedAt,
  };
}

// @route   GET /api/gamification/status
// @desc    Current tier, rolling pillar metrics, streak, and next-tier progress.
//          Always recomputes so pillarBreakdown and rollingConsistencyScore stay
//          in sync on pull-to-refresh and screen focus.
// @access  Private
router.get('/status', auth, async (req: any, res: any) => {
  try {
    const timeZone = await resolveRequestTimezone(
      req.user._id,
      readTimezoneHeader(req)
    );
    const evaluation = await calculateUserConsistency(req.user._id, {
      force: true,
      timeZone,
    });

    return res.json({
      success: true,
      data: formatEvaluationPayload(evaluation),
    });
  } catch (error) {
    console.error('Gamification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consistency status',
    });
  }
});

// @route   POST /api/gamification/log-session
// @desc    Record foreground app-usage minutes from the mobile lifecycle, then
//          immediately recompute consistency + streak so the UI stays in sync.
// @access  Private
router.post('/log-session', auth, async (req: any, res: any) => {
  try {
    const { minutes, nutritionCompliant } = req.body ?? {};

    const parsed = typeof minutes === 'string' ? Number(minutes) : minutes;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'minutes must be a positive number',
      });
    }
    if (parsed > MAX_SESSION_MINUTES) {
      return res.status(400).json({
        success: false,
        message: `minutes cannot exceed ${MAX_SESSION_MINUTES} per session`,
      });
    }
    if (nutritionCompliant !== undefined && typeof nutritionCompliant !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'nutritionCompliant must be a boolean when provided',
      });
    }

    if (nutritionCompliant === true) {
      const userDoc = await User.findById(req.user._id).select('mealPlans').lean();
      if (!userDoc?.mealPlans?.length) {
        return res.status(400).json({
          success: false,
          message: 'nutritionCompliant requires an assigned meal plan on your account',
        });
      }
    }

    const timeZone = await resolveRequestTimezone(
      req.user._id,
      readTimezoneHeader(req)
    );

    const entry = await logAppSession(
      req.user._id,
      parsed,
      nutritionCompliant,
      timeZone
    );

    const evaluation = await calculateUserConsistency(req.user._id, {
      force: true,
      timeZone,
    });

    return res.status(201).json({
      success: true,
      message: 'Session logged',
      data: {
        date: entry.date,
        minutesToday: entry.minutes,
        nutritionCompliant: entry.nutritionCompliant,
        consistency: formatEvaluationPayload(evaluation),
      },
    });
  } catch (error) {
    console.error('Gamification log-session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging app session',
    });
  }
});

// @route   POST /api/gamification/verify-nutrition
// @desc    Submit macro logs (+ optional meal photo URL and notes) for today,
//          then immediately recompute consistency for live UI feedback.
// @access  Private
router.post('/verify-nutrition', auth, async (req: any, res: any) => {
  try {
    const { macrosLogged, imageUrl, notes } = req.body ?? {};

    if (!macrosLogged || typeof macrosLogged !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'macrosLogged is required with calories, carbs, protein, and fats',
      });
    }

    const timeZone = await resolveRequestTimezone(
      req.user._id,
      readTimezoneHeader(req)
    );

    let entry;
    try {
      entry = await logNutritionVerification(
        req.user._id,
        {
          macrosLogged,
          imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
          notes: typeof notes === 'string' ? notes : undefined,
        },
        timeZone
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_MACROS') {
        return res.status(400).json({
          success: false,
          message:
            'macrosLogged must include non-negative numbers for calories, carbs, protein, and fats',
        });
      }
      throw error;
    }

    const evaluation = await calculateUserConsistency(req.user._id, {
      force: true,
      timeZone,
    });

    return res.status(201).json({
      success: true,
      message: 'Nutrition day verified',
      data: {
        date: entry.date,
        nutritionVerification: entry.nutritionVerification,
        consistency: formatEvaluationPayload(evaluation),
      },
    });
  } catch (error) {
    console.error('Gamification verify-nutrition error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying nutrition day',
    });
  }
});

export default router;
