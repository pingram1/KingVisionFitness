export type ConsistencyTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'olympian';

export interface NutritionMacrosInput {
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
}

export interface NutritionVerificationRecord {
  verified: boolean;
  macrosLogged?: NutritionMacrosInput | null;
  imageUrl?: string | null;
  notes?: string | null;
}

/** Server-authored display pillars — never recompute on the client. */
export interface ConsistencyBreakdown {
  overallScore: number;
  workoutPillar: number;
  nutritionPillar: number;
  appCheckInPillar: number;
  fitnessStatsPillar: number;
}

export interface PillarMetrics {
  appUsageMinutes: number;
  appCheckInRate: number;
  appCheckInDays: number;
  workoutCompletionRate: number;
  completedWorkouts: number;
  scheduledWorkouts: number;
  nutritionConsistencyRate: number;
  verifiedNutritionDays: number;
  fitnessPillarScore: number;
  fitnessScoreDelta: number;
}

export interface TierProgression {
  candidateTier: ConsistencyTier | null;
  consecutiveQualifiedDays: number;
  lastQualifiedDayKey: string | null;
}

export interface GamificationStatus {
  currentTier: ConsistencyTier;
  badgeLabel: string;
  /** Mirrors pillarBreakdown.overallScore from the server. */
  rollingConsistencyScore: number;
  pillarBreakdown: ConsistencyBreakdown;
  currentStreakDays: number;
  pillarMetrics: PillarMetrics;
  maintenanceFloor: number | null;
  nextTier: ConsistencyTier | null;
  nextTierThreshold: number | null;
  nextTierProgressPercent: number;
  tierProgression: TierProgression;
  verificationDaysRequired: number | null;
  verificationDaysCompleted: number;
  minimumStreakRequired: number | null;
  promoted: boolean;
  demoted: boolean;
  lastEvaluatedAt: string;
}

export interface NutritionVerificationPayload {
  macrosLogged: NutritionMacrosInput;
  imageUrl?: string;
  notes?: string;
}

export interface NutritionVerificationResponse {
  date: string;
  nutritionVerification: NutritionVerificationRecord | null | undefined;
  consistency: GamificationStatus;
}
