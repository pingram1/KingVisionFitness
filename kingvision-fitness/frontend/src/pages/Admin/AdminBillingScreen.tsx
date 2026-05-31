import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAdminAnalytics, formatCount, formatMrr } from '../../api/adminAnalytics';
import type { AdminAnalytics } from '../../types/adminAnalytics';

const TIER_PRICING = {
  BASIC: { label: 'Basic', priceCents: 0 },
  SPECIFIED: { label: 'Specified Plan', priceCents: 1999 },
  ACTIVE_CLIENT: { label: 'Active Client', priceCents: 4999 },
} as const;

function TierRow({
  label,
  count,
  priceCents,
  loading,
}: {
  label: string;
  count: number;
  priceCents: number;
  loading?: boolean;
}) {
  const subtotal = count * priceCents;
  return (
    <View style={styles.tierRow}>
      <View style={styles.tierRowLeft}>
        <Text style={styles.tierName}>{label}</Text>
        <Text style={styles.tierMeta}>
          {formatCount(count)} × {priceCents === 0 ? 'Free' : formatMrr(priceCents)}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#667eea" />
      ) : (
        <Text style={styles.tierSubtotal}>{formatMrr(subtotal)}</Text>
      )}
    </View>
  );
}

function OpsChecklistItem({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.checklistRow}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={done ? '#22c55e' : '#9ca3af'}
      />
      <Text style={[styles.checklistText, done && styles.checklistTextDone]}>{text}</Text>
    </View>
  );
}

/**
 * Billing ops dashboard — tier mix, estimated MRR, and pre-Stripe readiness.
 * Uses live user counts from `/admin/analytics`; no Stripe API calls.
 */
export default function AdminBillingScreen() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoader = true) => {
    try {
      setError(null);
      if (showLoader) setLoading(true);
      const data = await fetchAdminAnalytics();
      setAnalytics(data);
    } catch (loadError) {
      console.error('Failed to load billing ops:', loadError);
      setError('Could not load billing data. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  const showSkeleton = loading && !analytics;
  const byTier = analytics?.users.byTier;
  const specifiedMrr = (byTier?.SPECIFIED ?? 0) * TIER_PRICING.SPECIFIED.priceCents;
  const activeMrr = analytics?.revenue.estimatedMrrCents ?? 0;
  const totalMrr = activeMrr + specifiedMrr;
  const paidSubscribers = (byTier?.SPECIFIED ?? 0) + (byTier?.ACTIVE_CLIENT ?? 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="card-outline" size={24} color="#d4af37" />
        </View>
        <Text style={styles.heroTitle}>Billing Ops</Text>
        <Text style={styles.heroSubtitle}>
          Subscription health and revenue projections — Stripe integration pending.
        </Text>
      </View>

      {error && !showSkeleton ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.mrrCard}>
        <Text style={styles.mrrLabel}>Estimated total MRR</Text>
        {showSkeleton ? (
          <View style={styles.skeleton} />
        ) : (
          <>
            <Text style={styles.mrrValue}>{formatMrr(totalMrr)}</Text>
            <Text style={styles.mrrHint}>
              {formatCount(paidSubscribers)} paid subscriber{paidSubscribers === 1 ? '' : 's'}{' '}
              across Specified + Active Client tiers
            </Text>
          </>
        )}
      </View>

      <Text style={styles.sectionHeading}>Tier breakdown</Text>
      <View style={styles.card}>
        <TierRow
          label={TIER_PRICING.BASIC.label}
          count={byTier?.BASIC ?? 0}
          priceCents={TIER_PRICING.BASIC.priceCents}
          loading={showSkeleton}
        />
        <View style={styles.divider} />
        <TierRow
          label={TIER_PRICING.SPECIFIED.label}
          count={byTier?.SPECIFIED ?? 0}
          priceCents={TIER_PRICING.SPECIFIED.priceCents}
          loading={showSkeleton}
        />
        <View style={styles.divider} />
        <TierRow
          label={TIER_PRICING.ACTIVE_CLIENT.label}
          count={byTier?.ACTIVE_CLIENT ?? 0}
          priceCents={TIER_PRICING.ACTIVE_CLIENT.priceCents}
          loading={showSkeleton}
        />
      </View>

      <Text style={styles.sectionHeading}>Platform snapshot</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>Total users</Text>
          {showSkeleton ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <Text style={styles.metricValue}>{formatCount(analytics?.users.total ?? 0)}</Text>
          )}
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>Workouts (7d)</Text>
          {showSkeleton ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <Text style={styles.metricValue}>
              {formatCount(analytics?.engagement.workoutsCompletedLast7Days ?? 0)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.stripeCard}>
        <View style={styles.stripeHeader}>
          <Ionicons name="card" size={22} color="#635bff" />
          <Text style={styles.stripeTitle}>Stripe — not connected</Text>
        </View>
        <Text style={styles.stripeBody}>
          Live checkout, webhooks, and payout reconciliation will appear here once API keys are
          configured. Until then, tier changes use the dev upgrade path only.
        </Text>
        <OpsChecklistItem done={paidSubscribers > 0} text="At least one paid-tier member" />
        <OpsChecklistItem done={false} text="Stripe secret + publishable keys in backend .env" />
        <OpsChecklistItem done={false} text="Webhook endpoint registered for subscription events" />
        <OpsChecklistItem done={false} text="Customer portal link for self-serve billing" />
      </View>

      {analytics?.generatedAt && !showSkeleton ? (
        <Text style={styles.updatedAt}>
          Updated {new Date(analytics.generatedAt).toLocaleString()}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f7fb' },
  content: { padding: 16, paddingBottom: 40 },
  hero: { marginBottom: 16 },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  heroSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 20 },
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
  errorBannerText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },
  mrrCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  mrrLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d4af37',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mrrValue: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  mrrHint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  skeleton: {
    height: 44,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginTop: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tierRowLeft: { flex: 1 },
  tierName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tierMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  tierSubtotal: { fontSize: 16, fontWeight: '800', color: '#667eea' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metricLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  metricValue: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 6 },
  stripeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stripeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stripeTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  stripeBody: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 12 },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checklistText: { flex: 1, fontSize: 13, color: '#6b7280' },
  checklistTextDone: { color: '#374151' },
  updatedAt: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
  },
});
