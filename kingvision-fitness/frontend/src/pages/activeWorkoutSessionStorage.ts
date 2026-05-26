import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SESSION_TTL_MS,
  type PersistedSession,
  sessionStorageKey,
} from './activeWorkoutHelpers';

export async function loadPersistedSession(workoutId: string): Promise<PersistedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(sessionStorageKey(workoutId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.startTimeIso || !Array.isArray(parsed.exerciseLogs)) return null;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      AsyncStorage.removeItem(sessionStorageKey(workoutId)).catch(() => {});
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[ActiveWorkout] failed to read persisted session', err);
    return null;
  }
}

export async function clearPersistedSession(workoutId: string): Promise<void> {
  await AsyncStorage.removeItem(sessionStorageKey(workoutId)).catch(() => {});
}

export async function persistSession(workoutId: string, snapshot: PersistedSession): Promise<void> {
  await AsyncStorage.setItem(sessionStorageKey(workoutId), JSON.stringify(snapshot)).catch((err) => {
    console.warn('[ActiveWorkout] persist failed', err);
  });
}
