import type { AthleteStats } from '../utils/performanceScoring';

export const ATHLETE_STAT_FIELDS: ReadonlyArray<keyof AthleteStats> = [
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
export const STAT_BOUNDS: Record<keyof AthleteStats, { min: number; max: number }> = {
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
 * to numbers. Returns `{ stats, errors }` so the caller can 400 on bad input.
 */
export function parseAthleteStatsPayload(body: unknown): {
  stats: AthleteStats;
  errors: string[];
} {
  const stats: AthleteStats = {};
  const errors: string[] = [];
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  for (const field of ATHLETE_STAT_FIELDS) {
    const raw = source[field];
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
