'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface SearchFiltersProps {
  onFilterChange: (filters: {
    mediaType: 'all' | 'movie' | 'tv';
    year?: string;
    genre?: string;
  }) => void;
  availableGenres?: { id: number; name: string }[];
}

export function SearchFilters({ onFilterChange, availableGenres = [] }: SearchFiltersProps) {
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  const handleMediaTypeChange = (type: 'all' | 'movie' | 'tv') => {
    setMediaType(type);
    onFilterChange({ mediaType: type, year, genre });
  };

  const handleYearChange = (selectedYear: string) => {
    setYear(selectedYear);
    onFilterChange({ mediaType, year: selectedYear, genre });
  };

  const handleGenreChange = (selectedGenre: string) => {
    setGenre(selectedGenre);
    onFilterChange({ mediaType, year, genre: selectedGenre });
  };

  const clearFilters = () => {
    setMediaType('all');
    setYear('');
    setGenre('');
    onFilterChange({ mediaType: 'all' });
  };

  const hasActiveFilters = mediaType !== 'all' || year || genre;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Media Type Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant={mediaType === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMediaTypeChange('all')}
          className="flex-1"
        >
          All
        </Button>
        <Button
          variant={mediaType === 'movie' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMediaTypeChange('movie')}
          className="flex-1"
        >
          Movies
        </Button>
        <Button
          variant={mediaType === 'tv' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMediaTypeChange('tv')}
          className="flex-1"
        >
          TV Shows
        </Button>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors mb-2"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        Advanced Filters
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full ml-2">
            Active
          </span>
        )}
      </button>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Release Year</label>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full bg-gray-700 border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Any Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Genre Filter */}
          {availableGenres.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
              <select
                value={genre}
                onChange={(e) => handleGenreChange(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Genres</option>
                {availableGenres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
