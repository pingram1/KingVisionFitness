/**
 * KingVision Athletic Performance Algorithm
 *
 * Grades athletes on a 0-100 scale using *relative* performance (bodyweight
 * ratios, mass-adjusted speed) rather than raw numbers. A 185 lb athlete
 * squatting 315 (1.70× BW) scores higher than a 300 lb athlete squatting
 * 365 (1.22× BW) — by design.
 *
 * Composition:
 *   overall = 0.40 * strength + 0.30 * speed + 0.30 * endurance
 *
 * If a category is missing all inputs, its weight is redistributed across
 * the remaining categories — partial assessments still yield a fair grade.
 *
 * Tunable constants live at the top of this file. Treat ALL_BASELINES as the
 * single source of truth; the rest of the algorithm derives from it.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface AthleteStats {
  /** Required for every relative calculation. lbs. */
  bodyWeight?: number;
  /** inches (not currently used in scoring; reserved for future BMI tags). */
  height?: number;
  /** 1RM squat in lbs. */
  squatMax?: number;
  /** 1RM bench in lbs. */
  benchMax?: number;
  /** 1RM deadlift in lbs. */
  deadliftMax?: number;
  /** Max unbroken push-up reps. */
  pushUpCount?: number;
  /** Max unbroken sit-up reps. */
  sitUpCount?: number;
  /** 40-yard dash time in seconds (lower is better). */
  fortyYardDash?: number;
}

export type PerformanceTier =
  | 'untrained'
  | 'beginner'
  | 'developing'
  | 'baseline'
  | 'advanced'
  | 'elite';

export interface CategoryScore {
  /** Raw input metric — bodyweight ratio for lifts, reps for endurance, etc. */
  raw: number;
  /** 0-100 normalized score (clamped). */
  score: number;
  /** Plain-English bracket for UI badges. */
  tier: PerformanceTier;
}

export interface PerformanceBreakdown {
  squat: CategoryScore | null;
  bench: CategoryScore | null;
  deadlift: CategoryScore | null;
  strength: CategoryScore | null;
  pushUps: CategoryScore | null;
  sitUps: CategoryScore | null;
  endurance: CategoryScore | null;
  speed: CategoryScore | null;
  /** 0-100. Weighted blend of strength, speed, endurance. */
  overall: number;
  /** Effective weights after renormalization for missing categories. */
  weights: { strength: number; speed: number; endurance: number };
}

// ─── Tunable Baselines ─────────────────────────────────────────────────────

/**
 * Anchor points map a raw metric to a 0-100 score via piecewise-linear
 * interpolation. Each entry is `[rawValue, score]` and MUST be sorted by raw.
 * Values outside the first/last anchor extrapolate linearly toward 0 or 100
 * and are clamped at the boundaries.
 */
type Anchor = [raw: number, score: number];

const SQUAT_BW_ANCHORS: Anchor[] = [
  [0.5, 0],
  [1.0, 25],
  [1.5, 50],
  [1.85, 75],
  [2.2, 100],
];

const BENCH_BW_ANCHORS: Anchor[] = [
  [0.3, 0],
  [0.6, 25],
  [1.0, 50],
  [1.25, 75],
  [1.5, 100],
];

const DEADLIFT_BW_ANCHORS: Anchor[] = [
  [0.75, 0],
  [1.25, 25],
  [1.75, 50],
  [2.1, 75],
  [2.5, 100],
];

const PUSHUP_ANCHORS: Anchor[] = [
  [0, 0],
  [20, 25],
  [40, 50],
  [60, 75],
  [80, 100],
];

const SITUP_ANCHORS: Anchor[] = [
  [0, 0],
  [25, 25],
  [45, 50],
  [65, 75],
  [85, 100],
];

/**
 * Speed = (bodyweight × 200) / (40time ^ 4). Calibrated against NFL
 * combine "Powerball Index". Anchored so a 160 lb athlete running 4.8s
 * lands at baseline; a 250 lb at 4.8s reaches advanced; 4.4s elite zone.
 */
const SPEED_POWERBALL_ANCHORS: Anchor[] = [
  [15, 0],
  [30, 25],
  [60, 50],
  [90, 75],
  [120, 100],
];

const CATEGORY_WEIGHTS = {
  strength: 0.4,
  speed: 0.3,
  endurance: 0.3,
} as const;

/**
 * Endurance is bodyweight-bearing, so heavier athletes deserve a small
 * boost for the same rep count. +1% per 10 lbs over 180 baseline, capped
 * at ±15%. Only applied to push-ups (sit-ups are core stamina, not load).
 */
const PUSHUP_MASS_REFERENCE_LBS = 180;
const PUSHUP_MASS_BOOST_PER_LB = 0.001; // 0.1% per lb above reference
const PUSHUP_MASS_BOOST_CAP = 0.15;

// ─── Math primitives ──────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Piecewise-linear interpolation between anchor points. Values below the
 * first anchor or above the last are clamped to the boundary score.
 */
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

function tierFromScore(score: number): PerformanceTier {
  if (score < 15) return 'untrained';
  if (score < 35) return 'beginner';
  if (score < 50) return 'developing';
  if (score < 70) return 'baseline';
  if (score < 88) return 'advanced';
  return 'elite';
}

function buildScore(raw: number, score: number): CategoryScore {
  const clamped = clamp(score, 0, 100);
  return {
    raw: Number(raw.toFixed(2)),
    score: Number(clamped.toFixed(1)),
    tier: tierFromScore(clamped),
  };
}

