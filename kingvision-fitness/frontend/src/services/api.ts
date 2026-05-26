import axios from 'axios';
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

// Add token to requests
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

// Handle token expiration + dev logging for failed requests (status + body)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
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
    if (error.response?.status === 401) {
      try {
        await authTokenStorage.clearTokens();
        // Navigation will be handled by the app's navigation system
      } catch (storageError) {
        console.error('Error removing token from storage:', storageError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
