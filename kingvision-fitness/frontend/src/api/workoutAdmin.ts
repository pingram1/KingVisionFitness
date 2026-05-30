import api from '../services/api';
import type { CreateWorkoutPayload, Workout } from '../types/workout';

export async function fetchPublishedWorkouts(limit = 50): Promise<Workout[]> {
  const response = await api.get<{ success: boolean; data: Workout[] }>('/workouts/published', {
    params: { limit, kind: 'workout' },
  });
  return response.data.data ?? [];
}

export async function fetchWorkoutForAdmin(workoutId: string): Promise<Workout> {
  const response = await api.get<{ success: boolean; data: Workout }>(`/workouts/${workoutId}`);
  return response.data.data;
}

export async function updateWorkoutAdmin(
  workoutId: string,
  payload: CreateWorkoutPayload
): Promise<Workout> {
  const response = await api.put<{ success: boolean; data: Workout }>(
    `/workouts/admin/${workoutId}`,
    payload
  );
  return response.data.data;
}
