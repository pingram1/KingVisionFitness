import {
  buildLeaderboard,
  buildPerformanceLeaderboard,
  buildStreakLeaderboard,
  computePerformanceGrade,
  type LeaderboardGroupInput,
  type MembershipInput,
} from '../leaderboard';
import type { GroupMemberRole, GroupType } from '../../models/Group';

function membership(overrides: Partial<MembershipInput>): MembershipInput {
  return {
    _id: overrides._id ?? 'membership-1',
    user: overrides.user ?? {
      _id: 'user-1',
      profile: { firstName: 'Test', lastName: 'User' },
    },
    role: overrides.role ?? ('member' as GroupMemberRole),
    streakCount: overrides.streakCount ?? 0,
    performanceGrade: overrides.performanceGrade,
    workoutsCompleted: overrides.workoutsCompleted,
    totalMinutes: overrides.totalMinutes,
  };
}

function group(
  groupType: GroupType,
  memberships: MembershipInput[]
): LeaderboardGroupInput {
  return { groupType, memberships };
}

describe('computePerformanceGrade', () => {
  it('uses cached performanceGrade when present and positive', () => {
    expect(computePerformanceGrade({ performanceGrade: 85, workoutsCompleted: 99 })).toBe(85);
  });

  it('falls back to activity proxy when grade is missing, zero, or negative', () => {
    expect(computePerformanceGrade({ workoutsCompleted: 5, totalMinutes: 60 })).toBe(69);
    expect(computePerformanceGrade({ performanceGrade: 0, workoutsCompleted: 2 })).toBe(24);
    expect(computePerformanceGrade({ performanceGrade: -1, workoutsCompleted: 1 })).toBe(12);
  });

  it('clamps the fallback at 100', () => {
    expect(computePerformanceGrade({ workoutsCompleted: 100, totalMinutes: 1000 })).toBe(100);
  });

  it('returns 0 for an empty input', () => {
    expect(computePerformanceGrade({})).toBe(0);
  });
});

describe('buildStreakLeaderboard', () => {
  it('sorts by streak descending and assigns sequential ranks', () => {
    const g = group('public_community', [
      membership({ _id: 'm1', streakCount: 3, user: { _id: 'u1', profile: { firstName: 'A', lastName: 'A' } } }),
      membership({ _id: 'm2', streakCount: 10, user: { _id: 'u2', profile: { firstName: 'B', lastName: 'B' } } }),
      membership({ _id: 'm3', streakCount: 7, user: { _id: 'u3', profile: { firstName: 'C', lastName: 'C' } } }),
    ]);

    const rows = buildStreakLeaderboard(g);
    expect(rows.map((r) => r.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.streakCount)).toEqual([10, 7, 3]);
  });

  it('treats missing streakCount as 0', () => {
    const g = group('public_community', [
      membership({ _id: 'm1', streakCount: undefined }),
      membership({ _id: 'm2', streakCount: 1 }),
    ]);

    const rows = buildStreakLeaderboard(g);
    expect(rows[0].streakCount).toBe(1);
    expect(rows[1].streakCount).toBe(0);
  });

  it('renders "Member" when name fields are missing', () => {
    const g = group('public_community', [
      membership({ user: { _id: 'u1' } }),
      membership({ user: { _id: 'u2', profile: { firstName: '', lastName: '' } } }),
    ]);
    const rows = buildStreakLeaderboard(g);
    expect(rows.every((r) => r.name === 'Member')).toBe(true);
  });

  it('does not mutate the input memberships array', () => {
    const memberships = [
      membership({ _id: 'm1', streakCount: 3 }),
      membership({ _id: 'm2', streakCount: 10 }),
    ];
    const snapshot = [...memberships];
    buildStreakLeaderboard(group('public_community', memberships));
    expect(memberships).toEqual(snapshot);
  });

  it('returns [] when memberships is undefined', () => {
    expect(buildStreakLeaderboard({ groupType: 'public_community' })).toEqual([]);
  });

  it('uses contextual role labels per group type', () => {
    const community = buildStreakLeaderboard(
      group('public_community', [membership({ role: 'coach' })])
    );
    expect(community[0].roleLabel).toBe('Coach');
    expect(community[0].role).toBe('coach');

    const team = buildStreakLeaderboard(
      group('athletic_team', [membership({ role: 'member' })])
    );
    // 'member' on an athletic_team normalizes to 'athlete'
    expect(team[0].role).toBe('athlete');
    expect(team[0].roleLabel).toBe('Athlete');
  });
});

describe('buildPerformanceLeaderboard', () => {
  it('excludes coaches from the leaderboard', () => {
    const g = group('athletic_team', [
      membership({ _id: 'a', role: 'athlete', performanceGrade: 50, user: { _id: 'ua' } }),
      membership({ _id: 'c', role: 'coach', performanceGrade: 99, user: { _id: 'uc' } }),
      membership({ _id: 'b', role: 'captain', performanceGrade: 60, user: { _id: 'ub' } }),
    ]);
    const rows = buildPerformanceLeaderboard(g);
    expect(rows.map((r) => r.userId)).toEqual(['ub', 'ua']);
    expect(rows.some((r) => r.role === 'coach')).toBe(false);
  });

  it('sorts by computePerformanceGrade desc and assigns ranks', () => {
    const g = group('athletic_team', [
      membership({ _id: '1', role: 'athlete', performanceGrade: 30, user: { _id: 'u1' } }),
      membership({ _id: '2', role: 'athlete', performanceGrade: 90, user: { _id: 'u2' } }),
      membership({ _id: '3', role: 'athlete', performanceGrade: 0, workoutsCompleted: 4, user: { _id: 'u3' } }),
    ]);
    const rows = buildPerformanceLeaderboard(g);
    expect(rows.map((r) => r.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('preserves workoutsCompleted / totalMinutes on every row', () => {
    const g = group('athletic_team', [
      membership({
        _id: '1',
        role: 'athlete',
        performanceGrade: 70,
        workoutsCompleted: 12,
        totalMinutes: 240,
      }),
    ]);
    expect(buildPerformanceLeaderboard(g)[0]).toMatchObject({
      performanceGrade: 70,
      workoutsCompleted: 12,
      totalMinutes: 240,
    });
  });

  it('returns [] for an empty roster', () => {
    expect(buildPerformanceLeaderboard({ groupType: 'athletic_team' })).toEqual([]);
  });
});

describe('buildLeaderboard', () => {
  it('routes athletic_team to the performance variant', () => {
    const rows = buildLeaderboard(
      group('athletic_team', [
        membership({ role: 'athlete', performanceGrade: 80, user: { _id: 'u1' } }),
      ])
    );
    expect(rows[0]).toHaveProperty('performanceGrade', 80);
  });

  it('routes other group types to the streak variant', () => {
    const rows = buildLeaderboard(
      group('public_community', [
        membership({ role: 'member', streakCount: 5, user: { _id: 'u1' } }),
      ])
    );
    expect(rows[0]).toHaveProperty('streakCount', 5);
  });
});
