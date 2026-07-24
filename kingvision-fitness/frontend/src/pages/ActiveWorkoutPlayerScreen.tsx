import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { completeWorkout, fetchWorkoutById } from '../api/workoutSession';
import WorkoutCompletionModal, {
  type WorkoutCompletionStats,
} from '../components/WorkoutCompletionModal';
import { useAuth } from '../context/AuthContext';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import type { Workout, WorkoutExercise } from '../types/workout';
import {
  buildExerciseTemplateLookup,
  buildInitialLogState,
  computeWorkoutMetrics,
  exerciseRequiresWeight,
  extractErrorMessage,
  formatElapsed,
  formatExerciseTargetLabel,
  getWorkoutVersionTimestamp,
  hasWorkoutDrift,
  isDurationExercise,
  resolveExerciseTemplate,
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
const BRAND = '#667eea';

// ── ElapsedTimer ─────────────────────────────────────────────────────────────
const ElapsedTimer = React.memo(function ElapsedTimer({
  startTimeRef,
  isPaused,
  totalPausedMsRef,
  pauseStartedAtRef,
}: {
  startTimeRef: React.MutableRefObject<Date>;
  isPaused: boolean;
  totalPausedMsRef: React.MutableRefObject<number>;
  pauseStartedAtRef: React.MutableRefObject<number | null>;
}) {
  const computeElapsed = useCallback(() => {
    let pausedMs = totalPausedMsRef.current;
    if (isPaused && pauseStartedAtRef.current != null) {
      pausedMs += Date.now() - pauseStartedAtRef.current;
    }
    return Math.max(
      0,
      Math.floor((Date.now() - startTimeRef.current.getTime() - pausedMs) / 1000)
    );
  }, [isPaused, pauseStartedAtRef, startTimeRef, totalPausedMsRef]);

  const [elapsedSeconds, setElapsedSeconds] = useState(computeElapsed);

  useEffect(() => {
    setElapsedSeconds(computeElapsed());
    if (isPaused) return;
    const id = setInterval(() => setElapsedSeconds(computeElapsed()), 1000);
    return () => clearInterval(id);
  }, [computeElapsed, isPaused]);

  return (
    <Text style={styles.timerText} accessibilityLabel={`Elapsed time ${formatElapsed(elapsedSeconds)}`}>
      {formatElapsed(elapsedSeconds)}
    </Text>
  );
});

// ── SetRow ───────────────────────────────────────────────────────────────────
interface SetRowProps {
  setLog: SetLogState;
  exerciseIndex: number;
  requiresWeight: boolean;
  isDuration: boolean;
  onChange: (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<Pick<SetLogState, 'weight' | 'reps' | 'completed'>>
  ) => void;
}

const SetRow = React.memo(function SetRow({
  setLog,
  exerciseIndex,
  requiresWeight,
  isDuration,
  onChange,
}: SetRowProps) {
  const [weightFocused, setWeightFocused] = useState(false);
  const [valueFocused, setValueFocused] = useState(false);

  const handleChangeWeight = useCallback(
    (value: string) => onChange(exerciseIndex, setLog.setIndex, { weight: value }),
    [onChange, exerciseIndex, setLog.setIndex]
  );
  const handleChangeValue = useCallback(
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
      {requiresWeight ? (
        <View style={[styles.setInputGroup, weightFocused && styles.setInputGroupFocused]}>
          <Text style={styles.setInputLabel}>lbs</Text>
          <TextInput
            style={styles.setInput}
            value={setLog.weight}
            onChangeText={handleChangeWeight}
            onFocus={() => setWeightFocused(true)}
            onBlur={() => setWeightFocused(false)}
            placeholder="0"
            placeholderTextColor="#bbb"
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
          />
        </View>
      ) : null}
      <View
        style={[
          styles.setInputGroup,
          !requiresWeight && styles.setInputGroupWide,
          valueFocused && styles.setInputGroupFocused,
        ]}
      >
        <Text style={styles.setInputLabel}>{isDuration ? 'sec' : 'reps'}</Text>
        <TextInput
          style={styles.setInput}
          value={setLog.reps}
          onChangeText={handleChangeValue}
          onFocus={() => setValueFocused(true)}
          onBlur={() => setValueFocused(false)}
          placeholder="0"
          placeholderTextColor="#bbb"
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
        />
      </View>
      <TouchableOpacity
        style={styles.doneButton}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: setLog.completed }}
        accessibilityLabel={`Mark set ${setLog.setIndex} complete`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={setLog.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={32}
          color={setLog.completed ? '#4CAF50' : '#ccc'}
        />
      </TouchableOpacity>
    </View>
  );
});

// ── ExerciseCard ─────────────────────────────────────────────────────────────
const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  exerciseIndex,
  template,
  onChange,
  cardWidth,
}: {
  exercise: ExerciseLogState;
  exerciseIndex: number;
  template?: WorkoutExercise;
  onChange: SetRowProps['onChange'];
  cardWidth: number;
}) {
  const requiresWeight = template ? exerciseRequiresWeight(template) : false;
  const isDuration = template ? isDurationExercise(template) : false;
  const targetLabel = template ? formatExerciseTargetLabel(template) : null;

  return (
    <View style={[styles.exerciseSlide, { width: cardWidth }]}>
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {!template ? (
            <Text style={styles.exerciseRemovedHint}>
              No longer in the current plan — your logged sets are preserved
            </Text>
          ) : null}
          {targetLabel ? <Text style={styles.exerciseTarget}>{targetLabel}</Text> : null}
          {template?.equipment === 'bodyweight' ? (
            <Text style={styles.exerciseEquipment}>Bodyweight</Text>
          ) : null}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.setsScrollContent}
        >
          {exercise.sets.map((setLog) => (
            <SetRow
              key={setLog.setIndex}
              setLog={setLog}
              exerciseIndex={exerciseIndex}
              requiresWeight={requiresWeight}
              isDuration={isDuration}
              onChange={onChange}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
});

// ── ActiveWorkoutPlayerScreen ────────────────────────────────────────────────
export default function ActiveWorkoutPlayerScreen() {
  const route = useRoute<ActiveWorkoutRoute>();
  const navigation = useNavigation<ActiveWorkoutNav>();
  const { refreshProfile } = useAuth();
  const { workoutId } = route.params;
  const { width: windowWidth } = useWindowDimensions();
  const carouselWidth = windowWidth;

  const startTimeRef = useRef<Date>(new Date());
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratedRef = useRef(false);
  const allowExitRef = useRef(false);
  const sessionFinishedRef = useRef(false);
  const workoutUpdatedAtRef = useRef<string | undefined>(undefined);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredFromCrash, setRestoredFromCrash] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [completionStats, setCompletionStats] = useState<WorkoutCompletionStats | null>(null);

  // ── Load workout + persisted session ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const finishHydration = (
      logs: ExerciseLogState[],
      options: {
        restored: boolean;
        versionTimestamp?: string;
        persisted?: PersistedSession | null;
      }
    ) => {
      if (options.versionTimestamp) {
        workoutUpdatedAtRef.current = options.versionTimestamp;
      }
      if (options.persisted) {
        totalPausedMsRef.current = options.persisted.totalPausedMs ?? 0;
        pauseStartedAtRef.current = options.persisted.pauseStartedAt ?? null;
        setIsPaused(Boolean(options.persisted.isPaused));
      }
      setExerciseLogs(logs);
      setRestoredFromCrash(options.restored);
      isHydratedRef.current = true;
      setLoading(false);
    };

    (async () => {
      try {
        setLoading(true);
        setError(null);
        isHydratedRef.current = false;
        const [data, persisted] = await Promise.all([
          fetchWorkoutById(workoutId),
          loadPersistedSession(workoutId),
        ]);
        if (cancelled) return;

        setWorkout(data);
        const exercises = (data.exercises ?? []) as WorkoutExercise[];
        const currentVersion = getWorkoutVersionTimestamp(data);

        if (persisted && hasWorkoutDrift(persisted.workoutUpdatedAt, currentVersion)) {
          Alert.alert(
            'Workout Updated',
            'Your coach has updated this workout plan. Would you like to restart with the new version, or continue your saved progress?',
            [
              {
                text: 'Restart',
                style: 'destructive',
                onPress: () => {
                  if (cancelled) return;
                  void (async () => {
                    await clearPersistedSession(workoutId);
                    startTimeRef.current = new Date();
                    finishHydration(buildInitialLogState(exercises), {
                      restored: false,
                      versionTimestamp: currentVersion,
                    });
                  })();
                },
              },
              {
                text: 'Continue',
                onPress: () => {
                  if (cancelled) return;
                  startTimeRef.current = new Date(persisted.startTimeIso);
                  finishHydration(persisted.exerciseLogs, {
                    restored: true,
                    versionTimestamp: persisted.workoutUpdatedAt ?? currentVersion,
                    persisted,
                  });
                },
              },
            ],
            { cancelable: false }
          );
          return;
        }

        if (persisted) {
          startTimeRef.current = new Date(persisted.startTimeIso);
          finishHydration(persisted.exerciseLogs, {
            restored: true,
            versionTimestamp: persisted.workoutUpdatedAt ?? currentVersion,
            persisted,
          });
          return;
        }

        startTimeRef.current = new Date();
        finishHydration(buildInitialLogState(exercises), {
          restored: false,
          versionTimestamp: currentVersion,
        });
      } catch (err) {
        console.error('Failed to load workout', err);
        if (!cancelled) setError('Could not load this workout.');
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  // ── Debounced session persistence ──────────────────────────────────────────
  useEffect(() => {
    if (!isHydratedRef.current || sessionFinishedRef.current) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      if (sessionFinishedRef.current) return;
      const snapshot: PersistedSession = {
        startTimeIso: startTimeRef.current.toISOString(),
        exerciseLogs,
        savedAt: Date.now(),
        workoutUpdatedAt: workoutUpdatedAtRef.current,
        totalPausedMs: totalPausedMsRef.current,
        isPaused,
        pauseStartedAt: pauseStartedAtRef.current,
      };
      persistSession(workoutId, snapshot);
    }, SESSION_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [exerciseLogs, isPaused, workoutId]);

  // ── Block back navigation unless explicitly allowed ────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || completionVisible) return;

      event.preventDefault();
      Alert.alert(
        'Quit workout?',
        'Are you sure you want to quit? Your current workout progress will be saved as a draft for 24 hours.',
        [
          { text: 'Keep Training', style: 'cancel' },
          {
            text: 'Quit',
            style: 'destructive',
            onPress: () => {
              allowExitRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, completionVisible]);

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

  const metrics = useMemo(() => computeWorkoutMetrics(exerciseLogs), [exerciseLogs]);

  const exerciseProgressRatio = useMemo(() => {
    if (metrics.totalExerciseCount === 0) return 0;
    return metrics.completedExerciseCount / metrics.totalExerciseCount;
  }, [metrics.completedExerciseCount, metrics.totalExerciseCount]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (!prev) {
        pauseStartedAtRef.current = Date.now();
        return true;
      }
      if (pauseStartedAtRef.current != null) {
        totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }
      return false;
    });
  }, []);

  const handleGoHome = useCallback(() => {
    allowExitRef.current = true;
    setCompletionVisible(false);
    setCompletionStats(null);

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'WorkoutsList' }],
      })
    );

    navigation.getParent()?.navigate('Home', { screen: 'HomeMain' });
  }, [navigation]);

  const handleFinish = useCallback(async () => {
    if (metrics.completedSetCount === 0) {
      Alert.alert(
        'No sets completed',
        'Mark at least one set as done before finishing your workout.'
      );
      return;
    }

    const snapshotMetrics = computeWorkoutMetrics(exerciseLogs);

    try {
      setSubmitting(true);
      sessionFinishedRef.current = true;
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }

      setCompletionVisible(true);
      setCompletionStats(null);

      const endTime = new Date();
      let pausedDurationMs = totalPausedMsRef.current;
      if (isPaused && pauseStartedAtRef.current != null) {
        pausedDurationMs += Date.now() - pauseStartedAtRef.current;
      }

      const payload = {
        startTime: startTimeRef.current.toISOString(),
        endTime: endTime.toISOString(),
        pausedDurationMs,
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

      const result = await completeWorkout(workoutId, payload);
      await clearPersistedSession(workoutId);
      await refreshProfile();

      setCompletionStats({
        durationMinutes: result.durationMinutes,
        totalVolume: snapshotMetrics.totalVolume,
        completedSets: snapshotMetrics.completedSetCount,
        workoutTitle: workout?.title,
      });
    } catch (err: unknown) {
      sessionFinishedRef.current = false;
      setCompletionVisible(false);
      setCompletionStats(null);
      const message = extractErrorMessage(err);
      Alert.alert('Save failed', message ?? 'Could not log your workout. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [exerciseLogs, metrics.completedSetCount, refreshProfile, workout?.title, workoutId]);

  const templateLookup = useMemo(
    () => buildExerciseTemplateLookup((workout?.exercises ?? []) as WorkoutExercise[]),
    [workout?.exercises]
  );

  const renderExercise = useCallback(
    ({ item, index }: { item: ExerciseLogState; index: number }) => {
      const template = resolveExerciseTemplate(item, templateLookup);
      return (
        <ExerciseCard
          exercise={item}
          exerciseIndex={index}
          template={template}
          onChange={updateSet}
          cardWidth={carouselWidth}
        />
      );
    },
    [carouselWidth, templateLookup, updateSet]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={styles.loadingText}>Loading workout…</Text>
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{error ?? 'Workout not found.'}</Text>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => {
            allowExitRef.current = true;
            navigation.goBack();
          }}
        >
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
      {/* ── Top: timer + exercise progress ── */}
      <View style={styles.topSection}>
        <Text style={styles.workoutTitle} numberOfLines={2}>
          {workout.title}
        </Text>
        <View style={styles.timerRow}>
          <View style={styles.timerLeft}>
            <Ionicons name="time-outline" size={22} color={BRAND} />
            <ElapsedTimer
              startTimeRef={startTimeRef}
              isPaused={isPaused}
              totalPausedMsRef={totalPausedMsRef}
              pauseStartedAtRef={pauseStartedAtRef}
            />
          </View>
          {isPaused ? (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedBadgeText}>PAUSED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressMetaRow}>
          <Text style={styles.progressMeta}>
            Exercise {Math.min(activeExerciseIndex + 1, metrics.totalExerciseCount)} of{' '}
            {metrics.totalExerciseCount}
          </Text>
          <Text style={styles.progressMeta}>
            {metrics.completedSetCount}/{metrics.totalSetCount} sets
          </Text>
        </View>
        <View style={styles.progressBarTrack} accessibilityRole="progressbar">
          <View
            style={[styles.progressBarFill, { width: `${Math.round(exerciseProgressRatio * 100)}%` }]}
          />
        </View>
      </View>

      {restoredFromCrash ? (
        <View style={styles.restoreBanner}>
          <Ionicons name="information-circle" size={16} color={BRAND} />
          <Text style={styles.restoreBannerText}>
            Restored your session from where you left off.
          </Text>
        </View>
      ) : null}

      {/* ── Body: swipeable exercise carousel ── */}
      <FlatList
        data={exerciseLogs}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        renderItem={renderExercise}
        horizontal
        pagingEnabled
        snapToInterval={carouselWidth}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
        getItemLayout={(_, index) => ({
          length: carouselWidth,
          offset: carouselWidth * index,
          index,
        })}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
          setActiveExerciseIndex(index);
        }}
      />

      {/* ── Bottom: pause + finish ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={togglePause}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}
        >
          <Ionicons
            name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
            size={22}
            color={BRAND}
          />
          <Text style={styles.pauseButtonText}>
            {isPaused ? 'Resume Workout' : 'Pause Workout'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, submitting && styles.finishButtonDisabled]}
          onPress={handleFinish}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={22} color="#fff" />
              <Text style={styles.finishButtonText}>
                {metrics.completedSetCount === 0 ? 'Finish Workout' : 'Finish & Log Workout'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <WorkoutCompletionModal
        visible={completionVisible}
        stats={completionStats}
        onGoHome={handleGoHome}
      />
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
    color: BRAND,
    fontWeight: '600',
  },
  topSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#222',
    fontVariant: ['tabular-nums'],
  },
  pausedBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pausedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e65100',
    letterSpacing: 0.6,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
  },
  progressMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e8e8ee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: BRAND,
    borderRadius: 4,
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
  carousel: {
    flex: 1,
  },
  carouselContent: {
    paddingVertical: 12,
  },
  exerciseSlide: {
    paddingHorizontal: 16,
  },
  exerciseCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
  },
  exerciseRemovedHint: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 6,
    lineHeight: 16,
    fontWeight: '600',
  },
  exerciseTarget: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    fontWeight: '600',
  },
  exerciseEquipment: {
    fontSize: 11,
    color: '#667eea',
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  setsScrollContent: {
    paddingBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  setRowCompleted: {
    backgroundColor: '#f1f8f4',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  setIndex: {
    width: 48,
    fontSize: 14,
    fontWeight: '800',
    color: '#666',
  },
  setInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 52,
  },
  setInputGroupFocused: {
    borderColor: BRAND,
    backgroundColor: '#fff',
  },
  setInputGroupWide: {
    flex: 2,
  },
  setInputLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  setInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'right',
    minWidth: 0,
  },
  doneButton: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BRAND,
    backgroundColor: '#fff',
  },
  pauseButtonText: {
    color: BRAND,
    fontSize: 15,
    fontWeight: '800',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: 18,
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
