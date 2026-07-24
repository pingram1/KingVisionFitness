import type { AthleteDesignation, FitnessTrack } from '../types/athleteStats';

const ATHLETIC_GROUP_ROLES = new Set(['athlete', 'captain']);

export interface FitnessTrackUser {
  athleteDesignation?: AthleteDesignation;
  groupMemberships?: Array<{ role: string }>;
}

/**
 * Athletic status is determined ONLY by elite designation or athlete/captain
 * role on a team — never by subscription tier (BASIC / SPECIFIED / ACTIVE_CLIENT)
 * and never by generic group "member" roles on bootcamps or communities.
 */
export function resolveAthleteDesignation(
  user: FitnessTrackUser | null | undefined
): AthleteDesignation {
  if (!user) return 'none';
  return user.athleteDesignation ?? 'none';
}

/** True when the user belongs on the elite Combine track. */
export function isAthleticTrackEligible(user: FitnessTrackUser | null | undefined): boolean {
  if (!user) return false;
  if (resolveAthleteDesignation(user) !== 'none') return true;
  return (user.groupMemberships ?? []).some((m) => ATHLETIC_GROUP_ROLES.has(m.role));
}

export function fitnessTrackForUser(user: FitnessTrackUser | null | undefined): FitnessTrack {
  return isAthleticTrackEligible(user) ? 'athletic' : 'everyday';
}

/** Build a track user from auth/profile payloads (ignores subscription tier). */
export function fitnessTrackUserFromProfile(
  sources: Array<FitnessTrackUser | null | undefined>
): FitnessTrackUser {
  let athleteDesignation: AthleteDesignation = 'none';
  let groupMemberships: Array<{ role: string }> | undefined;

  for (const source of sources) {
    if (!source) continue;
    if (source.athleteDesignation && source.athleteDesignation !== 'none') {
      athleteDesignation = source.athleteDesignation;
    }
    if (source.groupMemberships?.length) {
      groupMemberships = source.groupMemberships;
    }
  }

  return { athleteDesignation, groupMemberships };
}

const DESIGNATION_LABELS: Record<Exclude<AthleteDesignation, 'none'>, string> = {
  pro: 'Pro',
  collegiate: 'Collegiate',
  'semi-pro': 'Semi-Pro',
  independent_hs: 'High School',
};

export function eliteDesignationLabel(
  designation: AthleteDesignation
): string | null {
  if (designation === 'none') return null;
  return DESIGNATION_LABELS[designation];
}

export function combineDisclaimerText(
  user: FitnessTrackUser | null | undefined
): string {
  const designation = resolveAthleteDesignation(user);
  const label = eliteDesignationLabel(designation);
  if (label) {
    return `Your performance grade is calculated relative to elite ${label} athletic weight-to-mass indexes established by KingVision Performance.`;
  }
  return 'Scores are bodyweight-relative. A 185 lb athlete squatting 315 (1.7× BW) will outrank a 300 lb athlete squatting 365 (1.2× BW) — that\'s by design.';
}
