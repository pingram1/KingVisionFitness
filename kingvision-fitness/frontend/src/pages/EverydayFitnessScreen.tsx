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
  fetchEverydayStats,
  previewEverydayStats,
  saveEverydayStats,
} from '../api/everydayStats';
import {
  EMPTY_EVERYDAY_FORM,
  EverydayFitnessBreakdown,
  EverydayFitnessFormState,
  EverydayFitnessPayload,
} from '../types/athleteStats';

type StatField = keyof EverydayFitnessFormState;

interface FieldDef {
  key: StatField;
  label: string;
  unit: string;
  placeholder: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  decimal?: boolean;
  layout?: 'inline' | 'stacked';
}

const FIELDS_UPPER_BODY: FieldDef[] = [
  {
    key: 'pushUpsMax',
    label: 'Push-Ups',
    unit: 'reps',
    placeholder: '25',
    icon: 'arrow-up-circle-outline',
    hint: 'Max consecutive reps — chest to floor, full lockout.',
    layout: 'stacked',
  },
  {
    key: 'pullUpsMax',
    label: 'Pull-Ups',
    unit: 'reps',
    placeholder: '8',
    icon: 'fitness-outline',
    hint: 'Max consecutive strict pull-ups.',
    layout: 'stacked',
  },
];

const FIELDS_CORE: FieldDef[] = [
  {
    key: 'sitUpsMax',
    label: 'Sit-Ups',
    unit: 'reps',
    placeholder: '40',
    icon: 'sync-outline',
    hint: 'Max unbroken reps — hands on chest.',
    layout: 'stacked',
  },
  {
    key: 'plankSeconds',
    label: 'Plank Hold',
    unit: 'sec',
    placeholder: '60',
    icon: 'timer-outline',
    hint: 'Longest strict front plank.',
    layout: 'stacked',
  },
];

const FIELDS_METABOLIC: FieldDef[] = [
  {
    key: 'burpeesCount',
    label: 'Burpees',
    unit: 'reps',
    placeholder: '20',
    icon: 'flash-outline',
    hint: 'Max reps in one minute (or best single set).',
    layout: 'stacked',
  },
];

const FIELDS_STRENGTH: FieldDef[] = [
  {
    key: 'bodyWeightLbs',
    label: 'Body Weight',
    unit: 'lbs',
    placeholder: '170',
    icon: 'body-outline',
    hint: 'Used to score curl volume relative to your size.',
    layout: 'stacked',
  },
  {
    key: 'curlsWeight',
    label: 'Curl Weight',
    unit: 'lbs',
    placeholder: '25',
    icon: 'barbell-outline',
  },
  {
    key: 'curlsReps',
    label: 'Curl Reps',
    unit: 'reps',
    placeholder: '12',
    icon: 'repeat-outline',
    hint: 'Pair with curl weight — score uses volume vs bodyweight.',
    layout: 'stacked',
  },
];

function wellnessColor(score: number): string {
  if (score >= 80) return '#2E7D32';
  if (score >= 60) return '#1565C0';
  if (score >= 40) return '#F9A825';
  if (score >= 20) return '#E65100';
  return '#546E7A';
}

function toPayload(form: EverydayFitnessFormState): EverydayFitnessPayload {
  const out: EverydayFitnessPayload = {};
  (Object.keys(form) as StatField[]).forEach((key) => {
    const trimmed = form[key].trim();
    if (!trimmed) return;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return;
    if (key === 'bodyWeightLbs') {
      if (num >= 50 && num <= 500) out.bodyWeightLbs = num;
      return;
    }
    out[key] = num;
  });
  return out;
}

function fromResponse(stats: EverydayFitnessPayload): EverydayFitnessFormState {
  const fmt = (v: number | null | undefined) =>
    typeof v === 'number' && v > 0 ? String(v) : '';
  return {
    pushUpsMax: fmt(stats.pushUpsMax),
    pullUpsMax: fmt(stats.pullUpsMax),
    sitUpsMax: fmt(stats.sitUpsMax),
    curlsWeight: fmt(stats.curlsWeight),
    curlsReps: fmt(stats.curlsReps),
    plankSeconds: fmt(stats.plankSeconds),
    burpeesCount: fmt(stats.burpeesCount),
    bodyWeightLbs: fmt(stats.bodyWeightLbs),
  };
}

function hasAnyInput(payload: EverydayFitnessPayload): boolean {
  return Object.values(payload).some((v) => typeof v === 'number' && v > 0);
}

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
            <Ionicons name={field.icon} size={18} color="#4CAF50" />
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
        <Ionicons name={field.icon} size={18} color="#4CAF50" />
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
  score: number | null | undefined;
  raw?: number | null;
  rawSuffix?: string;
}

function CategoryRow({ label, score, raw, rawSuffix }: CategoryRowProps) {
  if (score == null) {
    return (
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryEmpty}>—</Text>
      </View>
    );
  }
  return (
    <View style={styles.categoryRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.categoryLabel}>{label}</Text>
        {raw != null ? (
          <Text style={styles.categoryRaw}>
            {raw}
            {rawSuffix ?? ''}
          </Text>
        ) : null}
      </View>
      <Text style={styles.categoryScore}>{Math.round(score)}</Text>
    </View>
  );
}

