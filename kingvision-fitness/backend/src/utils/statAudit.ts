import type { AthleteStats } from '../utils/performanceScoring';

/** Metrics we track in combine stats and audit history. */
export const TRACKED_ATHLETE_METRICS = [
  'bodyWeight',
  'height',
  'squatMax',
  'benchMax',
  'deadliftMax',
  'pushUpCount',
  'sitUpCount',
  'fortyYardDash',
] as const satisfies ReadonlyArray<keyof AthleteStats>;

export type TrackedAthleteMetric = (typeof TRACKED_ATHLETE_METRICS)[number];

export interface IAthleteStatHistoryEntry {
  date: Date;
  metric: TrackedAthleteMetric;
  oldValue: number | null;
  newValue: number;
}

/** Maximum audit entries retained per athlete (most recent). */
export const STAT_HISTORY_CAP = 500;

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

/** Lower fortyYardDash is better; everything else higher is better. */
export function isImprovement(
  metric: TrackedAthleteMetric,
  oldValue: number | null,
  newValue: number
): boolean {
  if (oldValue == null) return true;
  if (metric === 'fortyYardDash') return newValue < oldValue;
  return newValue > oldValue;
}

/**
 * Compare previous vs merged stats and append audit entries for any changed
 * tracked metric. Returns the capped history array (most recent entries kept).
 */
export function buildStatHistoryEntries(
  previous: AthleteStats,
  merged: AthleteStats,
  existingHistory: IAthleteStatHistoryEntry[] = []
): IAthleteStatHistoryEntry[] {
  const now = new Date();
  const newEntries: IAthleteStatHistoryEntry[] = [];

  for (const metric of TRACKED_ATHLETE_METRICS) {
    const oldVal = previous[metric];
    const newVal = merged[metric];

    if (typeof newVal !== 'number' || !Number.isFinite(newVal)) continue;
    if (oldVal === newVal) continue;

    newEntries.push({
      date: now,
      metric,
      oldValue: typeof oldVal === 'number' ? oldVal : null,
      newValue: newVal,
    });
  }

  return [...existingHistory, ...newEntries].slice(-STAT_HISTORY_CAP);
}
