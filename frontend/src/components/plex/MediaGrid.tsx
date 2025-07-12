'use client';

import React, { useEffect, useRef } from 'react';

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

export function MediaGrid({ libraryKey, filters, searchQuery }: MediaGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use search or regular library items based on searchQuery
  const libraryQuery = usePlexLibraryItems(libraryKey, filters);
  const searchQueryResult = useLibrarySearch(libraryKey, searchQuery || '');

  const isSearching = !!searchQuery && searchQuery.length >= 2;

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

  // Get items from appropriate source
  const items = isSearching
    ? searchQueryResult.data || []
    : (libraryQuery.data?.pages as PlexLibraryResponse[])?.flatMap((page) => page.items) || [];

  const isLoading = isSearching ? searchQueryResult.isLoading : libraryQuery.isLoading;
  const isFetchingMore = libraryQuery.isFetchingNextPage;

  if (!items.length && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">
          {isSearching ? 'No results found' : 'No media found'}
        </p>
        <p className="text-gray-500 text-sm mt-2">
          {isSearching
            ? 'Try adjusting your search terms'
            : 'Try adjusting your filters or check back later'}
        </p>
      </div>
    );
  }

  const handleItemClick = (item: PlexMediaItem) => {
    // TODO: Implement media detail modal
    console.log('Media clicked:', item);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaCard key={item.key} media={item} onClick={() => handleItemClick(item)} />
        ))}

        {isLoading &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={`skeleton-${i}`} />)}
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
}
