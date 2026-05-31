import api from '../services/api';

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', {
    email: email.trim().toLowerCase(),
  });
  return response.data.message;
}

export async function resetPasswordWithToken(token: string, password: string): Promise<string> {
  const response = await api.post<{ success: boolean; message: string }>('/auth/reset-password', {
    token: token.trim(),
    password,
  });
  return response.data.message;
}
