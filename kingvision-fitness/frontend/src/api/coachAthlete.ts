import api from '../services/api';
import type { CoachAthleteDetail } from '../types/coachAthlete';
import type { AthleteStatsPayload, AthleteStatsResponse } from '../types/athleteStats';

export async function fetchCoachAthleteDetail(
  groupId: string,
  userId: string
): Promise<CoachAthleteDetail> {
  const response = await api.get<{ success: boolean; data: CoachAthleteDetail }>(
    `/groups/${groupId}/athletes/${userId}`
  );
  return response.data.data;
}

export async function saveCoachAthleteStats(
  groupId: string,
  userId: string,
  payload: AthleteStatsPayload
): Promise<AthleteStatsResponse> {
  const response = await api.put<{ success: boolean; data: AthleteStatsResponse }>(
    `/groups/${groupId}/athletes/${userId}/stats`,
    payload
  );
  return response.data.data;
}
