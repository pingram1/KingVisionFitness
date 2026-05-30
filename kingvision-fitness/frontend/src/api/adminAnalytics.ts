import api from '../services/api';
import type { AdminAnalytics } from '../types/adminAnalytics';

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const response = await api.get<{ success: boolean; data: AdminAnalytics }>('/admin/analytics');
  return response.data.data;
}

export function formatMrr(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
