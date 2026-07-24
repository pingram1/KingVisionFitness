import api from '../services/api';
import type {
  GamificationStatus,
  NutritionVerificationPayload,
  NutritionVerificationResponse,
} from '../types/gamification';

export async function fetchGamificationStatus(): Promise<GamificationStatus> {
  const response = await api.get<{ success: boolean; data: GamificationStatus }>(
    '/gamification/status'
  );
  return response.data.data;
}

/**
 * Report foreground app-usage minutes (called from the app lifecycle when the
 * app backgrounds).
 */
export async function logAppSession(minutes: number): Promise<void> {
  await api.post('/gamification/log-session', { minutes });
}

/**
 * Submit today's macro verification (logs, optional photo URL, notes) and
 * return the refreshed consistency snapshot.
 */
export async function verifyNutritionDay(
  payload: NutritionVerificationPayload
): Promise<NutritionVerificationResponse> {
  const response = await api.post<{
    success: boolean;
    data: NutritionVerificationResponse;
  }>('/gamification/verify-nutrition', payload);
  return response.data.data;
}
