import mongoose from 'mongoose';
import User from '../models/User';
import Group from '../models/Group';
import {
  calculatePerformanceGrade,
  type AthleteStats,
} from '../utils/performanceScoring';
import { buildStatHistoryEntries } from '../utils/statAudit';
import type { IAthleteStats } from '../models/User';

export interface AppliedAthleteStats {
  bodyWeight: number | null;
  height: number | null;
  squatMax: number | null;
  benchMax: number | null;
  deadliftMax: number | null;
  pushUpCount: number | null;
  sitUpCount: number | null;
  fortyYardDash: number | null;
  performanceGrade: number;
  performanceBreakdown: ReturnType<typeof calculatePerformanceGrade>;
  statHistory: IAthleteStats['statHistory'];
  lastUpdatedAt: Date;
}

/**
 * Merge partial stats, recompute grade, persist, and fan out to athletic teams.
 */
export async function applyAthleteStatsUpdate(
  userId: string | mongoose.Types.ObjectId,
  incoming: AthleteStats
): Promise<AppliedAthleteStats> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const currentStats = (user.get('athleteStats') ?? {}) as IAthleteStats;
  const current: AthleteStats = currentStats;
  const merged: AthleteStats = { ...current, ...incoming };
  const existingHistory = currentStats.statHistory ?? [];

  const statHistory = buildStatHistoryEntries(current, merged, existingHistory);
  const breakdown = calculatePerformanceGrade(merged);
  const lastUpdatedAt = new Date();

  user.set('athleteStats', {
    ...merged,
    performanceGrade: breakdown.overall,
    performanceBreakdown: breakdown,
    statHistory,
    lastUpdatedAt,
  });
  await user.save();

  const userObjectId = new mongoose.Types.ObjectId(String(user._id));
  await Group.updateMany(
    {
      groupType: 'athletic_team',
      'memberships.user': userObjectId,
    },
    {
      $set: {
        'memberships.$[m].performanceGrade': breakdown.overall,
        'memberships.$[m].performanceBreakdown': breakdown,
        'memberships.$[m].lastGradedAt': lastUpdatedAt,
      },
    },
    { arrayFilters: [{ 'm.user': userObjectId }] }
  );

  return {
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
    lastUpdatedAt,
  };
}
