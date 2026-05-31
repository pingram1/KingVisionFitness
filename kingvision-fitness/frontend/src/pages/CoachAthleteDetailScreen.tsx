import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { fetchCoachAthleteDetail, saveCoachAthleteStats } from '../api/coachAthlete';
import { previewAthleteStats } from '../api/athleteStats';
import type { GroupsStackParamList } from './GroupsScreen';
import type {
  AthleteStatHistoryEntry,
  CoachAthleteDetail,
  TrackedAthleteMetric,
} from '../types/coachAthlete';
import {
  METRIC_LABELS,
  formatStatValue,
  isStatImprovement,
} from '../types/coachAthlete';
import type {
  AthleteStatsFormState,
  AthleteStatsPayload,
  CategoryScore,
  PerformanceBreakdown,
  PerformanceTier,
} from '../types/athleteStats';
import { EMPTY_ATHLETE_FORM } from '../types/athleteStats';

type CoachAthleteRoute = RouteProp<GroupsStackParamList, 'CoachAthleteDetail'>;

type StatField = keyof AthleteStatsFormState;

const STAT_FIELDS: Array<{ key: StatField; label: string; unit: string; decimal?: boolean }> = [
  { key: 'bodyWeight', label: 'Body Weight', unit: 'lbs' },
  { key: 'height', label: 'Height', unit: 'in' },
  { key: 'squatMax', label: 'Squat 1RM', unit: 'lbs' },
  { key: 'benchMax', label: 'Bench 1RM', unit: 'lbs' },
  { key: 'deadliftMax', label: 'Deadlift 1RM', unit: 'lbs' },
  { key: 'pushUpCount', label: 'Push-Ups', unit: 'reps' },
  { key: 'sitUpCount', label: 'Sit-Ups', unit: 'reps' },
  { key: 'fortyYardDash', label: '40-Yard Dash', unit: 'sec', decimal: true },
];

function statsToForm(stats: CoachAthleteDetail['stats']): AthleteStatsFormState {
  return {
    bodyWeight: stats.bodyWeight != null ? String(stats.bodyWeight) : '',
    height: stats.height != null ? String(stats.height) : '',
    squatMax: stats.squatMax != null ? String(stats.squatMax) : '',
    benchMax: stats.benchMax != null ? String(stats.benchMax) : '',
    deadliftMax: stats.deadliftMax != null ? String(stats.deadliftMax) : '',
    pushUpCount: stats.pushUpCount != null ? String(stats.pushUpCount) : '',
    sitUpCount: stats.sitUpCount != null ? String(stats.sitUpCount) : '',
    fortyYardDash: stats.fortyYardDash != null ? String(stats.fortyYardDash) : '',
  };
}

function formToPayload(form: AthleteStatsFormState): AthleteStatsPayload {
  const out: AthleteStatsPayload = {};
  (Object.keys(form) as StatField[]).forEach((key) => {
    const trimmed = form[key].trim();
    if (!trimmed) return;
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) out[key] = num;
  });
  return out;
}

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: string[] } } })
      .response?.data;
    if (Array.isArray(data?.errors) && data.errors.length > 0) return data.errors.join('. ');
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

const TIER_COLORS: Record<PerformanceTier, { bg: string; fg: string; label: string }> = {
  untrained: { bg: '#ECEFF1', fg: '#546E7A', label: 'Untrained' },
  beginner: { bg: '#FFF3E0', fg: '#E65100', label: 'Beginner' },
  developing: { bg: '#FFF8E1', fg: '#F9A825', label: 'Developing' },
  baseline: { bg: '#E3F2FD', fg: '#1565C0', label: 'Baseline' },
  advanced: { bg: '#E8F5E9', fg: '#2E7D32', label: 'Advanced' },
  elite: { bg: '#EDE7F6', fg: '#4527A0', label: 'Elite' },
};

function gradeColor(grade: number): string {
  if (grade >= 88) return '#4527A0';
  if (grade >= 70) return '#2E7D32';
  if (grade >= 50) return '#1565C0';
  if (grade >= 35) return '#F9A825';
  if (grade >= 15) return '#E65100';
  return '#546E7A';
}

function CategoryBreakdownRow({
  label,
  score,
  rawSuffix,
}: {
  label: string;
  score: CategoryScore | null;
  rawSuffix?: string;
}) {
  if (!score) {
    return (
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryEmpty}>—</Text>
      </View>
    );
  }
  const tone = TIER_COLORS[score.tier];
  return (
    <View style={styles.categoryRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryRaw}>
          {score.raw}
          {rawSuffix ?? ''}
        </Text>
      </View>
      <Text style={styles.categoryScore}>{Math.round(score.score)}</Text>
      <View style={[styles.tierPill, { backgroundColor: tone.bg }]}>
        <Text style={[styles.tierPillText, { color: tone.fg }]}>{tone.label}</Text>
      </View>
    </View>
  );
}

