import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
import { fetchAdminAnalytics, formatCount, formatMrr } from '../../api/adminAnalytics';
import type { AdminAnalytics } from '../../types/adminAnalytics';

type MetricTileProps = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  loading?: boolean;
};

function MetricTile({ label, value, icon, accent, loading }: MetricTileProps) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={accent} style={styles.metricLoader} />
      ) : (
        <Text style={styles.metricValue}>{value}</Text>
      )}
    </View>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

/**
 * Admin Command Center — live business metrics for SUPER_ADMIN.
 */
export default function AdminHomeScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
          } catch (logoutError) {
            console.error('Admin logout failed:', logoutError);
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

  const loadAnalytics = useCallback(async (showFullScreenLoader = false) => {
    try {
      setError(null);
      if (showFullScreenLoader) setLoading(true);
      const data = await fetchAdminAnalytics();
      setAnalytics(data);
    } catch (loadError) {
      console.error('Failed to load admin analytics:', loadError);
      setError('Could not load analytics. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(true);
  }, [loadAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics(false);
    setRefreshing(false);
  }, [loadAnalytics]);

  const showSkeleton = loading && !analytics;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="shield-checkmark" size={18} color="#d4af37" />
          <Text style={styles.heroBadgeText}>SUPER ADMIN</Text>
        </View>
        <Text style={styles.heroTitle}>
          Welcome back{user?.profile?.firstName ? `, ${user.profile.firstName}` : ''}.
        </Text>
        <Text style={styles.heroSubtitle}>Live business metrics for KingVision Fitness.</Text>
      </View>

      {error && !showSkeleton ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* Top row — financials */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueHeader}>
          <View style={styles.revenueIconWrap}>
            <Ionicons name="cash" size={22} color="#d4af37" />
          </View>
          <View style={styles.revenueHeaderText}>
            <Text style={styles.revenueLabel}>Estimated MRR</Text>
            <Text style={styles.revenueHint}>
              {analytics
                ? `${formatCount(analytics.revenue.activeClientCount)} Active Client${
                    analytics.revenue.activeClientCount === 1 ? '' : 's'
                  } × ${formatMrr(analytics.revenue.pricePerClientCents)}`
                : 'Monthly recurring revenue projection'}
            </Text>
          </View>
        </View>
        {showSkeleton ? (
          <SkeletonBlock height={44} />
        ) : (
          <Text style={styles.revenueValue}>
            {formatMrr(analytics?.revenue.estimatedMrrCents ?? 0)}
          </Text>
        )}
      </View>

      {/* Middle grid — users */}
      <Text style={styles.sectionHeading}>Users</Text>
      <View style={styles.metricGrid}>
        <MetricTile
          label="Total Users"
          value={formatCount(analytics?.users.total ?? 0)}
          icon="people"
          accent="#667eea"
          loading={showSkeleton}
        />
        <MetricTile
          label="Active Clients"
          value={formatCount(analytics?.users.byTier.ACTIVE_CLIENT ?? 0)}
          icon="star"
          accent="#22c55e"
          loading={showSkeleton}
        />
        <MetricTile
          label="Specified Clients"
          value={formatCount(analytics?.users.byTier.SPECIFIED ?? 0)}
          icon="ribbon"
          accent="#f59e0b"
          loading={showSkeleton}
        />
        <MetricTile
          label="Active Coaches"
          value={formatCount(analytics?.users.activeCoaches ?? 0)}
          icon="fitness"
          accent="#a855f7"
          loading={showSkeleton}
        />
      </View>

      {/* Bottom — engagement */}
      <View style={styles.engagementCard}>
        <View style={styles.engagementHeader}>
          <Ionicons name="pulse" size={22} color="#667eea" />
          <Text style={styles.engagementTitle}>Platform Workouts Completed This Week</Text>
        </View>
        {showSkeleton ? (
          <SkeletonBlock height={36} />
        ) : (
          <>
            <Text style={styles.engagementValue}>
              {formatCount(analytics?.engagement.workoutsCompletedLast7Days ?? 0)}
            </Text>
            <Text style={styles.engagementHint}>
              Completed sessions logged in the last 7 days across all users.
            </Text>
          </>
        )}
      </View>

      {analytics?.generatedAt && !showSkeleton ? (
        <Text style={styles.updatedAt}>
          Updated {new Date(analytics.generatedAt).toLocaleString()}
        </Text>
      ) : null}

      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
        <Text style={styles.footerNoteText}>
          Signed in as {user?.email ?? '—'} · {user?.role ?? 'SUPER_ADMIN'}
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  revenueCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  revenueIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueHeaderText: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d4af37',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  revenueHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  revenueValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  metricLoader: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  engagementCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  engagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  engagementTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  engagementValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#667eea',
  },
  engagementHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 17,
  },
  skeleton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
  },
  updatedAt: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 14,
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
