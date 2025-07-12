'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import {
  fetchLibraries,
  fetchLibraryItems,
  searchLibrary,
  fetchRecentlyAdded,
} from '@/lib/api/plex';
import { PlexFilters } from '@/types/plex';

export function usePlexLibraries() {
  return useQuery({
    queryKey: ['plex', 'libraries'],
    queryFn: fetchLibraries,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePlexLibraryItems(libraryKey: string, filters: PlexFilters) {
  return useInfiniteQuery({
    queryKey: ['plex', 'library', libraryKey, filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchLibraryItems(libraryKey, {
        filters: {
          genre: filters.genre,
          year: filters.year,
          contentRating: filters.contentRating,
          resolution: filters.resolution,
        },
        sort: filters.sort,
        offset: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return totalLoaded < lastPage.totalSize ? totalLoaded : undefined;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!libraryKey,
  });
}

export function useLibrarySearch(libraryKey: string, query: string) {
  return useQuery({
    queryKey: ['plex', 'search', libraryKey, query],
    queryFn: () => searchLibrary(libraryKey, query),
    enabled: query.length >= 2 && !!libraryKey,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useRecentlyAdded(libraryKey?: string) {
  return useQuery({
    queryKey: ['plex', 'recently-added', libraryKey],
    queryFn: () => fetchRecentlyAdded(libraryKey, { limit: 12 }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useLibraryMetadata(libraryKey: string) {
  const { data } = usePlexLibraryItems(libraryKey, {});

  // Extract unique metadata from all loaded items
  const metadata = {
    genres: [] as string[],
    years: [] as number[],
    contentRatings: [] as string[],
  };

  if (data?.pages) {
    const allItems = data.pages.flatMap((page) => page.items);

    // Extract unique genres
    const genreSet = new Set<string>();
    allItems.forEach((item) => {
      item.genres?.forEach((genre) => genreSet.add(genre));
    });
    metadata.genres = Array.from(genreSet).sort();

    // Extract unique years
    const yearSet = new Set<number>();
    allItems.forEach((item) => {
      if (item.year) yearSet.add(item.year);
    });
    metadata.years = Array.from(yearSet).sort((a, b) => b - a);

    // Extract unique content ratings
    const ratingSet = new Set<string>();
    allItems.forEach((item) => {
      if (item.contentRating) ratingSet.add(item.contentRating);
    });
    metadata.contentRatings = Array.from(ratingSet).sort();
  }

  return metadata;
}
