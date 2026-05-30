import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import api from '../../services/api';
import ExerciseBuilder from '../../components/Admin/ExerciseBuilder';
import { fetchWorkoutForAdmin, updateWorkoutAdmin } from '../../api/workoutAdmin';
import type { AdminContentStackParamList } from '../../navigation/AdminContentNavigator';
import type {
  DistributionType,
  ExerciseDraft,
  WorkoutDifficulty,
  WorkoutType,
} from '../../types/workout';
import type { ActiveClientSummary } from '../../types/user';
import { MUSCLE_GROUP_OPTIONS, MUSCLE_GROUP_PRESETS } from '../../constants/muscleGroups';
import {
  buildAdminWorkoutPayload,
  EMPTY_ADMIN_WORKOUT_FORM,
  getAssignedClientId,
  validateAdminWorkoutForm,
  workoutExercisesToDrafts,
  workoutToFormState,
  type AdminWorkoutFormState,
} from '../../utils/adminWorkoutFormUtils';

type Route = RouteProp<AdminContentStackParamList, 'AdminWorkoutForm'>;
type Nav = NativeStackNavigationProp<AdminContentStackParamList, 'AdminWorkoutForm'>;

const DIFFICULTY_OPTIONS: WorkoutDifficulty[] = ['beginner', 'intermediate', 'advanced'];
const WORKOUT_TYPE_OPTIONS: WorkoutType[] = [
  'mixed',
  'strength',
  'cardio',
  'hiit',
  'functional',
  'flexibility',
];

const DAY_OPTIONS = [
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
];

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: unknown[] } } })
      .response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'object' && first !== null && 'msg' in first) {
        return String((first as { msg: string }).msg);
      }
    }
  }
  return fallback;
}

