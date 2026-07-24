import mongoose from 'mongoose';
import User from '../models/User';
import WorkoutSession from '../models/WorkoutSession';
import UserConsistency, {
  ConsistencyTier,
  CONSISTENCY_TIERS,
  EMPTY_TIER_PROGRESSION,
  IConsistencyBreakdown,
  IDailyUsageEntry,
  INutritionMacros,
  INutritionVerification,
  IPillarMetrics,
  ITierProgression,
  IUserConsistency,
} from '../models/Gamification';

/**
 * KingVision Consistency & Level-Up engine.
 *
 * Aggregates four health pillars over a rolling 7-day window into a single
 * 0–100% consistency score, then applies the tier ladder:
 *
 *   overall = 0.40 * workouts + 0.30 * nutrition + 0.15 * appUsage + 0.15 * fitness
 *
 * Perfection ceiling: 7/7 verified nutrition days, 100% of scheduled workouts,
 * 7/7 app check-in days, and a fresh/improving fitness test within 30 days.
 *
 * Calendar-day keys and streaks use the user's profile timezone (or the
 * client `X-User-Timezone` / `X-Timezone` header) — never raw UTC midnight boundaries.
 */

// ─── Tunables ───────────────────────────────────────────────────────────────

const ROLLING_WINDOW_DAYS = 7;
/** Activity + streak scan window — must cover Olympian's 45-day requirement. */
const STREAK_WINDOW_DAYS = 45;
const FITNESS_CHECKIN_WINDOW_DAYS = 30;
/** Full fitness pillar credit when stats were updated within this many days. */
const FITNESS_FULL_CREDIT_DAYS = 14;
/** Minimum fitness pillar credit at the edge of the 30-day window. */
const FITNESS_MIN_CREDIT_SCORE = 50;
/** Default weekly workout slots when no trainer schedule exists. */
const DEFAULT_WEEKLY_WORKOUT_SLOTS = 7;
/** Minimum foreground minutes for a calendar day to count as an app check-in. */
const MIN_ACTIVE_APP_MINUTES = 5;
/** Consecutive days below the maintenance floor before a demotion fires. */
const DEMOTION_GRACE_DAYS = 3;
/** Cap the usage log — sized for Olympian verification horizon. */
const USAGE_LOG_MAX_ENTRIES = 50;
/** Skip full recomputation if evaluated more recently than this. */
const EVALUATION_STALENESS_MS = 10 * 60 * 1000;

export const DEFAULT_TIMEZONE = 'America/New_York';

const PILLAR_WEIGHTS = {
  workout: 0.4,
  nutrition: 0.3,
  appUsage: 0.15,
  fitness: 0.15,
} as const;

// ─── Timezone helpers ───────────────────────────────────────────────────────

export function isValidTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the calendar timezone: profile preference → request header → default.
 */
export function resolveTimezone(
  profileTimezone?: string | null,
  headerTimezone?: string | null
): string {
  if (profileTimezone && isValidTimezone(profileTimezone)) return profileTimezone;
  if (headerTimezone && isValidTimezone(headerTimezone)) return headerTimezone;
  return DEFAULT_TIMEZONE;
}

/** yyyy-MM-dd calendar day in the target IANA timezone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Step a yyyy-MM-dd key by whole calendar days (timezone-agnostic key math). */
export function shiftDayKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  const yyyy = anchor.getUTCFullYear();
  const mm = String(anchor.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function recentDayKeys(days: number, now: Date, timeZone: string): string[] {
  const today = dayKey(now, timeZone);
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(shiftDayKey(today, -i));
  }
  return keys;
}

// ─── Tier ladder ────────────────────────────────────────────────────────────

export interface TierRule {
  tier: ConsistencyTier;
  /** Rolling score required to promote INTO this tier. Null = starting tier. */
  promotionThreshold: number | null;
  /** Rolling score required to KEEP this tier. Null = cannot be demoted. */
  maintenanceFloor: number | null;
  badgeLabel: string;
}

