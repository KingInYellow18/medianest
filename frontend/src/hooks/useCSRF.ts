import { useState, useEffect, useCallback } from 'react';

import { csrfClient, type CSRFToken } from '@/lib/api/csrf';
import { logger } from '@/lib/utils';

interface UseCSRFReturn {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

/**
 * Hook for managing CSRF tokens
 */
export function useCSRF(): UseCSRFReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get CSRF token from cookie
  const getTokenFromCookie = useCallback((): string | null => {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf-token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }, []);

  // Get fresh token from API
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await csrfClient.getToken();
      const newToken = response.token;

      setToken(newToken);
      return newToken;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch CSRF token');
      setError(error);
      logger.error('Failed to fetch CSRF token', { error });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh token
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await csrfClient.refreshToken();
      const newToken = response.token;

      setToken(newToken);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh CSRF token');
      setError(error);
      logger.error('Failed to refresh CSRF token', { error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get token (from cookie or fetch new)
  const getToken = useCallback(async (): Promise<string | null> => {
    // First try to get from cookie
    const cookieToken = getTokenFromCookie();
    if (cookieToken) {
      setToken(cookieToken);
      return cookieToken;
    }

    // If no cookie token, fetch from API
    return fetchToken();
  }, [getTokenFromCookie, fetchToken]);

  // Initialize token on mount
  useEffect(() => {
    const initToken = async () => {
      const cookieToken = getTokenFromCookie();
      if (cookieToken) {
        setToken(cookieToken);
      } else {
        await fetchToken();
      }
    };

    initToken();
  }, [getTokenFromCookie, fetchToken]);

  // Auto-refresh token before expiry (45 minutes)
  useEffect(() => {
    if (!token) return;

    const refreshInterval = setInterval(() => {
      refreshToken();
    }, 45 * 60 * 1000); // 45 minutes

    return () => clearInterval(refreshInterval);
  }, [token, refreshToken]);

  return {
    token,
    isLoading,
    error,
    refreshToken,
    getToken,
  };
}
