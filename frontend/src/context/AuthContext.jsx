import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import authService from '../services/authService.js';

/**
 * Authentication Context Type Definition
 * @typedef {Object} AuthContextType
 * @property {boolean} isAuthenticated - Whether the user is currently authenticated
 * @property {Object|null} user - Current user data (username, etc.)
 * @property {string|null} token - Current access token
 * @property {Function} login - Function to log in a user
 * @property {Function} logout - Function to log out the current user
 * @property {Function} register - Function to register a new user (admin only)
 * @property {boolean} loading - Whether an auth operation is in progress
 */

// Create the context with a default value (used if no Provider is found)
export const AuthContext = createContext(null);

/**
 * AuthProvider component to wrap your app or part of it
 * Manages authentication state and provides auth functions to child components
 */
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user_data');
    
    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear invalid data
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('refresh_token');
      }
    }
  }, []);

  /**
   * Login function - authenticates a user with username and password
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @returns {Promise<Object>} Response object with success status and data/error
   */
  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await authService.login(username, password);
      
      if (response.success) {
        const { access_token, refresh_token } = response.data;
        
        // Store tokens in localStorage
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        // Create user object (in a real app, you might decode the JWT or fetch user data)
        const userData = { username };
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        // Update state
        setToken(access_token);
        setUser(userData);
        setIsAuthenticated(true);
        
        return { success: true, message: 'Login successful' };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred during login' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout function - logs out the current user and clears stored data
   * @returns {Promise<Object>} Response object with success status
   */
  const logout = async () => {
    setLoading(true);
    try {
      // Call backend logout if we have a token
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local logout even if backend call fails
    } finally {
      // Clear all auth data regardless of backend response
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      
      return { success: true, message: 'Logged out successfully' };
    }
  };

  /**
   * Register function - registers a new user (admin only)
   * @param {string} username - New user's username
   * @param {string} password - New user's password
   * @param {string} email - New user's email (optional)
   * @returns {Promise<Object>} Response object with success status and message/error
   */
  const register = async (username, password, email = '') => {
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

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    isAuthenticated,
    user,
    token,
    login,
    logout,
    register,
    loading
  }), [isAuthenticated, user, token, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook for consuming the auth context
 * Provides better error handling and ensures the hook is used within an AuthProvider
 * @returns {AuthContextType} The authentication context value
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Default export for convenience
export default AuthProvider;