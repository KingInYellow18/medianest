# Plex Collection Browser Implementation

## Status: COMPLETED ✅

## Overview

Implement a collection browsing interface that allows users to explore curated Plex collections, view collection details, and navigate collection contents. Collections group related media together (e.g., movie franchises, TV show universes).

## Prerequisites

- Plex library browser implemented
- Plex API integration functional
- Media card components created
- Navigation system in place

## Acceptance Criteria

1. Display all collections within a library
2. Show collection poster/art and metadata
3. View collection contents in organized layout
4. Sort collections by title, item count, or date added
5. Search within collections
6. Navigate between collection and item views
7. Display collection description and item count

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/plex-collections.ts
export interface PlexCollectionSummary {
  id: string;
  key: string;
  title: string;
  summary?: string;
  thumb?: string;
  art?: string;
  childCount: number;
  addedAt: Date;
  updatedAt: Date;
  collectionSort?: string;
  collectionMode?: string;
}

export interface PlexCollectionDetail extends PlexCollectionSummary {
  items: PlexMediaItem[];
  genre?: string[];
  year?: number;
  contentRating?: string;
  tagline?: string;
}

export interface CollectionFilters {
  sort?: 'title' | 'childCount' | 'addedAt';
  minItems?: number;
  search?: string;
}
```

### Component Structure

```typescript
// frontend/src/components/plex/CollectionBrowser.tsx
interface CollectionBrowserProps {
  libraryKey: string;
  onCollectionSelect: (collection: PlexCollectionSummary) => void;
}

// frontend/src/components/plex/CollectionGrid.tsx
interface CollectionGridProps {
  collections: PlexCollectionSummary[];
  isLoading: boolean;
  onCollectionClick: (collection: PlexCollectionSummary) => void;
}

// frontend/src/components/plex/CollectionDetail.tsx
interface CollectionDetailProps {
  collectionKey: string;
  onBack: () => void;
  onItemClick: (item: PlexMediaItem) => void;
}

// frontend/src/components/plex/CollectionCard.tsx
interface CollectionCardProps {
  collection: PlexCollectionSummary;
  onClick: () => void;
}
```

## Implementation Steps

1. **Create Collection Types**

   ```bash
   frontend/src/types/plex-collections.ts
   ```

2. **Build Collection Browser Component**

   ```bash
   frontend/src/components/plex/CollectionBrowser.tsx
   ```

3. **Implement Collection Grid**

   ```bash
   frontend/src/components/plex/CollectionGrid.tsx
   ```

4. **Create Collection Card**

   ```bash
   frontend/src/components/plex/CollectionCard.tsx
   ```

5. **Build Collection Detail View**

   ```bash
   frontend/src/components/plex/CollectionDetail.tsx
   ```

6. **Add Collection Filters**
   ```bash
   frontend/src/components/plex/CollectionFilters.tsx
   ```

## Component Implementation

### Collection Browser

```typescript
// frontend/src/components/plex/CollectionBrowser.tsx
import { useState } from 'react';
import { CollectionGrid } from './CollectionGrid';
import { CollectionFilters } from './CollectionFilters';
import { useCollections } from '@/hooks/usePlexCollections';
import { Search } from 'lucide-react';

export function CollectionBrowser({ libraryKey, onCollectionSelect }: CollectionBrowserProps) {
  const [filters, setFilters] = useState<CollectionFilters>({
    sort: 'title',
  });

  const { data: collections, isLoading } = useCollections(libraryKey, filters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Collections</h2>
        <div className="text-sm text-gray-400">{collections?.length || 0} collections</div>
      </div>

      {/* Filters */}
      <CollectionFilters filters={filters} onChange={setFilters} />

      {/* Grid */}
      <CollectionGrid
        collections={collections || []}
        isLoading={isLoading}
        onCollectionClick={onCollectionSelect}
      />
    </div>
  );
}
```

### Collection Grid

```typescript
// frontend/src/components/plex/CollectionGrid.tsx
import { CollectionCard } from './CollectionCard';
import { CollectionCardSkeleton } from './CollectionCardSkeleton';

export function CollectionGrid({ collections, isLoading, onCollectionClick }: CollectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <CollectionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-lg">No collections found</p>
        <p className="text-gray-500 text-sm mt-2">
          Collections will appear here once created in Plex
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.key}
          collection={collection}
          onClick={() => onCollectionClick(collection)}
        />
      ))}
    </div>
  );
}
```

### Collection Card

```typescript
// frontend/src/components/plex/CollectionCard.tsx
import { useState } from 'react';
import Image from 'next/image';
import { Film, Folder } from 'lucide-react';
import { getPlexImageUrl } from '@/lib/plex/utils';
import { motion } from 'framer-motion';

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  const [imageError, setImageError] = useState(false);

  const posterUrl =
    collection.thumb && !imageError
      ? getPlexImageUrl(collection.thumb, { width: 300, height: 450 })
      : null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer group"
    >
      <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={collection.title}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-700 to-gray-800">
            <Folder className="w-16 h-16 text-gray-600 mb-2" />
            <span className="text-gray-500 text-sm">Collection</span>
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {collection.summary && (
              <p className="text-sm text-gray-200 line-clamp-3 mb-2">{collection.summary}</p>
            )}
            <div className="flex items-center gap-2 text-gray-300">
              <Film className="w-4 h-4" />
              <span className="text-sm font-medium">
                {collection.childCount} {collection.childCount === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="absolute top-2 right-2">
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
            <Film className="w-3 h-3 text-white" />
            <span className="text-xs text-white font-medium">{collection.childCount}</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3 text-base font-semibold text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
        {collection.title}
      </h3>

      {/* Metadata */}
      {collection.year && <p className="text-sm text-gray-400 mt-1">{collection.year}</p>}
    </motion.div>
  );
}
```

### Collection Detail View

```typescript
// frontend/src/components/plex/CollectionDetail.tsx
import { ArrowLeft, Grid, List } from 'lucide-react';
import { useState } from 'react';
import { useCollectionDetail } from '@/hooks/usePlexCollections';
import { MediaGrid } from './MediaGrid';
import { MediaList } from './MediaList';
import { Button } from '@/components/ui/Button';