function RawStatChip({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View style={styles.rawChip}>
      <Text style={styles.rawChipLabel}>{label}</Text>
      <Text style={styles.rawChipValue}>
        {value != null ? `${value}${unit === 'sec' ? '' : ' '}${unit === 'sec' ? ` ${unit}` : unit}` : '—'}
      </Text>
    </View>
  );
}

function HistoryRow({ entry }: { entry: AthleteStatHistoryEntry }) {
  const improved = isStatImprovement(entry.metric, entry.oldValue, entry.newValue);
  const label = METRIC_LABELS[entry.metric as TrackedAthleteMetric] ?? entry.metric;
  const oldDisplay =
    entry.oldValue != null
      ? formatStatValue(entry.metric as TrackedAthleteMetric, entry.oldValue)
      : '—';
  const newDisplay = formatStatValue(entry.metric as TrackedAthleteMetric, entry.newValue);
  const dateLabel = format(new Date(entry.date), 'MMM d, yyyy · h:mm a');

  return (
    <View style={styles.historyRow}>
      <View style={[styles.historyIcon, improved ? styles.historyIconUp : styles.historyIconDown]}>
        <Ionicons
          name={improved ? 'trending-up' : 'trending-down'}
          size={18}
          color={improved ? '#2E7D32' : '#C62828'}
        />
      </View>
      <View style={styles.historyBody}>
        <Text style={styles.historyTitle}>
          {entry.oldValue == null
            ? `${label} logged: ${newDisplay}`
            : `${label} ${improved ? 'increased' : 'changed'}: ${oldDisplay} → ${newDisplay}`}
        </Text>
        <Text style={styles.historyDate}>{dateLabel}</Text>
      </View>
    </View>
  );
}

