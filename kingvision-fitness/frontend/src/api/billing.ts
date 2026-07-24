import api from '../services/api';
import type { SubscriptionTier } from '../types/user';

export type PaidSubscriptionTier = Exclude<SubscriptionTier, 'BASIC'>;

export interface CheckoutSessionResult {
  tier: PaidSubscriptionTier;
  priceCents: number;
  interval: string;
  checkoutUrl: string;
  sessionId: string;
}

export async function createCheckoutSession(
  tier: PaidSubscriptionTier
): Promise<CheckoutSessionResult> {
  const response = await api.post<{
    success: boolean;
    message?: string;
    data: CheckoutSessionResult;
  }>('/billing/create-checkout-session', { tier });

  if (!response.data.success || !response.data.data?.checkoutUrl) {
    throw new Error(response.data.message ?? 'Checkout is not available');
  }

  return response.data.data;
}

export async function createBillingPortalSession(): Promise<{ portalUrl: string }> {
  const response = await api.post<{
    success: boolean;
    message?: string;
    data: { portalUrl: string };
  }>('/billing/create-portal-session', {});

  if (!response.data.success || !response.data.data?.portalUrl) {
    throw new Error(response.data.message ?? 'Billing portal is not available');
  }

  return response.data.data;
}
