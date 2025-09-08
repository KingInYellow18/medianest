'use client';

import clsx from 'clsx';
import { Filter } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { usePlexSearch } from '@/hooks/usePlexSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { PlexSearchQuery, PlexMediaItem } from '@/types/plex-search';

import { AdvancedSearchFilters } from './AdvancedSearchFilters';
import { SearchBar } from './SearchBar';
import { SearchHomepage } from './SearchHomepage';
import { SearchResults } from './SearchResults';

interface PlexSearchProps {
  initialQuery?: string;
  onResultSelect?: (item: PlexMediaItem) => void;
}

export function PlexSearch({ initialQuery = '', onResultSelect }: PlexSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState<PlexSearchQuery>({
    query: initialQuery || searchParams.get('q') || '',
    libraries: searchParams.getAll('library'),
    filters: {},
  });

  const { results, isLoading, suggestions } = usePlexSearch(searchQuery);
  const { addToHistory, getHistory } = useSearchHistory();

  // Update URL params when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.query) {
      params.set('q', searchQuery.query);
    }
    if (searchQuery.libraries && searchQuery.libraries.length > 0) {
      searchQuery.libraries.forEach((lib) => params.append('library', lib));
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, router]);

  const handleSearch = (query: string) => {
    setSearchQuery((prev) => ({ ...prev, query }));
    if (query.trim().length >= 2) {
      addToHistory(query.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchQuery({ query: '', filters: {} });
    router.replace(window.location.pathname);
  };

  const handleItemClick = (item: PlexMediaItem) => {
    if (onResultSelect) {
      onResultSelect(item);
    } else {
      // Default behavior - could navigate to item detail page
      // Handle item selection (TODO: implement proper routing/details)
    }
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
              aria-label="Toggle filters"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4">
              <AdvancedSearchFilters
                filters={searchQuery.filters || {}}
                onChange={(filters) => setSearchQuery((prev) => ({ ...prev, filters }))}
                availableFilters={results?.availableFilters || {}}
              />
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {searchQuery.query ? (
          <SearchResults results={results} isLoading={isLoading} onItemClick={handleItemClick} />
        ) : (
          <SearchHomepage recentSearches={getHistory()} onSearchSelect={handleSearch} />
        )}
      </div>
    </div>
  );
}
