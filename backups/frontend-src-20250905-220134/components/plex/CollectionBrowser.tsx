'use client';

import { useState } from 'react';

import { useCollections } from '@/hooks/usePlexCollections';
import { CollectionFilters, PlexCollectionSummary } from '@/types/plex';

import { CollectionFilters as CollectionFiltersComponent } from './CollectionFilters';
import { CollectionGrid } from './CollectionGrid';

interface CollectionBrowserProps {
  libraryKey: string;
  onCollectionSelect: (collection: PlexCollectionSummary) => void;
}

export function CollectionBrowser({ libraryKey, onCollectionSelect }: CollectionBrowserProps) {
  const [filters, setFilters] = useState<CollectionFilters>({
    sort: 'addedAt',
  });

  const { data: collections = [], isLoading, error } = useCollections(libraryKey, filters);

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-red-600 mb-2">Error loading collections</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Failed to load collections. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <CollectionFiltersComponent filters={filters} onChange={setFilters} />

      {/* Results count */}
      {!isLoading && collections.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {collections.length} collection{collections.length !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Collections Grid */}
      <CollectionGrid
        collections={collections}
        isLoading={isLoading}
        onCollectionClick={onCollectionSelect}
      />
    </div>
  );
}
