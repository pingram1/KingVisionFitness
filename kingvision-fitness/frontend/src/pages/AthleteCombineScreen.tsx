import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchAthleteStats,
  previewAthleteStats,
  saveAthleteStats,
} from '../api/athleteStats';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useFitnessTrack } from '../hooks/useFitnessTrack';
import {
  combineDisclaimerText,
  fitnessTrackUserFromProfile,
  type FitnessTrackUser,
} from '../utils/fitnessTrack';
import EverydayFitnessScreen from './EverydayFitnessScreen';
import type { UserProfile } from '../types/user';
import {
  AthleteStatsFormState,
  AthleteStatsPayload,
  CategoryScore,
  EMPTY_ATHLETE_FORM,
  PerformanceBreakdown,
  PerformanceTier,
} from '../types/athleteStats';

// ─── Field metadata (single source of truth for the form layout) ─────────────

type StatField = keyof AthleteStatsFormState;

interface FieldDef {
  key: StatField;
  label: string;
  unit: string;
  placeholder: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  decimal?: boolean;
  /** Stacked = label above input (better for longer labels on narrow screens). */
  layout?: 'inline' | 'stacked';
}

const FIELDS_BIO: FieldDef[] = [
  {
    key: 'bodyWeight',
    label: 'Body Weight',
    unit: 'lbs',
    placeholder: '185',
    icon: 'body-outline',
    hint: 'Required — every score is bodyweight-relative.',
  },
  {
    key: 'height',
    label: 'Height',
    unit: 'in',
    placeholder: '70',
    icon: 'resize-outline',
  },
];

const FIELDS_STRENGTH: FieldDef[] = [
  { key: 'squatMax', label: 'Squat 1RM', unit: 'lbs', placeholder: '315', icon: 'barbell-outline' },
  { key: 'benchMax', label: 'Bench 1RM', unit: 'lbs', placeholder: '225', icon: 'barbell-outline' },
  {
    key: 'deadliftMax',
    label: 'Deadlift 1RM',
    unit: 'lbs',
    placeholder: '405',
    icon: 'barbell-outline',
  },
];

const FIELDS_ENDURANCE: FieldDef[] = [
  {
    key: 'pushUpCount',
    label: 'Push-Ups',
    unit: 'reps',
    placeholder: '45',
    icon: 'arrow-up-circle-outline',
    hint: 'Max unbroken reps — chest to floor, full lockout at top.',
    layout: 'stacked',
  },
  {
    key: 'sitUpCount',
    label: 'Sit-Ups',
    unit: 'reps',
    placeholder: '50',
    icon: 'sync-outline',
    hint: 'Max unbroken reps — hands on chest, elbows touch knees.',
    layout: 'stacked',
  },
];

const FIELDS_SPEED: FieldDef[] = [
  {
    key: 'fortyYardDash',
    label: '40-Yard Dash',
    unit: 'sec',
    placeholder: '4.8',
    icon: 'speedometer-outline',
    decimal: true,
  },
];

// ─── Tier visuals ─────────────────────────────────────────────────────────────

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

// ─── Form ↔ payload bridge ────────────────────────────────────────────────────

function toPayload(form: AthleteStatsFormState): AthleteStatsPayload {
  const out: AthleteStatsPayload = {};
  (Object.keys(form) as StatField[]).forEach((key) => {
    const trimmed = form[key].trim();
    if (!trimmed) return;
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      out[key] = num;
    }
  });
  return out;
}

function fromResponse(stats: {
  bodyWeight?: number | null;
  height?: number | null;
  squatMax?: number | null;
  benchMax?: number | null;
  deadliftMax?: number | null;
  pushUpCount?: number | null;
  sitUpCount?: number | null;
  fortyYardDash?: number | null;
}): AthleteStatsFormState {
  const fmt = (v: number | null | undefined) =>
    typeof v === 'number' && v > 0 ? String(v) : '';
  return {
    bodyWeight: fmt(stats.bodyWeight),
    height: fmt(stats.height),
    squatMax: fmt(stats.squatMax),
    benchMax: fmt(stats.benchMax),
    deadliftMax: fmt(stats.deadliftMax),
    pushUpCount: fmt(stats.pushUpCount),
    sitUpCount: fmt(stats.sitUpCount),
    fortyYardDash: fmt(stats.fortyYardDash),
  };
}

