'use client';

import { useState, useMemo } from 'react';

import { usePlexLibraries } from '@/hooks/usePlexLibrary';
import { PlexFilters, PlexCollectionSummary } from '@/types/plex';

import { LibrarySearch } from './LibrarySearch';
import { LibrarySelector } from './LibrarySelector';
import { MediaFilters } from './MediaFilters';
import { MediaGrid } from './MediaGrid';
import { RecentlyAdded } from './RecentlyAdded';
import { CollectionBrowser } from './CollectionBrowser';
import { CollectionDetail } from './CollectionDetail';
import { Button } from '@/components/ui/button';

interface PlexBrowserProps {
  initialLibrary?: string;
  onLibraryChange?: (libraryKey: string) => void;
}

type ViewMode = 'media' | 'collections' | 'collection-detail';

export function PlexBrowser({ initialLibrary, onLibraryChange }: PlexBrowserProps) {
  const { data: libraries, isLoading: librariesLoading } = usePlexLibraries();
  const [selectedLibrary, setSelectedLibrary] = useState<string | undefined>(initialLibrary);
  const [filters, setFilters] = useState<PlexFilters>({
    sort: 'addedAt:desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('media');
  const [selectedCollection, setSelectedCollection] = useState<PlexCollectionSummary | null>(null);

  // Get the selected library object
  const currentLibrary = useMemo(() => {
    return libraries?.find((lib) => lib.key === selectedLibrary);
  }, [libraries, selectedLibrary]);

  // Handle library selection
  const handleLibraryChange = (libraryKey: string) => {
    setSelectedLibrary(libraryKey);
    setFilters({ sort: 'addedAt:desc' }); // Reset filters when changing library
    setSearchQuery(''); // Clear search
    setViewMode('media'); // Reset to media view
    setSelectedCollection(null); // Clear selected collection
    onLibraryChange?.(libraryKey);
  };

  // Handle collection selection
  const handleCollectionSelect = (collection: PlexCollectionSummary) => {
    setSelectedCollection(collection);
    setViewMode('collection-detail');
  };

  // Handle back from collection detail
  const handleBackFromCollection = () => {
    setSelectedCollection(null);
    setViewMode('collections');
  };

  // Auto-select first library if none selected
  if (libraries && libraries.length > 0 && !selectedLibrary) {
    const firstLibrary = libraries[0];
    handleLibraryChange(firstLibrary.key);
  }

  if (librariesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading libraries...</p>
        </div>
      </div>
    );
  }

  if (!libraries || libraries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No libraries found</p>
        <p className="text-gray-500 text-sm mt-2">
          Make sure your Plex server is configured correctly
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Library Selector */}
      <LibrarySelector
        libraries={libraries}
        selectedLibrary={selectedLibrary}
        onLibraryChange={handleLibraryChange}
      />

      {selectedLibrary && currentLibrary && (
        <>
          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={viewMode === 'media' ? 'default' : 'outline'}
              onClick={() => setViewMode('media')}
              size="sm"
            >
              Media
            </Button>
            <Button
              variant={viewMode === 'collections' ? 'default' : 'outline'}
              onClick={() => setViewMode('collections')}
              size="sm"
            >
              Collections
            </Button>
          </div>

          {viewMode === 'media' && (
            <>
              {/* Search */}
              <LibrarySearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={`Search ${currentLibrary.title}...`}
              />

              {/* Recently Added Section */}
              {!searchQuery && <RecentlyAdded libraryKey={selectedLibrary} />}

              {/* Filters */}
              <MediaFilters filters={filters} onChange={setFilters} library={currentLibrary} />

              {/* Media Grid */}
              <MediaGrid libraryKey={selectedLibrary} filters={filters} searchQuery={searchQuery} />
            </>
          )}

          {viewMode === 'collections' && (
            <CollectionBrowser
              libraryKey={selectedLibrary}
              onCollectionSelect={handleCollectionSelect}
            />
          )}

          {viewMode === 'collection-detail' && selectedCollection && (
            <CollectionDetail
              collectionKey={selectedCollection.key}
              onBack={handleBackFromCollection}
            />
          )}
        </>
      )}
    </div>
  );
}
