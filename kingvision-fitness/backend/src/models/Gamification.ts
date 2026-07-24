import mongoose, { Document, Schema } from 'mongoose';

/**
 * Consistency & Level-Up System — per-user gamification state.
 *
 * One document per user. The engine (utils/consistencyEngine.ts) recomputes
 * `rollingConsistencyScore` from the four health pillars, then applies the
 * prestige tier ladder (sequential promotions gated by sustained calendar-day
 * verification windows).
 */

export type ConsistencyTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'olympian';

export const CONSISTENCY_TIERS: readonly ConsistencyTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'olympian',
] as const;

/** Display-synced pillar percentages committed alongside the aggregate score. */
export interface IConsistencyBreakdown {
  /** Rounded weighted habit score (0–100). */
  overallScore: number;
  /** Display component percentage (0–100). */
  workoutPillar: number;
  /** Display component percentage (0–100). */
  nutritionPillar: number;
  /** Display component percentage (0–100). */
  appCheckInPillar: number;
  /** Display component percentage (0–100). */
  fitnessStatsPillar: number;
}

/** Rolling 7-day pillar readings frozen at the last evaluation. */
export interface IPillarMetrics {
  /** Rolling 7-day sum of foreground app minutes. */
  appUsageMinutes: number;
  /** Proportional qualifying app check-in days / 7, 0–100. */
  appCheckInRate: number;
  /** Calendar days with a qualifying app check-in in the rolling 7-day window. */
  appCheckInDays: number;
  /** Proportional workout completion, 0–100 (completed / scheduled). */
  workoutCompletionRate: number;
  /** Completed workout sessions in the rolling 7-day window. */
  completedWorkouts: number;
  /** Scheduled workout slots in the rolling 7-day window. */
  scheduledWorkouts: number;
  /** Proportional nutrition verification, 0–100 (verified days / 7). */
  nutritionConsistencyRate: number;
  /** Fully verified nutrition days in the rolling 7-day window. */
  verifiedNutritionDays: number;
  /** Composite fitness pillar score after recency + delta weighting. */
  fitnessPillarScore: number;
  /** Fitness grade/score trend over ~30 days (positive = improving). */
  fitnessScoreDelta: number;
}

export interface INutritionMacros {
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
}

/** Macro log + media proof for a single calendar day. */
export interface INutritionVerification {
  verified: boolean;
  macrosLogged?: INutritionMacros | null;
  imageUrl?: string | null;
  notes?: string | null;
}

/** One day of self-reported activity. `date` is yyyy-MM-dd in the user's calendar timezone. */
export interface IDailyUsageEntry {
  date: string;
  minutes: number;
  /**
   * @deprecated Legacy flag — prefer `nutritionVerification.verified`.
   * Kept for backward compatibility with older documents.
   */
  nutritionCompliant: boolean;
  nutritionVerification?: INutritionVerification | null;
}

/**
 * Prestige verification state toward the next sequential tier.
 * Tracks consecutive local-calendar days the rolling score met threshold.
 */
export interface ITierProgression {
  /** Next rank under verification (null at Olympian). */
  candidateTier: ConsistencyTier | null;
  /** Consecutive calendar days the score met the candidate tier threshold. */
  consecutiveQualifiedDays: number;
  /** yyyy-MM-dd of the most recent day that advanced verification. */
  lastQualifiedDayKey: string | null;
}

export const EMPTY_TIER_PROGRESSION: ITierProgression = {
  candidateTier: null,
  consecutiveQualifiedDays: 0,
  lastQualifiedDayKey: null,
};