/** Ordered lowest → highest. Index = rank. */
export const TIER_LADDER: readonly TierRule[] = [
  { tier: 'bronze', promotionThreshold: null, maintenanceFloor: null, badgeLabel: 'Bronze Bicep Badge' },
  { tier: 'silver', promotionThreshold: 85, maintenanceFloor: 80, badgeLabel: 'Silver Bicep Badge' },
  { tier: 'gold', promotionThreshold: 90, maintenanceFloor: 85, badgeLabel: 'Gold Bicep Badge' },
  { tier: 'platinum', promotionThreshold: 95, maintenanceFloor: 90, badgeLabel: 'Platinum Bicep Badge' },
  { tier: 'diamond', promotionThreshold: 98, maintenanceFloor: 95, badgeLabel: 'Diamond Bicep Badge' },
  { tier: 'olympian', promotionThreshold: 100, maintenanceFloor: 100, badgeLabel: 'Crowned Olympian Badge' },
] as const;

/** Sustained calendar-day verification required to earn each prestige rank. */
export const TIER_PRESTIGE_REQUIREMENTS: Record<
  Exclude<ConsistencyTier, 'bronze'>,
  { verificationDays: number; minimumStreak: number }
> = {
  silver: { verificationDays: 7, minimumStreak: 7 },
  gold: { verificationDays: 14, minimumStreak: 14 },
  platinum: { verificationDays: 21, minimumStreak: 21 },
  diamond: { verificationDays: 30, minimumStreak: 30 },
  olympian: { verificationDays: 45, minimumStreak: 45 },
};

export function prestigeRequirementForTier(
  tier: ConsistencyTier
): { verificationDays: number; minimumStreak: number } | null {
  if (tier === 'bronze') return null;
  return TIER_PRESTIGE_REQUIREMENTS[tier];
}

export function nextCandidateTier(currentTier: ConsistencyTier): ConsistencyTier | null {
  const rank = tierRank(currentTier);
  return rank + 1 < TIER_LADDER.length ? TIER_LADDER[rank + 1].tier : null;
}

export function normalizeTierProgression(
  raw: Partial<ITierProgression> | null | undefined,
  currentTier: ConsistencyTier
): ITierProgression {
  const candidateTier = nextCandidateTier(currentTier);
  if (!candidateTier) {
    return { ...EMPTY_TIER_PROGRESSION, candidateTier: null };
  }
  return {
    candidateTier: raw?.candidateTier ?? candidateTier,
    consecutiveQualifiedDays: raw?.consecutiveQualifiedDays ?? 0,
    lastQualifiedDayKey: raw?.lastQualifiedDayKey ?? null,
  };
}

/**
 * Advance prestige verification at most once per local calendar day.
 * Resets when the score or streak falls below the candidate tier gates.
 */
export function advanceTierProgression(
  currentTier: ConsistencyTier,
  score: number,
  currentStreakDays: number,
  progression: ITierProgression,
  todayKey: string
): ITierProgression {
  const candidateTier = nextCandidateTier(currentTier);
  if (!candidateTier) {
    return { ...EMPTY_TIER_PROGRESSION, candidateTier: null };
  }

  const rule = tierRule(candidateTier);
  const prestige = prestigeRequirementForTier(candidateTier);
  const threshold = rule.promotionThreshold;

  if (
    threshold === null ||
    prestige === null ||
    score < threshold ||
    currentStreakDays < prestige.minimumStreak
  ) {
    return {
      candidateTier,
      consecutiveQualifiedDays: 0,
      lastQualifiedDayKey: null,
    };
  }

  if (progression.lastQualifiedDayKey === todayKey) {
    return {
      candidateTier,
      consecutiveQualifiedDays: progression.consecutiveQualifiedDays,
      lastQualifiedDayKey: todayKey,
    };
  }

  const yesterdayKey = shiftDayKey(todayKey, -1);
  const consecutive =
    progression.lastQualifiedDayKey === yesterdayKey
      ? progression.consecutiveQualifiedDays + 1
      : 1;

  return {
    candidateTier,
    consecutiveQualifiedDays: consecutive,
    lastQualifiedDayKey: todayKey,
  };
}

