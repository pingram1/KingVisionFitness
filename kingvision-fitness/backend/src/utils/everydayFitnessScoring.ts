/**
 * Everyday Fitness Score — 0–100 wellness baseline for mainstream users.
 *
 * Separate from the team Athletic Performance Grade in performanceScoring.ts.
 * Uses piecewise-linear anchors against general-population fitness standards.
 *
 * Composition (renormalized when categories are missing):
 *   upperBody 30% · core 25% · metabolic 25% · strength 20%
 */

export interface EverydayFitnessStats {
  pushUpsMax?: number;
  pullUpsMax?: number;
  sitUpsMax?: number;
  curlsWeight?: number;
  curlsReps?: number;
  plankSeconds?: number;
  burpeesCount?: number;
}

export interface EverydayCategoryScore {
  raw: number;
  score: number;
}

export interface EverydayFitnessBreakdown {
  pushUps: EverydayCategoryScore | null;
  pullUps: EverydayCategoryScore | null;
  upperBody: EverydayCategoryScore | null;
  sitUps: EverydayCategoryScore | null;
  plank: EverydayCategoryScore | null;
  core: EverydayCategoryScore | null;
  burpees: EverydayCategoryScore | null;
  metabolic: EverydayCategoryScore | null;
  curlsVolume: EverydayCategoryScore | null;
  strength: EverydayCategoryScore | null;
  overall: number;
  weights: { upperBody: number; core: number; metabolic: number; strength: number };
}

type Anchor = [raw: number, score: number];

const PUSHUP_ANCHORS: Anchor[] = [
  [0, 0],
  [10, 25],
  [25, 50],
  [40, 75],
  [60, 100],
];

const PULLUP_ANCHORS: Anchor[] = [
  [0, 0],
  [3, 25],
  [8, 50],
  [12, 75],
  [20, 100],
];

const SITUP_ANCHORS: Anchor[] = [
  [0, 0],
  [20, 25],
  [40, 50],
  [60, 75],
  [80, 100],
];

const PLANK_ANCHORS: Anchor[] = [
  [0, 0],
  [30, 25],
  [60, 50],
  [90, 75],
  [180, 100],
];

const BURPEE_ANCHORS: Anchor[] = [
  [0, 0],
  [10, 25],
  [20, 50],
  [30, 75],
  [40, 100],
];

/** Volume index = (weight × reps) / bodyWeight (lbs). Modest bodyweight adjustment. */
const CURLS_BW_ANCHORS: Anchor[] = [
  [0, 0],
  [0.5, 25],
  [1.0, 50],
  [1.5, 75],
  [2.5, 100],
];

