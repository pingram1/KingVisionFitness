import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';

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
 * Prefer Keychain / Keystore when Expo SecureStore is available (iOS/Android).
 * Falls back to AsyncStorage on Web and other environments — document as weaker posture for web-only trials.
 */
export async function isSecureHardwareAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function writeSecret(key: string, value: string): Promise<void> {
  await ensureMigratedFromAsyncStorage();
  const secureOk = await isSecureHardwareAvailable();
  if (secureOk) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await AsyncStorage.removeItem(key);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function readSecret(key: string): Promise<string | null> {
  await ensureMigratedFromAsyncStorage();
  const secureOk = await isSecureHardwareAvailable();
  if (secureOk) {
    return (await SecureStore.getItemAsync(key)) ?? null;
  }
  return AsyncStorage.getItem(key);
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
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    await secureDeleteSafe(TOKEN_KEY);
    await secureDeleteSafe(REFRESH_KEY);
  },

  migrateLegacyTokensFromAsyncStorage: ensureMigratedFromAsyncStorage,
};
