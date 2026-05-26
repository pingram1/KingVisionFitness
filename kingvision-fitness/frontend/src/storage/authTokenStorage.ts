import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';

// KingVision ships iOS + Android only. The previous AsyncStorage fallback for
// web (and unavailable SecureStore environments) was an XSS exposure surface
// for JWTs. We now refuse to store tokens unless Keychain / Keystore is
// actually available — callers get a hard error instead of silent insecurity.
class InsecureStorageError extends Error {
  constructor() {
    super(
      'Secure token storage is unavailable. KingVision does not ship a web build; ' +
        'tokens cannot be stored in AsyncStorage / localStorage. Run on iOS or Android.'
    );
    this.name = 'InsecureStorageError';
  }
}

let migrationPromise: Promise<void> | null = null;

async function ensureMigratedFromAsyncStorage(): Promise<void> {
  if (migrationPromise) {
    await migrationPromise;
    return;
  }
  migrationPromise = (async () => {
    const secureOk = await isSecureHardwareAvailable();
    if (!secureOk) {
      return;
    }
    const [legacyT, legacyR] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
    if (legacyT) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyT).catch(() => {});
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    if (legacyR) {
      await SecureStore.setItemAsync(REFRESH_KEY, legacyR).catch(() => {});
      await AsyncStorage.removeItem(REFRESH_KEY);
    }
  })().finally(() => {
    migrationPromise = null;
  });
  await migrationPromise;
}

async function secureDeleteSafe(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* key may not exist */
  }
}

/**
 * SecureStore-backed Keychain (iOS) / Keystore (Android) availability check.
 * Returns false on web and any environment without hardware-backed storage.
 */
export async function isSecureHardwareAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function writeSecret(key: string, value: string): Promise<void> {
  await ensureMigratedFromAsyncStorage();
  const secureOk = await isSecureHardwareAvailable();
  if (!secureOk) {
    throw new InsecureStorageError();
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  // Wipe any stragglers from the pre-migration AsyncStorage path.
  await AsyncStorage.removeItem(key).catch(() => {});
}

async function readSecret(key: string): Promise<string | null> {
  await ensureMigratedFromAsyncStorage();
  const secureOk = await isSecureHardwareAvailable();
  if (!secureOk) {
    // No throw on read — lets the app render the unauthenticated state
    // cleanly on web/unsupported targets without crashing the boot screen.
    // Defensively wipe any pre-migration tokens that might still be sitting
    // in AsyncStorage so they can't be exfiltrated later.
    AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]).catch(() => {});
    return null;
  }
  return (await SecureStore.getItemAsync(key)) ?? null;
}

export const authTokenStorage = {
  getAccessToken: () => readSecret(TOKEN_KEY),
  getRefreshToken: () => readSecret(REFRESH_KEY),

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await writeSecret(TOKEN_KEY, accessToken);
    if (refreshToken) {
      await writeSecret(REFRESH_KEY, refreshToken);
    }
  },

  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]).catch(() => {});
    await secureDeleteSafe(TOKEN_KEY);
    await secureDeleteSafe(REFRESH_KEY);
  },

  migrateLegacyTokensFromAsyncStorage: ensureMigratedFromAsyncStorage,
};

export { InsecureStorageError };
