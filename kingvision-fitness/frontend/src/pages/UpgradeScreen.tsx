import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import api from '../services/api';
import { createCheckoutSession } from '../api/billing';
import { useAuth } from '../context/AuthContext';
import type { SubscriptionTier } from '../types/user';
import { getTier } from '../utils/subscriptionAccess';

type TierKey = SubscriptionTier;

type TierCard = {
  key: TierKey;
  label: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  accent: string;
  badge?: string;
};

const TIERS: TierCard[] = [
  {
    key: 'BASIC',
    label: 'Basic',
    price: 'Free',
    cadence: 'forever',
    blurb: 'Get started with our public weekly workouts and community feed.',
    features: [
      'Public weekly workouts',
      'Community feed & teams',
      'Workout completion tracking',
    ],
    accent: '#9aa3b2',
  },
  {
    key: 'SPECIFIED',
    label: 'Specified',
    price: '$19.99',
    cadence: 'per month',
    blurb: 'Personalized weekly programs assigned to your goals and pace.',
    features: [
      'Personalized weekly programs',
      'Nutrition guidance library',
      'Progress analytics dashboard',
    ],
    accent: '#4CAF50',
  },
  {
    key: 'ACTIVE_CLIENT',
    label: 'Active Client',
    price: '$49.99',
    cadence: 'per month',
    blurb: 'The full 1-on-1 experience with your dedicated trainer.',
    features: [
      'Custom Weekly Plans',
      'Direct Trainer Chat',
      'Book 1-on-1 Sessions',
    ],
    accent: '#667eea',
    badge: 'Most Popular',
  },
];

const TIER_RANK: Record<TierKey, number> = {
  BASIC: 0,
  SPECIFIED: 1,
  ACTIVE_CLIENT: 2,
};

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: string }).message;
    if (m) return m;
  }
  return fallback;
}

const DEV_BYPASS_ENABLED = __DEV__ && Boolean(process.env.EXPO_PUBLIC_DEV_BYPASS_SECRET);

