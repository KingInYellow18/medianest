'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { searchPlex } from '@/lib/api/plex';
import { PlexSearchQuery, SearchSuggestion } from '@/types/plex-search';

import { useDebounce } from './useDebounce';
import { useSearchHistory } from './useSearchHistory';

interface UsePlexSearchOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function usePlexSearch(query: PlexSearchQuery, options: UsePlexSearchOptions = {}) {
  const { enabled = true, staleTime = 30 * 1000 } = options;
  const debouncedQuery = useDebounce(query.query, 300);
  const { getHistory } = useSearchHistory();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['plex', 'search', debouncedQuery, query.libraries, query.mediaTypes, query.filters],
    queryFn: () =>
      searchPlex({
        ...query,
        query: debouncedQuery,
      }),
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime,
    // Keep previous data while loading new results
    placeholderData: (previousData) => previousData,
  });

  // Generate suggestions
  const suggestions = useMemo(() => {
    const results: SearchSuggestion[] = [];

    // Don't show suggestions if we're still typing or have no query
    if (debouncedQuery.length < 2 || query.query !== debouncedQuery) {
      return results;
    }

    // Add search history
    const history = getHistory();
    history.forEach((item) => {
      if (item.toLowerCase().includes(query.query.toLowerCase()) && item !== query.query) {
        results.push({
          text: item,
          type: 'history',
        });
      }
    });

    // Add filter suggestions based on current results
    if (data?.availableFilters) {
      // Genre suggestions
      data.availableFilters.genres?.slice(0, 3).forEach((genre) => {
        if (genre.toLowerCase().includes(query.query.toLowerCase())) {
          results.push({
            text: `${query.query} ${genre}`,
            type: 'filter',
            metadata: { type: 'genre', value: genre },
          });
        }
      });

      // Actor suggestions
      data.availableFilters.actors?.slice(0, 2).forEach((actor) => {
        if (actor.toLowerCase().includes(query.query.toLowerCase())) {
          results.push({
            text: actor,
            type: 'suggestion',
            metadata: { type: 'actor', value: actor },
          });
        }
      });
    }

    // Add API suggestions if available
    if (data?.suggestions) {
      data.suggestions.forEach((suggestion) => {
        results.push({
          text: suggestion,
          type: 'suggestion',
        });
      });
    }

    return results.slice(0, 8);
  }, [query.query, debouncedQuery, data, getHistory]);

  return {
    results: data,
    isLoading: isLoading || (isFetching && query.query === debouncedQuery),
    error,
    suggestions,
  };
}
