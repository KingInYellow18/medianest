# Media Search Interface Implementation ✅

## Overview

Create a comprehensive media search interface that allows users to search for movies and TV shows, check availability in Plex, and submit requests through Overseerr. The interface should provide a seamless experience with real-time search results and clear availability indicators.

## Prerequisites

- Overseerr API integration complete (Phase 2)
- Plex API integration complete (Phase 2)
- Authentication system functional
- React Query configured for data fetching

## Acceptance Criteria

1. Search input with debounced API calls (300ms delay)
2. Search results display within 2 seconds
3. Clear availability indicators (Available/Requested/Not Available)
4. Movie and TV show results clearly differentiated
5. Responsive grid layout for results
6. Request button disabled for available content
7. Loading states during search
8. Error handling for API failures

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/media.ts
export interface MediaSearchResult {
  id: number;
  tmdbId: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: Genre[];
  runtime?: number; // movies only
  numberOfSeasons?: number; // TV only
  status?: string; // TV only
  availability: MediaAvailability;
}

export interface MediaAvailability {
  status: 'available' | 'partial' | 'requested' | 'processing' | 'unavailable';
  plexUrl?: string;
  seasons?: SeasonAvailability[]; // TV only
  requestedBy?: string;
  requestedAt?: Date;
}

export interface SeasonAvailability {
  seasonNumber: number;
  status: 'available' | 'partial' | 'unavailable';
  episodes: EpisodeAvailability[];
}
```

### Component Structure

```typescript
// frontend/src/components/media/MediaSearch.tsx
interface MediaSearchProps {
  onRequestSubmit: (media: MediaSearchResult) => void;
}

// frontend/src/components/media/SearchInput.tsx
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

// frontend/src/components/media/MediaGrid.tsx
interface MediaGridProps {
  results: MediaSearchResult[];
  isLoading: boolean;
  onMediaSelect: (media: MediaSearchResult) => void;
  onRequestClick: (media: MediaSearchResult) => void;
}

// frontend/src/components/media/MediaCard.tsx
interface MediaCardProps {
  media: MediaSearchResult;
  onSelect: () => void;
  onRequestClick: () => void;
}
```

## Implementation Steps

1. **Create Media Types**

   ```bash
   frontend/src/types/media.ts
   ```

2. **Implement Search Hook**

   ```bash
   frontend/src/hooks/useMediaSearch.ts
   ```

3. **Build Search Input Component**

   ```bash
   frontend/src/components/media/SearchInput.tsx
   ```

4. **Create Media Grid Layout**

   ```bash
   frontend/src/components/media/MediaGrid.tsx
   ```

5. **Implement Media Card Component**

   ```bash
   frontend/src/components/media/MediaCard.tsx
   ```

6. **Add Availability Badge**

   ```bash
   frontend/src/components/media/AvailabilityBadge.tsx
   ```

7. **Create Filter Controls**
   ```bash
   frontend/src/components/media/SearchFilters.tsx
   ```

## Component Implementation

### Search Hook with Debouncing

```typescript
// frontend/src/hooks/useMediaSearch.ts
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMedia } from '@/lib/api/media';
import { useDebounce } from '@/hooks/useDebounce';

export function useMediaSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    year: undefined as number | undefined,
    genre: undefined as number | undefined,
  });

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['media', 'search', debouncedQuery, filters],
    queryFn: () =>
      searchMedia({
        query: debouncedQuery,
        ...filters,
      }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results: data?.results || [],
    totalResults: data?.totalResults || 0,
    isLoading,
    error,
  };
}
```

### Search Input Component

```typescript
// frontend/src/components/media/SearchInput.tsx
import { Search, X } from 'lucide-react';
import { useRef, useEffect } from 'react';