export function CollectionDetail({ collectionKey, onBack, onItemClick }: CollectionDetailProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data: collection, isLoading } = useCollectionDetail(collectionKey);

  if (isLoading) {
    return <CollectionDetailSkeleton />;
  }

  if (!collection) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Collection not found</p>
        <Button onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        {collection.art && (
          <div className="absolute inset-0 -z-10">
            <Image
              src={getPlexImageUrl(collection.art)}
              alt=""
              fill
              className="object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/90 to-gray-900" />
          </div>
        )}

        <div className="relative z-10 space-y-4 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Collections</span>
          </button>

          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{collection.title}</h1>
            {collection.tagline && (
              <p className="text-lg text-gray-300 italic mb-4">"{collection.tagline}"</p>
            )}
            {collection.summary && <p className="text-gray-400 max-w-3xl">{collection.summary}</p>}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{collection.childCount} items</span>
              {collection.contentRating && (
                <>
                  <span>•</span>
                  <span>{collection.contentRating}</span>
                </>
              )}
              {collection.genre && collection.genre.length > 0 && (
                <>
                  <span>•</span>
                  <span>{collection.genre.slice(0, 3).join(', ')}</span>
                </>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-2 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-2 rounded transition-colors',
                  viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collection Items */}
      {viewMode === 'grid' ? (
        <MediaGrid items={collection.items} isLoading={false} onItemClick={onItemClick} />
      ) : (
        <MediaList items={collection.items} onItemClick={onItemClick} />
      )}
    </div>
  );
}
```

### Collection Filters

```typescript
// frontend/src/components/plex/CollectionFilters.tsx
import { Search, SortAsc } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useState } from 'react';

export function CollectionFilters({ filters, onChange }: CollectionFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search collections..."
            className="pl-10"
          />
        </div>

        {/* Sort */}
        <Select
          value={filters.sort || 'title'}
          onChange={(value) => onChange({ ...filters, sort: value as any })}
          options={[
            { value: 'title', label: 'Title' },
            { value: 'childCount', label: 'Item Count' },
            { value: 'addedAt', label: 'Date Added' },
          ]}
          icon={<SortAsc className="w-4 h-4" />}
        />

        {/* Min Items Filter */}
        <Select
          value={filters.minItems?.toString() || '0'}
          onChange={(value) =>
            onChange({
              ...filters,
              minItems: value ? parseInt(value) : undefined,
            })
          }
          options={[
            { value: '0', label: 'All Collections' },
            { value: '5', label: '5+ Items' },
            { value: '10', label: '10+ Items' },
            { value: '20', label: '20+ Items' },
          ]}
          placeholder="Minimum items"
        />
      </div>
    </div>
  );
}
```

## Collection Hooks

```typescript
// frontend/src/hooks/usePlexCollections.ts
import { useQuery } from '@tanstack/react-query';
import { fetchCollections, fetchCollectionDetail } from '@/lib/api/plex';

export function useCollections(libraryKey: string, filters: CollectionFilters) {
  return useQuery({
    queryKey: ['plex', 'collections', libraryKey, filters],
    queryFn: () => fetchCollections(libraryKey, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => {
      let filtered = [...data];

      // Apply client-side filtering
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter((c) => c.title.toLowerCase().includes(search));
      }

      if (filters.minItems) {
        filtered = filtered.filter((c) => c.childCount >= filters.minItems!);
      }

      // Apply sorting
      filtered.sort((a, b) => {
        switch (filters.sort) {
          case 'childCount':
            return b.childCount - a.childCount;
          case 'addedAt':
            return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
          case 'title':
          default:
            return a.title.localeCompare(b.title);
        }
      });

      return filtered;
    },
  });
}

export function useCollectionDetail(collectionKey: string) {
  return useQuery({
    queryKey: ['plex', 'collection', collectionKey],
    queryFn: () => fetchCollectionDetail(collectionKey),
    staleTime: 5 * 60 * 1000,
  });
}
```

## Testing Requirements

1. **Collection Loading**:

   - All collections display with correct metadata
   - Collection counts are accurate
   - Poster images load correctly

2. **Filtering & Sorting**:

   - Search filters collections in real-time
   - Sort options work correctly
   - Minimum item filter applies properly

3. **Collection Details**:

   - Collection items load correctly
   - View mode toggle works
   - Navigation between views smooth

4. **Performance**:
   - Large collections load efficiently
   - Images lazy load properly
   - No memory leaks on navigation

## Performance Considerations

1. **Image Optimization**:

   - Use Plex transcoder for collection posters
   - Preload collection art for detail view
   - Cache collection thumbnails

2. **Data Management**:

   - Cache collection lists for 5 minutes
   - Prefetch collection details on hover
   - Limit initial item load to 50

3. **UI Responsiveness**:
   - Debounce search input
   - Virtualize long collection lists
   - Progressive loading for large collections

## Related Tasks

- Plex Library Browser
- Media Detail Modal
- Collection Management (Admin)
- Smart Collections Support
