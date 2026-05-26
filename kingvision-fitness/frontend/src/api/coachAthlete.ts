import api from '../services/api';
import type { CoachAthleteDetail } from '../types/coachAthlete';

export async function fetchCoachAthleteDetail(
  groupId: string,
  userId: string
): Promise<CoachAthleteDetail> {
  const response = await api.get<{ success: boolean; data: CoachAthleteDetail }>(
    `/groups/${groupId}/athletes/${userId}`
  );
  return response.data.data;
}
