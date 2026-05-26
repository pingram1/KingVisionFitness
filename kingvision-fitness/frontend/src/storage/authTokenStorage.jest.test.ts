import * as SecureStore from 'expo-secure-store';
import { authTokenStorage, InsecureStorageError } from './authTokenStorage';

describe('authTokenStorage', () => {
  beforeEach(async () => {
    await authTokenStorage.clearTokens();
    jest.clearAllMocks();
  });

  it('stores access and refresh tokens via SecureStore on iOS/Android', async () => {
    await authTokenStorage.setTokens('access-token', 'refresh-token');
    await expect(authTokenStorage.getAccessToken()).resolves.toBe('access-token');
    await expect(authTokenStorage.getRefreshToken()).resolves.toBe('refresh-token');
  });

  it('clearTokens removes credentials', async () => {
    await authTokenStorage.setTokens('a', 'b');
    await authTokenStorage.clearTokens();
    await expect(authTokenStorage.getAccessToken()).resolves.toBeNull();
    await expect(authTokenStorage.getRefreshToken()).resolves.toBeNull();
  });

  describe('when SecureStore is unavailable (e.g. web)', () => {
    beforeEach(() => {
      // setTokens / readSecret each call isAvailableAsync more than once (via
      // the migration helper + the write/read itself). mockResolvedValue keeps
      // the response stable for the entire test.
      (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    });

    afterEach(() => {
      (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    });

    it('refuses to write tokens', async () => {
      await expect(authTokenStorage.setTokens('a', 'b')).rejects.toBeInstanceOf(InsecureStorageError);
    });

    it('returns null from read (no AsyncStorage leak)', async () => {
      await expect(authTokenStorage.getAccessToken()).resolves.toBeNull();
      await expect(authTokenStorage.getRefreshToken()).resolves.toBeNull();
    });
  });
});