async function pollProfileUntilTier(
  expectedTier: TierKey,
  refreshProfile: () => Promise<{ subscriptionTier?: SubscriptionTier } | null>,
  maxAttempts = 8
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const fresh = await refreshProfile();
    if (fresh?.subscriptionTier === expectedTier) return true;
    const delayMs = Math.min(1000 * (attempt + 1), 4000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const { user, refreshProfile } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<TierKey | null>(null);

  const currentTier: TierKey = getTier(user);

  const sortedTiers = useMemo(
    () => [...TIERS].sort((a, b) => (a.key === 'ACTIVE_CLIENT' ? -1 : b.key === 'ACTIVE_CLIENT' ? 1 : 0)),
    []
  );

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

  const handleDevUpgrade = async () => {
    try {
      setUpgrading(true);
      const devSecret = process.env.EXPO_PUBLIC_DEV_BYPASS_SECRET;
      await api.post(
        '/billing/dev-upgrade',
        {},
        devSecret ? { headers: { 'X-Dev-Bypass-Secret': devSecret } } : undefined
      );
      const fresh = await refreshProfile();
      if (fresh?.subscriptionTier !== 'ACTIVE_CLIENT') {
        console.warn(
          '[UpgradeScreen] Post-upgrade refresh did not return ACTIVE_CLIENT — got:',
          fresh?.subscriptionTier
        );
      }
      Alert.alert(
        'Welcome to Active Client status!',
        'Your trainer chat and 1-on-1 booking are now unlocked.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Dev upgrade failed:', error);
      Alert.alert('Upgrade failed', parseApiError(error, 'Could not upgrade your account.'));
    } finally {
      setUpgrading(false);
    }
  };

  const handleStripeCheckout = async (tier: 'SPECIFIED' | 'ACTIVE_CLIENT') => {
    try {
      setCheckoutTier(tier);
      const { checkoutUrl } = await createCheckoutSession(tier);
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      const updated = await pollProfileUntilTier(tier, refreshProfile);
      if (!updated) {
        Alert.alert(
          'Payment processing',
          'Your payment may still be processing. Pull to refresh on your Profile if your tier has not updated yet.'
        );
      }
    } catch (error) {
      console.error('Stripe checkout failed:', error);
      Alert.alert('Checkout unavailable', parseApiError(error, 'Could not start checkout.'));
    } finally {
      setCheckoutTier(null);
    }
  };

  const showPaymentsBanner = !DEV_BYPASS_ENABLED && currentTier === 'BASIC';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {showPaymentsBanner ? (
        <View style={styles.paymentsBanner}>
          <Ionicons name="card-outline" size={18} color="#1e40af" />
          <View style={styles.paymentsBannerBody}>
            <Text style={styles.paymentsBannerTitle}>Upgrade with Stripe</Text>
            <Text style={styles.paymentsBannerText}>
              Choose a paid plan below to open secure checkout. Your membership updates automatically
              after payment.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Ionicons name="diamond" size={32} color="#FFD54F" />
        <Text style={styles.heroTitle}>Upgrade Your Membership</Text>
        <Text style={styles.heroSubtitle}>
          Unlock custom plans, trainer access, and live 1-on-1 sessions.
        </Text>
      </View>

      {sortedTiers.map((tier) => {
        const isCurrent = tier.key === currentTier;
        const isUpgradeTarget = TIER_RANK[tier.key] > TIER_RANK[currentTier];
        const isPaidTier = tier.key === 'SPECIFIED' || tier.key === 'ACTIVE_CLIENT';
        const isHero = tier.key === 'ACTIVE_CLIENT';
        const isCheckingOut = checkoutTier === tier.key;

        return (
          <View
            key={tier.key}
            style={[
              styles.card,
              isHero && styles.cardHero,
              isHero && { borderColor: tier.accent },
            ]}
          >
            {tier.badge && (
              <View style={[styles.badge, { backgroundColor: tier.accent }]}>
                <Text style={styles.badgeText}>{tier.badge}</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.tierLabel, isHero && styles.tierLabelHero]}>{tier.label}</Text>
                <Text style={styles.tierBlurb}>{tier.blurb}</Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={[styles.price, isHero && { color: tier.accent }]}>{tier.price}</Text>
                <Text style={styles.cadence}>{tier.cadence}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.features}>
              {tier.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={tier.accent} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {isCurrent ? (
              <View style={styles.currentPill}>
                <Ionicons name="ribbon" size={14} color="#555" />
                <Text style={styles.currentPillText}>Current Plan</Text>
              </View>
            ) : isHero && DEV_BYPASS_ENABLED ? (
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: tier.accent }]}
                onPress={handleDevUpgrade}
                disabled={upgrading}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Active Client (development)"
              >
                {upgrading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#fff" />
                    <Text style={styles.upgradeButtonText}>Dev Upgrade (Active Client)</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : isPaidTier && isUpgradeTarget ? (
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: tier.accent }]}
                onPress={() => handleStripeCheckout(tier.key as 'SPECIFIED' | 'ACTIVE_CLIENT')}
                disabled={isCheckingOut}
                accessibilityRole="button"
                accessibilityLabel={`Subscribe to ${tier.label}`}
              >
                {isCheckingOut ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="card" size={16} color="#fff" />
                    <Text style={styles.upgradeButtonText}>Subscribe — {tier.price}/mo</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : isPaidTier && !isUpgradeTarget ? (
              <View style={styles.includedPill}>
                <Ionicons name="checkmark-done" size={14} color="#555" />
                <Text style={styles.includedPillText}>Included in your plan</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={16} color="#888" />
        <Text style={styles.footerNoteText}>
          {DEV_BYPASS_ENABLED
            ? 'Development mode: Dev Upgrade grants Active Client without Stripe. Production uses Stripe Checkout.'
            : 'Payments are processed securely by Stripe. Pull to refresh your profile after returning from checkout.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  paymentsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  paymentsBannerBody: {
    flex: 1,
  },
  paymentsBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  paymentsBannerText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 17,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 8,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHero: {
    borderWidth: 2,
    paddingTop: 26,
  },
  badge: {
    position: 'absolute',
    top: -10,
    left: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  tierLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  tierLabelHero: {
    fontSize: 20,
  },
  tierBlurb: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
    maxWidth: 220,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  cadence: {
    fontSize: 11,
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 14,
  },
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
  },
  upgradeButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  currentPill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f1f3',
    borderRadius: 999,
  },
  currentPillText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  includedPill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f1f3',
    borderRadius: 999,
  },
  includedPillText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
});
