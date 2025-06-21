import React, { createContext, useState, useContext, useMemo, useEffect, ReactNode } from 'react';
import authService from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { username: string } | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<{ success: boolean; message?: string }>;
  register: (username: string, password: string, email?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user_data');

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('refresh_token');
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await authService.login(username, password);
      if (response.success) {
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        const userData = { username };
        localStorage.setItem('user_data', JSON.stringify(userData));
        setToken(access_token);
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, message: 'Login successful' };
      }
      return { success: false, error: response.error };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred during login' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
    return { success: true, message: 'Logged out successfully' };
  };

  const register = async (username: string, password: string, email = '') => {
    if (!token) {
      return { success: false, error: 'You must be logged in to register new users' };
    }
    setLoading(true);
    try {
      const response = await authService.register(username, password, email, token);
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An unexpected error occurred during registration' };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({ isAuthenticated, user, token, login, logout, register, loading }),
    [isAuthenticated, user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
