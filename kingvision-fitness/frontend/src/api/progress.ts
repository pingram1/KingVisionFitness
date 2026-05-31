import api from '../services/api';
import type { LogProgressPayload, ProgressEntry } from '../types/progress';

export async function logProgress(payload: LogProgressPayload): Promise<ProgressEntry> {
  const response = await api.post<{ success: boolean; data: ProgressEntry }>(
    '/users/progress',
    payload
  );
  return response.data.data;
}

export async function fetchProgressHistory(limit = 30): Promise<ProgressEntry[]> {
  const response = await api.get<{ success: boolean; data: ProgressEntry[] }>(
    '/users/progress',
    { params: { limit } }
  );
  return response.data.data;
}
