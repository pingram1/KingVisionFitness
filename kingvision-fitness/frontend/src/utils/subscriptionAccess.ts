import type { SubscriptionTier, UserProfile } from '../types/user';

type TierUser = Pick<UserProfile, 'subscriptionTier'> | null | undefined;

const TIER_RANK: Record<SubscriptionTier, number> = {
  BASIC: 0,
  SPECIFIED: 1,
  ACTIVE_CLIENT: 2,
};

/** Canonical product tier — always read `subscriptionTier`, never legacy nested fields. */
export function getTier(user: TierUser): SubscriptionTier {
  return user?.subscriptionTier ?? 'BASIC';
}

export function isActiveClient(user: TierUser): boolean {
  return getTier(user) === 'ACTIVE_CLIENT';
}

export function isSpecifiedOrAbove(user: TierUser): boolean {
  return TIER_RANK[getTier(user)] >= TIER_RANK.SPECIFIED;
}

/** Trainer-assigned 1-on-1 custom workouts — Active Client only. */
export function hasCustomWorkouts(user: TierUser): boolean {
  return isActiveClient(user);
}

/** Trainer-assigned custom macro meal plans — Active Client only. */
export function hasCustomNutrition(user: TierUser): boolean {
  return isActiveClient(user);
}

/** Progress analytics dashboard — Specified tier and above. */
export function hasProgressAnalytics(user: TierUser): boolean {
  return isSpecifiedOrAbove(user);
}

/** Personalized weekly program recommendations — Specified tier and above. */
export function hasPersonalizedPrograms(user: TierUser): boolean {
  return isSpecifiedOrAbove(user);
}

export function subscriptionLabel(tier: SubscriptionTier | undefined): string {
  if (tier === 'ACTIVE_CLIENT') return 'Active Client';
  if (tier === 'SPECIFIED') return 'Specified Plan';
  return 'Basic Member';
}
