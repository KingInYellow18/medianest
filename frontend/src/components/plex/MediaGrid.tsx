'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';

import { useIsIntersecting } from '@/hooks/useIntersectionObserver';
import { usePlexLibraryItems, useLibrarySearch } from '@/hooks/usePlexLibrary';
import { PlexFilters, PlexMediaItem, PlexLibraryResponse } from '@/types/plex';

import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';

interface MediaGridProps {
  libraryKey: string;
  filters: PlexFilters;
  searchQuery?: string;
}

// CONTEXT7 PATTERN: React.memo for MediaGrid to prevent unnecessary re-renders
// Reference: React.dev performance guide - React.memo for expensive list components
export const MediaGrid = React.memo(
  function MediaGrid({ libraryKey, filters, searchQuery }: MediaGridProps) {
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Use search or regular library items based on searchQuery
    const libraryQuery = usePlexLibraryItems(libraryKey, filters);
    const searchQueryResult = useLibrarySearch(libraryKey, searchQuery || '');

    // CONTEXT7 PATTERN: useMemo for computed boolean state
    // Reference: React.dev performance guide - useMemo for derived state
    const isSearching = useMemo(() => !!searchQuery && searchQuery.length >= 2, [searchQuery]);

    const isIntersecting = useIsIntersecting(loadMoreRef, {
      threshold: 0.1,
      rootMargin: '100px',
    });

    // Load more when intersection detected (only for library items, not search)
    useEffect(() => {
      if (
        isIntersecting &&
        !isSearching &&
        libraryQuery.hasNextPage &&
        !libraryQuery.isFetchingNextPage
      ) {
        libraryQuery.fetchNextPage();
      }
    }, [isIntersecting, isSearching, libraryQuery]);

    // CONTEXT7 PATTERN: useMemo for expensive array operations
    // Reference: React.dev performance guide - useMemo for expensive computations
    const items = useMemo(() => {
      return isSearching
        ? searchQueryResult.data || []
        : (libraryQuery.data?.pages as PlexLibraryResponse[])?.flatMap((page) => page.items) || [];
    }, [isSearching, searchQueryResult.data, libraryQuery.data]);

    // CONTEXT7 PATTERN: useMemo for computed loading states
    // Reference: React.dev performance guide - useMemo for derived state
    const loadingStates = useMemo(
      () => ({
        isLoading: isSearching ? searchQueryResult.isLoading : libraryQuery.isLoading,
        isFetchingMore: libraryQuery.isFetchingNextPage,
      }),
      [
        isSearching,
        searchQueryResult.isLoading,
        libraryQuery.isLoading,
        libraryQuery.isFetchingNextPage,
      ]
    );

    const { isLoading, isFetchingMore } = loadingStates;

    // CONTEXT7 PATTERN: Early return for empty state with memoized content
    // Reference: React.dev performance guide - Early returns to prevent unnecessary renders
    if (!items.length && !isLoading) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">{emptyStateContent.title}</p>
          <p className="text-gray-500 text-sm mt-2">{emptyStateContent.subtitle}</p>
        </div>
      );
    }

    // CONTEXT7 PATTERN: useCallback for stable event handler references
    // Reference: React.dev performance guide - useCallback for event handlers
    const handleItemClick = useCallback((item: PlexMediaItem) => {
      // TODO: Implement media detail modal
      // Handle media item click (TODO: implement proper navigation)
      console.log('Media item clicked:', item.key);
    }, []);

    // CONTEXT7 PATTERN: useMemo for skeleton array to prevent recreation
    // Reference: React.dev performance guide - useMemo for array references
    const skeletonItems = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

    // CONTEXT7 PATTERN: useMemo for empty state messages
    // Reference: React.dev performance guide - useMemo for conditional content
    const emptyStateContent = useMemo(
      () => ({
        title: isSearching ? 'No results found' : 'No media found',
        subtitle: isSearching
          ? 'Try adjusting your search terms'
          : 'Try adjusting your filters or check back later',
      }),
      [isSearching]
    );

    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <MediaCard key={item.key} media={item} onClick={() => handleItemClick(item)} />
          ))}

          {isLoading && skeletonItems.map((i) => <MediaCardSkeleton key={`skeleton-${i}`} />)}
        </div>

        {!isSearching && libraryQuery.hasNextPage && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingMore && (
              <div className="inline-flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading more...</span>
              </div>
            )}
          </div>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // CONTEXT7 PATTERN: Custom comparison function for React.memo with deep comparison
    // Reference: React.dev performance guide - areEqual for complex props
    // Compare library key, filters, and search query for re-render decision
    return (
      prevProps.libraryKey === nextProps.libraryKey &&
      prevProps.searchQuery === nextProps.searchQuery &&
      JSON.stringify(prevProps.filters) === JSON.stringify(nextProps.filters)
    );
  }
);
