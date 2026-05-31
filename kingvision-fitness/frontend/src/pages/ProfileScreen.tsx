import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { CompletedWorkoutEntry, SubscriptionTier, UserProfile } from '../types/user';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

type TierBadge = {
  label: string;
  description: string;
  color: string;
  background: string;
};

/**
 * Tier badge is derived from `AuthContext.user.subscriptionTier` (the
 * single source of truth that {@link refreshProfile} keeps in sync after a
 * dev-upgrade or Stripe purchase). The locally-fetched `profile` may lag
 * behind, so we never read `subscriptionTier` from it here.
 */
function tierBadge(tier: SubscriptionTier | undefined): TierBadge {
  if (tier === 'ACTIVE_CLIENT') {
    return {
      label: 'Active Client',
      description: 'Premium 1-on-1 trainer access',
      color: '#fff',
      background: '#667eea',
    };
  }
  if (tier === 'SPECIFIED') {
    return {
      label: 'Specified Plan',
      description: 'Personalized weekly programs',
      color: '#fff',
      background: '#4CAF50',
    };
  }
  return {
    label: 'Basic',
    description: 'Free starter tier — public weekly workouts only',
    color: '#333',
    background: '#E0E0E0',
  };
}

function initialsOf(profile: UserProfile | null): string {
  if (!profile) return '?';
  const a = profile.profile?.firstName?.[0] ?? '';
  const b = profile.profile?.lastName?.[0] ?? '';
  const initials = `${a}${b}`.trim();
  return initials || profile.email?.[0]?.toUpperCase() || '?';
}

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const navigation = useNavigation<ProfileNav>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(
    async (showFullScreenLoader = true) => {
      try {
        setLoadError(null);
        if (showFullScreenLoader) setLoading(true);
        const response = await api.get<{ success: boolean; data: UserProfile }>(
          '/users/profile'
        );
        setProfile(response.data.data);
      } catch (error) {
        console.error('Error loading profile:', error);
        setLoadError('Failed to load profile. Pull to refresh or try again.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProfile(true);
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      await loadProfile(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
          } catch (error) {
            console.error('Error during logout:', error);
            Alert.alert('Logout failed', 'Something went wrong. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const metrics = useMemo(() => {
    const completions: CompletedWorkoutEntry[] = profile?.completedWorkouts ?? [];
    const totalWorkouts = completions.length;
    const totalMinutes = completions.reduce(
      (sum, w) => sum + (typeof w.duration === 'number' ? w.duration : 0),
      0
    );
    const lastWorkoutAt = completions
      .map((c) => new Date(c.completedAt).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    return { totalWorkouts, totalMinutes, lastWorkoutAt };
  }, [profile]);

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadProfile(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={handleLogout}>
          <Text style={styles.linkButtonText}>Log out instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentTier: SubscriptionTier = user?.subscriptionTier ?? 'BASIC';
  const isActiveClient = currentTier === 'ACTIVE_CLIENT';
  const tier = tierBadge(currentTier);
  const displayName =
    `${profile?.profile?.firstName ?? ''} ${profile?.profile?.lastName ?? ''}`.trim() ||
    'Unnamed Member';
  const email = profile?.email ?? user?.email ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(profile).toUpperCase()}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={[styles.tierBadge, { backgroundColor: tier.background }]}>
          <Ionicons
            name="ribbon-outline"
            size={14}
            color={tier.color}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
        </View>
        <Text style={styles.tierDescription}>{tier.description}</Text>
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() =>
            navigation.navigate('EditProfile', {
              initial: {
                firstName: profile?.profile?.firstName ?? '',
                lastName: profile?.profile?.lastName ?? '',
                phone: profile?.profile?.phone,
                bio: profile?.profile?.bio,
                fitnessLevel: profile?.profile?.fitnessLevel ?? 'beginner',
              },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Ionicons name="create-outline" size={16} color="#667eea" />
          <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
          <Text style={styles.metricValue}>{metrics.totalWorkouts}</Text>
          <Text style={styles.metricLabel}>Workouts Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="time-outline" size={22} color="#2196F3" />
          <Text style={styles.metricValue}>{metrics.totalMinutes}</Text>
          <Text style={styles.metricLabel}>Total Minutes</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Activity</Text>
        {metrics.lastWorkoutAt ? (
          <Text style={styles.sectionBody}>
            Last workout completed on{' '}
            {new Date(metrics.lastWorkoutAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        ) : (
          <Text style={styles.sectionBodyMuted}>
            No workouts completed yet. Start one from the Workouts tab.
          </Text>
        )}
      </View>

      {!isActiveClient && (
        <View style={styles.upgradeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>Unlock Active Client</Text>
            <Text style={styles.upgradeBody}>
              Custom workouts, meal plans, and 1-on-1 booking. Payments launching soon via Stripe.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => navigation.navigate('Upgrade')}
          >
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}

      {isActiveClient && (
        <TouchableOpacity
          style={styles.manageSubscriptionButton}
          onPress={() =>
            navigation.getParent()?.navigate('Home', { screen: 'ClientSessions' })
          }
          accessibilityRole="button"
          accessibilityLabel="My Sessions"
        >
          <View style={[styles.manageSubscriptionIcon, { backgroundColor: '#4CAF50' }]}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageSubscriptionTitle}>My Sessions</Text>
            <Text style={styles.manageSubscriptionSubtitle}>
              View pending, confirmed, and past appointments
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.manageSubscriptionButton}
        onPress={() => navigation.navigate('AthleteCombine')}
        accessibilityRole="button"
        accessibilityLabel="Combine Stats"
      >
        <View style={[styles.manageSubscriptionIcon, { backgroundColor: '#FF6B35' }]}>
          <Ionicons name="barbell-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.manageSubscriptionTitle}>Combine Stats</Text>
          <Text style={styles.manageSubscriptionSubtitle}>
            Log lifts, dash, and reps — power your team leaderboard
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.manageSubscriptionButton}
        onPress={() => navigation.navigate('Upgrade')}
        accessibilityRole="button"
        accessibilityLabel="Manage Subscription"
      >
        <View style={styles.manageSubscriptionIcon}>
          <Ionicons name="diamond-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.manageSubscriptionTitle}>
            {isActiveClient ? 'Manage Subscription' : 'Upgrade Membership'}
          </Text>
          <Text style={styles.manageSubscriptionSubtitle}>
            View plans, value props, and billing
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutButtonText}>Log out</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.footerText}>KingVision Fitness · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 40,
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
  linkButton: {
    marginTop: 12,
  },
  linkButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 16,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tierDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#667eea',
    backgroundColor: '#667eea12',
  },
  editProfileButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: '#333',
  },
  sectionBodyMuted: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    gap: 12,
  },
  upgradeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  upgradeBody: {
    color: '#fff',
    opacity: 0.9,
    fontSize: 13,
  },
  upgradeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  upgradeButtonText: {
    color: '#667eea',
    fontWeight: '700',
    fontSize: 13,
  },
  manageSubscriptionButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  manageSubscriptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageSubscriptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  manageSubscriptionSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 12,
    marginTop: 20,
  },
});
