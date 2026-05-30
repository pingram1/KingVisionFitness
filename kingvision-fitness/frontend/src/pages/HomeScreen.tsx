import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import type {
  CompletedWorkoutEntry,
  SubscriptionTier,
  UserProfile,
  WeeklyWorkoutSummary,
} from '../types/user';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { useFocusRefresh } from '../hooks/useFocusRefresh';

type HomeScreenNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

interface DashboardStats {
  workoutsCompleted: number;
  totalMinutes: number;
  currentStreak: number;
  weeklyWorkoutsCompleted: number;
  weeklyPlanCount: number;
  recentActivity: CompletedWorkoutEntry[];
}

function computeDayStreak(completions: CompletedWorkoutEntry[]): number {
  if (completions.length === 0) return 0;

  const dayKeys = new Set(
    completions.map((c) => format(new Date(c.completedAt), 'yyyy-MM-dd'))
  );

  const cursor = new Date();
  const todayKey = format(cursor, 'yyyy-MM-dd');
  if (!dayKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dayKeys.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function countCompletionsThisWeek(completions: CompletedWorkoutEntry[]): number {
  const now = new Date();
  const interval = {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
  return completions.filter((c) =>
    isWithinInterval(new Date(c.completedAt), interval)
  ).length;
}

/**
 * Resolves the membership label shown under the greeting. Reads from
 * `AuthContext.user.subscriptionTier` so it re-renders the instant
 * {@link refreshProfile} returns from a successful upgrade.
 */
function subscriptionLabel(tier: SubscriptionTier | undefined): string {
  if (tier === 'ACTIVE_CLIENT') return 'Active Client';
  if (tier === 'SPECIFIED') return 'Specified Plan';
  return 'Basic Member';
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNav>();
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const buildStatsFromProfile = useCallback(
    (userProfile: UserProfile, planCount: number): DashboardStats => {
      const completions = userProfile.completedWorkouts ?? [];
      const totalMinutes = completions.reduce(
        (sum, w) => sum + (typeof w.duration === 'number' ? w.duration : 0),
        0
      );
      const recentActivity = [...completions].sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );

      return {
        workoutsCompleted: completions.length,
        totalMinutes,
        currentStreak: computeDayStreak(completions),
        weeklyWorkoutsCompleted: countCompletionsThisWeek(completions),
        weeklyPlanCount: planCount,
        recentActivity,
      };
    },
    []
  );

  const loadDashboardData = useCallback(async (showFullScreenLoader = true) => {
    try {
      setLoadError(null);
      if (showFullScreenLoader) setLoading(true);

      const [profileRes, weeklyRes] = await Promise.all([
        api.get<{ success: boolean; data: UserProfile }>('/users/profile'),
        api.get<{ success: boolean; data: WeeklyWorkoutSummary[] }>('/workouts/weekly'),
      ]);

      const userProfile = profileRes.data.data;
      const plan = weeklyRes.data.data ?? [];

      setProfile(userProfile);
      setWeeklyPlan(plan);
      setStats(buildStatsFromProfile(userProfile, plan.length));
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoadError('Failed to load dashboard. Pull to refresh or try again.');
    } finally {
      setLoading(false);
    }
  }, [buildStatsFromProfile]);

  useFocusRefresh(loadDashboardData);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      await loadDashboardData(false);
    } finally {
      setRefreshing(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const weeklyProgressPct =
    stats && stats.weeklyPlanCount > 0
      ? Math.min((stats.weeklyWorkoutsCompleted / stats.weeklyPlanCount) * 100, 100)
      : stats && stats.weeklyWorkoutsCompleted > 0
        ? 100
        : 0;

  const currentTier: SubscriptionTier = user?.subscriptionTier ?? 'BASIC';
  const isActiveClientTier = currentTier === 'ACTIVE_CLIENT';

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  if (loadError && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboardData(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {profile?.profile?.firstName || 'User'}!
          </Text>
          <Text style={styles.subtitle}>{subscriptionLabel(currentTier)}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => Alert.alert('Notifications', 'Feature coming soon')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.statValue}>{stats?.workoutsCompleted ?? 0}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
          <Text style={styles.statSubLabel}>Completed</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="time-outline" size={24} color="#2196F3" />
          </View>
          <Text style={styles.statValue}>{stats?.totalMinutes ?? 0}</Text>
          <Text style={styles.statLabel}>Minutes</Text>
          <Text style={styles.statSubLabel}>Total Time</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="flame" size={24} color="#FF9800" />
          </View>
          <Text style={styles.statValue}>{stats?.currentStreak ?? 0}</Text>
          <Text style={styles.statLabel}>Day</Text>
          <Text style={styles.statSubLabel}>Streak</Text>
        </View>
      </View>

      {isActiveClientTier && (
        <TouchableOpacity
          style={styles.bookSessionCard}
          onPress={() => navigation.navigate('ClientBooking')}
        >
          <View style={styles.bookSessionIconWrap}>
            <Ionicons name="calendar" size={24} color="#fff" />
          </View>
          <View style={styles.bookSessionBody}>
            <Text style={styles.bookSessionTitle}>Book 1-on-1 Session</Text>
            <Text style={styles.bookSessionText}>
              Request a private session with KingVision based on available hours.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#667eea" />
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Workouts' as never)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#667eea20' }]}>
              <Ionicons name="barbell" size={28} color="#667eea" />
            </View>
            <Text style={styles.quickActionText}>Start Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Groups' as never)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="people" size={28} color="#4CAF50" />
            </View>
            <Text style={styles.quickActionText}>Join Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Nutrition')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#9C27B020' }]}>
              <Ionicons name="nutrition" size={28} color="#9C27B0" />
            </View>
            <Text style={styles.quickActionText}>Nutrition & Meals</Text>
          </TouchableOpacity>

          {isActiveClientTier ? (
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ClientSessions')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#667eea20' }]}>
                <Ionicons name="calendar" size={28} color="#667eea" />
              </View>
              <Text style={styles.quickActionText}>My Sessions</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => Alert.alert('Progress', 'Log progress from your profile soon.')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="stats-chart" size={28} color="#FF9800" />
              </View>
              <Text style={styles.quickActionText}>Track Progress</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Workouts' as never)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyValue}>{stats?.weeklyWorkoutsCompleted ?? 0}</Text>
            <Text style={styles.weeklyLabel}>
              Completed · {stats?.weeklyPlanCount ?? 0} in weekly plan
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${weeklyProgressPct}%` }]} />
          </View>
        </View>

        {weeklyPlan.length > 0 ? (
          <View style={styles.planList}>
            {weeklyPlan.slice(0, 4).map((workout) => (
              <View key={workout._id} style={styles.planRow}>
                <Ionicons name="barbell-outline" size={18} color="#667eea" />
                <View style={styles.planRowText}>
                  <Text style={styles.planTitle}>{workout.title}</Text>
                  <Text style={styles.planMeta}>
                    {[workout.type, workout.duration ? `${workout.duration} min` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.inlineEmptyText}>
            No workouts published for this week yet. Check back soon.
          </Text>
        )}
      </View>

      {!isActiveClientTier && (
        <TouchableOpacity
          style={styles.upgradeCard}
          onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'Upgrade' })}
        >
          <View style={styles.upgradeContent}>
            <View>
              <Text style={styles.upgradeTitle}>Upgrade to Active Client</Text>
              <Text style={styles.upgradeText}>
                Get custom workouts, meal plans, and direct trainer access
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#667eea" />
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {stats && stats.recentActivity.length > 0 ? (
          <View style={styles.activityList}>
            {stats.recentActivity.slice(0, 5).map((workout, index) => (
              <View
                key={`${workout.completedAt}-${index}`}
                style={styles.activityItem}
              >
                <View style={styles.activityIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>Completed workout</Text>
                  <Text style={styles.activityDate}>
                    {format(new Date(workout.completedAt), 'MMM d, yyyy')}
                  </Text>
                </View>
                <Text style={styles.activityDuration}>
                  {typeof workout.duration === 'number' ? `${workout.duration} min` : '—'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No workouts completed yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Complete your first workout to see activity here.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('Workouts' as never)}
            >
              <Text style={styles.emptyStateButtonText}>Browse Workouts</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  notificationButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  statSubLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  bookSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#667eea30',
    shadowColor: '#667eea',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bookSessionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookSessionBody: {
    flex: 1,
    marginRight: 8,
  },
  bookSessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bookSessionText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 17,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  weeklyCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  weeklyStat: {
    marginBottom: 12,
  },
  weeklyValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  weeklyLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  planList: {
    gap: 10,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  planRowText: {
    flex: 1,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  planMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  inlineEmptyText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  upgradeCard: {
    margin: 20,
    marginTop: 12,
    backgroundColor: '#667eea',
    borderRadius: 16,
    padding: 20,
  },
  upgradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  upgradeText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
  },
  activityDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
