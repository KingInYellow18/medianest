# ✅ COMPLETED TASK

**Original Task**: 07-plex-library-browser.md
**Completion Date**: January 2025
**Phase**: phase3

---

# Plex Library Browser Implementation ✅ COMPLETE

## Overview

Create a comprehensive Plex library browser that allows users to explore available content, view collections, and access media details. The browser should provide a Netflix-like experience with smooth navigation and rich media information.

## Prerequisites

- Plex API integration complete (Phase 2)
- User authentication with Plex token
- React Query configured
- Image optimization setup

## Acceptance Criteria

1. Display all Plex libraries (Movies, TV Shows, etc.)
2. Browse library content with pagination/infinite scroll
3. View media details including metadata
4. Search within libraries
5. Filter by genre, year, rating
6. Collection browsing support
7. Recently added section
8. Continue watching integration (if available)

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/plex.ts
export interface PlexLibrary {
  id: string;
  key: string;
  title: string;
  type: 'movie' | 'show' | 'music' | 'photo';
  agent: string;
  scanner: string;
  language: string;
  updatedAt: Date;
  itemCount: number;
  thumb?: string;
  art?: string;
}

export interface PlexMediaItem {
  id: string;
  key: string;
  title: string;
  originalTitle?: string;
  type: 'movie' | 'episode' | 'season' | 'show';
  summary?: string;
  year?: number;
  rating?: number;
  duration?: number;
  thumb?: string;
  art?: string;
  addedAt: Date;
  updatedAt: Date;
  viewCount?: number;
  lastViewedAt?: Date;
  // Movie specific
  tagline?: string;
  contentRating?: string;
  // TV specific
  seasonCount?: number;
  episodeCount?: number;
  // Metadata
  genres?: string[];
  directors?: string[];
  actors?: string[];
  studio?: string;
}

export interface PlexCollection {
  id: string;
  key: string;
  title: string;
  summary?: string;
  thumb?: string;
  art?: string;
  childCount: number;
  items?: PlexMediaItem[];
}
```

### Component Structure

```typescript
// frontend/src/components/plex/PlexBrowser.tsx
interface PlexBrowserProps {
  initialLibrary?: string;
}

// frontend/src/components/plex/LibrarySelector.tsx
interface LibrarySelectorProps {
  libraries: PlexLibrary[];
  selectedLibrary?: string;
  onLibraryChange: (libraryKey: string) => void;
}

