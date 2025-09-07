'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchCollections, fetchCollectionDetail } from '@/lib/api/plex';
import { CollectionFilters } from '@/types/plex';

export function useCollections(libraryKey: string, filters: CollectionFilters) {
  return useQuery({
    queryKey: ['plex', 'collections', libraryKey, filters],
    queryFn: () => fetchCollections(libraryKey, filters),
    enabled: !!libraryKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => {
      let filteredData = data;

      // Client-side search filtering
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(
          (collection) =>
            collection.title.toLowerCase().includes(searchLower) ||
            collection.summary?.toLowerCase().includes(searchLower),
        );
      }

      // Client-side minimum items filtering
      if (filters.minItems && filters.minItems > 0) {
        filteredData = filteredData.filter(
          (collection) => collection.childCount >= filters.minItems!,
        );
      }

      // Client-side sorting
      if (filters.sort) {
        filteredData = [...filteredData].sort((a, b) => {
          switch (filters.sort) {
            case 'title':
              return a.title.localeCompare(b.title);
            case 'addedAt':
              return b.addedAt.getTime() - a.addedAt.getTime();
            case 'childCount':
              return b.childCount - a.childCount;
            default:
              return 0;
          }
        });
      }

      return filteredData;
    },
  });
}

export function useCollectionDetail(collectionKey: string) {
  return useQuery({
    queryKey: ['plex', 'collection-detail', collectionKey],
    queryFn: () => fetchCollectionDetail(collectionKey),
    enabled: !!collectionKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
