import type { EverydayFitnessStats } from './everydayFitnessScoring';

export const EVERYDAY_STAT_FIELDS: ReadonlyArray<keyof EverydayFitnessStats> = [
  'pushUpsMax',
  'pullUpsMax',
  'sitUpsMax',
  'curlsWeight',
  'curlsReps',
  'plankSeconds',
  'burpeesCount',
];

export const EVERYDAY_STAT_BOUNDS: Record<
  keyof EverydayFitnessStats,
  { min: number; max: number }
> = {
  pushUpsMax: { min: 0, max: 500 },
  pullUpsMax: { min: 0, max: 100 },
  sitUpsMax: { min: 0, max: 500 },
  curlsWeight: { min: 0, max: 200 },
  curlsReps: { min: 0, max: 100 },
  plankSeconds: { min: 0, max: 600 },
  burpeesCount: { min: 0, max: 200 },
};

/**
 * Pull known everyday stat fields from an arbitrary payload.
 * All fields optional — partial submissions are valid.
 */
export function parseEverydayStatsPayload(body: unknown): {
  stats: EverydayFitnessStats;
  errors: string[];
} {
  const stats: EverydayFitnessStats = {};
  const errors: string[] = [];
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  for (const field of EVERYDAY_STAT_FIELDS) {
    const raw = source[field];
    if (raw === undefined || raw === null || raw === '') continue;

    const num = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      errors.push(`${field} must be a finite number`);
      continue;
    }

    const { min, max } = EVERYDAY_STAT_BOUNDS[field];
    if (num < min || num > max) {
      errors.push(`${field} must be between ${min} and ${max}`);
      continue;
    }

    if (num > 0) {
      stats[field] = num;
    }
  }

  return { stats, errors };
}

/** Optional body weight (lbs) used for curl volume scoring. */
export function parseBodyWeightLbs(body: unknown): {
  bodyWeightLbs?: number;
  errors: string[];
} {
  const errors: string[] = [];
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const raw = source.bodyWeightLbs;
  if (raw === undefined || raw === null || raw === '') {
    return { errors };
  }

  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    errors.push('bodyWeightLbs must be a finite number');
    return { errors };
  }
  if (num < 50 || num > 500) {
    errors.push('bodyWeightLbs must be between 50 and 500 lbs');
    return { errors };
  }
  if (num > 0) {
    return { bodyWeightLbs: num, errors };
  }
  return { errors };
}
