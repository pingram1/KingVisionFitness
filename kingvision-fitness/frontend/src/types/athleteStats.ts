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
