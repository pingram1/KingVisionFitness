// Pure leaderboard builders extracted from group.routes.ts so the sorting,
// rank assignment, fallback grade, and coach-exclusion rules can be unit-tested
// without booting Mongoose or Express.

import type { GroupMemberRole, GroupType } from '../models/Group';

// Local constants — duplicated from group.routes to keep this module
// dependency-free. They MUST stay in sync.
const ROLE_LABELS: Record<GroupMemberRole, string> = {
  member: 'Member',
  athlete: 'Athlete',
  captain: 'Captain',
  coach: 'Coach',
  participant: 'Participant',
};

function normalizeRoleForGroupType(
  groupType: GroupType,
  role: GroupMemberRole
): GroupMemberRole {
  if (groupType === 'athletic_team') {
    if (role === 'coach') return 'coach';
    if (role === 'captain') return 'captain';
    return 'athlete';
  }
  if (role === 'coach') return 'coach';
  return 'member';
}

function contextualRoleLabel(groupType: GroupType, role: GroupMemberRole): string {
  return ROLE_LABELS[normalizeRoleForGroupType(groupType, role)];
}

interface MembershipUser {
  _id?: unknown;
  profile?: { firstName?: string; lastName?: string };
}

export interface MembershipInput {
  _id?: unknown;
  user: MembershipUser | unknown;
  role: GroupMemberRole;
  streakCount?: number;
  performanceGrade?: number;
  workoutsCompleted?: number;
  totalMinutes?: number;
}

export interface StreakLeaderboardRow {
  rank: number;
  userId: unknown;
  name: string;
  role: GroupMemberRole;
  roleLabel: string;
  streakCount: number;
}

export interface PerformanceLeaderboardRow extends Omit<StreakLeaderboardRow, 'streakCount'> {
  performanceGrade: number;
  workoutsCompleted: number;
  totalMinutes: number;
}

export interface LeaderboardGroupInput {
  groupType: GroupType;
  memberships?: MembershipInput[];
}

function memberDisplayName(m: MembershipInput): string {
  const user = m.user as MembershipUser | null | undefined;
  if (user && typeof user === 'object' && user.profile) {
    return `${user.profile.firstName ?? ''} ${user.profile.lastName ?? ''}`.trim() || 'Member';
  }
  return 'Member';
}

/**
 * Compute the 0-100 leaderboard grade for one membership row.
 *
 * If the cached `performanceGrade` (set by the combine-stats save path) is > 0,
 * that's authoritative. Otherwise we fall back to an activity proxy based on
 * workouts logged + minutes elapsed. Note: see audit S13 — the activity
 * proxy is currently never incremented anywhere, so members without combine
 * stats stay at 0. Fixing the increment side is tracked separately.
 */
export function computePerformanceGrade(m: {
  performanceGrade?: number;
  workoutsCompleted?: number;
  totalMinutes?: number;
}): number {
  if (typeof m.performanceGrade === 'number' && m.performanceGrade > 0) {
    return m.performanceGrade;
  }
  const workouts = m.workoutsCompleted ?? 0;
  const minutes = m.totalMinutes ?? 0;
  return Math.min(100, Math.round(workouts * 12 + minutes * 0.15));
}

export function buildStreakLeaderboard(group: LeaderboardGroupInput): StreakLeaderboardRow[] {
  const groupType = group.groupType;
  return [...(group.memberships ?? [])]
    .sort((a, b) => (b.streakCount ?? 0) - (a.streakCount ?? 0))
    .map((m, index) => ({
      rank: index + 1,
      userId: (m.user as MembershipUser | null | undefined)?._id ?? m.user,
      name: memberDisplayName(m),
      role: normalizeRoleForGroupType(groupType, m.role),
      roleLabel: contextualRoleLabel(groupType, m.role),
      streakCount: m.streakCount ?? 0,
    }));
}

export function buildPerformanceLeaderboard(
  group: LeaderboardGroupInput
): PerformanceLeaderboardRow[] {
  const groupType = group.groupType;
  return [...(group.memberships ?? [])]
    .filter((m) => m.role !== 'coach')
    .sort((a, b) => computePerformanceGrade(b) - computePerformanceGrade(a))
    .map((m, index) => ({
      rank: index + 1,
      userId: (m.user as MembershipUser | null | undefined)?._id ?? m.user,
      name: memberDisplayName(m),
      role: normalizeRoleForGroupType(groupType, m.role),
      roleLabel: contextualRoleLabel(groupType, m.role),
      performanceGrade: computePerformanceGrade(m),
      workoutsCompleted: m.workoutsCompleted ?? 0,
      totalMinutes: m.totalMinutes ?? 0,
    }));
}

export function buildLeaderboard(
  group: LeaderboardGroupInput
): StreakLeaderboardRow[] | PerformanceLeaderboardRow[] {
  return group.groupType === 'athletic_team'
    ? buildPerformanceLeaderboard(group)
    : buildStreakLeaderboard(group);
}
