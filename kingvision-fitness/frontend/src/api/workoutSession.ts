import api from '../services/api';
import type { Workout } from '../types/workout';

export interface LoggedSetPayload {
  setIndex: number;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface LoggedExercisePayload {
  name: string;
  sets: LoggedSetPayload[];
}

export interface CompleteWorkoutPayload {
  startTime: string;
  endTime: string;
  loggedExercises: LoggedExercisePayload[];
}

export interface CompleteWorkoutResponse {
  sessionId: string;
  workoutId: string;
  durationMinutes: number;
  completedAt: string;
}

export async function fetchWorkoutById(workoutId: string): Promise<Workout> {
  const response = await api.get<{ success: boolean; data: Workout }>(
    `/workouts/${workoutId}`
  );
  return response.data.data;
}

export async function completeWorkout(
  workoutId: string,
  payload: CompleteWorkoutPayload
): Promise<CompleteWorkoutResponse> {
  const response = await api.post<{ success: boolean; data: CompleteWorkoutResponse }>(
    `/workouts/${workoutId}/complete`,
    payload
  );
  return response.data.data;
}
