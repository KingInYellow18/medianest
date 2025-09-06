'use client';

import { PlexMediaItem } from '@/types/plex';

import { MediaCard } from './MediaCard';

interface MediaListProps {
  items: PlexMediaItem[];
  isLoading?: boolean;
}

export function MediaList({ items, isLoading = false }: MediaListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">No items in this collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          onClick={() => {
            /* Handle media click */
          }}
        />
      ))}
    </div>
  );
}
