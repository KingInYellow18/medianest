import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as mediaApi from '@/lib/api/media';

import { useMediaSearch } from '../useMediaSearch';

// Mock the API module
vi.mock('@/lib/api/media');

// Mock the debounce hook
vi.mock('../useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

describe('useMediaSearch', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should initialize with empty results and no loading state', () => {
    const { result } = renderHook(() => useMediaSearch(), { wrapper });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should update query when setQuery is called', () => {
    const { result } = renderHook(() => useMediaSearch(), { wrapper });

    act(() => {
      result.current.setQuery('Inception');
    });

    expect(result.current.query).toBe('Inception');
  });

  it('should call searchMedia API when query is provided', async () => {
    const mockResults = {
      results: [
        {
          id: 1,
          tmdbId: 27205,
          title: 'Inception',
          mediaType: 'movie',
          overview: 'A thief who steals corporate secrets...',
          voteAverage: 8.3,
          availability: { status: 'available' },
        },
      ],
      totalResults: 1,
      page: 1,
      totalPages: 1,
    };

    vi.mocked(mediaApi.searchMedia).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useMediaSearch('Inception'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual(mockResults.results);
    });

    expect(mediaApi.searchMedia).toHaveBeenCalledWith({
      query: 'Inception',
    });
  });

  it('should not search with empty query', async () => {
    const { result } = renderHook(() => useMediaSearch(''), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mediaApi.searchMedia).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Network error';
    vi.mocked(mediaApi.searchMedia).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useMediaSearch('Test'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(new Error(errorMessage));
    });

    expect(result.current.results).toEqual([]);
  });

  it('should update results when query changes', async () => {
    const firstResults = {
      results: [{ id: 1, title: 'Movie 1' }],
      totalResults: 1,
      page: 1,
      totalPages: 1,
    };

    const secondResults = {
      results: [{ id: 2, title: 'Movie 2' }],
      totalResults: 1,
      page: 1,
      totalPages: 1,
    };

    vi.mocked(mediaApi.searchMedia)
      .mockResolvedValueOnce(firstResults as any)
      .mockResolvedValueOnce(secondResults as any);

    const { result, rerender } = renderHook(({ query }) => useMediaSearch(query), {
      wrapper,
      initialProps: { query: 'First' },
    });

    await waitFor(() => {
      expect(result.current.results).toEqual(firstResults.results);
    });

    // Change query
    rerender({ query: 'Second' });

    await waitFor(() => {
      expect(result.current.results).toEqual(secondResults.results);
    });

    expect(mediaApi.searchMedia).toHaveBeenCalledTimes(2);
  });
});
