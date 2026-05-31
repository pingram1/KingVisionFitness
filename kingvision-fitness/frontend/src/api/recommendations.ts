import api from '../services/api';
import type { WeeklyRecommendations } from '../types/recommendations';

export async function fetchWeeklyRecommendations(slots = 3): Promise<WeeklyRecommendations> {
  const response = await api.get<{ success: boolean; data: WeeklyRecommendations }>(
    '/recommendations/weekly-workouts',
    { params: { slots } }
  );
  return response.data.data;
}
