# Plex Search Functionality Implementation

## Overview

Implement comprehensive search functionality within the Plex library browser, allowing users to search across libraries, within specific libraries, and use advanced search filters. The search should be fast, intuitive, and provide relevant results with proper categorization.

## Prerequisites

- Plex library browser implemented
- Plex API search endpoints integrated
- Media card components available
- Debouncing utilities configured

## Acceptance Criteria

1. Global search across all libraries
2. Library-specific search with filters
3. Search results categorized by media type
4. Advanced filters (year, genre, rating, etc.)
5. Search history/suggestions
6. Real-time search with debouncing
7. Clear search state management
8. Keyboard navigation support

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/plex-search.ts
export interface PlexSearchQuery {
  query: string;
  libraries?: string[]; // Empty = all libraries
  mediaTypes?: ('movie' | 'show' | 'episode' | 'artist' | 'album' | 'track')[];
  filters?: PlexSearchFilters;
}

export interface PlexSearchFilters {
  year?: { min?: number; max?: number };
  rating?: { min?: number; max?: number };
  genre?: string[];
  actor?: string[];
  director?: string[];
  studio?: string[];
  contentRating?: string[];
  resolution?: string[];
  decade?: number;
}

export interface PlexSearchResults {
  query: string;
  totalResults: number;
  results: PlexSearchResultGroup[];
  suggestions?: string[];
}

export interface PlexSearchResultGroup {
  library: PlexLibrary;
  mediaType: string;
  items: PlexMediaItem[];
  totalCount: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'history' | 'suggestion' | 'filter';
  metadata?: any;
}
```

### Component Structure

```typescript
// frontend/src/components/plex/PlexSearch.tsx
interface PlexSearchProps {
  initialQuery?: string;
  onResultSelect: (item: PlexMediaItem) => void;
}

// frontend/src/components/plex/SearchBar.tsx
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
}

// frontend/src/components/plex/SearchResults.tsx
interface SearchResultsProps {
  results: PlexSearchResults;
  isLoading: boolean;
  onItemClick: (item: PlexMediaItem) => void;
}

// frontend/src/components/plex/AdvancedSearchFilters.tsx
interface AdvancedSearchFiltersProps {
  filters: PlexSearchFilters;
  onChange: (filters: PlexSearchFilters) => void;
  availableFilters: AvailableFilters;
}
```

## Implementation Steps

1. **Create Search Types**

   ```bash
   frontend/src/types/plex-search.ts
   ```

2. **Build Search Page/Modal**

   ```bash
   frontend/src/components/plex/PlexSearch.tsx
   ```

3. **Implement Search Bar**

   ```bash
   frontend/src/components/plex/SearchBar.tsx
   ```

4. **Create Search Results Component**

   ```bash
   frontend/src/components/plex/SearchResults.tsx
   ```

5. **Build Advanced Filters**

   ```bash
   frontend/src/components/plex/AdvancedSearchFilters.tsx
   ```

6. **Add Search Suggestions**

   ```bash
   frontend/src/components/plex/SearchSuggestions.tsx
   ```

7. **Implement Search History**
   ```bash
   frontend/src/hooks/useSearchHistory.ts
   ```

## Component Implementation

### Main Search Component

```typescript
// frontend/src/components/plex/PlexSearch.tsx
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { AdvancedSearchFilters } from './AdvancedSearchFilters';
import { usePlexSearch } from '@/hooks/usePlexSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Filter } from 'lucide-react';

export function PlexSearch({ initialQuery = '', onResultSelect }: PlexSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState<PlexSearchQuery>({
    query: initialQuery || searchParams.get('q') || '',
    libraries: searchParams.getAll('library'),
    filters: {}
  });

  const { results, isLoading, suggestions } = usePlexSearch(searchQuery);
  const { addToHistory, getHistory } = useSearchHistory();

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.query) params.set('q', searchQuery.query);
    searchQuery.libraries?.forEach(lib => params.append('library', lib));

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchQuery, router]);

  const handleSearch = (query: string) => {
    setSearchQuery(prev => ({ ...prev, query }));
    if (query.trim()) {
      addToHistory(query);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery({ query: '', filters: {} });
    router.replace(window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery.query}
                onChange={handleSearch}
                onClear={handleClearSearch}
                suggestions={suggestions}
                isLoading={isLoading}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'p-3 rounded-lg transition-colors',
                showFilters
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4">
              <AdvancedSearchFilters
                filters={searchQuery.filters || {}}
                onChange={(filters) => setSearchQuery(prev => ({ ...prev, filters }))}
                availableFilters={results?.availableFilters || {}}
              />
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {searchQuery.query ? (
          <SearchResults
            results={results}
            isLoading={isLoading}
            onItemClick={onResultSelect}
          />
        ) : (
          <SearchHomepage
            recentSearches={getHistory()}
            onSearchSelect={handleSearch}
          />
        )}
      </div>
    </div>
  );
}
```

### Search Bar with Suggestions

```typescript
// frontend/src/components/plex/SearchBar.tsx
import { useRef, useState, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchSuggestion } from '@/types/plex-search';

