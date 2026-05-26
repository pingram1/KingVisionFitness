export type GroupType = 'athletic_team' | 'bootcamp' | 'public_community';

export type GroupMemberRole = 'member' | 'athlete' | 'captain' | 'coach' | 'participant';

export type LeaderboardMode = 'streak' | 'performance';

export interface GroupSummary {
  _id: string;
  name: string;
  description: string;
  coverImage?: string;
  groupType: GroupType;
  groupTypeLabel: string;
  type: 'private' | 'public';
  memberCount: number;
  myRole: GroupMemberRole | null;
  myRoleLabel: string | null;
  stats: {
    totalWorkoutsCompleted: number;
    averageWorkoutsPerWeek: number;
  };
}

/** Admin portal list item — includes invite code for distribution. */
export interface AdminGroupSummary {
  _id: string;
  name: string;
  description: string;
  groupType: GroupType;
  groupTypeLabel: string;
  inviteCode: string | null;
  memberCount: number;
  type: 'private' | 'public';
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRosterMember {
  membershipId?: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier: string;
  role: GroupMemberRole;
  roleLabel: string;
  joinedAt: string;
}

export interface AdminGroupRoster {
  group: AdminGroupSummary;
  roster: AdminRosterMember[];
}

export const GROUP_TYPE_OPTIONS: { value: GroupType; label: string }[] = [
  { value: 'athletic_team', label: 'Athletic Team' },
  { value: 'bootcamp', label: 'Bootcamp' },
  { value: 'public_community', label: 'Public Community' },
];

export interface GroupFeedPost {
  _id: string;
  content: string;
  authorId: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  workoutCompleted?: {
    workoutId: string;
    duration: number;
    calories?: number;
  } | null;
}

export interface StreakLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  role: GroupMemberRole;
  roleLabel: string;
  streakCount: number;
}

export interface PerformanceLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  role: GroupMemberRole;
  roleLabel: string;
  performanceGrade: number;
  workoutsCompleted: number;
  totalMinutes: number;
}

export type LeaderboardEntry = StreakLeaderboardEntry | PerformanceLeaderboardEntry;

export interface GroupDailyWorkout {
  _id: string;
  title: string;
  description: string;
  duration: number;
  type: string;
  difficulty: string;
  exerciseCount: number;
}

export interface GroupDetail extends GroupSummary {
  leaderboardMode: LeaderboardMode;
  leaderboard: LeaderboardEntry[];
  myStreakCount: number;
  isGroupCoach: boolean;
  hasCheckInLocation: boolean;
  checkInRadiusMeters: number | null;
  address: string | null;
  dailyWorkout: GroupDailyWorkout | null;
  feed: GroupFeedPost[];
  announcements: Array<{
    title: string;
    content: string;
    createdAt: string;
  }>;
}

export const GROUP_TYPE_ICONS: Record<GroupType, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  athletic_team: 'american-football',
  bootcamp: 'fitness',
  public_community: 'people',
};

export function isStreakLeaderboardEntry(
  entry: LeaderboardEntry
): entry is StreakLeaderboardEntry {
  return 'streakCount' in entry;
}

export function isPerformanceLeaderboardEntry(
  entry: LeaderboardEntry
): entry is PerformanceLeaderboardEntry {
  return 'performanceGrade' in entry;
}

export function getDisplayRoleLabel(
  groupType: GroupType,
  role: GroupMemberRole | null,
  roleLabel: string | null
): string | null {
  if (!role || !roleLabel) return null;
  if (groupType === 'public_community' || groupType === 'bootcamp') {
    return role === 'coach' ? 'Coach' : 'Member';
  }
  return roleLabel;
}
