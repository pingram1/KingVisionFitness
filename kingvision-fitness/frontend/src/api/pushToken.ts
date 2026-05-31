import api from '../services/api';

export async function registerPushToken(expoPushToken: string): Promise<void> {
  await api.put('/users/push-token', { expoPushToken });
}

export async function clearPushToken(): Promise<void> {
  await api.delete('/users/push-token');
}
