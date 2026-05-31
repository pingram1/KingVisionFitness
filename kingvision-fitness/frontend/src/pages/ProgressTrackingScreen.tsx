import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { fetchProgressHistory, logProgress } from '../api/progress';
import type { BodyMeasurements, ProgressEntry } from '../types/progress';
import { useFocusRefresh } from '../hooks/useFocusRefresh';

type MeasurementField = keyof BodyMeasurements;

const MEASUREMENT_FIELDS: Array<{ key: MeasurementField; label: string }> = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'thighs', label: 'Thighs' },
  { key: 'arms', label: 'Arms' },
];

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function formatMeasurements(measurements?: BodyMeasurements): string {
  if (!measurements) return '';
  return MEASUREMENT_FIELDS.map(({ key, label }) => {
    const value = measurements[key];
    return value != null ? `${label} ${value}"` : null;
  })
    .filter(Boolean)
    .join(' · ');
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function ProgressTrackingScreen() {
  const [weight, setWeight] = useState('');
  const [measurements, setMeasurements] = useState<Record<MeasurementField, string>>({
    chest: '',
    waist: '',
    hips: '',
    thighs: '',
    arms: '',
  });
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadHistory = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const entries = await fetchProgressHistory(20);
      setHistory(entries);
    } catch (error) {
      console.error('Failed to load progress history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh((showLoader) => loadHistory(showLoader));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory(false);
    setRefreshing(false);
  }, [loadHistory]);

  const resetForm = () => {
    setWeight('');
    setMeasurements({ chest: '', waist: '', hips: '', thighs: '', arms: '' });
    setNotes('');
  };

  const handleSave = async () => {
    const bodyMeasurements: BodyMeasurements = {};
    for (const { key } of MEASUREMENT_FIELDS) {
      const raw = measurements[key].trim();
      if (raw) bodyMeasurements[key] = Number(raw);
    }

    const payload = {
      weight: weight.trim() ? Number(weight.trim()) : undefined,
      bodyMeasurements: Object.keys(bodyMeasurements).length > 0 ? bodyMeasurements : undefined,
      notes: notes.trim() || undefined,
    };

    if (!payload.weight && !payload.bodyMeasurements && !payload.notes) {
      Alert.alert('Check the form', 'Add weight, at least one measurement, or notes.');
      return;
    }

    try {
      setSaving(true);
      await logProgress(payload);
      resetForm();
      await loadHistory(false);
      Alert.alert('Logged', 'Your progress entry has been saved.');
    } catch (error) {
      Alert.alert('Save failed', parseApiError(error, 'Could not log progress.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
      >
        <Text style={styles.sectionHint}>
          Log weight, body measurements, and notes. Entries appear in your history below.
        </Text>

        <Field label="Weight (lbs)">
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 185"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </Field>

        <Text style={styles.subheading}>Body measurements (inches)</Text>
        <View style={styles.measureGrid}>
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <View key={key} style={styles.measureCell}>
              <Text style={styles.measureLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={measurements[key]}
                onChangeText={(value) =>
                  setMeasurements((prev) => ({ ...prev, [key]: value }))
                }
                placeholder="—"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>

        <Field label="Notes">
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How you're feeling, PRs, sleep, etc."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Log Progress</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.historyHeading}>Recent entries</Text>
        {loading && history.length === 0 ? (
          <ActivityIndicator color="#667eea" style={styles.historyLoader} />
        ) : history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="stats-chart-outline" size={40} color="#ccc" />
            <Text style={styles.emptyHistoryText}>No entries yet</Text>
          </View>
        ) : (
          history.map((entry, index) => (
            <View key={`${entry.date}-${index}`} style={styles.historyCard}>
              <Text style={styles.historyDate}>
                {format(new Date(entry.date), 'MMM d, yyyy · h:mm a')}
              </Text>
              {entry.weight != null ? (
                <Text style={styles.historyLine}>Weight: {entry.weight} lbs</Text>
              ) : null}
              {entry.bodyMeasurements ? (
                <Text style={styles.historyLine}>
                  {formatMeasurements(entry.bodyMeasurements)}
                </Text>
              ) : null}
              {entry.notes ? <Text style={styles.historyNotes}>{entry.notes}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  measureCell: {
    width: '48%',
    marginBottom: 10,
  },
  measureLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  notesInput: {
    minHeight: 88,
    paddingTop: 10,
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
    marginBottom: 24,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  historyHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  historyLoader: { marginVertical: 20 },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyHistoryText: {
    marginTop: 8,
    color: '#9ca3af',
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 6,
  },
  historyLine: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  historyNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 18,
  },
});
