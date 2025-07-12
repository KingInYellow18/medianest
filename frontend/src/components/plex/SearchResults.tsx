'use client';

import { Film, Tv, Music, Image as ImageIcon } from 'lucide-react';

import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';
import { PlexSearchResults, PlexMediaItem } from '@/types/plex-search';

interface SearchResultsProps {
  results?: PlexSearchResults;
  isLoading: boolean;
  onItemClick: (item: PlexMediaItem) => void;
}

const typeIcons = {
  movie: Film,
  show: Tv,
  artist: Music,
  photo: ImageIcon,
} as const;

function SearchResultsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 bg-gray-800 rounded w-32 animate-pulse" />
            <div className="h-4 bg-gray-800 rounded w-16 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <MediaCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResults({ results, isLoading, onItemClick }: SearchResultsProps) {
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }
  
  if (!results) {
    return null;
  }

  if (results.totalResults === 0) {
    return (
      <div className="text-center py-16">
        <div className="mb-4">
          <Film className="w-16 h-16 text-gray-600 mx-auto" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Try adjusting your search terms or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Found <span className="text-white font-medium">{results.totalResults}</span> results for{' '}
          <span className="text-white font-medium">"{results.query}"</span>
        </div>
      </div>
      
      {/* Grouped Results */}
      {results.results.map((group) => {
        const IconComponent = typeIcons[group.library.type as keyof typeof typeIcons] || Film;
        
        return (
          <section key={`${group.library.key}-${group.mediaType}`} className="space-y-4">
            <div className="flex items-center gap-3">
              <IconComponent className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-semibold text-white">
                {group.library.title}
              </h2>
              <span className="text-sm text-gray-400">
                ({group.totalCount.toLocaleString()} {group.totalCount === 1 ? 'result' : 'results'})
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
              <div className="mt-6 text-center">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-400 
                           hover:text-blue-300 transition-colors focus:outline-none focus:ring-2 
                           focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md"
                  onClick={() => {
                    // TODO: Implement "show more" functionality
                    console.log('Show more for library:', group.library.title);
                  }}
                >
                  Show all {group.totalCount.toLocaleString()} results in {group.library.title}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}