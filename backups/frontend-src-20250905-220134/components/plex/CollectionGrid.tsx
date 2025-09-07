'use client';

import { PlexCollectionSummary } from '@/types/plex';

import { CollectionCard } from './CollectionCard';
import { CollectionCardSkeleton } from './CollectionCardSkeleton';

interface CollectionGridProps {
  collections: PlexCollectionSummary[];
  isLoading: boolean;
  onCollectionClick: (collection: PlexCollectionSummary) => void;
}

export function CollectionGrid({ collections, isLoading, onCollectionClick }: CollectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <CollectionCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📚</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No collections found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          This library doesn&apos;t have any collections yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onClick={() => onCollectionClick(collection)}
        />
      ))}
    </div>
  );
}
