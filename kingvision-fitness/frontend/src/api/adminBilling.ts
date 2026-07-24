import api from '../services/api';

export interface AdminBillingStatus {
  stripeConfigured: boolean;
  checkoutReady: boolean;
  mode: 'test' | 'live' | 'disabled';
  webhookHealthy: boolean;
  dashboardUrl: string;
  lastWebhookReceivedAt: string | null;
  lastWebhookEventType: string | null;
}

export async function fetchAdminBillingStatus(): Promise<AdminBillingStatus> {
  const response = await api.get<{ success: boolean; data: AdminBillingStatus }>(
    '/admin/billing/status'
  );
  return response.data.data;
}