export function isPrestigePromotionReady(
  currentTier: ConsistencyTier,
  currentStreakDays: number,
  progression: ITierProgression
): boolean {
  const candidateTier = nextCandidateTier(currentTier);
  if (!candidateTier || progression.candidateTier !== candidateTier) return false;

  const prestige = prestigeRequirementForTier(candidateTier);
  if (!prestige) return false;

  return (
    progression.consecutiveQualifiedDays >= prestige.verificationDays &&
    currentStreakDays >= prestige.minimumStreak
  );
}

export function freshTierProgressionForTier(tier: ConsistencyTier): ITierProgression {
  const candidateTier = nextCandidateTier(tier);
  return {
    candidateTier,
    consecutiveQualifiedDays: 0,
    lastQualifiedDayKey: null,
  };
}

export function tierRank(tier: ConsistencyTier): number {
  return CONSISTENCY_TIERS.indexOf(tier);
}

export function tierRule(tier: ConsistencyTier): TierRule {
  return TIER_LADDER[tierRank(tier)];
}

/** Highest tier whose promotion threshold the score satisfies. */
export function tierForScore(score: number): ConsistencyTier {
  let eligible: ConsistencyTier = 'bronze';
  for (const rule of TIER_LADDER) {
    if (rule.promotionThreshold === null || score >= rule.promotionThreshold) {
      eligible = rule.tier;
    }
  }
  return eligible;
}

export type { IConsistencyBreakdown };

// ─── Pure scoring math ──────────────────────────────────────────────────────

export interface PillarInputs {
  /** Proportional completed / scheduled workouts, 0–100. */
  workoutCompletionRate: number;
  /** Proportional verified nutrition days / 7, 0–100. */
  nutritionConsistencyRate: number;
  /** Proportional qualifying app check-in days / 7, 0–100. */
  appCheckInRate: number;
  /** Composite fitness maintenance + delta score, 0–100. */
  fitnessPillarScore: number;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Proportional pillar rate: numerator / denominator × 100, capped at 100. */
export function proportionalPillarRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(clamp((numerator / denominator) * 100, 0, 100).toFixed(2));
}

export function isNutritionVerifiedEntry(entry: IDailyUsageEntry): boolean {
  if (entry.nutritionVerification?.verified === true) return true;
  return entry.nutritionCompliant === true;
}

export function hasQualifyingAppCheckIn(entry: IDailyUsageEntry): boolean {
  return entry.minutes >= MIN_ACTIVE_APP_MINUTES;
}

/**
 * Sliding fitness pillar credit by recency of the latest stats check-in.
 * 100 at ≤14 days, linear down to 50 at 30 days, 0 beyond 30 days.
 */
export function fitnessPillarScoreFromAge(ageDays: number): number {
  if (ageDays > FITNESS_CHECKIN_WINDOW_DAYS) return 0;
  if (ageDays <= FITNESS_FULL_CREDIT_DAYS) return 100;
  const span = FITNESS_CHECKIN_WINDOW_DAYS - FITNESS_FULL_CREDIT_DAYS;
  const t = (ageDays - FITNESS_FULL_CREDIT_DAYS) / span;
  return Number(clamp(100 - t * (100 - FITNESS_MIN_CREDIT_SCORE), FITNESS_MIN_CREDIT_SCORE, 100).toFixed(2));
}

export function fitnessPillarScoreFromLastUpdated(
  lastUpdated: Date | string | null | undefined,
  now: Date
): number {
  if (!lastUpdated) return 0;
  const at = new Date(lastUpdated);
  if (Number.isNaN(at.getTime())) return 0;
  const ageDays = (now.getTime() - at.getTime()) / (24 * 60 * 60 * 1000);
  return fitnessPillarScoreFromAge(ageDays);
}

/**
 * Blends recency credit with maintenance/improvement delta from profile tests.
 * Positive deltas add up to +15 pts; declines subtract up to −10 pts.
 */
export function compositeFitnessPillarScore(
  recencyScore: number,
  fitnessScoreDelta: number
): number {
  let deltaAdjustment = 0;
  if (fitnessScoreDelta > 0) {
    deltaAdjustment = Math.min(15, fitnessScoreDelta * 1.5);
  } else if (fitnessScoreDelta < 0) {
    deltaAdjustment = Math.max(-10, fitnessScoreDelta);
  }
  return Number(clamp(recencyScore + deltaAdjustment, 0, 100).toFixed(2));
}