export function SearchInput({ value, onChange, onClear, isLoading }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on mount
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for movies or TV shows..."
        className="block w-full pl-10 pr-10 py-3 text-base border-gray-700 rounded-lg
                   bg-gray-800 text-white placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   transition-all duration-150"
      />

      {value && (
        <button onClick={onClear} className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <X className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-y-0 right-10 pr-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}
```

### Media Card with Availability

```typescript
// frontend/src/components/media/MediaCard.tsx
import { useState } from 'react';
import Image from 'next/image';
import { Calendar, Star, Clock } from 'lucide-react';
import { AvailabilityBadge } from './AvailabilityBadge';
import { RequestButton } from './RequestButton';
import { formatDate } from '@/lib/utils';

export function MediaCard({ media, onSelect, onRequestClick }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const posterUrl =
    media.posterPath && !imageError
      ? `https://image.tmdb.org/t/p/w500${media.posterPath}`
      : '/images/poster-placeholder.png';

  return (
    <div
      className="group relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative">
        <Image
          src={posterUrl}
          alt={media.title}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm text-gray-200 line-clamp-3">{media.overview}</p>
          </div>
        </div>

        {/* Availability Badge */}
        <div className="absolute top-2 right-2">
          <AvailabilityBadge status={media.availability.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-1 mb-2">{media.title}</h3>

        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
          {media.releaseDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(media.releaseDate).getFullYear()}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />
            <span>{media.voteAverage.toFixed(1)}</span>
          </div>

          {media.runtime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{media.runtime}m</span>
            </div>
          )}
        </div>

        {/* Request Button */}
        <RequestButton
          media={media}
          onClick={(e) => {
            e.stopPropagation();
            onRequestClick();
          }}
        />
      </div>
    </div>
  );
}
```

### Media Grid Layout

```typescript
// frontend/src/components/media/MediaGrid.tsx
import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';

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
```

## Search Filters

```typescript
// frontend/src/components/media/SearchFilters.tsx
export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={filters.mediaType}
        onChange={(e) => onChange({ ...filters, mediaType: e.target.value })}
        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Types</option>
        <option value="movie">Movies</option>
        <option value="tv">TV Shows</option>
      </select>

      <select
        value={filters.year || ''}
        onChange={(e) =>
          onChange({ ...filters, year: e.target.value ? parseInt(e.target.value) : undefined })
        }
        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Years</option>
        {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      {/* Add more filters as needed */}
    </div>
  );
}
```

## API Integration

```typescript
// frontend/src/lib/api/media.ts
export async function searchMedia({ query, mediaType, year, genre }: SearchParams) {
  const params = new URLSearchParams({
    q: query,
    ...(mediaType !== 'all' && { type: mediaType }),
    ...(year && { year: year.toString() }),
    ...(genre && { genre: genre.toString() }),
  });

  const response = await fetch(`/api/media/search?${params}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to search media');
  }

  const data = await response.json();

  // Check availability for each result
  const resultsWithAvailability = await Promise.all(
    data.results.map(async (item: any) => {
      const availability = await checkAvailability(item.id, item.mediaType);
      return { ...item, availability };
    })
  );

  return {
    results: resultsWithAvailability,
    totalResults: data.totalResults,
    page: data.page,
    totalPages: data.totalPages,
  };
}
```

## Testing Requirements

1. **Search Functionality**:

   - Debouncing works correctly (300ms)
   - Empty query shows no results
   - Special characters handled properly

2. **UI Components**:

   - Grid layout responsive on all screen sizes
   - Image placeholders work when posters missing
   - Loading skeletons display during search

3. **Availability Checking**:
   - Available content shows correct badge
   - Request button disabled for available items
   - Partial availability shown for TV shows

## Performance Optimizations

1. **Image Loading**:

   - Use Next.js Image component with lazy loading
   - Implement progressive image loading
   - Cache poster images

2. **Search Optimization**:

   - Debounce search input
   - Cache search results for 5 minutes
   - Implement pagination for large result sets

3. **Bundle Size**:
   - Lazy load media detail modal
   - Code split search filters

## Accessibility

- Keyboard navigation through results grid
- ARIA labels for all interactive elements
- Focus management when opening/closing modals
- Announce search results to screen readers

## Related Tasks

- Media Request Submission
- Media Detail Modal
- Request History View
- TV Show Season Selection
