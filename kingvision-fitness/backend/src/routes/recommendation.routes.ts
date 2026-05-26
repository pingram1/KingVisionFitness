import express, { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRecommendationTier } from '../middleware/recommendation.middleware';
import {
  PlanRecommendationService,
  hydratePriorEngagementsFromHistory,
} from '../services/planRecommendation.service';

const router: Router = express.Router();

// @route   GET /api/recommendations/weekly-workouts
// @desc    Weekly workout suggestions fused with tier-aware similarity + residual history
router.get('/weekly-workouts', auth, requireRecommendationTier('BASIC'), async (req: any, res) => {
  try {
    if (req.query.hydrate === 'true') {
      if (req.user.subscriptionTier !== 'ACTIVE_CLIENT') {
        await hydratePriorEngagementsFromHistory(req.user._id, 35);
      }
    }

    const weekParsed =
      req.query.weekNumber !== undefined && req.query.weekNumber !== ''
        ? parseInt(String(req.query.weekNumber), 10)
        : undefined;
    if (
      typeof weekParsed === 'number' &&
      (!Number.isFinite(weekParsed) || weekParsed < 1 || weekParsed > 53)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid weekNumber' });
    }

    const slotsParsed =
      req.query.slots !== undefined && req.query.slots !== ''
        ? parseInt(String(req.query.slots), 10)
        : NaN;

    const svc = new PlanRecommendationService();
    const result = await svc.suggestWeeklyWorkouts({
      userId: req.user._id,
      weekNumber:
        typeof weekParsed === 'number' && Number.isFinite(weekParsed) ? weekParsed : undefined,
      slots: Number.isFinite(slotsParsed) && slotsParsed > 0 ? Math.min(slotsParsed, 14) : undefined,
    });

    res.status(200).json({
      success: true,
      data: {
        tier: result.tier,
        externalMlUsed: result.externalMlUsed,
        centroid: result.centroid,
        workouts: result.weeklyWorkouts.map((row) => ({
          similarity: Number(row.similarity.toFixed(4)),
          passesRelevanceGate: row.passesRelevance,
          workout: row.workout,
        })),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Recommendation failed';
    if (message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message });
  }
});

export default router;
