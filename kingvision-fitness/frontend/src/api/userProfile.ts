import api from '../services/api';
import type { UserProfile } from '../types/user';

export type UpdateProfilePayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  bio?: string;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
};

export async function updateUserProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const response = await api.put<{ success: boolean; data: UserProfile }>(
    '/users/profile',
    payload
  );
  return response.data.data;
}
