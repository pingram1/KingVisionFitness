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
}

export const SESSION_STORAGE_PREFIX = '@kvf:active-workout:';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const sessionStorageKey = (workoutId: string) => `${SESSION_STORAGE_PREFIX}${workoutId}`;

export function parseTargetReps(reps: string | undefined): string {
  if (!reps) return '10';
  const match = reps.match(/\d+/);
  return match ? match[0] : '10';
}

export function buildInitialLogState(exercises: WorkoutExercise[]): ExerciseLogState[] {
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
