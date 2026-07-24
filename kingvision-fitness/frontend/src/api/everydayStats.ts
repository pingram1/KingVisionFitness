import api from '../services/api';
import type {
  EverydayFitnessBreakdown,
  EverydayFitnessPayload,
  EverydayFitnessResponse,
  FitnessTrackResponse,
} from '../types/athleteStats';

export async function fetchEverydayStats(): Promise<EverydayFitnessResponse> {
  const response = await api.get<{ success: boolean; data: EverydayFitnessResponse }>(
    '/users/me/everyday-stats'
  );
  return response.data.data;
}

export async function saveEverydayStats(
  payload: EverydayFitnessPayload
): Promise<EverydayFitnessResponse> {
  const response = await api.put<{ success: boolean; data: EverydayFitnessResponse }>(
    '/users/me/everyday-stats',
    payload
  );
  return response.data.data;
}

export async function previewEverydayStats(
  payload: EverydayFitnessPayload
): Promise<EverydayFitnessBreakdown> {
  const response = await api.post<{ success: boolean; data: EverydayFitnessBreakdown }>(
    '/users/me/everyday-stats/preview',
    payload
  );
  return response.data.data;
}

export async function fetchFitnessTrack(): Promise<FitnessTrackResponse> {
  const response = await api.get<{ success: boolean; data: FitnessTrackResponse }>(
    '/users/me/fitness-track'
  );
  return response.data.data;
}
