'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MediaSearchResult } from '@/types/media';
import { useMediaSearch } from '@/hooks/useMediaSearch';
import { SearchInput } from '@/components/media/SearchInput';
import { SearchFilters } from '@/components/media/SearchFilters';
import { MediaGrid } from '@/components/media/MediaGrid';
import { requestMedia } from '@/lib/api/media';
import { useToast } from '@/hooks/use-toast';

export default function MediaSearchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    year: '',
    genre: '',
  });

  const {
    query,
    setQuery,
    results,
    isLoading,
    isDebouncing,
    error,
  } = useMediaSearch();

  // Filter results based on selected filters
  const filteredResults = results.filter((media) => {
    if (filters.mediaType !== 'all' && media.mediaType !== filters.mediaType) {
      return false;
    }

    if (filters.year && media.releaseDate) {
      const releaseYear = new Date(media.releaseDate).getFullYear().toString();
      if (releaseYear !== filters.year) {
        return false;
      }
    }

    if (filters.genre && media.genres) {
      const hasGenre = media.genres.some((g) => g.id.toString() === filters.genre);
      if (!hasGenre) {
        return false;
      }
    }

    return true;
  });

  // Extract unique genres from results for filter dropdown
  const availableGenres = Array.from(
    new Map(
      results
        .flatMap((media) => media.genres || [])
        .map((genre) => [genre.id, genre])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleMediaSelect = useCallback((media: MediaSearchResult) => {
    // Navigate to media detail page (to be implemented)
    router.push(`/media/${media.mediaType}/${media.tmdbId}`);
  }, [router]);

  const handleRequestClick = useCallback(async (media: MediaSearchResult) => {
    try {
      await requestMedia({
        tmdbId: media.tmdbId,
        mediaType: media.mediaType,
      });

      toast({
        title: 'Request Submitted',
        description: `${media.title} has been requested successfully.`,
      });

      // Refresh the search results to update availability status
      // This would be handled by React Query cache invalidation in a real implementation
    } catch (error) {
      toast({
        title: 'Request Failed',
        description: error instanceof Error ? error.message : 'Failed to submit request',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Media Search</h1>
          <p className="text-gray-400">
            Search for movies and TV shows to request for the Plex server
          </p>
        </div>

        {/* Search Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Search Input */}
          <div className="lg:col-span-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              isLoading={isDebouncing}
              placeholder="Search for movies or TV shows..."
            />
          </div>

          {/* Filters */}
          <div className="lg:col-span-1">
            <SearchFilters
              onFilterChange={handleFilterChange}
              availableGenres={availableGenres}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-200">
              {error instanceof Error ? error.message : 'An error occurred while searching'}
            </p>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && query && filteredResults.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-400">
              Found {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
              {filters.mediaType !== 'all' && ` (${filters.mediaType}s only)`}
            </p>
          </div>
        )}

        {/* Results Grid */}
        <MediaGrid
          results={filteredResults}
          isLoading={isLoading}
          onMediaSelect={handleMediaSelect}
          onRequestClick={handleRequestClick}
        />

        {/* Empty State for Initial Load */}
        {!query && !isLoading && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">
              Start typing to search for movies and TV shows
            </p>
            <p className="text-gray-500 text-sm">
              Use filters to narrow down your search results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}