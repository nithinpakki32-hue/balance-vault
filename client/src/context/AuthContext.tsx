import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api, getAuthToken, setAuthToken, clearAuthToken } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, initialDeposit?: number) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      if (getAuthToken()) {
        const response = await api.getMe();
        if (response.success && response.user) {
          setUser(response.user);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Failed to fetch authenticated user session:', err);
      clearAuthToken();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.login({ email, password });
      if (response.success && response.token) {
        setAuthToken(response.token);
        setToken(response.token);
        setUser(response.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password: string, initialDeposit = 0) => {
    setIsLoading(true);
    try {
      const response = await api.register({ fullName, email, password, initialDeposit });
      if (response.success && response.token) {
        setAuthToken(response.token);
        setToken(response.token);
        setUser(response.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