export function SearchBar({
  value,
  onChange,
  onClear,
  suggestions = [],
  isLoading
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const showSuggestions = isFocused && (suggestions.length > 0 || value.length > 0);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            onChange(suggestions[selectedIndex].text);
            setIsFocused(false);
          }
          break;
        case 'Escape':
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    };

    if (isFocused) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFocused, selectedIndex, suggestions, onChange]);

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Search movies, shows, actors..."
          className="block w-full pl-10 pr-10 py-3 text-base
                     bg-gray-800 border border-gray-700 rounded-lg
                     text-white placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-150"
          aria-label="Search"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={showSuggestions}
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}

          {value && (
            <button
              onClick={onClear}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={suggestionsRef}
            id="search-suggestions"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.text}`}
                onClick={() => {
                  onChange(suggestion.text);
                  setIsFocused(false);
                }}
                className={clsx(
                  'w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left',
                  selectedIndex === index && 'bg-gray-700'
                )}
              >
                {suggestion.type === 'history' && (
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                {suggestion.type === 'suggestion' && (
                  <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0" />
                )}
                <span className="text-white flex-1">{suggestion.text}</span>
                {suggestion.type === 'filter' && (
                  <span className="text-xs text-gray-400">{suggestion.metadata?.type}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Search Results Component

```typescript
// frontend/src/components/plex/SearchResults.tsx
import { MediaCard } from './MediaCard';
import { SearchResultsSkeleton } from './SearchResultsSkeleton';
import { Film, Tv, Music, Image as ImageIcon } from 'lucide-react';

const typeIcons = {
  movie: Film,
  show: Tv,
  artist: Music,
  photo: ImageIcon
};

export function SearchResults({ results, isLoading, onItemClick }: SearchResultsProps) {
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }

  if (!results || results.totalResults === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-400 mb-2">No results found</p>
        <p className="text-gray-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="text-sm text-gray-400">
        Found {results.totalResults} results for "{results.query}"
      </div>

      {/* Grouped Results */}
      {results.results.map((group) => {
        const Icon = typeIcons[group.library.type] || Film;

        return (
          <section key={`${group.library.key}-${group.mediaType}`}>
            <div className="flex items-center gap-3 mb-4">
              <Icon className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-semibold text-white">
                {group.library.title}
              </h2>
              <span className="text-sm text-gray-400">
                ({group.totalCount} results)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {group.items.map((item) => (
                <MediaCard
                  key={item.key}
                  media={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </div>

            {group.totalCount > group.items.length && (
              <div className="mt-4 text-center">
                <button className="text-blue-500 hover:text-blue-400 text-sm">
                  Show all {group.totalCount} results in {group.library.title}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

### Advanced Search Filters

```typescript
// frontend/src/components/plex/AdvancedSearchFilters.tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { RangeSlider } from '@/components/ui/RangeSlider';

export function AdvancedSearchFilters({
  filters,
  onChange,
  availableFilters
}: AdvancedSearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const clearFilter = (filterKey: keyof PlexSearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    onChange(newFilters);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Basic Filters */}
      <div>
        <button
          onClick={() => toggleSection('basic')}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-white">Basic Filters</span>
          {expandedSections.has('basic') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('basic') && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Year Range */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Year</label>
              <RangeSlider
                min={1900}
                max={new Date().getFullYear()}
                value={[
                  filters.year?.min || 1900,
                  filters.year?.max || new Date().getFullYear()
                ]}
                onChange={([min, max]) => onChange({
                  ...filters,
                  year: { min, max }
                })}
              />
            </div>

            {/* Rating Range */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Rating</label>
              <RangeSlider
                min={0}
                max={10}
                step={0.1}
                value={[
                  filters.rating?.min || 0,
                  filters.rating?.max || 10
                ]}
                onChange={([min, max]) => onChange({
                  ...filters,
                  rating: { min, max }
                })}
                format={(value) => value.toFixed(1)}
              />
            </div>

            {/* Content Rating */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Content Rating</label>
              <MultiSelect
                options={availableFilters.contentRatings || []}
                value={filters.contentRating || []}
                onChange={(value) => onChange({
                  ...filters,
                  contentRating: value
                })}
                placeholder="Any rating"
              />
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div>
        <button
          onClick={() => toggleSection('advanced')}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-white">Advanced Filters</span>
          {expandedSections.has('advanced') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('advanced') && (
          <div className="mt-4 space-y-4">
            {/* Genres */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Genres</label>
              <MultiSelect
                options={availableFilters.genres || []}
                value={filters.genre || []}
                onChange={(value) => onChange({
                  ...filters,
                  genre: value
                })}
                placeholder="Select genres"
              />
            </div>

            {/* Other filters... */}
          </div>
        )}
      </div>

      {/* Active Filters */}
      {Object.keys(filters).length > 0 && (
        <div className="pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Active Filters</span>
            <button
              onClick={() => onChange({})}
              className="text-xs text-red-500 hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-white"
              >
                {formatFilterLabel(key, value)}
                <button
                  onClick={() => clearFilter(key as keyof PlexSearchFilters)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Search Hook

```typescript
// frontend/src/hooks/usePlexSearch.ts
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { searchPlex } from '@/lib/api/plex';

export function usePlexSearch(query: PlexSearchQuery) {
  const debouncedQuery = useDebounce(query.query, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['plex', 'search', debouncedQuery, query.libraries, query.filters],
    queryFn: () =>
      searchPlex({
        ...query,
        query: debouncedQuery,
      }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
    keepPreviousData: true,
  });

  // Generate suggestions
  const suggestions = useMemo(() => {
    const results: SearchSuggestion[] = [];

    // Add search history
    const history = getSearchHistory();
    history.forEach((item) => {
      if (item.toLowerCase().includes(query.query.toLowerCase())) {
        results.push({ text: item, type: 'history' });
      }
    });

    // Add filter suggestions based on current results
    if (data?.availableFilters) {
      // Genre suggestions
      data.availableFilters.genres?.slice(0, 3).forEach((genre) => {
        results.push({
          text: `${query.query} ${genre}`,
          type: 'filter',
          metadata: { type: 'genre', value: genre },
        });
      });
    }

    return results.slice(0, 8);
  }, [query.query, data]);

  return {
    results: data,
    isLoading,
    error,
    suggestions,
  };
}
```

## Testing Requirements

1. **Search Functionality**:

   - Debouncing works correctly
   - Results categorized properly
   - Empty state displays correctly

2. **Keyboard Navigation**:

   - Arrow keys navigate suggestions
   - Enter selects suggestion
   - Escape closes dropdown

3. **Filter Application**:

   - Filters apply correctly to results
   - Active filters display properly
   - Clear filters works

4. **Performance**:
   - Search remains responsive with many results
   - Suggestions update quickly
   - No memory leaks

## Performance Optimizations

1. **Debouncing**: 300ms delay on search input
2. **Result Caching**: Cache searches for 30 seconds
3. **Lazy Loading**: Load more results on demand
4. **Image Optimization**: Use smaller thumbnails in search
5. **Virtual Scrolling**: For very large result sets

## Accessibility

- Proper ARIA labels and roles
- Keyboard navigation fully supported
- Screen reader announcements for results
- Focus management on filter changes

## Related Tasks

- Plex Library Browser
- Global Search Implementation
- Search History Management
- Voice Search Support (future)

---

## ✅ COMPLETED

**Completion Date**: 2025-07-12  
**Implementation Summary**:

✅ **All acceptance criteria implemented**:

1. ✅ Global search across all libraries - Implemented with searchPlex API function
2. ✅ Library-specific search with filters - Advanced filters component with multi-select and range sliders
3. ✅ Search results categorized by media type - Results grouped by library and media type
4. ✅ Advanced filters (year, genre, rating, etc.) - Comprehensive filter system with collapsible sections
5. ✅ Search history/suggestions - localStorage-based search history with useSearchHistory hook
6. ✅ Real-time search with debouncing - 300ms debouncing in usePlexSearch hook
7. ✅ Clear search state management - URL state synchronization with searchParams
8. ✅ Keyboard navigation support - Arrow keys, Enter, Escape handling in SearchBar

**Key Components Implemented**:

- `/frontend/src/types/plex-search.ts` - Comprehensive type definitions
- `/frontend/src/components/plex/SearchBar.tsx` - Search input with suggestions and keyboard navigation
- `/frontend/src/components/plex/SearchResults.tsx` - Results display with skeleton loading
- `/frontend/src/components/plex/AdvancedSearchFilters.tsx` - Multi-select filters and range sliders
- `/frontend/src/components/plex/PlexSearch.tsx` - Main search orchestration component
- `/frontend/src/hooks/usePlexSearch.ts` - Search hook with debouncing and caching
- `/frontend/src/hooks/useSearchHistory.ts` - Search history management with localStorage
- `/frontend/src/app/(auth)/plex/search/page.tsx` - Dedicated search page
- `/frontend/src/lib/api/plex.ts` - Enhanced with searchPlex API function

**Quality Assurance**:
✅ Lint and type checking completed  
✅ Code review with Perplexity - confirmed strong architecture and TypeScript practices  
✅ All acceptance criteria verified and implemented

**Notes**: Implementation follows Next.js 14 App Router patterns with proper TypeScript typing, debouncing for performance, keyboard accessibility, and URL state management for shareable search results.