function hasAnyInput(payload: AthleteStatsPayload): boolean {
  return Object.values(payload).some((v) => typeof v === 'number' && v > 0);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface StatFieldProps {
  field: FieldDef;
  value: string;
  onChange: (next: string) => void;
}

function StatFieldRow({ field, value, onChange }: StatFieldProps) {
  const stacked = field.layout === 'stacked';

  if (stacked) {
    return (
      <View style={styles.fieldRowStacked}>
        <View style={styles.fieldHeader}>
          <View style={styles.fieldIcon}>
            <Ionicons name={field.icon} size={18} color="#667eea" />
          </View>
          <View style={styles.fieldLabelBlock}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            {field.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}
          </View>
        </View>
        <View style={styles.fieldInputWrapperStacked}>
          <TextInput
            style={styles.fieldInputStacked}
            value={value}
            onChangeText={onChange}
            placeholder={field.placeholder}
            placeholderTextColor="#bbb"
            keyboardType={field.decimal ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
          />
          <Text style={styles.fieldUnit}>{field.unit}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIcon}>
        <Ionicons name={field.icon} size={18} color="#667eea" />
      </View>
      <View style={styles.fieldLabelBlock}>
        <Text style={styles.fieldLabel} numberOfLines={2}>
          {field.label}
        </Text>
        {field.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}
      </View>
      <View style={styles.fieldInputWrapper}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder}
          placeholderTextColor="#bbb"
          keyboardType={field.decimal ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
        />
        <Text style={styles.fieldUnit}>{field.unit}</Text>
      </View>
    </View>
  );
}

interface CategoryRowProps {
  label: string;
  score: CategoryScore | null;
  rawSuffix?: string;
}

function CategoryRow({ label, score, rawSuffix }: CategoryRowProps) {
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
          {rawSuffix ? rawSuffix : ''}
        </Text>
      </View>
      <Text style={styles.categoryScore}>{Math.round(score.score)}</Text>
      <View style={[styles.tierPill, { backgroundColor: tone.bg }]}>
        <Text style={[styles.tierPillText, { color: tone.fg }]}>{tone.label}</Text>
      </View>
    </View>
  );
}

interface GradeCardProps {
  breakdown: PerformanceBreakdown | null;
  previewing: boolean;
}

function GradeCard({ breakdown, previewing }: GradeCardProps) {
  const grade = breakdown?.overall ?? 0;
  const color = gradeColor(grade);
  return (
    <View style={[styles.gradeCard, { borderColor: color }]}>
      <View style={styles.gradeHeader}>
        <Text style={styles.gradeLabel}>KingVision Performance Grade</Text>
        {previewing ? <ActivityIndicator size="small" color="#999" /> : null}
      </View>
      <View style={styles.gradeBody}>
        <Text style={[styles.gradeValue, { color }]}>{Math.round(grade)}</Text>
        <Text style={styles.gradeMax}> / 100</Text>
      </View>
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
      ) : (
        <Text style={styles.gradeHint}>
          Enter your body weight + at least one lift, dash, or rep count.
        </Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function AthleticCombineContent({
  trackUser,
  onForbidden,
}: {
  trackUser: FitnessTrackUser;
  onForbidden?: () => void;
}) {
  const disclaimer = useMemo(() => combineDisclaimerText(trackUser), [trackUser]);
  const [form, setForm] = useState<AthleteStatsFormState>(EMPTY_ATHLETE_FORM);
  const [savedBreakdown, setSavedBreakdown] = useState<PerformanceBreakdown | null>(null);
  const [livePreview, setLivePreview] = useState<PerformanceBreakdown | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the latest preview request so out-of-order responses don't clobber UI.
  const previewSeqRef = useRef(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (showFullSpinner = true) => {
    try {
      if (showFullSpinner) setLoading(true);
      setError(null);
      const stats = await fetchAthleteStats();
      setForm(fromResponse(stats));
      setSavedBreakdown(stats.performanceBreakdown ?? null);
      setLivePreview(stats.performanceBreakdown ?? null);
      setLastUpdatedAt(stats.lastUpdatedAt);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        onForbidden?.();
        return;
      }
      console.error('Failed to load athlete stats', err);
      setError('Could not load your combine stats. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [onForbidden]);

  useEffect(() => {
    load(true);
  }, [load]);

  // Debounced live preview — fires 350ms after the user stops typing.
  useEffect(() => {
    const payload = toPayload(form);
    if (!hasAnyInput(payload)) {
      setLivePreview(null);
      setPreviewing(false);
      return;
    }

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = setTimeout(async () => {
      const seq = ++previewSeqRef.current;
      setPreviewing(true);
      try {
        const breakdown = await previewAthleteStats(payload);
        if (seq === previewSeqRef.current) {
          setLivePreview(breakdown);
        }
      } catch {
        // Preview errors are non-fatal — just clear the live view.
        if (seq === previewSeqRef.current) setLivePreview(savedBreakdown);
      } finally {
        if (seq === previewSeqRef.current) setPreviewing(false);
      }
    }, 350);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [form, savedBreakdown]);

  const onChangeField = useCallback((key: StatField, next: string) => {
    setForm((prev) => ({ ...prev, [key]: next }));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  };

  const onSave = async () => {
    const payload = toPayload(form);
    if (!hasAnyInput(payload)) {
      Alert.alert('Nothing to save', 'Enter at least one stat before saving.');
      return;
    }
    if (!payload.bodyWeight) {
      Alert.alert(
        'Body weight required',
        'Body weight powers every relative score. Add it before saving.'
      );
      return;
    }
    try {
      setSaving(true);
      const stats = await saveAthleteStats(payload);
      setForm(fromResponse(stats));
      setSavedBreakdown(stats.performanceBreakdown ?? null);
      setLivePreview(stats.performanceBreakdown ?? null);
      setLastUpdatedAt(stats.lastUpdatedAt);
      Alert.alert(
        'Stats saved',
        `Your KingVision grade is now ${Math.round(stats.performanceGrade)}/100. Team leaderboards will reflect this immediately.`
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.errors?.join('\n') ??
        err?.response?.data?.message ??
        'Could not save your stats. Try again.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const breakdown = livePreview ?? savedBreakdown;

  const lastUpdatedDisplay = useMemo(() => {
    if (!lastUpdatedAt) return null;
    const d = new Date(lastUpdatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [lastUpdatedAt]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your combine card…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#c62828" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <GradeCard breakdown={breakdown} previewing={previewing} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <CategoryRow label="Strength" score={breakdown?.strength ?? null} rawSuffix="× BW" />
          <CategoryRow label="Speed" score={breakdown?.speed ?? null} />
          <CategoryRow label="Push-Ups" score={breakdown?.pushUps ?? null} rawSuffix=" reps" />
          <CategoryRow label="Sit-Ups" score={breakdown?.sitUps ?? null} rawSuffix=" reps" />
          <CategoryRow
            label="Endurance (avg)"
            score={breakdown?.endurance ?? null}
            rawSuffix=" avg reps"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Biometrics</Text>
          {FIELDS_BIO.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Strength (1RM)</Text>
          {FIELDS_STRENGTH.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bodyweight Endurance</Text>
          <Text style={styles.cardSubtitle}>
            Max consecutive reps in one set — no pausing or resting between reps.
          </Text>
          {FIELDS_ENDURANCE.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Speed</Text>
          {FIELDS_SPEED.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Save & Update Leaderboards</Text>
            </>
          )}
        </TouchableOpacity>

        {lastUpdatedDisplay ? (
          <Text style={styles.lastUpdatedText}>Last updated {lastUpdatedDisplay}</Text>
        ) : null}

        <Text style={styles.disclaimer}>{disclaimer}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Routes users to athletic combine or everyday fitness based on designation / team role only. */
export default function AthleteCombineScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forceEveryday, setForceEveryday] = useState(false);
  const { track, loading: trackLoading } = useFitnessTrack();

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ success: boolean; data: UserProfile }>('/users/profile')
      .then((response) => {
        if (!cancelled) setProfile(response.data.data);
      })
      .catch(() => {
        // Profile is optional — track resolution falls back to auth user fields.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trackUser = fitnessTrackUserFromProfile([user, profile]);

  if (trackLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your fitness test…</Text>
      </View>
    );
  }

  if (track === 'everyday' || forceEveryday) {
    return <EverydayFitnessScreen />;
  }

  return (
    <AthleticCombineContent
      trackUser={trackUser}
      onForbidden={() => setForceEveryday(true)}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    color: '#c62828',
    fontSize: 13,
    flex: 1,
  },
  gradeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gradeBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  gradeValue: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  gradeMax: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
    marginLeft: 4,
  },
  gradeHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  weightsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  weightChip: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    backgroundColor: '#f0f0f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
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
    lineHeight: 17,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  fieldRowStacked: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldLabelBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fieldHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  fieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    paddingHorizontal: 10,
    width: 96,
    flexShrink: 0,
  },
  fieldInputWrapperStacked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    alignSelf: 'stretch',
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    color: '#222',
    textAlign: 'right',
  },
  fieldInputStacked: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    minWidth: 0,
  },
  fieldUnit: {
    fontSize: 11,
    color: '#999',
    marginLeft: 6,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 0,
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
    letterSpacing: 0.3,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  lastUpdatedText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 10,
  },
  disclaimer: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