export interface IUserConsistency extends Document {
  user: mongoose.Types.ObjectId;
  currentTier: ConsistencyTier;
  currentStreakDays: number;
  /** Aggregate 4-pillar score, 0.00–100.00. */
  rollingConsistencyScore: number;
  pillarMetrics: IPillarMetrics;
  /** Rounded display pillars + overall score — always synced with rollingConsistencyScore. */
  pillarBreakdown: IConsistencyBreakdown;
  /**
   * Rolling activity log (bounded). Feeds app check-ins, nutrition verification,
   * and streak counting.
   */
  dailyUsageLog: IDailyUsageEntry[];
  /**
   * Set when the score first dropped below the active tier's maintenance
   * floor; cleared on recovery. Demotion fires once this is >3 days old.
   */
  belowMaintenanceSince: Date | null;
  /** Snapshot of the fitness grade at the previous evaluation (for delta). */
  previousFitnessScore: number | null;
  previousFitnessScoreAt: Date | null;
  lastEvaluatedAt: Date | null;
  /** Prestige verification lock toward the next sequential tier. */
  tierProgression: ITierProgression;
  /**
   * @deprecated Superseded by `tierProgression`. Retained for legacy documents.
   */
  promotionAssessmentStreak?: number;
  createdAt: Date;
  updatedAt: Date;
}

const pillarMetricsSchema = new Schema<IPillarMetrics>(
  {
    appUsageMinutes: { type: Number, default: 0, min: 0 },
    appCheckInRate: { type: Number, default: 0, min: 0, max: 100 },
    appCheckInDays: { type: Number, default: 0, min: 0, max: 7 },
    workoutCompletionRate: { type: Number, default: 0, min: 0, max: 100 },
    completedWorkouts: { type: Number, default: 0, min: 0 },
    scheduledWorkouts: { type: Number, default: 0, min: 0 },
    nutritionConsistencyRate: { type: Number, default: 0, min: 0, max: 100 },
    verifiedNutritionDays: { type: Number, default: 0, min: 0, max: 7 },
    fitnessPillarScore: { type: Number, default: 0, min: 0, max: 100 },
    fitnessScoreDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

const pillarBreakdownSchema = new Schema<IConsistencyBreakdown>(
  {
    overallScore: { type: Number, default: 0, min: 0, max: 100 },
    workoutPillar: { type: Number, default: 0, min: 0, max: 100 },
    nutritionPillar: { type: Number, default: 0, min: 0, max: 100 },
    appCheckInPillar: { type: Number, default: 0, min: 0, max: 100 },
    fitnessStatsPillar: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const nutritionMacrosSchema = new Schema<INutritionMacros>(
  {
    calories: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    fats: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const nutritionVerificationSchema = new Schema<INutritionVerification>(
  {
    verified: { type: Boolean, default: false },
    macrosLogged: { type: nutritionMacrosSchema, default: null },
    imageUrl: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const dailyUsageEntrySchema = new Schema<IDailyUsageEntry>(
  {
    date: { type: String, required: true },
    minutes: { type: Number, required: true, min: 0 },
    nutritionCompliant: { type: Boolean, default: false },
    nutritionVerification: { type: nutritionVerificationSchema, default: null },
  },
  { _id: false }
);

const tierProgressionSchema = new Schema<ITierProgression>(
  {
    candidateTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'olympian'],
      default: null,
    },
    consecutiveQualifiedDays: { type: Number, default: 0, min: 0 },
    lastQualifiedDayKey: { type: String, default: null },
  },
  { _id: false }
);

const userConsistencySchema = new Schema<IUserConsistency>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    currentTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'olympian'],
      default: 'bronze',
      required: true,
    },
    currentStreakDays: { type: Number, default: 0, min: 0 },
    rollingConsistencyScore: { type: Number, default: 0, min: 0, max: 100 },
    pillarMetrics: { type: pillarMetricsSchema, default: () => ({}) },
    pillarBreakdown: { type: pillarBreakdownSchema, default: () => ({}) },
    dailyUsageLog: { type: [dailyUsageEntrySchema], default: [] },
    belowMaintenanceSince: { type: Date, default: null },
    previousFitnessScore: { type: Number, default: null },
    previousFitnessScoreAt: { type: Date, default: null },
    lastEvaluatedAt: { type: Date, default: null },
    tierProgression: {
      type: tierProgressionSchema,
      default: () => ({ ...EMPTY_TIER_PROGRESSION }),
    },
    promotionAssessmentStreak: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userConsistencySchema.index({ currentTier: 1, rollingConsistencyScore: -1 });

const UserConsistency = mongoose.model<IUserConsistency>(
  'UserConsistency',
  userConsistencySchema
);

export default UserConsistency;