/**
 * Build display-synced pillar integers and an overall score that is the exact
 * weighted sum of those rounded components (40 / 30 / 15 / 15).
 */
export function buildConsistencyBreakdown(inputs: PillarInputs): IConsistencyBreakdown {
  const workoutPillar = Math.round(clamp(inputs.workoutCompletionRate, 0, 100));
  const nutritionPillar = Math.round(clamp(inputs.nutritionConsistencyRate, 0, 100));
  const appCheckInPillar = Math.round(clamp(inputs.appCheckInRate, 0, 100));
  const fitnessStatsPillar = Math.round(clamp(inputs.fitnessPillarScore, 0, 100));

  const overallScore = Math.round(
    clamp(
      workoutPillar * PILLAR_WEIGHTS.workout +
        nutritionPillar * PILLAR_WEIGHTS.nutrition +
        appCheckInPillar * PILLAR_WEIGHTS.appUsage +
        fitnessStatsPillar * PILLAR_WEIGHTS.fitness,
      0,
      100
    )
  );

  return {
    overallScore,
    workoutPillar,
    nutritionPillar,
    appCheckInPillar,
    fitnessStatsPillar,
  };
}

/** Rebuild a breakdown from stored raw pillar metrics (legacy document hydration). */
export function breakdownFromPillarMetrics(metrics: IPillarMetrics): IConsistencyBreakdown {
  return buildConsistencyBreakdown({
    workoutCompletionRate: metrics.workoutCompletionRate ?? 0,
    nutritionConsistencyRate: metrics.nutritionConsistencyRate ?? 0,
    appCheckInRate: metrics.appCheckInRate ?? 0,
    fitnessPillarScore: metrics.fitnessPillarScore ?? 0,
  });
}

/**
 * Weighted 4-pillar aggregate, 0–100. Delegates to {@link buildConsistencyBreakdown}.
 */
export function aggregateConsistencyScore(inputs: PillarInputs): number {
  return buildConsistencyBreakdown(inputs).overallScore;
}

export interface TierTransition {
  nextTier: ConsistencyTier;
  belowMaintenanceSince: Date | null;
  demoted: boolean;
  promoted: boolean;
  tierProgression: ITierProgression;
}

/**
 * Prestige promotion / demotion state machine. Pure.
 *
 * - Sequential rank-ups only — at most one tier per confirmed promotion.
 * - Promotion requires sustained calendar-day verification (see
 *   {@link TIER_PRESTIGE_REQUIREMENTS}) plus matching activity streak.
 * - Demotion retains the 3-day maintenance-floor grace window.
 */
export function evaluateTierTransition(
  currentTier: ConsistencyTier,
  score: number,
  belowMaintenanceSince: Date | null,
  tierProgression: ITierProgression,
  currentStreakDays: number,
  todayKey: string,
  now: Date
): TierTransition {
  const updatedProgression = advanceTierProgression(
    currentTier,
    score,
    currentStreakDays,
    tierProgression,
    todayKey
  );

  if (isPrestigePromotionReady(currentTier, currentStreakDays, updatedProgression)) {
    const nextRule = tierRule(updatedProgression.candidateTier as ConsistencyTier);
    return {
      nextTier: nextRule.tier,
      belowMaintenanceSince: null,
      demoted: false,
      promoted: true,
      tierProgression: freshTierProgressionForTier(nextRule.tier),
    };
  }

  const floor = tierRule(currentTier).maintenanceFloor;
  if (floor === null || score >= floor) {
    return {
      nextTier: currentTier,
      belowMaintenanceSince: null,
      demoted: false,
      promoted: false,
      tierProgression: updatedProgression,
    };
  }

  const since = belowMaintenanceSince ?? now;
  const graceMs = DEMOTION_GRACE_DAYS * 24 * 60 * 60 * 1000;
  if (now.getTime() - since.getTime() > graceMs) {
    const demotedTier = CONSISTENCY_TIERS[Math.max(0, tierRank(currentTier) - 1)];
    return {
      nextTier: demotedTier,
      belowMaintenanceSince: null,
      demoted: true,
      promoted: false,
      tierProgression: freshTierProgressionForTier(demotedTier),
    };
  }

  return {
    nextTier: currentTier,
    belowMaintenanceSince: since,
    demoted: false,
    promoted: false,
    tierProgression: updatedProgression,
  };
}

