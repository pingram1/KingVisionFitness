import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { completeWorkout, fetchWorkoutById } from '../api/workoutSession';
import { useAuth } from '../context/AuthContext';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import type { Workout, WorkoutExercise } from '../types/workout';
import {
  buildInitialLogState,
  extractErrorMessage,
  formatElapsed,
  type ExerciseLogState,
  type PersistedSession,
  type SetLogState,
} from './activeWorkoutHelpers';
import {
  clearPersistedSession,
  loadPersistedSession,
  persistSession,
} from './activeWorkoutSessionStorage';

type ActiveWorkoutRoute = RouteProp<WorkoutsStackParamList, 'ActiveWorkout'>;
type ActiveWorkoutNav = NativeStackNavigationProp<WorkoutsStackParamList, 'ActiveWorkout'>;

const SESSION_PERSIST_DEBOUNCE_MS = 600;

// ── ElapsedTimer ─────────────────────────────────────────────────────────────
// The 1-Hz tick is owned exclusively by this leaf component. Previously the
// parent screen called setState every second, re-rendering every exercise and
// every set row. Now the timer holds its own state and re-renders 1 Text node.
const ElapsedTimer = React.memo(function ElapsedTimer({
  startTimeRef,
}: {
  startTimeRef: React.MutableRefObject<Date>;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTimeRef]);

  return <Text style={styles.timerText}>{formatElapsed(elapsedSeconds)}</Text>;
});

// ── SetRow ───────────────────────────────────────────────────────────────────
// React.memo + stable callbacks mean typing in one set's TextInput now
// re-renders only that row (verified via React DevTools profiler).
interface SetRowProps {
  setLog: SetLogState;
  exerciseIndex: number;
  onChange: (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<Pick<SetLogState, 'weight' | 'reps' | 'completed'>>
  ) => void;
}

const SetRow = React.memo(function SetRow({ setLog, exerciseIndex, onChange }: SetRowProps) {
  // Callbacks depend on stable identifiers — `onChange` is memoized in the
  // parent (useCallback []), so these are stable across renders too. React.memo
  // only re-runs SetRow when setLog itself is replaced.
  const handleChangeWeight = useCallback(
    (value: string) => onChange(exerciseIndex, setLog.setIndex, { weight: value }),
    [onChange, exerciseIndex, setLog.setIndex]
  );
  const handleChangeReps = useCallback(
    (value: string) => onChange(exerciseIndex, setLog.setIndex, { reps: value }),
    [onChange, exerciseIndex, setLog.setIndex]
  );
  const handleToggle = useCallback(
    () => onChange(exerciseIndex, setLog.setIndex, { completed: !setLog.completed }),
    [onChange, exerciseIndex, setLog.setIndex, setLog.completed]
  );

  return (
    <View style={[styles.setRow, setLog.completed && styles.setRowCompleted]}>
      <Text style={styles.setIndex}>Set {setLog.setIndex}</Text>
      <View style={styles.setInputGroup}>
        <Text style={styles.setInputLabel}>lbs</Text>
        <TextInput
          style={styles.setInput}
          value={setLog.weight}
          onChangeText={handleChangeWeight}
          placeholder="0"
          placeholderTextColor="#bbb"
          keyboardType="decimal-pad"
        />
      </View>
      <View style={styles.setInputGroup}>
        <Text style={styles.setInputLabel}>reps</Text>
        <TextInput
          style={styles.setInput}
          value={setLog.reps}
          onChangeText={handleChangeReps}
          placeholder="0"
          placeholderTextColor="#bbb"
          keyboardType="number-pad"
        />
      </View>
      <TouchableOpacity
        style={[styles.doneButton, setLog.completed && styles.doneButtonActive]}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: setLog.completed }}
        accessibilityLabel={`Mark set ${setLog.setIndex} complete`}
      >
        <Ionicons
          name={setLog.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={setLog.completed ? '#4CAF50' : '#ccc'}
        />
      </TouchableOpacity>
    </View>
  );
});

// ── ExerciseCard ─────────────────────────────────────────────────────────────
// Memoized so unrelated exercise edits don't re-render every card. Cards only
// re-render when their own exercise log or template changes.
const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  exerciseIndex,
  template,
  onChange,
}: {
  exercise: ExerciseLogState;
  exerciseIndex: number;
  template?: WorkoutExercise;
  onChange: SetRowProps['onChange'];
}) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {template?.reps ? (
          <Text style={styles.exerciseTarget}>Target: {template.reps} reps</Text>
        ) : null}
      </View>
      {exercise.sets.map((setLog) => (
        <SetRow
          key={setLog.setIndex}
          setLog={setLog}
          exerciseIndex={exerciseIndex}
          onChange={onChange}
        />
      ))}
    </View>
  );
});

