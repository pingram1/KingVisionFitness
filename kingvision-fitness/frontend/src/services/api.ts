import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { authTokenStorage } from '../storage/authTokenStorage';

// Prefer EXPO_PUBLIC_API_URL (.env / shell) over app.config so device dev can swap host without editing app.config.js.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (__DEV__) {
  // Visible in Metro (`npx expo start`) — confirms device can target the right machine:port
  // eslint-disable-next-line no-console -- intentional dev diagnostic
  console.log('[api] baseURL =', API_URL);
}

api.interceptors.request.use(async (config) => {
  try {
    const token = await authTokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error getting token from storage:', error);
  }
  return config;
});

// ── Silent refresh on 401 ──────────────────────────────────────────────────────
// Access tokens now expire in 15 minutes. When a request fails with 401 we try
// the long-lived refresh token once. Concurrent 401s share a single in-flight
// refresh promise so we never queue parallel /auth/refresh calls.

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let inflightRefresh: Promise<string | null> | null = null;

async function requestNewAccessToken(): Promise<string | null> {
  const refreshToken = await authTokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Bare axios so this call does NOT loop back through our 401 interceptor.
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const newToken: string | undefined = res.data?.data?.token;
    if (!newToken) return null;
    await authTokenStorage.setTokens(newToken, refreshToken);
    return newToken;
  } catch {
    return null;
  }
}

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = requestNewAccessToken().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

function isAuthEndpoint(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/logout')
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (__DEV__ && error.response) {
      const { status, statusText, data } = error.response;
      // eslint-disable-next-line no-console -- intentional dev diagnostic
      console.warn('[api]', error.config?.method?.toUpperCase(), error.config?.url, '→', status, statusText, data);
    }
    if (__DEV__ && error.request && !error.response) {
      // eslint-disable-next-line no-console -- intentional dev diagnostic
      console.warn(
        '[api] No response from server (wrong host/port, firewall, or device not on LAN). baseURL was',
        api.defaults.baseURL
      );
    }

    const originalRequest = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;

      const newAccessToken = await refreshAccessTokenOnce();

      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
        return api.request(originalRequest as AxiosRequestConfig);
      }

      // Refresh failed — clear tokens and surface the 401 to the caller so
      // navigation guards / AuthContext can route back to the login screen.
      try {
        await authTokenStorage.clearTokens();
      } catch (storageError) {
        console.error('Error removing token from storage:', storageError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