interface ScoreCardProps {
  breakdown: EverydayFitnessBreakdown | null;
  previewing: boolean;
}

function ScoreCard({ breakdown, previewing }: ScoreCardProps) {
  const score = breakdown?.overall ?? 0;
  const color = wellnessColor(score);
  return (
    <View style={[styles.scoreCard, { borderColor: color }]}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>Everyday Fitness Score</Text>
        {previewing ? <ActivityIndicator size="small" color="#999" /> : null}
      </View>
      <View style={styles.scoreBody}>
        <Text style={[styles.scoreValue, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.scoreMax}> / 100</Text>
      </View>
      {breakdown ? (
        <View style={styles.weightsRow}>
          <Text style={styles.weightChip}>
            UPP {Math.round((breakdown.weights.upperBody ?? 0) * 100)}%
          </Text>
          <Text style={styles.weightChip}>
            CORE {Math.round((breakdown.weights.core ?? 0) * 100)}%
          </Text>
          <Text style={styles.weightChip}>
            MET {Math.round((breakdown.weights.metabolic ?? 0) * 100)}%
          </Text>
          <Text style={styles.weightChip}>
            STR {Math.round((breakdown.weights.strength ?? 0) * 100)}%
          </Text>
        </View>
      ) : (
        <Text style={styles.scoreHint}>
          Log any test below — save one field at a time or fill them all.
        </Text>
      )}
    </View>
  );
}

export default function EverydayFitnessScreen() {
  const [form, setForm] = useState<EverydayFitnessFormState>(EMPTY_EVERYDAY_FORM);
  const [savedBreakdown, setSavedBreakdown] = useState<EverydayFitnessBreakdown | null>(null);
  const [livePreview, setLivePreview] = useState<EverydayFitnessBreakdown | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewSeqRef = useRef(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (showFullSpinner = true) => {
    try {
      if (showFullSpinner) setLoading(true);
      setError(null);
      const stats = await fetchEverydayStats();
      setForm(fromResponse(stats));
      setLastUpdated(stats.lastUpdated);
      if (stats.everydayFitnessScore > 0) {
        const breakdown = await previewEverydayStats(toPayload(fromResponse(stats)));
        setSavedBreakdown(breakdown);
        setLivePreview(breakdown);
      } else {
        setSavedBreakdown(null);
        setLivePreview(null);
      }
    } catch (err) {
      console.error('Failed to load everyday stats', err);
      setError('Could not load your fitness test log. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

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
        const breakdown = await previewEverydayStats(payload);
        if (seq === previewSeqRef.current) {
          setLivePreview(breakdown);
        }
      } catch {
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
    try {
      setSaving(true);
      const stats = await saveEverydayStats(payload);
      setForm(fromResponse(stats));
      const breakdown = await previewEverydayStats(toPayload(fromResponse(stats)));
      setSavedBreakdown(breakdown);
      setLivePreview(breakdown);
      setLastUpdated(stats.lastUpdated);
      Alert.alert(
        'Stats saved',
        `Your Everyday Fitness Score is now ${Math.round(stats.everydayFitnessScore)}/100.`
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
    if (!lastUpdated) return null;
    const d = new Date(lastUpdated);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [lastUpdated]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your fitness test log…</Text>
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

        <ScoreCard breakdown={breakdown} previewing={previewing} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <CategoryRow
            label="Upper Body"
            score={breakdown?.upperBody?.score}
            raw={breakdown?.upperBody?.raw}
          />
          <CategoryRow
            label="Core"
            score={breakdown?.core?.score}
            raw={breakdown?.core?.raw}
          />
          <CategoryRow
            label="Metabolic"
            score={breakdown?.metabolic?.score}
            raw={breakdown?.burpees?.raw}
            rawSuffix=" burpees"
          />
          <CategoryRow
            label="Strength (curls)"
            score={breakdown?.strength?.score}
            raw={breakdown?.curlsVolume?.raw}
            rawSuffix=" vol index"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upper Body Stamina</Text>
          {FIELDS_UPPER_BODY.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Core Endurance</Text>
          {FIELDS_CORE.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Metabolic Conditioning</Text>
          {FIELDS_METABOLIC.map((field) => (
            <StatFieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(next) => onChangeField(field.key, next)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Strength Tracking</Text>
          <Text style={styles.cardSubtitle}>
            Dumbbell curl volume (weight × reps), scored against your body weight.
          </Text>
          {FIELDS_STRENGTH.map((field) => (
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
              <Text style={styles.saveButtonText}>Save Fitness Test</Text>
            </>
          )}
        </TouchableOpacity>

        {lastUpdatedDisplay ? (
          <Text style={styles.lastUpdatedText}>Last updated {lastUpdatedDisplay}</Text>
        ) : null}

        <Text style={styles.disclaimer}>
          Your wellness score uses general fitness benchmarks — separate from team combine
          grades reserved for athletes and pro clients.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scoreCard: {
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
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scoreBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  scoreMax: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
    marginLeft: 4,
  },
  scoreHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  weightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    backgroundColor: '#e8f5e9',
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
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
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
