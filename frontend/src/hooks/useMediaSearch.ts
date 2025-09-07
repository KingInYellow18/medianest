'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { searchMedia } from '@/lib/api/media';
import { SearchFilters } from '@/types/media';

export function useMediaSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({
    mediaType: 'all',
    year: undefined,
    genre: undefined,
  });

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['media', 'search', debouncedQuery, filters],
    queryFn: () =>
      searchMedia({
        query: debouncedQuery,
        ...filters,
      }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results: data?.results || [],
    totalResults: data?.totalResults || 0,
    isLoading,
    isDebouncing: query !== debouncedQuery,
    error,
    refetch,
  };
}
