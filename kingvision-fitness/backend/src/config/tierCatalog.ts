/**
 * Subscription tier pricing catalog — shared by billing and admin analytics.
 */
export const TIER_CATALOG = {
  BASIC: { priceCents: 0, interval: 'month' as const },
  SPECIFIED: { priceCents: 1999, interval: 'month' as const },
  ACTIVE_CLIENT: { priceCents: 4999, interval: 'month' as const },
} as const;

export type SubscriptionCatalogTier = keyof typeof TIER_CATALOG;
