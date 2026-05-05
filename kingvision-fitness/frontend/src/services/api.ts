import axios from 'axios';
import Constants from 'expo-constants';
import { authTokenStorage } from '../storage/authTokenStorage';

// Get API URL from environment or use default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 
               process.env.EXPO_PUBLIC_API_URL || 
               'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
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
