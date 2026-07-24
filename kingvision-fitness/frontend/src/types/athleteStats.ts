export type PerformanceTier =
  | 'untrained'
  | 'beginner'
  | 'developing'
  | 'baseline'
  | 'advanced'
  | 'elite';

export interface CategoryScore {
  raw: number;
  score: number;
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
  overall: number;
  weights: { strength: number; speed: number; endurance: number };
}

/** Mirror of backend AthleteStats. All fields optional → partial submissions are valid. */
export interface AthleteStatsPayload {
  bodyWeight?: number | null;
  height?: number | null;
  squatMax?: number | null;
  benchMax?: number | null;
  deadliftMax?: number | null;
  pushUpCount?: number | null;
  sitUpCount?: number | null;
  fortyYardDash?: number | null;
}

export interface AthleteStatsResponse extends AthleteStatsPayload {
  performanceGrade: number;
  performanceBreakdown: PerformanceBreakdown | null;
  lastUpdatedAt: string | null;
}

/** Editable form state — strings so we can render empty fields cleanly. */
export type AthleteStatsFormState = Record<keyof AthleteStatsPayload, string>;

export const EMPTY_ATHLETE_FORM: AthleteStatsFormState = {
  bodyWeight: '',
  height: '',
  squatMax: '',
  benchMax: '',
  deadliftMax: '',
  pushUpCount: '',
  sitUpCount: '',
  fortyYardDash: '',
};

// ─── Everyday Fitness track (mainstream users) ─────────────────────────────

export interface EverydayFitnessPayload {
  pushUpsMax?: number | null;
  pullUpsMax?: number | null;
  sitUpsMax?: number | null;
  curlsWeight?: number | null;
  curlsReps?: number | null;
  plankSeconds?: number | null;
  burpeesCount?: number | null;
  bodyWeightLbs?: number | null;
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

export interface EverydayFitnessResponse extends EverydayFitnessPayload {
  everydayFitnessScore: number;
  lastUpdated: string | null;
}

export type EverydayFitnessFormState = Record<keyof EverydayFitnessPayload, string>;

export const EMPTY_EVERYDAY_FORM: EverydayFitnessFormState = {
  pushUpsMax: '',
  pullUpsMax: '',
  sitUpsMax: '',
  curlsWeight: '',
  curlsReps: '',
  plankSeconds: '',
  burpeesCount: '',
  bodyWeightLbs: '',
};

export type FitnessTrack = 'athletic' | 'everyday';

export type AthleteDesignation = 'none' | 'pro' | 'collegiate' | 'semi-pro' | 'independent_hs';

export interface FitnessTrackResponse {
  track: FitnessTrack;
  athleteDesignation: AthleteDesignation;
}
