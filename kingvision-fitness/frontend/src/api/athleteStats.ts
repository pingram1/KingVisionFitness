import api from '../services/api';
import type {
  AthleteStatsPayload,
  AthleteStatsResponse,
  PerformanceBreakdown,
} from '../types/athleteStats';

export async function fetchAthleteStats(): Promise<AthleteStatsResponse> {
  const response = await api.get<{ success: boolean; data: AthleteStatsResponse }>(
    '/users/me/athlete-stats'
  );
  return response.data.data;
}

export async function saveAthleteStats(
  payload: AthleteStatsPayload
): Promise<AthleteStatsResponse> {
  const response = await api.put<{ success: boolean; data: AthleteStatsResponse }>(
    '/users/me/athlete-stats',
    payload
  );
  return response.data.data;
}

/**
 * Stateless preview: returns the grade the backend WOULD assign for the
 * supplied stats, without persisting them. Used by the combine screen to
 * show a live grade as the athlete edits inputs.
 */
export async function previewAthleteStats(
  payload: AthleteStatsPayload
): Promise<PerformanceBreakdown> {
  const response = await api.post<{ success: boolean; data: PerformanceBreakdown }>(
    '/users/me/athlete-stats/preview',
    payload
  );
  return response.data.data;
}
