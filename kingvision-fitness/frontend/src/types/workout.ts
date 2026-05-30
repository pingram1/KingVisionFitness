export type WorkoutType =
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'flexibility'
  | 'functional'
  | 'mixed';

export type WorkoutDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface WorkoutMetaTags {
  intensity: number;
  volumeLoadIndex: number;
  cardiovascularStress: number;
  recoveryDemand: number;
  skillComplexity?: number;
  mobilityDemand?: number;
}

export interface AssignedClientSummary {
  _id: string;
  email: string;
  profile?: {
    firstName?: string;
    lastName?: string;
  };
}

export type ExerciseTargetType = 'reps' | 'duration';

export type ExerciseEquipment =
  | 'bodyweight'
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'none';

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  duration?: number;
  restTime?: number;
  weight?: string;
  videoUrl?: string;
  notes?: string;
  muscleGroups?: string[];
  equipment?: string;
}

export interface Workout {
  _id: string;
  title: string;
  description?: string;
  type: WorkoutType;
  difficulty: WorkoutDifficulty;
  duration: number;
  exercises?: WorkoutExercise[];
  targetMuscleGroups?: string[];
  equipment?: string[];
  location?: 'gym' | 'home' | 'outdoor' | 'any';
  calories?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  metaTags?: WorkoutMetaTags;
  tags?: string[];
  isPublic?: boolean;
  isCustom?: boolean;
  assignedTo?: Array<string | AssignedClientSummary>;
  weekNumber?: number;
  dayOfWeek?: number;
  completionCount?: number;
  averageRating?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DistributionType = 'weekly_public' | 'custom_client';
export type ContentKind = 'workout' | 'tutoring';

/** Client-side exercise row in the admin Exercise Builder. */
export interface ExerciseDraft {
  id: string;
  name: string;
  sets: string;
  targetType: ExerciseTargetType;
  /** Reps (e.g. "8-12") when targetType is reps; seconds when duration. */
  targetValue: string;
  equipment: ExerciseEquipment;
  restTime: string;
  videoUrl: string;
}

/** Payload shape for each exercise sent to POST /api/workouts. */
export interface WorkoutExerciseInput {
  name: string;
  sets: number;
  reps: string;
  duration?: number;
  equipment?: ExerciseEquipment;
  restTime?: string;
  videoUrl?: string;
}

export interface CreateWorkoutPayload {
  title: string;
  description: string;
  distributionType: DistributionType;
  contentKind: ContentKind;
  videoUrl?: string;
  duration: number;
  difficulty: WorkoutDifficulty;
  workoutType?: WorkoutType;
  targetMuscleGroups: string[];
  exercises?: WorkoutExerciseInput[];
  metaTags: {
    intensity: number;
    volumeLoadIndex: number;
    cardiovascularStress: number;
    recoveryDemand: number;
    skillComplexity: number;
    mobilityDemand: number;
  };
  weekNumber?: number;
  dayOfWeek?: number;
  assignedTo?: string[];
}

export interface WeeklyWorkoutsResponse {
  success: boolean;
  data: Workout[];
  meta?: { weekNumber: number };
}

export interface WorkoutsListResponse {
  success: boolean;
  data: Workout[];
}