// ── ActiveWorkoutScreen ──────────────────────────────────────────────────────
export default function ActiveWorkoutScreen() {
  const route = useRoute<ActiveWorkoutRoute>();
  const navigation = useNavigation<ActiveWorkoutNav>();
  const { refreshProfile } = useAuth();
  const { workoutId } = route.params;

  const startTimeRef = useRef<Date>(new Date());
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratedRef = useRef(false);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredFromCrash, setRestoredFromCrash] = useState(false);

  // ── Load workout + any persisted session ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, persisted] = await Promise.all([
          fetchWorkoutById(workoutId),
          loadPersistedSession(workoutId),
        ]);
        if (cancelled) return;

        setWorkout(data);
        const exercises = (data.exercises ?? []) as WorkoutExercise[];

        if (persisted) {
          startTimeRef.current = new Date(persisted.startTimeIso);
          setExerciseLogs(persisted.exerciseLogs);
          setRestoredFromCrash(true);
        } else {
          startTimeRef.current = new Date();
          setExerciseLogs(buildInitialLogState(exercises));
        }
        // Mark as hydrated AFTER the initial state is set so the persistence
        // effect below doesn't fire on the load-time setState.
        isHydratedRef.current = true;
      } catch (err) {
        console.error('Failed to load workout', err);
        if (!cancelled) setError('Could not load this workout.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  // ── Persist mid-session on every change (debounced) ──────────────────────
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      const snapshot: PersistedSession = {
        startTimeIso: startTimeRef.current.toISOString(),
        exerciseLogs,
        savedAt: Date.now(),
      };
      persistSession(workoutId, snapshot);
    }, SESSION_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [exerciseLogs, workoutId]);

  // ── Set update handler (stable identity, never changes) ───────────────────
  const updateSet = useCallback<SetRowProps['onChange']>(
    (exerciseIndex, setIndex, patch) => {
      setExerciseLogs((prev) =>
        prev.map((exercise, ei) => {
          if (ei !== exerciseIndex) return exercise;
          return {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.setIndex === setIndex ? { ...set, ...patch } : set
            ),
          };
        })
      );
    },
    []
  );

  // ── Derived metrics ────────────────────────────────────────────────────────
  const { completedSetCount, totalSetCount } = useMemo(() => {
    let completed = 0;
    let total = 0;
    for (const ex of exerciseLogs) {
      for (const s of ex.sets) {
        total += 1;
        if (s.completed) completed += 1;
      }
    }
    return { completedSetCount: completed, totalSetCount: total };
  }, [exerciseLogs]);

  // ── Finish flow ────────────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    if (completedSetCount === 0) {
      Alert.alert(
        'No sets completed',
        'Mark at least one set as done before finishing your workout.'
      );
      return;
    }

    Alert.alert('Finish workout?', 'Your session will be saved to your activity log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          try {
            setSubmitting(true);
            const endTime = new Date();
            const elapsedSeconds = Math.floor(
              (endTime.getTime() - startTimeRef.current.getTime()) / 1000
            );
            const payload = {
              startTime: startTimeRef.current.toISOString(),
              endTime: endTime.toISOString(),
              loggedExercises: exerciseLogs.map((exercise) => ({
                name: exercise.name,
                sets: exercise.sets.map((set) => ({
                  setIndex: set.setIndex,
                  weight: Number(set.weight) || 0,
                  reps: Number(set.reps) || 0,
                  completed: set.completed,
                })),
              })),
            };

            await completeWorkout(workoutId, payload);
            await clearPersistedSession(workoutId);
            await refreshProfile();

            navigation.getParent()?.navigate('Home', { screen: 'HomeMain' });
            Alert.alert(
              'Workout complete!',
              `Great work — ${Math.max(1, Math.round(elapsedSeconds / 60))} minutes logged.`
            );
          } catch (err: unknown) {
            const message = extractErrorMessage(err);
            Alert.alert('Save failed', message ?? 'Could not log your workout. Try again.');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [completedSetCount, exerciseLogs, navigation, refreshProfile, workoutId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading workout…</Text>
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{error ?? 'Workout not found.'}</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const exerciseTemplates = (workout.exercises ?? []) as WorkoutExercise[];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.timerBar}>
        <View style={styles.timerLeft}>
          <Ionicons name="time-outline" size={20} color="#667eea" />
          <ElapsedTimer startTimeRef={startTimeRef} />
        </View>
        <Text style={styles.timerMeta}>
          {completedSetCount}/{totalSetCount} sets done
        </Text>
      </View>

      {restoredFromCrash ? (
        <View style={styles.restoreBanner}>
          <Ionicons name="information-circle" size={16} color="#667eea" />
          <Text style={styles.restoreBannerText}>
            Restored your session from where you left off.
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{workout.title}</Text>
          {workout.description ? (
            <Text style={styles.heroDescription}>{workout.description}</Text>
          ) : null}
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>{workout.duration} min planned</Text>
            <Text style={styles.heroMeta}> · </Text>
            <Text style={styles.heroMeta}>{workout.difficulty}</Text>
          </View>
        </View>

        {exerciseLogs.map((exercise, exerciseIndex) => (
          <ExerciseCard
            key={`${exercise.name}-${exerciseIndex}`}
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            template={exerciseTemplates[exerciseIndex]}
            onChange={updateSet}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishButton, submitting && styles.finishButtonDisabled]}
          onPress={handleFinish}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={22} color="#fff" />
              <Text style={styles.finishButtonText}>Finish Workout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
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
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    color: '#667eea',
    fontWeight: '600',
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
    fontVariant: ['tabular-nums'],
  },
  timerMeta: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  restoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eef0fc',
  },
  restoreBannerText: {
    fontSize: 12,
    color: '#3949ab',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
  },
  heroDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    lineHeight: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  heroMeta: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  exerciseHeader: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  exerciseTarget: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  setRowCompleted: {
    backgroundColor: '#f1f8f4',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  setIndex: {
    width: 44,
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  setInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  setInputLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    color: '#222',
    textAlign: 'right',
    minWidth: 0,
  },
  doneButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonActive: {},
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 14,
    paddingVertical: 16,
  },
  finishButtonDisabled: {
    opacity: 0.7,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