// frontend/src/components/plex/MediaGrid.tsx
interface MediaGridProps {
  items: PlexMediaItem[];
  isLoading: boolean;
  onItemClick: (item: PlexMediaItem) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// frontend/src/components/plex/MediaFilters.tsx
interface MediaFiltersProps {
  filters: PlexFilters;
  onChange: (filters: PlexFilters) => void;
  library: PlexLibrary;
}

interface PlexFilters {
  sort?: 'title' | 'year' | 'rating' | 'addedAt' | 'lastViewedAt';
  genre?: string;
  year?: number;
  contentRating?: string;
  resolution?: string;
}
```

## Implementation Steps

1. **Create Plex Types**

   ```bash
   frontend/src/types/plex.ts
   ```

2. **Build Library Browser Page**

   ```bash
   frontend/src/app/(auth)/plex/page.tsx
   ```

3. **Implement Library Selector**

   ```bash
   frontend/src/components/plex/LibrarySelector.tsx
   ```

4. **Create Media Grid Component**

   ```bash
   frontend/src/components/plex/MediaGrid.tsx
   ```

5. **Build Media Card Component**

   ```bash
   frontend/src/components/plex/MediaCard.tsx
   ```

6. **Add Filter Controls**

   ```bash
   frontend/src/components/plex/MediaFilters.tsx
   ```

7. **Implement Search Within Library**
   ```bash
   frontend/src/components/plex/LibrarySearch.tsx
   ```

## Component Implementation

### Main Browser Component

```typescript
// frontend/src/app/(auth)/plex/page.tsx
'use client';

import { useState } from 'react';
import { PlexBrowser } from '@/components/plex/PlexBrowser';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PlexPage() {
  const [selectedLibrary, setSelectedLibrary] = useState<string>();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Plex Library"
        description="Browse your media collection"
      />

      <PlexBrowser
        initialLibrary={selectedLibrary}
        onLibraryChange={setSelectedLibrary}
      />
    </div>
  );
}
```

### Library Selector

```typescript
// frontend/src/components/plex/LibrarySelector.tsx
import { Film, Tv, Music, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

const libraryIcons = {
  movie: Film,
  show: Tv,
  music: Music,
  photo: ImageIcon
};

export function LibrarySelector({ libraries, selectedLibrary, onLibraryChange }: LibrarySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {libraries.map((library) => {
        const Icon = libraryIcons[library.type] || Film;
        const isSelected = selectedLibrary === library.key;

        return (
          <button
            key={library.key}
            onClick={() => onLibraryChange(library.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all',
              isSelected
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{library.title}</span>
            <span className="text-sm opacity-75">({library.itemCount})</span>
          </button>
        );
      })}
    </div>
  );
}
```

### Media Grid with Infinite Scroll

```typescript
// frontend/src/components/plex/MediaGrid.tsx
import { useEffect, useRef, useCallback } from 'react';
import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function MediaGrid({
  items,
  isLoading,
  onItemClick,
  onLoadMore,
  hasMore
}: MediaGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { isIntersecting } = useIntersectionObserver(loadMoreRef, {
    threshold: 0.1,
    rootMargin: '100px'
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isLoading, onLoadMore]);

  if (!items.length && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No media found</p>
        <p className="text-gray-500 text-sm mt-2">
          Try adjusting your filters or search terms
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaCard
            key={item.key}
            media={item}
            onClick={() => onItemClick(item)}
          />
        ))}

        {isLoading && (
          Array.from({ length: 12 }).map((_, i) => (
            <MediaCardSkeleton key={`skeleton-${i}`} />
          ))
        )}
      </div>

      {hasMore && (
        <div ref={loadMoreRef} className="py-4 text-center">
          {isLoading && (
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
```

### Media Card Component

```typescript
// frontend/src/components/plex/MediaCard.tsx
import { useState } from 'react';
import Image from 'next/image';
import { Play, Star, Eye } from 'lucide-react';
import { getPlexImageUrl } from '@/lib/plex/utils';
import clsx from 'clsx';

export function MediaCard({ media, onClick }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = media.thumb && !imageError
    ? getPlexImageUrl(media.thumb)
    : '/images/poster-placeholder.png';

  const progress = media.viewOffset && media.duration
    ? (media.viewOffset / media.duration) * 100
    : 0;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
        <Image
          src={imageUrl}
          alt={media.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageError(true)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Watch Progress */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
            <div
              className="h-full bg-orange-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {media.viewCount > 0 && (
            <div className="bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3 text-white" />
              <span className="text-xs text-white">{media.viewCount}</span>
            </div>
          )}

          {media.rating && (
            <div className="bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-white">{media.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-2 text-sm font-medium text-white line-clamp-2">
        {media.title}
      </h3>

      {/* Metadata */}
      <div className="mt-1 text-xs text-gray-400">
        {media.year && <span>{media.year}</span>}
        {media.contentRating && (
          <>
            <span className="mx-1">•</span>
            <span>{media.contentRating}</span>
          </>
        )}
        {media.duration && (
          <>
            <span className="mx-1">•</span>
            <span>{Math.round(media.duration / 60000)}m</span>
          </>
        )}
      </div>
    </div>
  );
}
```

### Library Filters

```typescript
// frontend/src/components/plex/MediaFilters.tsx
import { ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { useLibraryMetadata } from '@/hooks/usePlexLibrary';

export function MediaFilters({ filters, onChange, library }: MediaFiltersProps) {
  const { genres, years, contentRatings } = useLibraryMetadata(library.key);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sort By */}
        <Select
          value={filters.sort || 'addedAt'}
          onChange={(value) => onChange({ ...filters, sort: value as any })}
          options={[
            { value: 'title', label: 'Title' },
            { value: 'year', label: 'Year' },
            { value: 'rating', label: 'Rating' },
            { value: 'addedAt', label: 'Recently Added' },
            { value: 'lastViewedAt', label: 'Recently Watched' }
          ]}
          placeholder="Sort by"
        />

        {/* Genre Filter */}
        <Select
          value={filters.genre || ''}
          onChange={(value) => onChange({ ...filters, genre: value || undefined })}
          options={[
            { value: '', label: 'All Genres' },
            ...genres.map(g => ({ value: g, label: g }))
          ]}
          placeholder="Genre"
        />

        {/* Year Filter */}
        <Select
          value={filters.year?.toString() || ''}
          onChange={(value) => onChange({ ...filters, year: value ? parseInt(value) : undefined })}
          options={[
            { value: '', label: 'All Years' },
            ...years.map(y => ({ value: y.toString(), label: y.toString() }))
          ]}
          placeholder="Year"
        />

        {/* Content Rating */}
        <Select
          value={filters.contentRating || ''}
          onChange={(value) => onChange({ ...filters, contentRating: value || undefined })}
          options={[
            { value: '', label: 'All Ratings' },
            ...contentRatings.map(r => ({ value: r, label: r }))
          ]}
          placeholder="Rating"
        />
      </div>
    </div>
  );
}
```

### Library Hooks

```typescript
// frontend/src/hooks/usePlexLibrary.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchLibraries, fetchLibraryItems } from '@/lib/api/plex';

export function usePlexLibraries() {
  return useQuery({
    queryKey: ['plex', 'libraries'],
    queryFn: fetchLibraries,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePlexLibraryItems(libraryKey: string, filters: PlexFilters) {
  return useInfiniteQuery({
    queryKey: ['plex', 'library', libraryKey, filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchLibraryItems(libraryKey, {
        ...filters,
        offset: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return totalLoaded < lastPage.totalSize ? totalLoaded : undefined;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useLibrarySearch(libraryKey: string, query: string) {
  return useQuery({
    queryKey: ['plex', 'search', libraryKey, query],
    queryFn: () => searchLibrary(libraryKey, query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

### Recently Added Section

```typescript
// frontend/src/components/plex/RecentlyAdded.tsx
export function RecentlyAdded({ libraryKey }: { libraryKey: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['plex', 'recently-added', libraryKey],
    queryFn: () => fetchRecentlyAdded(libraryKey, { limit: 12 }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <RecentlyAddedSkeleton />;
  }

  if (!data?.items.length) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-white mb-4">Recently Added</h2>
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {data.items.map((item) => (
            <div key={item.key} className="flex-none w-40">
              <MediaCard media={item} onClick={() => {}} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

## API Integration

```typescript
// frontend/src/lib/api/plex.ts
const PLEX_API_BASE = process.env.NEXT_PUBLIC_PLEX_URL;

export async function fetchLibraries(): Promise<PlexLibrary[]> {
  const response = await fetch('/api/plex/libraries', {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch libraries');
  }

  return response.json();
}

export async function fetchLibraryItems(
  libraryKey: string,
  params: {
    sort?: string;
    filters?: Record<string, any>;
    offset?: number;
    limit?: number;
  },
): Promise<{ items: PlexMediaItem[]; totalSize: number }> {
  const searchParams = new URLSearchParams({
    ...params.filters,
    sort: params.sort || 'addedAt:desc',
    'X-Plex-Container-Start': params.offset?.toString() || '0',
    'X-Plex-Container-Size': params.limit?.toString() || '50',
  });

  const response = await fetch(`/api/plex/library/${libraryKey}/items?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch library items');
  }

  return response.json();
}
```

## Testing Requirements

1. **Library Loading**:

   - All libraries display correctly
   - Library counts accurate
   - Library switching works

2. **Content Browsing**:

   - Grid displays media correctly
   - Infinite scroll loads more content
   - No duplicate items

3. **Filtering**:

   - All filter combinations work
   - Results update immediately
   - Filter state persists during navigation

4. **Performance**:
   - Images lazy load properly
   - Smooth scrolling maintained
   - Memory usage stays reasonable

## Performance Optimizations

1. **Image Loading**:

   - Use Plex transcoder for thumbnails
   - Implement progressive loading
   - Cache images aggressively

2. **Data Fetching**:

   - Pagination with 50 items per page
   - Prefetch next page on scroll
   - Cache library data for 5 minutes

3. **Rendering**:
   - Virtualize long lists if needed
   - Memoize filter options
   - Use React.memo for cards

## Related Tasks

- Media Detail Modal
- Collection Browser
- Continue Watching Section
- Plex Player Integration