export default function AdminWorkoutForm() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { workoutId } = route.params;

  const [form, setForm] = useState<AdminWorkoutFormState>(EMPTY_ADMIN_WORKOUT_FORM);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeClients, setActiveClients] = useState<ActiveClientSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const patchForm = (patch: Partial<AdminWorkoutFormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.distributionType === 'weekly_public') {
        setSelectedClientId(null);
      }
      return next;
    });
  };

  const loadActiveClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      const response = await api.get<{ success: boolean; data: ActiveClientSummary[] }>(
        '/users/active-clients'
      );
      setActiveClients(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load active clients:', error);
      setActiveClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadWorkout = useCallback(async () => {
    try {
      setLoading(true);
      const workout = await fetchWorkoutForAdmin(workoutId);
      if (workout.tags?.includes('tutoring')) {
        Alert.alert('Not editable', 'Tutoring videos cannot be edited here.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setForm(workoutToFormState(workout));
      setExercises(workoutExercisesToDrafts(workout.exercises));
      setSelectedClientId(getAssignedClientId(workout));
    } catch (error) {
      Alert.alert('Load failed', parseApiError(error, 'Could not load workout.'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [navigation, workoutId]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    if (form.distributionType === 'custom_client') {
      loadActiveClients();
    }
  }, [form.distributionType, loadActiveClients]);

  const handleSave = async () => {
    const validationError = validateAdminWorkoutForm(form, exercises, selectedClientId);
    if (validationError) {
      Alert.alert('Check the form', validationError);
      return;
    }

    const payload = buildAdminWorkoutPayload(form, exercises, selectedClientId);

    try {
      setSaving(true);
      await updateWorkoutAdmin(workoutId, payload);
      Alert.alert('Saved', 'Workout changes are live. Past client sessions were not modified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Save failed', parseApiError(error, 'Could not save workout changes.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#d4af37" size="large" />
        <Text style={styles.loadingText}>Loading workout…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Edit Workout</Text>
        <Text style={styles.cardSubtitle}>
          Update the live template. Completed client sessions keep their original exercise data.
        </Text>

        <Field label="Title">
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(title) => patchForm({ title })}
            placeholder="Workout title"
            placeholderTextColor="#9ca3af"
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(description) => patchForm({ description })}
            placeholder="What clients should expect"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </Field>

        <Field label="Type">
          <View style={styles.chipRow}>
            {(
              [
                { value: 'weekly_public' as DistributionType, label: 'Weekly Public' },
                { value: 'custom_client' as DistributionType, label: 'Custom Client' },
              ] as const
            ).map((option) => {
              const active = form.distributionType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => patchForm({ distributionType: option.value })}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        {form.distributionType === 'weekly_public' && (
          <View style={styles.row}>
            <View style={styles.rowField}>
              <Field label="Week number">
                <TextInput
                  style={styles.input}
                  value={form.weekNumber}
                  onChangeText={(weekNumber) => patchForm({ weekNumber })}
                  keyboardType="number-pad"
                  placeholder="1–52"
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
            <View style={styles.rowField}>
              <Field label="Day of week">
                <View style={styles.chipRow}>
                  {DAY_OPTIONS.map((day) => {
                    const active = form.dayOfWeek === day.value;
                    return (
                      <TouchableOpacity
                        key={day.value}
                        style={[styles.chipSmall, active && styles.chipActive]}
                        onPress={() => patchForm({ dayOfWeek: day.value })}
                      >
                        <Text style={[styles.chipTextSmall, active && styles.chipTextActive]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
            </View>
          </View>
        )}

        {form.distributionType === 'custom_client' && (
          <Field label="Assign To Client *">
            {loadingClients ? (
              <ActivityIndicator color="#d4af37" style={styles.clientLoader} />
            ) : activeClients.length === 0 ? (
              <Text style={styles.clientEmpty}>No Active Client tier users found.</Text>
            ) : (
              <View style={styles.clientList}>
                {activeClients.map((client) => {
                  const active = selectedClientId === client._id;
                  const label = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
                  return (
                    <TouchableOpacity
                      key={client._id}
                      style={[styles.clientOption, active && styles.clientOptionActive]}
                      onPress={() => setSelectedClientId(client._id)}
                    >
                      <View style={styles.clientOptionBody}>
                        <Text
                          style={[styles.clientOptionName, active && styles.clientOptionNameActive]}
                        >
                          {label || client.email}
                        </Text>
                        <Text style={styles.clientOptionEmail}>{client.email}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color="#d4af37" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color="#9ca3af" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Field>
        )}

        <Field label="Video URL (optional)">
          <TextInput
            style={styles.input}
            value={form.videoUrl}
            onChangeText={(videoUrl) => patchForm({ videoUrl })}
            placeholder="https://..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Duration (min)">
              <TextInput
                style={styles.input}
                value={form.duration}
                onChangeText={(duration) => patchForm({ duration })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Difficulty">
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map((level) => {
                  const active = form.difficulty === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.chipSmall, active && styles.chipActive]}
                      onPress={() => patchForm({ difficulty: level })}
                    >
                      <Text style={[styles.chipTextSmall, active && styles.chipTextActive]}>
                        {level.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
          </View>
        </View>

        <Field label="Workout style">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {WORKOUT_TYPE_OPTIONS.map((type) => {
                const active = form.workoutType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => patchForm({ workoutType: type })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Field>

        <Field label="Muscle focus">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {MUSCLE_GROUP_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.chip}
                  onPress={() => patchForm({ muscleFocus: preset.groups.join(', ') })}
                >
                  <Text style={styles.chipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={[styles.input, styles.inputSpacingTop]}
            value={form.muscleFocus}
            onChangeText={(muscleFocus) => patchForm({ muscleFocus })}
            placeholder="full_body or chest, shoulders"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          <Text style={styles.fieldHint}>
            Valid: {MUSCLE_GROUP_OPTIONS.slice(0, 6).join(', ')}…
          </Text>
        </Field>

        <ExerciseBuilder exercises={exercises} onChange={setExercises} />

        <Text style={styles.metaHeader}>ML Meta-Tags</Text>
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Intensity (1–10)">
              <TextInput
                style={styles.input}
                value={form.intensity}
                onChangeText={(intensity) => patchForm({ intensity })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Volume load (0–1)">
              <TextInput
                style={styles.input}
                value={form.volumeLoadIndex}
                onChangeText={(volumeLoadIndex) => patchForm({ volumeLoadIndex })}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Cardio stress (1–10)">
              <TextInput
                style={styles.input}
                value={form.cardiovascularStress}
                onChangeText={(cardiovascularStress) => patchForm({ cardiovascularStress })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Recovery demand (1–10)">
              <TextInput
                style={styles.input}
                value={form.recoveryDemand}
                onChangeText={(recoveryDemand) => patchForm({ recoveryDemand })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#1f2937" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  inputSpacingTop: {
    marginTop: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#d4af37',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  chipTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#92400e',
  },
  metaHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  clientLoader: {
    paddingVertical: 12,
  },
  clientEmpty: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  clientList: {
    gap: 8,
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  clientOptionActive: {
    borderColor: '#d4af37',
    backgroundColor: '#fffbeb',
  },
  clientOptionBody: {
    flex: 1,
    marginRight: 8,
  },
  clientOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clientOptionNameActive: {
    color: '#92400e',
  },
  clientOptionEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
