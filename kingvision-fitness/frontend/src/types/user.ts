import type { WorkoutType } from './workout';

export type UserRole = 'SUPER_ADMIN' | 'TRAINER' | 'CLIENT';

export type SubscriptionTier = 'BASIC' | 'SPECIFIED' | 'ACTIVE_CLIENT';

/** Slim user record returned by GET /api/users/active-clients. */
export interface ActiveClientSummary {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CompletedWorkoutEntry {
  workoutId?: string;
  completedAt: string;
  duration?: number;
  notes?: string;
}

export interface UserProfile {
  _id: string;
  email: string;
  /** Platform RBAC role. Defaults server-side to 'CLIENT'. */
  role: UserRole;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string | null;
    bio?: string;
    fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  subscription: {
    tier: string;
    status: string;
  };
  /** Product tier. Server-side default is 'BASIC'. */
  subscriptionTier?: SubscriptionTier;
  completedWorkouts?: CompletedWorkoutEntry[];
}

export interface WeeklyWorkoutSummary {
  _id: string;
  title: string;
  type?: WorkoutType;
  difficulty?: string;
  duration?: number;
  dayOfWeek?: number;
}
