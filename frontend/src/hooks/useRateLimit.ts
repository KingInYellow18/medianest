'use client';

import { useState, useMemo, useCallback } from 'react';

export function useRateLimit(limit = 20, window = 3600000) {
  const [requests, setRequests] = useState<number[]>([]);
  
  const canRequest = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter(time => now - time < window);
    return recentRequests.length < limit;
  }, [requests, limit, window]);
  
  const addRequest = useCallback(() => {
    setRequests(prev => [...prev, Date.now()]);
  }, []);
  
  const remainingRequests = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter(time => now - time < window);
    return Math.max(0, limit - recentRequests.length);
  }, [requests, limit, window]);
  
  return { canRequest, addRequest, remainingRequests };
}