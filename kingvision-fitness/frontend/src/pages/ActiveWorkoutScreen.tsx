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

type ActiveWorkoutRoute = RouteProp<WorkoutsStackParamList, 'ActiveWorkout'>;
type ActiveWorkoutNav = NativeStackNavigationProp<WorkoutsStackParamList, 'ActiveWorkout'>;

interface SetLogState {
  setIndex: number;
  weight: string;
  reps: string;
  completed: boolean;
}

interface ExerciseLogState {
  name: string;
  sets: SetLogState[];
}

function parseTargetReps(reps: string | undefined): string {
  if (!reps) return '10';
  const match = reps.match(/\d+/);
  return match ? match[0] : '10';
}

function buildInitialLogState(exercises: WorkoutExercise[]): ExerciseLogState[] {
  return exercises.map((exercise) => {
    const setCount = Math.max(1, exercise.sets ?? 1);
    const targetReps = parseTargetReps(exercise.reps);
    return {
      name: exercise.name,
      sets: Array.from({ length: setCount }, (_, index) => ({
        setIndex: index + 1,
        weight: '',
        reps: targetReps,
        completed: false,
      })),
    };
  });
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface SetRowProps {
  setLog: SetLogState;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onToggleCompleted: () => void;
}

function SetRow({ setLog, onChangeWeight, onChangeReps, onToggleCompleted }: SetRowProps) {
  return (
    <View style={[styles.setRow, setLog.completed && styles.setRowCompleted]}>
      <Text style={styles.setIndex}>Set {setLog.setIndex}</Text>
      <View style={styles.setInputGroup}>
        <Text style={styles.setInputLabel}>lbs</Text>
        <TextInput
          style={styles.setInput}
          value={setLog.weight}
          onChangeText={onChangeWeight}
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
          onChangeText={onChangeReps}
          placeholder="0"
          placeholderTextColor="#bbb"
          keyboardType="number-pad"
        />
      </View>
      <TouchableOpacity
        style={[styles.doneButton, setLog.completed && styles.doneButtonActive]}
        onPress={onToggleCompleted}
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
}

export default function ActiveWorkoutScreen() {
  const route = useRoute<ActiveWorkoutRoute>();
  const navigation = useNavigation<ActiveWorkoutNav>();
  const { refreshProfile } = useAuth();
  const { workoutId } = route.params;

  const startTimeRef = useRef(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWorkoutById(workoutId);
        if (cancelled) return;
        setWorkout(data);
        const exercises = (data.exercises ?? []) as WorkoutExercise[];
        setExerciseLogs(buildInitialLogState(exercises));
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

  const completedSetCount = useMemo(
    () =>
      exerciseLogs.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
        0
      ),
    [exerciseLogs]
  );

  const totalSetCount = useMemo(
    () => exerciseLogs.reduce((sum, ex) => sum + ex.sets.length, 0),
    [exerciseLogs]
  );

  const updateSet = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      patch: Partial<Pick<SetLogState, 'weight' | 'reps' | 'completed'>>
    ) => {
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

  const handleFinish = async () => {
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
            await refreshProfile();

            navigation.getParent()?.navigate('Home', { screen: 'HomeMain' });
            Alert.alert(
              'Workout complete!',
              `Great work — ${Math.max(1, Math.round(elapsedSeconds / 60))} minutes logged.`
            );
          } catch (err: unknown) {
            let message: string | undefined;
            if (
              err &&
              typeof err === 'object' &&
              'response' in err
            ) {
              const data = (err as { response?: { data?: { message?: string } } }).response?.data;
              if (data && typeof data.message === 'string') {
                message = data.message;
              }
            }
            Alert.alert('Save failed', message ?? 'Could not log your workout. Try again.');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.timerBar}>
        <View style={styles.timerLeft}>
          <Ionicons name="time-outline" size={20} color="#667eea" />
          <Text style={styles.timerText}>{formatElapsed(elapsedSeconds)}</Text>
        </View>
        <Text style={styles.timerMeta}>
          {completedSetCount}/{totalSetCount} sets done
        </Text>
      </View>

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

        {exerciseLogs.map((exercise, exerciseIndex) => {
          const template = (workout.exercises ?? [])[exerciseIndex] as
            | WorkoutExercise
            | undefined;
          return (
            <View key={`${exercise.name}-${exerciseIndex}`} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                {template?.reps ? (
                  <Text style={styles.exerciseTarget}>Target: {template.reps} reps</Text>
                ) : null}
              </View>
              {exercise.sets.map((setLog) => (
                <SetRow
                  key={`${exerciseIndex}-${setLog.setIndex}`}
                  setLog={setLog}
                  onChangeWeight={(value) =>
                    updateSet(exerciseIndex, setLog.setIndex, { weight: value })
                  }
                  onChangeReps={(value) =>
                    updateSet(exerciseIndex, setLog.setIndex, { reps: value })
                  }
                  onToggleCompleted={() =>
                    updateSet(exerciseIndex, setLog.setIndex, {
                      completed: !setLog.completed,
                    })
                  }
                />
              ))}
            </View>
          );
        })}
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
