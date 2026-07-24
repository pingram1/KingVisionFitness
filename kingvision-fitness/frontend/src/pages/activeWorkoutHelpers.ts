import type { WorkoutExercise } from '../types/workout';

export interface SetLogState {
  setIndex: number;
  weight: string;
  reps: string;
  completed: boolean;
}

export interface ExerciseLogState {
  name: string;
  sets: SetLogState[];
}

export interface PersistedSession {
  startTimeIso: string;
  exerciseLogs: ExerciseLogState[];
  savedAt: number;
  /** Workout template `updatedAt` captured when the session first started. */
  workoutUpdatedAt?: string;
  totalPausedMs?: number;
  isPaused?: boolean;
  pauseStartedAt?: number | null;
}

export const SESSION_STORAGE_PREFIX = '@kvf:active-workout:';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const sessionStorageKey = (workoutId: string) => `${SESSION_STORAGE_PREFIX}${workoutId}`;

export function parseTargetReps(reps: string | undefined): string {
  if (!reps) return '10';
  const match = reps.match(/\d+/);
  return match ? match[0] : '10';
}

export function isDurationExercise(exercise: Pick<WorkoutExercise, 'duration'>): boolean {
  return typeof exercise.duration === 'number' && exercise.duration > 0;
}

export function exerciseRequiresWeight(exercise: Pick<WorkoutExercise, 'equipment'>): boolean {
  const equipment = exercise.equipment?.toLowerCase();
  return equipment !== 'bodyweight' && equipment !== 'none';
}

export function formatExerciseTargetLabel(exercise: WorkoutExercise): string | null {
  if (isDurationExercise(exercise)) {
    const sec = exercise.duration ?? 0;
    if (sec >= 60) {
      const mins = Math.floor(sec / 60);
      const rem = sec % 60;
      return rem > 0 ? `Target: ${mins}m ${rem}s hold` : `Target: ${mins} min hold`;
    }
    return `Target: ${sec}s hold`;
  }
  if (exercise.reps) {
    return `Target: ${exercise.reps} reps`;
  }
  return null;
}

export function normalizeExerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Stable lookup for pairing logged exercises to template rows by name. */
export function buildExerciseTemplateLookup(
  exercises: WorkoutExercise[]
): Map<string, WorkoutExercise> {
  const lookup = new Map<string, WorkoutExercise>();
  for (const exercise of exercises) {
    const key = normalizeExerciseKey(exercise.name);
    if (!lookup.has(key)) {
      lookup.set(key, exercise);
    }
  }
  return lookup;
}

export function resolveExerciseTemplate(
  log: ExerciseLogState,
  lookup: Map<string, WorkoutExercise>
): WorkoutExercise | undefined {
  return lookup.get(normalizeExerciseKey(log.name));
}

export function getWorkoutVersionTimestamp(workout: {
  updatedAt?: string;
  createdAt?: string;
}): string | undefined {
  return workout.updatedAt ?? workout.createdAt;
}

/** Returns true when an admin edit likely occurred after the draft was started. */
export function hasWorkoutDrift(
  draftUpdatedAt: string | undefined,
  currentUpdatedAt: string | undefined
): boolean {
  if (!draftUpdatedAt || !currentUpdatedAt) return false;
  const draftMs = new Date(draftUpdatedAt).getTime();
  const currentMs = new Date(currentUpdatedAt).getTime();
  if (Number.isNaN(draftMs) || Number.isNaN(currentMs)) return false;
  return draftMs !== currentMs;
}

export function buildInitialLogState(exercises: WorkoutExercise[]): ExerciseLogState[] {
  return exercises.map((exercise) => {
    const setCount = Math.max(1, exercise.sets ?? 1);
    const defaultValue = isDurationExercise(exercise)
      ? String(exercise.duration ?? 60)
      : parseTargetReps(exercise.reps);
    const defaultWeight = exerciseRequiresWeight(exercise) ? '' : '0';
    return {
      name: exercise.name,
      sets: Array.from({ length: setCount }, (_, index) => ({
        setIndex: index + 1,
        weight: defaultWeight,
        reps: defaultValue,
        completed: false,
      })),
    };
  });
}

export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function extractErrorMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return null;
}

export interface WorkoutMetrics {
  completedSetCount: number;
  totalSetCount: number;
  totalVolume: number;
  completedExerciseCount: number;
  totalExerciseCount: number;
}

/** Aggregate set/exercise completion and volume (weight × reps) for completed sets only. */
export function computeWorkoutMetrics(logs: ExerciseLogState[]): WorkoutMetrics {
  let completedSetCount = 0;
  let totalSetCount = 0;
  let totalVolume = 0;
  let completedExerciseCount = 0;

  for (const exercise of logs) {
    let allSetsDone = exercise.sets.length > 0;
    for (const set of exercise.sets) {
      totalSetCount += 1;
      if (set.completed) {
        completedSetCount += 1;
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (weight > 0) {
          totalVolume += weight * reps;
        }
      } else {
        allSetsDone = false;
      }
    }
    if (allSetsDone && exercise.sets.length > 0) {
      completedExerciseCount += 1;
    }
  }

  return {
    completedSetCount,
    totalSetCount,
    totalVolume,
    completedExerciseCount,
    totalExerciseCount: logs.length,
  };
}

export function formatVolumeLbs(volume: number): string {
  if (volume >= 10000) {
    return `${(volume / 1000).toFixed(1)}k lbs`;
  }
  return `${Math.round(volume).toLocaleString()} lbs`;
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
