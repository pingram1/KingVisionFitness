import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExerciseDraft, ExerciseEquipment, ExerciseTargetType } from '../../types/workout';

const TARGET_TYPE_OPTIONS: ExerciseTargetType[] = ['reps', 'duration'];

const EQUIPMENT_OPTIONS: ExerciseEquipment[] = [
  'barbell',
  'dumbbell',
  'bodyweight',
  'machine',
  'cable',
  'kettlebell',
  'none',
];

export function createEmptyExercise(): ExerciseDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    sets: '3',
    targetType: 'reps',
    targetValue: '8-12',
    equipment: 'barbell',
    restTime: '60s',
    videoUrl: '',
  };
}

export function createDefaultExerciseList(): ExerciseDraft[] {
  return [createEmptyExercise()];
}

interface ExerciseBuilderProps {
  exercises: ExerciseDraft[];
  onChange: (exercises: ExerciseDraft[]) => void;
}

/**
 * Dynamic multi-exercise editor for admin workout publishing.
 * Controlled component — parent owns state and reads `exercises` on submit.
 */
export default function ExerciseBuilder({ exercises, onChange }: ExerciseBuilderProps) {
  const updateExercise = (id: string, patch: Partial<ExerciseDraft>) => {
    onChange(
      exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, ...patch } : exercise
      )
    );
  };

  const addExercise = () => {
    onChange([...exercises, createEmptyExercise()]);
  };

  const removeExercise = (id: string) => {
    if (exercises.length <= 1) return;
    onChange(exercises.filter((exercise) => exercise.id !== id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        <TouchableOpacity style={styles.addButton} onPress={addExercise}>
          <Ionicons name="add-circle-outline" size={18} color="#92400e" />
          <Text style={styles.addButtonText}>Add Exercise</Text>
        </TouchableOpacity>
      </View>

      {exercises.map((exercise, index) => (
        <View key={exercise.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Exercise {index + 1}</Text>
            <TouchableOpacity
              onPress={() => removeExercise(exercise.id)}
              disabled={exercises.length <= 1}
              accessibilityRole="button"
              accessibilityLabel={`Remove exercise ${index + 1}`}
              style={exercises.length <= 1 ? styles.removeDisabled : undefined}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={exercises.length <= 1 ? '#d1d5db' : '#ef4444'}
              />
            </TouchableOpacity>
          </View>

          <Field label="Name">
            <TextInput
              style={styles.input}
              value={exercise.name}
              onChangeText={(name) => updateExercise(exercise.id, { name })}
              placeholder="Barbell Squat"
              placeholderTextColor="#9ca3af"
            />
          </Field>

          <Field label="Tracking">
            <View style={styles.chipRow}>
              {TARGET_TYPE_OPTIONS.map((type) => {
                const active = exercise.targetType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      updateExercise(exercise.id, {
                        targetType: type,
                        targetValue: type === 'duration' ? '60' : '8-12',
                      })
                    }
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {type === 'duration' ? 'Time hold' : 'Reps'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label="Equipment">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {EQUIPMENT_OPTIONS.map((equipment) => {
                  const active = exercise.equipment === equipment;
                  return (
                    <TouchableOpacity
                      key={equipment}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => updateExercise(exercise.id, { equipment })}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {equipment.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Field>

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Field label="Sets">
                <TextInput
                  style={styles.input}
                  value={exercise.sets}
                  onChangeText={(sets) => updateExercise(exercise.id, { sets })}
                  keyboardType="number-pad"
                  placeholder="3"
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
            <View style={styles.rowField}>
              <Field label={exercise.targetType === 'duration' ? 'Target (seconds)' : 'Reps'}>
                <TextInput
                  style={styles.input}
                  value={exercise.targetValue}
                  onChangeText={(targetValue) => updateExercise(exercise.id, { targetValue })}
                  keyboardType={exercise.targetType === 'duration' ? 'number-pad' : 'default'}
                  placeholder={exercise.targetType === 'duration' ? '60' : '8-12'}
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
          </View>

          {exercise.equipment === 'bodyweight' ? (
            <Text style={styles.hint}>
              Bodyweight — clients log reps or hold time without entering weight.
            </Text>
          ) : null}

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Field label="Rest">
                <TextInput
                  style={styles.input}
                  value={exercise.restTime}
                  onChangeText={(restTime) => updateExercise(exercise.id, { restTime })}
                  placeholder="60s"
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
            <View style={styles.rowFieldWide}>
              <Field label="Demo video (optional)">
                <TextInput
                  style={styles.input}
                  value={exercise.videoUrl}
                  onChangeText={(videoUrl) => updateExercise(exercise.id, { videoUrl })}
                  placeholder="https://..."
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </Field>
            </View>
          </View>
        </View>
      ))}
    </View>
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
  container: {
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  card: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  removeDisabled: {
    opacity: 0.5,
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#d4af37',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#92400e',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
  rowFieldWide: {
    flex: 2,
  },
});
