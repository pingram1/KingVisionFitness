import type { PerformanceBreakdown, PerformanceTier } from './athleteStats';

export type TrackedAthleteMetric =
  | 'bodyWeight'
  | 'height'
  | 'squatMax'
  | 'benchMax'
  | 'deadliftMax'
  | 'pushUpCount'
  | 'sitUpCount'
  | 'fortyYardDash';

export interface AthleteStatHistoryEntry {
  date: string;
  metric: TrackedAthleteMetric;
  oldValue: number | null;
  newValue: number;
}

export interface CoachAthleteProfile {
  userId: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: string;
  roleLabel: string;
}

export interface CoachAthleteStats {
  bodyWeight: number | null;
  height: number | null;
  squatMax: number | null;
  benchMax: number | null;
  deadliftMax: number | null;
  pushUpCount: number | null;
  sitUpCount: number | null;
  fortyYardDash: number | null;
  performanceGrade: number;
  performanceBreakdown: PerformanceBreakdown | null;
  lastUpdatedAt: string | null;
}

export interface CoachAthleteDetail {
  athlete: CoachAthleteProfile;
  stats: CoachAthleteStats;
  statHistory: AthleteStatHistoryEntry[];
  membership: {
    performanceGrade: number;
    performanceBreakdown: PerformanceBreakdown | null;
    lastGradedAt: string | null;
    workoutsCompleted: number;
    totalMinutes: number;
  };
}

export const METRIC_LABELS: Record<TrackedAthleteMetric, string> = {
  bodyWeight: 'Body Weight',
  height: 'Height',
  squatMax: 'Squat',
  benchMax: 'Bench Press',
  deadliftMax: 'Deadlift',
  pushUpCount: 'Push-Ups',
  sitUpCount: 'Sit-Ups',
  fortyYardDash: '40-Yard Dash',
};

export const METRIC_UNITS: Record<TrackedAthleteMetric, string> = {
  bodyWeight: 'lbs',
  height: 'in',
  squatMax: 'lbs',
  benchMax: 'lbs',
  deadliftMax: 'lbs',
  pushUpCount: 'reps',
  sitUpCount: 'reps',
  fortyYardDash: 'sec',
};

export function isStatImprovement(
  metric: TrackedAthleteMetric,
  oldValue: number | null,
  newValue: number
): boolean {
  if (oldValue == null) return true;
  if (metric === 'fortyYardDash') return newValue < oldValue;
  return newValue > oldValue;
}

export function formatStatValue(metric: TrackedAthleteMetric, value: number): string {
  const unit = METRIC_UNITS[metric];
  if (metric === 'fortyYardDash') {
    return `${value.toFixed(2)} ${unit}`;
  }
  return `${Math.round(value)} ${unit}`;
}

export type { PerformanceTier };