export default function CoachAthleteDetailScreen() {
  const route = useRoute<CoachAthleteRoute>();
  const { groupId, userId } = route.params;

  const [detail, setDetail] = useState<CoachAthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AthleteStatsFormState>(EMPTY_ATHLETE_FORM);
  const [saving, setSaving] = useState(false);
  const [previewGrade, setPreviewGrade] = useState<number | null>(null);

  const load = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        setError(null);
        const data = await fetchCoachAthleteDetail(groupId, userId);
        setDetail(data);
        setForm(statsToForm(data.stats));
      } catch (err) {
        console.error('Failed to load coach athlete detail', err);
        setError('Could not load athlete details. Pull to refresh.');
      } finally {
        setLoading(false);
      }
    },
    [groupId, userId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  };

  const breakdown = useMemo(
    () => (detail?.stats.performanceBreakdown as PerformanceBreakdown | null) ?? null,
    [detail]
  );

  useEffect(() => {
    if (!editing) {
      setPreviewGrade(null);
      return;
    }
    const payload = formToPayload(form);
    if (Object.keys(payload).length === 0) {
      setPreviewGrade(null);
      return;
    }
    const timer = setTimeout(() => {
      void previewAthleteStats(payload)
        .then((result) => setPreviewGrade(result.overall))
        .catch(() => setPreviewGrade(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [editing, form]);

  const handleSaveStats = async () => {
    const payload = formToPayload(form);
    if (Object.keys(payload).length === 0) {
      Alert.alert('Check the form', 'Enter at least one measurable before saving.');
      return;
    }
    try {
      setSaving(true);
      await saveCoachAthleteStats(groupId, userId, payload);
      setEditing(false);
      await load(false);
      Alert.alert('Saved', 'Combine stats updated and performance grade recalculated.');
    } catch (err) {
      Alert.alert('Save failed', parseApiError(err, 'Could not update athlete stats.'));
    } finally {
      setSaving(false);
    }
  };

  const athleteName = detail
    ? `${detail.athlete.firstName} ${detail.athlete.lastName}`.trim() || 'Athlete'
    : 'Athlete';

  if (loading && !detail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading athlete profile…</Text>
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!detail) return null;

  const grade = previewGrade ?? detail.stats.performanceGrade ?? 0;
  const color = gradeColor(grade);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(detail.athlete.firstName?.[0] ?? '').toUpperCase()}
              {(detail.athlete.lastName?.[0] ?? '').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.athleteName}>{athleteName}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{detail.athlete.roleLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editToggle}
            onPress={() => {
              if (editing) {
                setForm(statsToForm(detail.stats));
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
          >
            <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color="#667eea" />
            <Text style={styles.editToggleText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.gradeCard, { borderColor: color }]}>
          <Text style={styles.gradeLabel}>KingVision Performance Grade</Text>
          <View style={styles.gradeRow}>
            <Text style={[styles.gradeValue, { color }]}>{Math.round(grade)}</Text>
            <Text style={styles.gradeMax}>/ 100</Text>
          </View>
          {editing && previewGrade != null ? (
            <Text style={styles.previewHint}>Live preview from entered measurables</Text>
          ) : null}
          {breakdown ? (
            <View style={styles.weightsRow}>
              <Text style={styles.weightChip}>
                STR {Math.round((breakdown.weights.strength ?? 0) * 100)}%
              </Text>
              <Text style={styles.weightChip}>
                SPD {Math.round((breakdown.weights.speed ?? 0) * 100)}%
              </Text>
              <Text style={styles.weightChip}>
                END {Math.round((breakdown.weights.endurance ?? 0) * 100)}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter Measurables</Text>
          <Text style={styles.cardSubtitle}>
            Log combine stats for this athlete. Partial updates are supported — only filled fields
            are saved.
          </Text>
          {STAT_FIELDS.map(({ key, label, unit, decimal }) => (
            <View key={key} style={styles.formRow}>
              <Text style={styles.formLabel}>{label}</Text>
              <View style={styles.formInputWrap}>
                <TextInput
                  style={styles.formInput}
                  value={form[key]}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
                  placeholder="—"
                  placeholderTextColor="#bbb"
                  keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                />
                <Text style={styles.formUnit}>{unit}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveStats}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save & Recalculate Grade</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Breakdown</Text>
        <CategoryBreakdownRow label="Strength" score={breakdown?.strength ?? null} rawSuffix="× BW" />
        <CategoryBreakdownRow label="Speed" score={breakdown?.speed ?? null} />
        <CategoryBreakdownRow label="Push-Ups" score={breakdown?.pushUps ?? null} rawSuffix=" reps" />
        <CategoryBreakdownRow label="Sit-Ups" score={breakdown?.sitUps ?? null} rawSuffix=" reps" />
        <CategoryBreakdownRow
          label="Endurance (avg)"
          score={breakdown?.endurance ?? null}
          rawSuffix=" avg reps"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Combine Stats</Text>
        <View style={styles.rawGrid}>
          <RawStatChip label="Squat" value={detail.stats.squatMax} unit="lbs" />
          <RawStatChip label="Bench" value={detail.stats.benchMax} unit="lbs" />
          <RawStatChip label="Deadlift" value={detail.stats.deadliftMax} unit="lbs" />
          <RawStatChip label="Push-Ups" value={detail.stats.pushUpCount} unit="reps" />
          <RawStatChip label="Sit-Ups" value={detail.stats.sitUpCount} unit="reps" />
          <RawStatChip label="40-Yard" value={detail.stats.fortyYardDash} unit="sec" />
          <RawStatChip label="Body Wt" value={detail.stats.bodyWeight} unit="lbs" />
          <RawStatChip label="Height" value={detail.stats.height} unit="in" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progression History</Text>
        <Text style={styles.cardSubtitle}>
          Every time combine stats are updated, changes are logged here.
        </Text>
        {detail.statHistory.length > 0 ? (
          detail.statHistory.map((entry, index) => (
            <HistoryRow key={`${entry.metric}-${entry.date}-${index}`} entry={entry} />
          ))
        ) : (
          <View style={styles.emptyHistory}>
            <Ionicons name="time-outline" size={36} color="#ccc" />
            <Text style={styles.emptyHistoryText}>No stat updates recorded yet.</Text>
            <Text style={styles.emptyHistorySub}>
              Tap Edit above to enter combine measurables for this athlete.
            </Text>
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
  contentContainer: {
    padding: 16,
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
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  athleteName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#eef0ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
  },
  editToggle: {
    alignItems: 'center',
    gap: 2,
  },
  editToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667eea',
  },
  previewHint: {
    fontSize: 11,
    color: '#667eea',
    marginTop: 6,
    fontWeight: '600',
  },
  formRow: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  formInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    paddingVertical: 10,
  },
  formUnit: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  gradeCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
  },
  gradeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  gradeValue: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
  },
  gradeMax: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
    marginLeft: 4,
  },
  weightsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  weightChip: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    backgroundColor: '#f0f0f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    lineHeight: 17,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryRaw: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  categoryScore: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    minWidth: 36,
    textAlign: 'right',
  },
  categoryEmpty: {
    fontSize: 14,
    color: '#bbb',
  },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rawGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rawChip: {
    width: '47%',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    padding: 12,
  },
  rawChipLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rawChipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconUp: {
    backgroundColor: '#E8F5E9',
  },
  historyIconDown: {
    backgroundColor: '#FFEBEE',
  },
  historyBody: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  historyDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  emptyHistorySub: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
