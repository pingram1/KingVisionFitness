import type { WeeklyWorkoutSummary } from './user';

export interface RecommendedWorkout {
  similarity: number;
  passesRelevanceGate: boolean;
  workout: WeeklyWorkoutSummary & {
    description?: string;
    exercises?: unknown[];
  };
}

export interface WeeklyRecommendations {
  tier: string;
  externalMlUsed: boolean;
  workouts: RecommendedWorkout[];
}
