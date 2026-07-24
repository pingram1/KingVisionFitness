export type ProductSubscriptionTier = 'BASIC' | 'SPECIFIED' | 'ACTIVE_CLIENT';

const PAID_TIERS = new Set<ProductSubscriptionTier>(['SPECIFIED', 'ACTIVE_CLIENT']);

export function resolveEffectiveTier(user: {
  subscriptionTier?: string | null;
  subscription?: { tier?: string; status?: string } | null;
}): ProductSubscriptionTier {
  const canonical = user.subscriptionTier;
  if (canonical === 'BASIC' || canonical === 'SPECIFIED' || canonical === 'ACTIVE_CLIENT') {
    return canonical;
  }
  if (user.subscription?.tier === 'active-client') {
    return 'ACTIVE_CLIENT';
  }
  return 'BASIC';
}

export function isActiveClientTier(user: {
  subscriptionTier?: string | null;
  subscription?: { tier?: string; status?: string } | null;
}): boolean {
  return resolveEffectiveTier(user) === 'ACTIVE_CLIENT';
}

export function isPaidTier(user: {
  subscriptionTier?: string | null;
  subscription?: { tier?: string; status?: string } | null;
}): boolean {
  return PAID_TIERS.has(resolveEffectiveTier(user));
}