/** Consecutive calendar-day streak ending today (or yesterday) in the target timezone. */
export function computeStreakDays(
  activeDayKeys: Set<string>,
  now: Date,
  timeZone: string
): number {
  let cursor = dayKey(now, timeZone);
  if (!activeDayKeys.has(cursor)) {
    cursor = shiftDayKey(cursor, -1);
  }
  let streak = 0;
  while (activeDayKeys.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

// ─── Data gathering ─────────────────────────────────────────────────────────

interface GatheredPillars {
  inputs: PillarInputs;
  fitnessScoreDelta: number;
  currentFitnessScore: number | null;
  activityDayKeys: Set<string>;
  appUsageMinutes: number;
  appCheckInDays: number;
  completedWorkouts: number;
  scheduledWorkouts: number;
  verifiedNutritionDays: number;
}

async function gatherPillarData(
  userId: mongoose.Types.ObjectId,
  doc: IUserConsistency,
  now: Date,
  timeZone: string
): Promise<GatheredPillars> {
  const windowStart = new Date(now.getTime() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const streakWindowStart = new Date(now.getTime() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const fitnessWindowStart = new Date(
    now.getTime() - FITNESS_CHECKIN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [user, sessionsInStreakWindow] = await Promise.all([
      User.findById(userId)
        .select('athleteStats everydayFitnessStats')
        .lean(),
      WorkoutSession.find({ userId, endTime: { $gte: streakWindowStart } })
        .select('endTime durationMinutes')
        .lean(),
    ]);

  const sessionsInRollingWindow = sessionsInStreakWindow.filter(
    (s) => new Date(s.endTime) >= windowStart
  );

  // ── Pillar 1: proportional workout completion (40%) ──
  // Weekly ceiling is always 7 logged/completed sessions — not per-user assignment count.
  const scheduledWorkouts = DEFAULT_WEEKLY_WORKOUT_SLOTS;
  const completedWorkouts = sessionsInRollingWindow.length;
  const workoutCompletionRate = proportionalPillarRate(
    completedWorkouts,
    scheduledWorkouts
  );

  // ── Pillar 2: proportional nutrition verification (30%) ──
  const windowKeys = new Set(recentDayKeys(ROLLING_WINDOW_DAYS, now, timeZone));
  const verifiedNutritionDays = doc.dailyUsageLog.filter(
    (entry) => windowKeys.has(entry.date) && isNutritionVerifiedEntry(entry)
  ).length;
  const nutritionConsistencyRate = proportionalPillarRate(
    verifiedNutritionDays,
    ROLLING_WINDOW_DAYS
  );

  // ── Pillar 3: proportional app check-in days (15%) ──
  const appCheckInDays = doc.dailyUsageLog.filter(
    (entry) => windowKeys.has(entry.date) && hasQualifyingAppCheckIn(entry)
  ).length;
  const appCheckInRate = proportionalPillarRate(appCheckInDays, ROLLING_WINDOW_DAYS);
  const appUsageMinutes = doc.dailyUsageLog
    .filter((entry) => windowKeys.has(entry.date))
    .reduce((sum, entry) => sum + entry.minutes, 0);

  // ── Pillar 4: graduated fitness + maintenance delta (15%) ──
  const athleteUpdatedAt = user?.athleteStats?.lastUpdatedAt ?? null;
  const everydayUpdatedAt = user?.everydayFitnessStats?.lastUpdated ?? null;
  const athleteRecency = fitnessPillarScoreFromLastUpdated(athleteUpdatedAt, now);
  const everydayRecency = fitnessPillarScoreFromLastUpdated(everydayUpdatedAt, now);
  const recencyScore = Math.max(athleteRecency, everydayRecency);

  const currentFitnessScore =
    user?.athleteStats?.performanceGrade && user.athleteStats.performanceGrade > 0
      ? user.athleteStats.performanceGrade
      : (user?.everydayFitnessStats?.everydayFitnessScore ?? null);

  const deltaBaselineFresh =
    doc.previousFitnessScoreAt !== null &&
    new Date(doc.previousFitnessScoreAt) >= fitnessWindowStart;
  const fitnessScoreDelta =
    currentFitnessScore !== null && doc.previousFitnessScore !== null && deltaBaselineFresh
      ? Number((currentFitnessScore - doc.previousFitnessScore).toFixed(1))
      : 0;
  const fitnessPillarScore = compositeFitnessPillarScore(recencyScore, fitnessScoreDelta);

  // ── Streak: hardened activity thresholds ──
  const streakKeys = new Set(recentDayKeys(STREAK_WINDOW_DAYS, now, timeZone));
  const activityDayKeys = new Set<string>();

  doc.dailyUsageLog.forEach((entry) => {
    if (!streakKeys.has(entry.date)) return;
    if (isNutritionVerifiedEntry(entry) || hasQualifyingAppCheckIn(entry)) {
      activityDayKeys.add(entry.date);
    }
  });

  sessionsInStreakWindow.forEach((s) => {
    activityDayKeys.add(dayKey(new Date(s.endTime), timeZone));
  });

  return {
    inputs: {
      workoutCompletionRate,
      nutritionConsistencyRate,
      appCheckInRate,
      fitnessPillarScore,
    },
    fitnessScoreDelta,
    currentFitnessScore,
    activityDayKeys,
    appUsageMinutes,
    appCheckInDays,
    completedWorkouts,
    scheduledWorkouts,
    verifiedNutritionDays,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ConsistencyEvaluation {
  tier: ConsistencyTier;
  badgeLabel: string;
  rollingConsistencyScore: number;
  pillarBreakdown: IConsistencyBreakdown;
  currentStreakDays: number;
  pillarMetrics: IPillarMetrics;
  promoted: boolean;
  demoted: boolean;
  lastEvaluatedAt: Date;
  tierProgression: ITierProgression;
}

export interface ConsistencyCalculationOptions {
  force?: boolean;
  timeZone?: string;
}

async function resolveTimeZoneForUser(
  userId: mongoose.Types.ObjectId,
  override?: string
): Promise<string> {
  if (override && isValidTimezone(override)) return override;
  const user = await User.findById(userId).select('settings.timezone').lean();
  return resolveTimezone(user?.settings?.timezone);
}

async function getOrCreateConsistencyDoc(
  userId: mongoose.Types.ObjectId
): Promise<IUserConsistency> {
  const existing = await UserConsistency.findOne({ user: userId });
  if (existing) return existing;
  return UserConsistency.create({ user: userId });
}

function evaluationFromDocument(doc: IUserConsistency): ConsistencyEvaluation {
  const progression = normalizeTierProgression(doc.tierProgression, doc.currentTier);
  const pillarBreakdown = breakdownFromPillarMetrics(doc.pillarMetrics);

  return {
    tier: doc.currentTier,
    badgeLabel: tierRule(doc.currentTier).badgeLabel,
    rollingConsistencyScore: pillarBreakdown.overallScore,
    pillarBreakdown,
    currentStreakDays: doc.currentStreakDays,
    pillarMetrics: doc.pillarMetrics,
    promoted: false,
    demoted: false,
    lastEvaluatedAt: new Date(doc.lastEvaluatedAt as Date),
    tierProgression: progression,
  };
}

/**
 * Recompute the 4-pillar consistency score, streak, and tier for a user, then
 * persist the result. Runs at most once per 10 minutes unless `force` is set —
 * safe to call as a login/status hook or from a cron sweep.
 */
export async function calculateUserConsistency(
  userId: string | mongoose.Types.ObjectId,
  options: ConsistencyCalculationOptions = {}
): Promise<ConsistencyEvaluation> {
  const objectId = new mongoose.Types.ObjectId(String(userId));
  const doc = await getOrCreateConsistencyDoc(objectId);
  const now = new Date();
  const timeZone = await resolveTimeZoneForUser(objectId, options.timeZone);

  const fresh =
    doc.lastEvaluatedAt !== null &&
    now.getTime() - new Date(doc.lastEvaluatedAt).getTime() < EVALUATION_STALENESS_MS;

  if (fresh && !options.force) {
    return evaluationFromDocument(doc);
  }

  const gathered = await gatherPillarData(objectId, doc, now, timeZone);
  const pillarBreakdown = buildConsistencyBreakdown(gathered.inputs);
  const score = pillarBreakdown.overallScore;
  const currentStreakDays = computeStreakDays(gathered.activityDayKeys, now, timeZone);
  const todayKey = dayKey(now, timeZone);
  const progression = normalizeTierProgression(doc.tierProgression, doc.currentTier);
  const transition = evaluateTierTransition(
    doc.currentTier,
    score,
    doc.belowMaintenanceSince,
    progression,
    currentStreakDays,
    todayKey,
    now
  );

  doc.currentTier = transition.nextTier;
  doc.belowMaintenanceSince = transition.belowMaintenanceSince;
  doc.tierProgression = transition.tierProgression;
  doc.rollingConsistencyScore = score;
  doc.pillarBreakdown = pillarBreakdown;
  doc.currentStreakDays = currentStreakDays;
  doc.pillarMetrics = {
    appUsageMinutes: gathered.appUsageMinutes,
    appCheckInRate: gathered.inputs.appCheckInRate,
    appCheckInDays: gathered.appCheckInDays,
    workoutCompletionRate: gathered.inputs.workoutCompletionRate,
    completedWorkouts: gathered.completedWorkouts,
    scheduledWorkouts: gathered.scheduledWorkouts,
    nutritionConsistencyRate: gathered.inputs.nutritionConsistencyRate,
    verifiedNutritionDays: gathered.verifiedNutritionDays,
    fitnessPillarScore: gathered.inputs.fitnessPillarScore,
    fitnessScoreDelta: gathered.fitnessScoreDelta,
  };
  if (
    gathered.currentFitnessScore !== null &&
    (doc.previousFitnessScoreAt === null ||
      now.getTime() - new Date(doc.previousFitnessScoreAt).getTime() >
        FITNESS_CHECKIN_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  ) {
    doc.previousFitnessScore = gathered.currentFitnessScore;
    doc.previousFitnessScoreAt = now;
  }
  doc.lastEvaluatedAt = now;
  await doc.save();

  return {
    tier: doc.currentTier,
    badgeLabel: tierRule(doc.currentTier).badgeLabel,
    rollingConsistencyScore: score,
    pillarBreakdown,
    currentStreakDays: doc.currentStreakDays,
    pillarMetrics: doc.pillarMetrics,
    promoted: transition.promoted,
    demoted: transition.demoted,
    lastEvaluatedAt: now,
    tierProgression: doc.tierProgression,
  };
}

/**
 * Record foreground app-usage minutes (and optional macro compliance) for
 * today in the user's calendar timezone, keeping the log bounded.
 */
export async function logAppSession(
  userId: string | mongoose.Types.ObjectId,
  minutes: number,
  nutritionCompliant?: boolean,
  timeZone?: string
): Promise<IDailyUsageEntry> {
  const objectId = new mongoose.Types.ObjectId(String(userId));
  const doc = await getOrCreateConsistencyDoc(objectId);
  const tz = await resolveTimeZoneForUser(objectId, timeZone);
  const today = dayKey(new Date(), tz);

  let entry = doc.dailyUsageLog.find((e) => e.date === today);
  if (entry) {
    entry.minutes += minutes;
    if (nutritionCompliant === true) entry.nutritionCompliant = true;
  } else {
    entry = {
      date: today,
      minutes,
      nutritionCompliant: nutritionCompliant === true,
      nutritionVerification: null,
    };
    doc.dailyUsageLog.push(entry);
  }

  if (doc.dailyUsageLog.length > USAGE_LOG_MAX_ENTRIES) {
    doc.dailyUsageLog = doc.dailyUsageLog
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, USAGE_LOG_MAX_ENTRIES);
  }

  await doc.save();
  return entry;
}

export interface NutritionVerificationInput {
  macrosLogged: INutritionMacros;
  imageUrl?: string;
  notes?: string;
}

function parseNutritionMacros(raw: unknown): INutritionMacros | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const fields = ['calories', 'carbs', 'protein', 'fats'] as const;
  const parsed: Partial<INutritionMacros> = {};

  for (const field of fields) {
    const value = source[field];
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) {
      return null;
    }
    parsed[field] = numeric;
  }

  return parsed as INutritionMacros;
}

/**
 * Record a fully verified nutrition day (macros + optional media/notes) for
 * today in the user's calendar timezone.
 */
export async function logNutritionVerification(
  userId: string | mongoose.Types.ObjectId,
  input: NutritionVerificationInput,
  timeZone?: string
): Promise<IDailyUsageEntry> {
  const macros = parseNutritionMacros(input.macrosLogged);
  if (!macros) {
    throw new Error('INVALID_MACROS');
  }

  const objectId = new mongoose.Types.ObjectId(String(userId));
  const doc = await getOrCreateConsistencyDoc(objectId);
  const tz = await resolveTimeZoneForUser(objectId, timeZone);
  const today = dayKey(new Date(), tz);

  const verification: INutritionVerification = {
    verified: true,
    macrosLogged: macros,
    imageUrl: typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0
      ? input.imageUrl.trim()
      : null,
    notes: typeof input.notes === 'string' && input.notes.trim().length > 0
      ? input.notes.trim()
      : null,
  };

  let entry = doc.dailyUsageLog.find((e) => e.date === today);
  if (entry) {
    entry.nutritionVerification = verification;
    entry.nutritionCompliant = true;
  } else {
    entry = {
      date: today,
      minutes: 0,
      nutritionCompliant: true,
      nutritionVerification: verification,
    };
    doc.dailyUsageLog.push(entry);
  }

  if (doc.dailyUsageLog.length > USAGE_LOG_MAX_ENTRIES) {
    doc.dailyUsageLog = doc.dailyUsageLog
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, USAGE_LOG_MAX_ENTRIES);
  }

  await doc.save();
  return entry;
}

/** Progress context toward the next tier (for UI progress bars). */
export interface NextTierProgress {
  nextTier: ConsistencyTier | null;
  nextTierThreshold: number | null;
  /** 0–100 progress from the current tier's baseline toward the next threshold. */
  progressPercent: number;
  maintenanceFloor: number | null;
  verificationDaysRequired: number | null;
  verificationDaysCompleted: number;
  minimumStreakRequired: number | null;
}

export function nextTierProgress(
  currentTier: ConsistencyTier,
  score: number,
  tierProgression?: ITierProgression
): NextTierProgress {
  const rank = tierRank(currentTier);
  const rule = TIER_LADDER[rank];
  const next = rank + 1 < TIER_LADDER.length ? TIER_LADDER[rank + 1] : null;

  if (!next || next.promotionThreshold === null) {
    return {
      nextTier: null,
      nextTierThreshold: null,
      progressPercent: 100,
      maintenanceFloor: rule.maintenanceFloor,
      verificationDaysRequired: null,
      verificationDaysCompleted: 0,
      minimumStreakRequired: null,
    };
  }

  const prestige = prestigeRequirementForTier(next.tier);
  const base = rule.promotionThreshold ?? 0;
  const span = next.promotionThreshold - base;
  const progress = span > 0 ? clamp(((score - base) / span) * 100, 0, 100) : 0;

  return {
    nextTier: next.tier,
    nextTierThreshold: next.promotionThreshold,
    progressPercent: Number(progress.toFixed(1)),
    maintenanceFloor: rule.maintenanceFloor,
    verificationDaysRequired: prestige?.verificationDays ?? null,
    verificationDaysCompleted: tierProgression?.consecutiveQualifiedDays ?? 0,
    minimumStreakRequired: prestige?.minimumStreak ?? null,
  };
}
