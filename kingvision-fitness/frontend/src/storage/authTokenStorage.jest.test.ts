import { authTokenStorage } from './authTokenStorage';

describe('authTokenStorage', () => {
  beforeEach(async () => {
    await authTokenStorage.clearTokens();
    jest.clearAllMocks();
  });

  it('stores access and refresh tokens when SecureStore unavailable (fallback path)', async () => {
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
});
