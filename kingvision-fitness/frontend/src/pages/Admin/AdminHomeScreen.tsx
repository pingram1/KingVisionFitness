import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

type OverviewMetric = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
};

type ActivityItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  when: string;
};

/**
 * Admin Overview — the home tab of the SUPER_ADMIN shell.
 *
 * This screen is intentionally *not* the client HomeScreen. Admins see business
 * metrics (clients, trainers, revenue, engagement) rather than personal
 * workouts. A logout control lives in the header so the owner can sign out
 * without ever having to enter a client-facing screen.
 *
 * The numbers below are scaffolded with placeholders. Replace `loadOverview`
 * with a real call to e.g. `GET /api/admin/overview` once that endpoint exists.
 */
export default function AdminHomeScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Placeholder data — wire to backend in a follow-up. Keeping it local-only
  // means the screen renders immediately and shows the intended layout.
  const [metrics, setMetrics] = useState<OverviewMetric[]>([
    { id: 'clients',     label: 'Total Clients',     value: '—', icon: 'people-outline',      accent: '#667eea' },
    { id: 'trainers',    label: 'Active Trainers',   value: '—', icon: 'fitness-outline',     accent: '#22c55e' },
    { id: 'revenue',     label: 'Revenue (MTD)',     value: '—', icon: 'cash-outline',        accent: '#f59e0b' },
    { id: 'engagement',  label: 'Workouts This Week', value: '—', icon: 'pulse-outline',       accent: '#a855f7' },
  ]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Sign out of the admin console?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
          } catch (error) {
            console.error('Admin logout failed:', error);
            Alert.alert('Logout failed', 'Something went wrong. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, [logout]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}
          disabled={loggingOut}
          style={styles.headerButton}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleLogout, loggingOut]);

  const loadOverview = useCallback(async () => {
    // TODO: replace with `api.get('/admin/overview')` once the endpoint exists.
    // For now, simulate "loaded" so the placeholders render consistently.
    setMetrics((prev) => prev.map((m) => ({ ...m, value: m.value })));
    setRecentActivity([]);
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadOverview();
    } finally {
      setRefreshing(false);
    }
  }, [loadOverview]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
    >
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="shield-checkmark" size={18} color="#d4af37" />
          <Text style={styles.heroBadgeText}>SUPER ADMIN</Text>
        </View>
        <Text style={styles.heroTitle}>
          Welcome back{user?.profile?.firstName ? `, ${user.profile.firstName}` : ''}.
        </Text>
        <Text style={styles.heroSubtitle}>
          Here's the state of KingVision Fitness today.
        </Text>
      </View>

      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <View key={metric.id} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: `${metric.accent}1A` }]}>
              <Ionicons name={metric.icon} size={20} color={metric.accent} />
            </View>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
            {metric.delta ? (
              <Text style={styles.metricDelta}>{metric.delta}</Text>
            ) : (
              <Text style={styles.metricDeltaMuted}>— no data yet —</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.sectionHint}>Last 24h</Text>
        </View>
        {recentActivity.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={26} color="#9ca3af" />
            <Text style={styles.emptyStateTitle}>No activity yet</Text>
            <Text style={styles.emptyStateBody}>
              Sign-ups, workout completions, and payments will surface here as
              soon as the admin telemetry endpoint is wired up.
            </Text>
          </View>
        ) : (
          recentActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityIconWrap}>
                <Ionicons name={item.icon} size={18} color="#4b5563" />
              </View>
              <View style={styles.activityBody}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.activityWhen}>{item.when}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
        <Text style={styles.footerNoteText}>
          Signed in as {user?.email ?? '—'} · role {user?.role ?? 'SUPER_ADMIN'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hero: {
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
    gap: 6,
  },
  heroBadgeText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  metricDelta: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
  },
  metricDeltaMuted: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionHint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyStateBody: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  activityWhen: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 8,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