const CATEGORY_WEIGHTS = {
  upperBody: 0.3,
  core: 0.25,
  metabolic: 0.25,
  strength: 0.2,
} as const;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function interpolateScore(raw: number, anchors: Anchor[]): number {
  if (anchors.length === 0) return 0;
  if (raw <= anchors[0][0]) return anchors[0][1];
  if (raw >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [x1, y1] = anchors[i];
    const [x2, y2] = anchors[i + 1];
    if (raw >= x1 && raw <= x2) {
      const t = (raw - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return 0;
}

function buildScore(raw: number, score: number): EverydayCategoryScore {
  const clamped = clamp(score, 0, 100);
  return {
    raw: Number(raw.toFixed(2)),
    score: Number(clamped.toFixed(1)),
  };
}

function scoreUpperBody(stats: EverydayFitnessStats) {
  let pushUps: EverydayCategoryScore | null = null;
  if (isPositive(stats.pushUpsMax)) {
    pushUps = buildScore(stats.pushUpsMax, interpolateScore(stats.pushUpsMax, PUSHUP_ANCHORS));
  }

  let pullUps: EverydayCategoryScore | null = null;
  if (isPositive(stats.pullUpsMax)) {
    pullUps = buildScore(stats.pullUpsMax, interpolateScore(stats.pullUpsMax, PULLUP_ANCHORS));
  }

  const parts = [pushUps, pullUps].filter((s): s is EverydayCategoryScore => s !== null);
  if (parts.length === 0) {
    return { pushUps, pullUps, upperBody: null };
  }

  const avg = parts.reduce((sum, s) => sum + s.score, 0) / parts.length;
  const avgRaw = parts.reduce((sum, s) => sum + s.raw, 0) / parts.length;
  return { pushUps, pullUps, upperBody: buildScore(avgRaw, avg) };
}

function scoreCore(stats: EverydayFitnessStats) {
  let sitUps: EverydayCategoryScore | null = null;
  if (isPositive(stats.sitUpsMax)) {
    sitUps = buildScore(stats.sitUpsMax, interpolateScore(stats.sitUpsMax, SITUP_ANCHORS));
  }

  let plank: EverydayCategoryScore | null = null;
  if (isPositive(stats.plankSeconds)) {
    plank = buildScore(stats.plankSeconds, interpolateScore(stats.plankSeconds, PLANK_ANCHORS));
  }

  const parts = [sitUps, plank].filter((s): s is EverydayCategoryScore => s !== null);
  if (parts.length === 0) {
    return { sitUps, plank, core: null };
  }

  const avg = parts.reduce((sum, s) => sum + s.score, 0) / parts.length;
  const avgRaw = parts.reduce((sum, s) => sum + s.raw, 0) / parts.length;
  return { sitUps, plank, core: buildScore(avgRaw, avg) };
}

function scoreMetabolic(stats: EverydayFitnessStats) {
  if (!isPositive(stats.burpeesCount)) {
    return { burpees: null, metabolic: null };
  }
  const burpees = buildScore(stats.burpeesCount, interpolateScore(stats.burpeesCount, BURPEE_ANCHORS));
  return { burpees, metabolic: burpees };
}

function scoreStrength(stats: EverydayFitnessStats, bodyWeightLbs?: number) {
  if (!isPositive(stats.curlsWeight) || !isPositive(stats.curlsReps) || !isPositive(bodyWeightLbs)) {
    return { curlsVolume: null, strength: null };
  }

  const volumeIndex = (stats.curlsWeight * stats.curlsReps) / bodyWeightLbs;
  const curlsVolume = buildScore(volumeIndex, interpolateScore(volumeIndex, CURLS_BW_ANCHORS));
  return { curlsVolume, strength: curlsVolume };
}

/**
 * Compute the 0–100 Everyday Fitness Score. Missing categories redistribute weight.
 * `bodyWeightLbs` is optional — used only for curls volume normalization.
 */
export function calculateEverydayFitnessScore(
  stats: EverydayFitnessStats,
  bodyWeightLbs?: number
): EverydayFitnessBreakdown {
  const empty: EverydayFitnessBreakdown = {
    pushUps: null,
    pullUps: null,
    upperBody: null,
    sitUps: null,
    plank: null,
    core: null,
    burpees: null,
    metabolic: null,
    curlsVolume: null,
    strength: null,
    overall: 0,
    weights: { upperBody: 0, core: 0, metabolic: 0, strength: 0 },
  };

  const { pushUps, pullUps, upperBody } = scoreUpperBody(stats);
  const { sitUps, plank, core } = scoreCore(stats);
  const { burpees, metabolic } = scoreMetabolic(stats);
  const { curlsVolume, strength } = scoreStrength(stats, bodyWeightLbs);

  const presence = {
    upperBody: upperBody ? CATEGORY_WEIGHTS.upperBody : 0,
    core: core ? CATEGORY_WEIGHTS.core : 0,
    metabolic: metabolic ? CATEGORY_WEIGHTS.metabolic : 0,
    strength: strength ? CATEGORY_WEIGHTS.strength : 0,
  };
  const totalWeight =
    presence.upperBody + presence.core + presence.metabolic + presence.strength;

  if (totalWeight === 0) {
    return { ...empty, pushUps, pullUps, sitUps, plank, burpees, curlsVolume };
  }

  const weights = {
    upperBody: presence.upperBody / totalWeight,
    core: presence.core / totalWeight,
    metabolic: presence.metabolic / totalWeight,
    strength: presence.strength / totalWeight,
  };

  const overall =
    (upperBody?.score ?? 0) * weights.upperBody +
    (core?.score ?? 0) * weights.core +
    (metabolic?.score ?? 0) * weights.metabolic +
    (strength?.score ?? 0) * weights.strength;

  return {
    pushUps,
    pullUps,
    upperBody,
    sitUps,
    plank,
    core,
    burpees,
    metabolic,
    curlsVolume,
    strength,
    overall: Number(clamp(overall, 0, 100).toFixed(1)),
    weights: {
      upperBody: Number(weights.upperBody.toFixed(3)),
      core: Number(weights.core.toFixed(3)),
      metabolic: Number(weights.metabolic.toFixed(3)),
      strength: Number(weights.strength.toFixed(3)),
    },
  };
}

/** Convenience: just the 0–100 number for storing on the user document. */
export function everydayFitnessScoreNumber(
  stats: EverydayFitnessStats,
  bodyWeightLbs?: number
): number {
  return calculateEverydayFitnessScore(stats, bodyWeightLbs).overall;
}