// ─── Category calculators ─────────────────────────────────────────────────

function scoreLift(
  liftMax: number | undefined,
  bodyWeight: number,
  anchors: Anchor[]
): CategoryScore | null {
  if (!isPositive(liftMax)) return null;
  const ratio = liftMax / bodyWeight;
  return buildScore(ratio, interpolateScore(ratio, anchors));
}

function scoreStrength(stats: AthleteStats, bodyWeight: number) {
  const squat = scoreLift(stats.squatMax, bodyWeight, SQUAT_BW_ANCHORS);
  const bench = scoreLift(stats.benchMax, bodyWeight, BENCH_BW_ANCHORS);
  const deadlift = scoreLift(stats.deadliftMax, bodyWeight, DEADLIFT_BW_ANCHORS);

  const lifts = [squat, bench, deadlift].filter((s): s is CategoryScore => s !== null);
  if (lifts.length === 0) {
    return { squat, bench, deadlift, strength: null };
  }

  const avg = lifts.reduce((sum, s) => sum + s.score, 0) / lifts.length;
  const avgRatio = lifts.reduce((sum, s) => sum + s.raw, 0) / lifts.length;
  return {
    squat,
    bench,
    deadlift,
    strength: buildScore(avgRatio, avg),
  };
}

function scoreEndurance(stats: AthleteStats, bodyWeight: number) {
  let pushUps: CategoryScore | null = null;
  if (isPositive(stats.pushUpCount)) {
    const baseScore = interpolateScore(stats.pushUpCount, PUSHUP_ANCHORS);
    const massDelta = bodyWeight - PUSHUP_MASS_REFERENCE_LBS;
    const boost = clamp(
      massDelta * PUSHUP_MASS_BOOST_PER_LB,
      -PUSHUP_MASS_BOOST_CAP,
      PUSHUP_MASS_BOOST_CAP
    );
    pushUps = buildScore(stats.pushUpCount, baseScore * (1 + boost));
  }

  let sitUps: CategoryScore | null = null;
  if (isPositive(stats.sitUpCount)) {
    sitUps = buildScore(stats.sitUpCount, interpolateScore(stats.sitUpCount, SITUP_ANCHORS));
  }

  const parts = [pushUps, sitUps].filter((s): s is CategoryScore => s !== null);
  if (parts.length === 0) {
    return { pushUps, sitUps, endurance: null };
  }

  const avg = parts.reduce((sum, s) => sum + s.score, 0) / parts.length;
  const avgReps = parts.reduce((sum, s) => sum + s.raw, 0) / parts.length;
  return { pushUps, sitUps, endurance: buildScore(avgReps, avg) };
}

function scoreSpeed(stats: AthleteStats, bodyWeight: number): CategoryScore | null {
  if (!isPositive(stats.fortyYardDash)) return null;
  // Powerball Index — mass-adjusted speed. Higher = better.
  const powerball = (bodyWeight * 200) / Math.pow(stats.fortyYardDash, 4);
  return buildScore(powerball, interpolateScore(powerball, SPEED_POWERBALL_ANCHORS));
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Compute the 0-100 performance grade plus a per-category breakdown.
 *
 * Edge cases:
 * - Missing `bodyWeight` → returns zeroed result (no relative math possible).
 * - Missing categories → weights are redistributed across what's available.
 * - Implausible inputs (zero / negative) are ignored, not crashed on.
 */
export function calculatePerformanceGrade(stats: AthleteStats): PerformanceBreakdown {
  const empty: PerformanceBreakdown = {
    squat: null,
    bench: null,
    deadlift: null,
    strength: null,
    pushUps: null,
    sitUps: null,
    endurance: null,
    speed: null,
    overall: 0,
    weights: { strength: 0, speed: 0, endurance: 0 },
  };

  if (!isPositive(stats.bodyWeight)) {
    return empty;
  }
  const bodyWeight = stats.bodyWeight;

  const { squat, bench, deadlift, strength } = scoreStrength(stats, bodyWeight);
  const { pushUps, sitUps, endurance } = scoreEndurance(stats, bodyWeight);
  const speed = scoreSpeed(stats, bodyWeight);

  // Renormalize weights to whatever categories produced a score.
  const presence = {
    strength: strength ? CATEGORY_WEIGHTS.strength : 0,
    speed: speed ? CATEGORY_WEIGHTS.speed : 0,
    endurance: endurance ? CATEGORY_WEIGHTS.endurance : 0,
  };
  const totalWeight = presence.strength + presence.speed + presence.endurance;

  if (totalWeight === 0) {
    return { ...empty, squat, bench, deadlift, pushUps, sitUps };
  }

  const weights = {
    strength: presence.strength / totalWeight,
    speed: presence.speed / totalWeight,
    endurance: presence.endurance / totalWeight,
  };

  const overall =
    (strength?.score ?? 0) * weights.strength +
    (speed?.score ?? 0) * weights.speed +
    (endurance?.score ?? 0) * weights.endurance;

  return {
    squat,
    bench,
    deadlift,
    strength,
    pushUps,
    sitUps,
    endurance,
    speed,
    overall: Number(clamp(overall, 0, 100).toFixed(1)),
    weights: {
      strength: Number(weights.strength.toFixed(3)),
      speed: Number(weights.speed.toFixed(3)),
      endurance: Number(weights.endurance.toFixed(3)),
    },
  };
}

/** Convenience: just the 0-100 number (for storing on a membership). */
export function performanceGradeNumber(stats: AthleteStats): number {
  return calculatePerformanceGrade(stats).overall;
}
