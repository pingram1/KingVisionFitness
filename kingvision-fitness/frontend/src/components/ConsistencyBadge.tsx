import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { ConsistencyTier, GamificationStatus } from '../types/gamification';

interface TierTheme {
  color: string;
  background: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const TIER_THEMES: Record<ConsistencyTier, TierTheme> = {
  bronze: { color: '#CD7F32', background: '#CD7F3218', label: 'Bronze', icon: 'arm-flex' },
  silver: { color: '#8E9AA5', background: '#C0C0C028', label: 'Silver', icon: 'arm-flex' },
  gold: { color: '#D4A017', background: '#FFD70020', label: 'Gold', icon: 'arm-flex' },
  platinum: { color: '#7C8A99', background: '#E5E4E240', label: 'Platinum', icon: 'arm-flex' },
  diamond: { color: '#2FA8C9', background: '#B9F2FF35', label: 'Diamond', icon: 'diamond-stone' },
  olympian: { color: '#8E24AA', background: '#8E24AA15', label: 'Olympian', icon: 'crown' },
};

interface ConsistencyBadgeProps {
  status: GamificationStatus;
}

/**
 * Tier badge card for the Consistency & Level-Up System. All habit percentages
 * are rendered directly from the server `pillarBreakdown` payload.
 */
export default function ConsistencyBadge({ status }: ConsistencyBadgeProps) {
  const theme = TIER_THEMES[status.currentTier];
  const breakdown = status.pillarBreakdown;
  const habitScore = breakdown.overallScore;
  const hasNextTier = status.nextTier !== null && status.nextTierThreshold !== null;
  const nextTheme = status.nextTier ? TIER_THEMES[status.nextTier] : null;
  const metrics = status.pillarMetrics;

  const pillarRows = [
    {
      label: 'Workouts',
      value: breakdown.workoutPillar,
      detail: `${metrics.completedWorkouts}/7 sessions`,
    },
    {
      label: 'Nutrition',
      value: breakdown.nutritionPillar,
      detail: `${metrics.verifiedNutritionDays}/7 verified days`,
    },
    {
      label: 'Check-ins',
      value: breakdown.appCheckInPillar,
      detail: `${metrics.appCheckInDays}/7 app days`,
    },
    {
      label: 'Fitness',
      value: breakdown.fitnessStatsPillar,
      detail:
        metrics.fitnessScoreDelta > 0
          ? `+${metrics.fitnessScoreDelta} improving`
          : metrics.fitnessScoreDelta < 0
            ? `${metrics.fitnessScoreDelta} trend`
            : 'maintaining',
    },
  ];

  return (
    <View style={[styles.card, { borderColor: theme.color }]}>
      <View style={styles.headerRow}>
        <View style={[styles.badgeIconWrap, { backgroundColor: theme.background }]}>
          <MaterialCommunityIcons name={theme.icon} size={28} color={theme.color} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.tierName, { color: theme.color }]}>
            {theme.label} Tier
          </Text>
          <Text style={styles.badgeLabel}>{status.badgeLabel}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreValue, { color: theme.color }]}>{habitScore}%</Text>
          <Text style={styles.scoreCaption}>Weekly Habit Score</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="fire" size={14} color="#FF9800" />
          <Text style={styles.metaChipText}>{status.currentStreakDays}-day streak</Text>
        </View>
        {status.maintenanceFloor !== null ? (
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color="#667eea" />
            <Text style={styles.metaChipText}>
              Defend at {status.maintenanceFloor}%+
            </Text>
          </View>
        ) : null}
        {status.verificationDaysRequired !== null && status.nextTier ? (
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="calendar-check" size={14} color="#4CAF50" />
            <Text style={styles.metaChipText}>
              {status.verificationDaysCompleted}/{status.verificationDaysRequired} day verify
            </Text>
          </View>
        ) : null}
        {status.minimumStreakRequired !== null && status.nextTier ? (
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="trending-up" size={14} color="#4CAF50" />
            <Text style={styles.metaChipText}>
              Streak {status.currentStreakDays}/{status.minimumStreakRequired} req.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.pillarSection}>
        <Text style={styles.pillarHeading}>Weekly pillar breakdown</Text>
        {pillarRows.map((row) => (
          <View key={row.label} style={styles.pillarRow}>
            <View style={styles.pillarLabelBlock}>
              <Text style={styles.pillarLabel}>{row.label}</Text>
              <Text style={styles.pillarDetail}>{row.detail}</Text>
            </View>
            <Text style={[styles.pillarValue, { color: theme.color }]}>{row.value}%</Text>
          </View>
        ))}
      </View>

      {hasNextTier && nextTheme ? (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            {nextTheme.label} Progress: {Math.round(status.nextTierProgressPercent)}%
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(status.nextTierProgressPercent, 100)}%`,
                  backgroundColor: nextTheme.color,
                },
              ]}
            />
          </View>
          {status.verificationDaysRequired !== null ? (
            <Text style={styles.prestigeNote}>
              Requires a {status.nextTierThreshold}%+ Weekly Habit Score sustained for{' '}
              {status.verificationDaysRequired} consecutive local calendar days, plus a{' '}
              {status.minimumStreakRequired}-day activity streak.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.olympianNote}>
          Peak rank achieved — hold a perfect 100% week to keep the crown.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  scoreBlock: {
    alignItems: 'flex-end',
    maxWidth: 110,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  scoreCaption: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f7f7fb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  pillarSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f5',
    gap: 8,
  },
  pillarHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillarLabelBlock: {
    flex: 1,
    paddingRight: 8,
  },
  pillarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  pillarDetail: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  pillarValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressSection: {
    marginTop: 14,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  prestigeNote: {
    fontSize: 11,
    color: '#777',
    marginTop: 8,
    lineHeight: 16,
  },
  olympianNote: {
    fontSize: 12,
    color: '#8E24AA',
    fontWeight: '600',
    marginTop: 12,
  },
});
