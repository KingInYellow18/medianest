'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PlexLibrary, PlexCollectionSummary } from '@/types/plex';
import { LibrarySelector } from '@/components/plex/LibrarySelector';
import { CollectionBrowser } from '@/components/plex/CollectionBrowser';
import { CollectionDetail } from '@/components/plex/CollectionDetail';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';

export default function CollectionsPage() {
  const router = useRouter();
  const [selectedLibrary, setSelectedLibrary] = useState<PlexLibrary | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<PlexCollectionSummary | null>(null);

  const handleLibrarySelect = (library: PlexLibrary) => {
    setSelectedLibrary(library);
    setSelectedCollection(null);
  };

  const handleCollectionSelect = (collection: PlexCollectionSummary) => {
    setSelectedCollection(collection);
  };

  const handleBackToLibraries = () => {
    setSelectedLibrary(null);
    setSelectedCollection(null);
  };

  const handleBackToCollections = () => {
    setSelectedCollection(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/plex')}
            className="flex items-center gap-2"
          >
            <IconArrowLeft size={20} />
            Back to Plex
          </Button>
        </div>

        <PageHeader
          title="Plex Collections"
          description="Browse and explore your curated media collections"
        />
      </div>

      {!selectedLibrary ? (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Select a Library</h2>
          <LibrarySelector
            onSelect={handleLibrarySelect}
            filterTypes={['movie', 'show']} // Collections are typically for movies and shows
          />
        </div>
      ) : selectedCollection ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToCollections}
              className="flex items-center gap-2"
            >
              <IconArrowLeft size={20} />
              Back to Collections
            </Button>
            <h2 className="text-xl font-semibold">{selectedLibrary.title} Collections</h2>
          </div>

          <CollectionDetail
            collectionKey={selectedCollection.key}
            onBack={handleBackToCollections}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToLibraries}
              className="flex items-center gap-2"
            >
              <IconArrowLeft size={20} />
              Change Library
            </Button>
            <h2 className="text-xl font-semibold">{selectedLibrary.title} Collections</h2>
          </div>

          <CollectionBrowser
            libraryKey={selectedLibrary.key}
            onCollectionSelect={handleCollectionSelect}
          />
        </div>
      )}
    </div>
  );
}
