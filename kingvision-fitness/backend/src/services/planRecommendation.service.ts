import mongoose from 'mongoose';
import User from '../models/User';
import Workout from '../models/Workout';
import type { IWorkout } from '../models/Workout';
import type { SubscriptionTier } from '../models/User';
import { env } from '../config/env';
import { invokeSageMakerWeeklyPlan } from './mlInference.stub';

export const DEFAULT_VECTOR_DIM = 16;

type WorkoutVectorInput = Pick<IWorkout, 'metaTags' | 'duration' | 'difficulty' | 'type'> & {
  exercises?: unknown[] | null;
};

/** Map workout + user context into a fixed-length feature vector for similarity */
export function workoutToFeatureVector(w: WorkoutVectorInput): number[] {
  const m = w.metaTags;
  const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 8;
  const diff =
    w.difficulty === 'beginner' ? 0.25 : w.difficulty === 'intermediate' ? 0.55 : 0.85;
  const typeHue =
    w.type === 'strength'
      ? 0.15
      : w.type === 'cardio'
        ? 0.35
        : w.type === 'hiit'
          ? 0.55
          : w.type === 'flexibility'
            ? 0.72
            : w.type === 'functional'
              ? 0.45
              : 0.5;
  const base: number[] = [
    (m.intensity ?? 5) / 10,
    m.volumeLoadIndex ?? 0.5,
    (m.cardiovascularStress ?? 5) / 10,
    (m.recoveryDemand ?? 5) / 10,
    ((m.skillComplexity ?? 5) / 10) * 1,
    ((m.mobilityDemand ?? 5) / 10) * 1,
    Math.min(1, w.duration / 120),
    Math.min(1, exerciseCount / 16),
    diff,
    typeHue,
  ];
  while (base.length < DEFAULT_VECTOR_DIM) {
    base.push(0);
  }
  return base.slice(0, DEFAULT_VECTOR_DIM);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function zeroVector(dim: number): number[] {
  return Array(dim).fill(0);
}

function addScaled(target: number[], vec: number[], scale: number): void {
  for (let i = 0; i < vec.length; i += 1) {
    target[i] += vec[i] * scale;
  }
}

function flattenWeightSum(weightedSum: number[], totalWeight: number, dim: number): number[] {
  if (totalWeight <= 0) return zeroVector(dim);
  return weightedSum.map((x) => x / totalWeight);
}

export type EngagementSample = {
  vector: number[];
  weight: number;
  residual: number;
};

/** Build engagement samples from priorEngagements rows or residual inference from completions */
export async function gatherEngagementSamples(userId: mongoose.Types.ObjectId): Promise<EngagementSample[]> {
  const user = await User.findById(userId)
    .select('priorEngagements completedWorkouts mlProfile profile.fitnessLevel')
    .lean();
  if (!user) return [];

  const out: EngagementSample[] = [];

  if (Array.isArray(user.priorEngagements) && user.priorEngagements.length > 0) {
    const entries = [...user.priorEngagements].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    for (let i = 0; i < Math.min(entries.length, 120); i += 1) {
      const e = entries[i] as unknown as {
        workoutId: mongoose.Types.ObjectId;
        residualScore: number;
        tagSnapshot?: number[];
        completedAt: Date;
      };
      const decay = Math.exp(-i / 40); // newer events matter more
      if (Array.isArray(e.tagSnapshot) && e.tagSnapshot.length === DEFAULT_VECTOR_DIM) {
        out.push({ vector: e.tagSnapshot, weight: decay * (e.residualScore ?? 0.6), residual: e.residualScore });
      } else {
        const w = await Workout.findById(e.workoutId).lean<IWorkout | null>();
        if (w) {
          const v = workoutToFeatureVector(w);
          out.push({ vector: v, weight: decay * (e.residualScore ?? 0.6), residual: e.residualScore });
        }
      }
    }
    return out;
  }

  const completions =
    [...(user.completedWorkouts || [])].sort(
      (a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    ) || [];

  for (let i = 0; i < Math.min(completions.length, 60); i += 1) {
    const c = completions[i];
    const w = await Workout.findById(c.workoutId).lean<IWorkout | null>();
    if (!w) continue;
    const targetDur = Math.max(10, (w.duration || 45) * 1.35);
    const residual = Math.min(
      1,
      Math.max(0.1, typeof c.duration === 'number' ? c.duration / targetDur : 0.55)
    );
    const decay = Math.exp(-i / 28);
    out.push({
      vector: workoutToFeatureVector(w),
      weight: decay * residual,
      residual,
    });
  }

  /* Cold start heuristic from anonymized similarityVector if present */
  if (out.length === 0 && user.mlProfile?.similarityVector?.length === DEFAULT_VECTOR_DIM) {
    const levelPenalty =
      user.profile?.fitnessLevel === 'advanced'
        ? 1
        : user.profile?.fitnessLevel === 'intermediate'
          ? 0.85
          : 0.7;
    out.push({
      vector: [...user.mlProfile.similarityVector],
      weight: levelPenalty,
      residual: user.mlProfile.adherenceRate ?? 0.55,
    });
  }

  return out;
}

export function centroidFromEngagements(samples: EngagementSample[], dim: number): { vector: number[]; avgResidual: number } {
  if (samples.length === 0) return { vector: zeroVector(dim), avgResidual: 0.35 };
  const sum = zeroVector(dim);
  let weightTotal = 0;
  let residSum = 0;
  for (const s of samples) {
    addScaled(sum, s.vector, s.weight);
    weightTotal += s.weight;
    residSum += s.residual * s.weight;
  }
  return {
    vector: flattenWeightSum(sum, weightTotal, dim),
    avgResidual: residSum / (weightTotal || 1),
  };
}

export type RankedWorkout = {
  workout: IWorkout;
  similarity: number;
  passesRelevance: boolean;
};

const TIER_FEATURES: Record<SubscriptionTier, { poolLimit: number; minRelevance: number }> = {
  BASIC: { poolLimit: 80, minRelevance: 0.42 },
  SPECIFIED: { poolLimit: 150, minRelevance: 0.35 },
  ACTIVE_CLIENT: { poolLimit: 200, minRelevance: 0.28 },
};

export class PlanRecommendationService {
  async suggestWeeklyWorkouts(params: {
    userId: string | mongoose.Types.ObjectId;
    weekNumber?: number;
    slots?: number;
  }): Promise<{
    tier: SubscriptionTier;
    centroid: number[];
    weeklyWorkouts: RankedWorkout[];
    mealPlanSuggestion?: null;
    externalMlUsed: boolean;
  }> {
    const userId =
      typeof params.userId === 'string' ? new mongoose.Types.ObjectId(params.userId) : params.userId;
    const user = await User.findById(userId).select(
      'subscriptionTier mlProfile profile.fitnessLevel'
    );
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const tier = user.subscriptionTier as SubscriptionTier;
    const constraints = TIER_FEATURES[tier] ?? TIER_FEATURES.BASIC;
    const dim = DEFAULT_VECTOR_DIM;

    const samples = await gatherEngagementSamples(userId);
    const { vector: cen0, avgResidual } = centroidFromEngagements(samples, dim);
    let centroidForScore =
      cosineSimilarity(cen0, cen0) < 1e-9 || cen0.every((x) => x === 0)
        ? workoutToFeatureVector({
            metaTags: {
              intensity: 5 + (user.mlProfile?.adherenceRate || 0.5) * 2,
              volumeLoadIndex: 0.45,
              cardiovascularStress: 5,
              recoveryDemand: 5,
              skillComplexity: 5,
              mobilityDemand: 5,
            },
            duration: 40,
            difficulty: user.profile.fitnessLevel || 'beginner',
            type: 'mixed',
            exercises: [],
          })
        : [...cen0];

    if (user.mlProfile?.similarityVector?.length === dim) {
      const blend = [...user.mlProfile.similarityVector];
      centroidForScore = centroidForScore.map((c, idx) => 0.5 * (c + (blend[idx] || 0)));
    }

    const weekFilter =
      typeof params.weekNumber === 'number'
        ? { weekNumber: params.weekNumber, isPublic: true, isActive: true }
        : { isPublic: true, isActive: true };

    const candidates = await Workout.find({
      ...weekFilter,
      isCustom: false,
    })
      .sort({ completionCount: -1, updatedAt: -1 })
      .limit(constraints.poolLimit)
      .lean<IWorkout[]>();

    const ranked: RankedWorkout[] = candidates.map((w) => {
      const v = workoutToFeatureVector(w);
      const similarity = cosineSimilarity(centroidForScore, v) * (0.75 + (user.mlProfile?.adherenceRate || 0.5) * 0.25);
      /** Blend average residual engagement so “successful histories” amplify confidence */
      const blended = similarity * (0.65 + avgResidual * 0.35);
      return {
        workout: w as IWorkout,
        similarity: blended,
        passesRelevance: blended >= constraints.minRelevance,
      };
    });

    ranked.sort((a, b) => b.similarity - a.similarity);

    const slots = params.slots ?? 7;

    /** Coach tier: optionally merge externally ranked IDs (stub) without blocking local ranking */
    let externalMlUsed = false;
    if (tier === 'ACTIVE_CLIENT' && env.ENABLE_ML_INFERENCE) {
      const ml = await invokeSageMakerWeeklyPlan({
        userAnonymizedId: userId.toHexString(),
        featureSummary: { adherence: avgResidual },
        tier,
      });
      if (ml?.rankedWorkoutIds?.length) {
        externalMlUsed = true;
        const prioritized = new Map(ml.rankedWorkoutIds.map((id, idx) => [id, idx]));
        ranked.sort((a, b) => {
          const aw = prioritized.get(String(a.workout._id)) ?? 999;
          const bw = prioritized.get(String(b.workout._id)) ?? 999;
          if (aw !== bw) return aw - bw;
          return b.similarity - a.similarity;
        });
      }
    }

    const weeklyWorkouts = ranked.slice(0, slots);

    return {
      tier,
      centroid: centroidForScore,
      weeklyWorkouts,
      mealPlanSuggestion: null,
      externalMlUsed,
    };
  }
}

/** Call on login bootstrap for Basic users — records implied residuals into priorEngagements (bounded) */
export async function hydratePriorEngagementsFromHistory(userId: string | mongoose.Types.ObjectId, maxNew = 20): Promise<void> {
  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  const user = await User.findById(uid).select('priorEngagements completedWorkouts');
  if (!user) return;

  const existingIds = new Set(
    user.priorEngagements.map((p) => {
      const wid = String(p.workoutId);
      const at = p.completedAt instanceof Date ? p.completedAt.toISOString() : String(p.completedAt);
      return `${wid}|${at}`;
    })
  );

  let added = 0;
  for (const c of [...user.completedWorkouts].reverse()) {
    if (added >= maxNew) break;
    const key = `${c.workoutId.toString()}|${new Date(c.completedAt).toISOString()}`;
    if (existingIds.has(key)) continue;
    existingIds.add(key);
    const w = await Workout.findById(c.workoutId);
    if (!w) continue;
    const residual = Math.min(
      1,
      Math.max(
        0.15,
        typeof c.duration === 'number'
          ? c.duration / Math.max(10, w.duration * 1.35)
          : 0.55
      )
    );
    user.priorEngagements.push({
      workoutId: c.workoutId,
      residualScore: residual,
      completedAt: c.completedAt,
      tagSnapshot: workoutToFeatureVector(w),
    });
    added += 1;
  }

  if (user.priorEngagements.length > 480) {
    user.priorEngagements = user.priorEngagements.slice(-450);
  }

  await user.save();
}
