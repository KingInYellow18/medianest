'use client';

import { useState, useMemo, useCallback } from 'react';

export function useRateLimit(limit = 20, window = 3600000) {
  const [requests, setRequests] = useState<number[]>([]);

  const canRequest = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter((time) => now - time < window);
    return recentRequests.length < limit;
  }, [requests, limit, window]);

  const trackRequest = useCallback(() => {
    setRequests((prev) => [...prev, Date.now()]);
  }, []);

  const remainingRequests = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter((time) => now - time < window);
    return Math.max(0, limit - recentRequests.length);
  }, [requests, limit, window]);

  const resetTime = useMemo(() => {
    if (requests.length === 0) {
      return new Date(Date.now() + window);
    }
    const oldestRequest = Math.min(...requests);
    return new Date(oldestRequest + window);
  }, [requests, window]);

  // Legacy alias for backward compatibility
  const addRequest = trackRequest;

  return { canRequest, addRequest, remainingRequests, resetTime, trackRequest };
}
