'use client';

import { useCollectionDetail } from '@/hooks/usePlexCollections';
import { Button } from '@/components/ui/button';
import { MediaList } from './MediaList';

interface CollectionDetailProps {
  collectionKey: string;
  onBack: () => void;
}

export function CollectionDetail({ collectionKey, onBack }: CollectionDetailProps) {
  const { data: collection, isLoading, error } = useCollectionDetail(collectionKey);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
        </div>
        <MediaList items={[]} isLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-red-600 mb-2">Error loading collection</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Failed to load collection details. Please try again.
        </p>
        <Button onClick={onBack} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Collection not found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The collection you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button onClick={onBack} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button onClick={onBack} variant="outline" size="sm">
          ← Back
        </Button>
        
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{collection.title}</h1>
          
          {collection.summary && (
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-3xl">
              {collection.summary}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{collection.childCount} items</span>
            <span>Added {collection.addedAt.toLocaleDateString()}</span>
            {collection.updatedAt && (
              <span>Updated {collection.updatedAt.toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Collection Items */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Items in Collection</h2>
        <MediaList items={collection.items} />
      </div>
    </div>
  );
}