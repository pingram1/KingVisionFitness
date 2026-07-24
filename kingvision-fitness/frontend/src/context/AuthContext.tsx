import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { authTokenStorage } from '../storage/authTokenStorage';
import { clearPushToken } from '../api/pushToken';
import type { UserProfile } from '../types/user';

type User = UserProfile;

/** Human-readable message from axios errors (validation array, message, or network). */
function messageFromApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { status?: number; data?: any } }).response;
    const data = res?.data;
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'object' && first !== null && 'msg' in first) {
        return String((first as { msg: string }).msg);
      }
      return JSON.stringify(data.errors);
    }
    if (typeof data?.message === 'string' && data.message) {
      return data.message;
    }
    if (res?.status === 400 || res?.status === 422) {
      return 'Request was rejected. Check the Expo console for [api] response details.';
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: string }).message;
    if (m && !m.startsWith('Request failed with status code')) {
      return m;
    }
  }
  if (error && typeof error === 'object' && 'request' in error && !('response' in (error as object))) {
    return 'Cannot reach API. Set EXPO_PUBLIC_API_URL to your Mac LAN IP (same Wi‑Fi), e.g. http://192.168.1.x:5001/api — see Metro log [api] baseURL.';
  }
  return fallback;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-fetches `/users/profile` and replaces `user` in context. Call after
   * any backend mutation that changes role / subscriptionTier / profile fields
   * (e.g. billing dev-upgrade, Stripe checkout success) so every screen
   * deriving from `user.*` re-renders with the new values.
   */
  refreshProfile: () => Promise<User | null>;
  /** @deprecated kept for back-compat; use `refreshProfile` instead. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await authTokenStorage.migrateLegacyTokensFromAsyncStorage();
      const token = await authTokenStorage.getAccessToken();
      if (token) {
        // Verify token and get user data
        try {
          const response = await api.get('/users/profile');
          setUser(response.data.data);
        } catch {
          // Token is invalid, remove it
          await authTokenStorage.clearTokens();
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: userData, token, refreshToken } = response.data.data;
      
      await authTokenStorage.setTokens(token, refreshToken);
      
      setUser(userData);
    } catch (error: unknown) {
      throw new Error(messageFromApiError(error, 'Login failed'));
    }
  };

  const register = async (data: any) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user: userData, token, refreshToken } = response.data.data;
      
      await authTokenStorage.setTokens(token, refreshToken);
      
      setUser(userData);
    } catch (error: unknown) {
      throw new Error(messageFromApiError(error, 'Registration failed'));
    }
  };

  const logout = async () => {
    try {
      try {
        await clearPushToken();
      } catch (error) {
        console.warn('Could not clear push token on logout:', error);
      }

      // Call logout endpoint to invalidate refresh token
      const refreshToken = await authTokenStorage.getRefreshToken();
      if (refreshToken) {
        try {
          await api.post('/auth/logout', { refreshToken });
        } catch (error) {
          // Continue with logout even if API call fails
          console.error('Error calling logout endpoint:', error);
        }
      }
      
      // Clear storage
      await authTokenStorage.clearTokens();
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear local state even if storage clear fails
      setUser(null);
    }
  };

  const refreshProfile = async (): Promise<User | null> => {
    try {
      const response = await api.get('/users/profile');
      const fresh: User = response.data.data;
      setUser(fresh);
      return fresh;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return null;
    }
  };

  const refreshUser = async () => {
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshProfile, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export {
  getTier,
  isActiveClient,
  isSpecifiedOrAbove,
  hasCustomWorkouts,
  hasCustomNutrition,
  subscriptionLabel,
} from '../utils/subscriptionAccess';
