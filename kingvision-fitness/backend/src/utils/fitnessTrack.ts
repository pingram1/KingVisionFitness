import type { AthleteDesignation, IUser } from '../models/User';

const ATHLETIC_GROUP_ROLES = new Set(['athlete', 'captain']);

export type AthleticTrackUser = Pick<IUser, 'groupMemberships' | 'athleteDesignation'>;

/** Elite designation only — subscription tier is never consulted here. */
export function resolveAthleteDesignation(user: AthleticTrackUser): AthleteDesignation {
  return user.athleteDesignation ?? 'none';
}

/**
 * True when the user belongs on the Athletic Performance / Combine track:
 * athlete or captain on an athletic team, or an individual elite designation.
 * Group memberships should already be scoped to athletic_team by the caller.
 */
export function isAthleticTrackEligible(user: AthleticTrackUser): boolean {
  if (resolveAthleteDesignation(user) !== 'none') return true;
  return (user.groupMemberships ?? []).some((m) => ATHLETIC_GROUP_ROLES.has(m.role));
}

export const EVERYDAY_TRACK_FORBIDDEN_MESSAGE =
  'Athletic combine stats are reserved for team athletes and elite private clients. Use the Everyday Client Fitness Test instead.';

export const ATHLETIC_TRACK_EVERYDAY_FORBIDDEN_MESSAGE =
  'Everyday fitness stats are for non-athletic clients. Use the Athletic Combine test instead.';
