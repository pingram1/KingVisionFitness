import mongoose from 'mongoose';
import User from '../models/User';
import type { IEverydayFitnessStats } from '../models/User';
import {
  calculateEverydayFitnessScore,
  type EverydayFitnessStats,
} from '../utils/everydayFitnessScoring';
import { KG_TO_LBS, resolveBodyWeightLbs } from '../utils/bodyWeight';

export { resolveBodyWeightLbs };

export interface AppliedEverydayStats {
  pushUpsMax: number | null;
  pullUpsMax: number | null;
  sitUpsMax: number | null;
  curlsWeight: number | null;
  curlsReps: number | null;
  plankSeconds: number | null;
  burpeesCount: number | null;
  everydayFitnessScore: number;
  lastUpdated: Date;
}

/**
 * Merge partial everyday stats, recompute wellness score, persist.
 */
export async function applyEverydayStatsUpdate(
  userId: string | mongoose.Types.ObjectId,
  incoming: EverydayFitnessStats,
  options?: { bodyWeightLbs?: number }
): Promise<AppliedEverydayStats & { bodyWeightLbs: number | null }> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const current = (user.get('everydayFitnessStats') ?? {}) as IEverydayFitnessStats;
  const merged: EverydayFitnessStats = {
    pushUpsMax: incoming.pushUpsMax ?? current.pushUpsMax,
    pullUpsMax: incoming.pullUpsMax ?? current.pullUpsMax,
    sitUpsMax: incoming.sitUpsMax ?? current.sitUpsMax,
    curlsWeight: incoming.curlsWeight ?? current.curlsWeight,
    curlsReps: incoming.curlsReps ?? current.curlsReps,
    plankSeconds: incoming.plankSeconds ?? current.plankSeconds,
    burpeesCount: incoming.burpeesCount ?? current.burpeesCount,
  };

  if (typeof options?.bodyWeightLbs === 'number' && options.bodyWeightLbs > 0) {
    user.set('profile.initialWeight', options.bodyWeightLbs / KG_TO_LBS);
  }

  const bodyWeightLbs = resolveBodyWeightLbs(user, options?.bodyWeightLbs) ?? null;
  const breakdown = calculateEverydayFitnessScore(merged, bodyWeightLbs ?? undefined);
  const lastUpdated = new Date();

  user.set('everydayFitnessStats', {
    ...merged,
    everydayFitnessScore: breakdown.overall,
    lastUpdated,
  });
  await user.save();

  return {
    pushUpsMax: merged.pushUpsMax ?? null,
    pullUpsMax: merged.pullUpsMax ?? null,
    sitUpsMax: merged.sitUpsMax ?? null,
    curlsWeight: merged.curlsWeight ?? null,
    curlsReps: merged.curlsReps ?? null,
    plankSeconds: merged.plankSeconds ?? null,
    burpeesCount: merged.burpeesCount ?? null,
    everydayFitnessScore: breakdown.overall,
    lastUpdated,
    bodyWeightLbs,
  };
}

export { calculateEverydayFitnessScore };
