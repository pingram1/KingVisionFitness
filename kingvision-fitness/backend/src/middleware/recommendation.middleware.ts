import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Workout from '../models/Workout';
import User from '../models/User';
import type { Request } from 'express';
import type { SubscriptionTier } from '../models/User';
import {
  gatherEngagementSamples,
  centroidFromEngagements,
  workoutToFeatureVector,
  cosineSimilarity,
  DEFAULT_VECTOR_DIM,
} from '../services/planRecommendation.service';


declare global {
  namespace Express {
    interface Request {
      /** Set by relevance middleware — client can surface disclosure UI */
      planRelevance?: {
        similarity: number;
        passesRelevance: boolean;
      };
    }
  }
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  BASIC: 1,
  SPECIFIED: 2,
  ACTIVE_CLIENT: 3,
};

export function requireRecommendationTier(minimum: SubscriptionTier) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authenticate first' });
    }
    const tier = (req.user.subscriptionTier ||
      'BASIC') as SubscriptionTier;
    const userRank = TIER_ORDER[tier] ?? 1;
    const needRank = TIER_ORDER[minimum] ?? 1;
    if (userRank < needRank) {
      return res.status(403).json({
        success: false,
        message: 'Subscription tier insufficient for recommendations',
      });
    }
    return next();
  };
}

/** Permission: workout is readable if public, created by user, or assigned to user. */
async function workoutVisibleToUser(
  workoutId: string,
  userId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const w = await Workout.findById(workoutId).select(
    'isPublic assignedTo createdBy'
  ).lean();
  if (!w) return false;
  const uid = userId.toString();
  if (w.isPublic) return true;
  if (String(w.createdBy) === uid) return true;
  if (Array.isArray(w.assignedTo) && w.assignedTo.some((x) => String(x) === uid)) {
    return true;
  }
  return false;
}

/**
 * Relevance gate: cosine similarity vs user centroid must exceed tier-specific floor.
 */
export async function attachWorkoutRecommendationRelevance(
  req: Request,
  workoutIdFromParam: string
): Promise<void> {
  if (!req.user) return;

  const user = await User.findById(req.user._id).select(
    'subscriptionTier mlProfile'
  ).lean();
  if (!user) return;

  const tier = user.subscriptionTier as SubscriptionTier;

  const minByTier: Record<SubscriptionTier, number> = {
    BASIC: 0.42,
    SPECIFIED: 0.34,
    ACTIVE_CLIENT: 0.25,
  };
  const minSim = minByTier[tier] ?? 0.42;

  const [samples, workout] = await Promise.all([
    gatherEngagementSamples(req.user._id as mongoose.Types.ObjectId),
    Workout.findById(workoutIdFromParam).lean(),
  ]);

  if (!workout || !samples.length) {
    req.planRelevance = { similarity: 0, passesRelevance: tier === 'ACTIVE_CLIENT' };
    return;
  }

  const { vector: cen } = centroidFromEngagements(samples, DEFAULT_VECTOR_DIM);
  let centroid: number[] = [...cen];
  if (
    centroid.every((x: number) => x === 0) &&
    Array.isArray(user.mlProfile?.similarityVector) &&
    user.mlProfile!.similarityVector!.length === DEFAULT_VECTOR_DIM
  ) {
    centroid = [...user.mlProfile!.similarityVector!];
  }

  let centroidForScore = [...centroid];
  const dim = DEFAULT_VECTOR_DIM;
  if ((user.mlProfile as any)?.similarityVector?.length === dim) {
    const blend = [...(user.mlProfile as any).similarityVector];
    centroidForScore = centroidForScore.map((c, i) => 0.5 * (c + (blend[i] || 0)));
  }

  const wVec = workoutToFeatureVector(workout as any);
  const similarity =
    cosineSimilarity(centroidForScore, wVec) * (0.75 + ((user.mlProfile as any)?.adherenceRate ?? 0.5) * 0.25);

  req.planRelevance = {
    similarity,
    passesRelevance: similarity >= minSim,
  };
}

/**
 * Full stack: authorization (visibility) + ML relevance envelope (non-blocking advisory by default).
 * Set STRICT_PLAN_GATES=true to 403 responses when similarity is weak.
 */
export function gateWorkoutWithRelevance(options: {
  workoutIdParam?: string;
  strict?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authenticate first' });
      }
      const id =
        req.params?.[options.workoutIdParam || 'workoutId'] ||
        req.params?.id ||
        '';
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid workout id' });
      }
      const permitted = await workoutVisibleToUser(id, req.user._id);
      if (!permitted) {
        return res.status(403).json({ success: false, message: 'Not allowed to view this plan' });
      }
      await attachWorkoutRecommendationRelevance(req, id);
      if (options.strict && process.env.STRICT_PLAN_GATES === 'true' && !req.planRelevance?.passesRelevance) {
        return res.status(403).json({
          success: false,
          message: 'Recommendation relevance below threshold — try refreshing your weekly plan.',
          similarity: req.planRelevance?.similarity ?? 0,
        });
      }
      return next();
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Recommendation gate failed',
      });
    }
  };
}
