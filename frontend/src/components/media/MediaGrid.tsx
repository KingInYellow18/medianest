'use client';

import { MediaSearchResult } from '@/types/media';
import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';

interface MediaGridProps {
  results: MediaSearchResult[];
  isLoading: boolean;
  onMediaSelect: (media: MediaSearchResult) => void;
  onRequestClick: (media: MediaSearchResult) => void;
}

export function MediaGrid({ results, isLoading, onMediaSelect, onRequestClick }: MediaGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No results found</p>
        <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {results.map((media) => (
        <MediaCard
          key={`${media.mediaType}-${media.id}`}
          media={media}
          onSelect={() => onMediaSelect(media)}
          onRequestClick={() => onRequestClick(media)}
        />
      ))}
    </div>
  );
}