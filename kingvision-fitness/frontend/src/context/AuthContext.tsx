import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { authTokenStorage } from '../storage/authTokenStorage';

interface User {
  _id: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  subscription: {
    tier: string;
    status: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
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
        } catch (error) {
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
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (data: any) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user: userData, token, refreshToken } = response.data.data;
      
      await authTokenStorage.setTokens(token, refreshToken);
      
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
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

  const refreshUser = async () => {
    try {
      const response = await api.get('/users/profile');
      setUser(response.data.data);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
