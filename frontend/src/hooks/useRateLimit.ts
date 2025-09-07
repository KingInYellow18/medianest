'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mediaRequestTimestamps';

export function useRateLimit(limit = 20, windowMs = 3600000) {
  // Initialize from localStorage
  const [requests, setRequests] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored || stored === '') return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      // Filter out expired requests on initialization
      const now = Date.now();
      return parsed.filter((timestamp: number) => now - timestamp < windowMs);
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever requests change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    } catch {
      // Ignore storage errors
    }
  }, [requests]);

  // Clean up expired requests
  const cleanupExpiredRequests = useCallback(() => {
    const now = Date.now();
    setRequests((prev) => {
      const valid = prev.filter((timestamp) => now - timestamp < windowMs);
      return valid.length !== prev.length ? valid : prev;
    });
  }, [windowMs]);

  // Clean up on mount and when window changes
  useEffect(() => {
    cleanupExpiredRequests();
  }, [cleanupExpiredRequests]);

  const trackRequest = useCallback(() => {
    const now = Date.now();
    setRequests((prev) => {
      // Remove expired and add new
      const valid = prev.filter((timestamp) => now - timestamp < windowMs);
      return [...valid, now];
    });
  }, [windowMs]);

  const canRequest = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter((time) => now - time < windowMs);
    return recentRequests.length < limit;
  }, [requests, limit, windowMs]);

  const remainingRequests = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter((time) => now - time < windowMs);
    return Math.max(0, limit - recentRequests.length);
  }, [requests, limit, windowMs]);

  const resetTime = useMemo(() => {
    const now = Date.now();
    const validRequests = requests.filter((time) => now - time < windowMs);

    if (validRequests.length === 0) {
      return null;
    }

    const oldestRequest = Math.min(...validRequests);
    return new Date(oldestRequest + windowMs);
  }, [requests, windowMs]);

  // Legacy alias for backward compatibility
  const addRequest = trackRequest;

  return { canRequest, addRequest, remainingRequests, resetTime, trackRequest };
}
