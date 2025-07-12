'use client';

import React from 'react';

import { Select } from '@/components/ui/Select';
import { useLibraryMetadata } from '@/hooks/usePlexLibrary';
import { PLEX_SORT_OPTIONS } from '@/lib/plex/utils';
import { PlexFilters, PlexLibrary } from '@/types/plex';

interface MediaFiltersProps {
  filters: PlexFilters;
  onChange: (filters: PlexFilters) => void;
  library: PlexLibrary;
}

export function MediaFilters({ filters, onChange, library }: MediaFiltersProps) {
  const { genres, years, contentRatings } = useLibraryMetadata(library.key);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sort By */}
        <Select
          value={filters.sort || 'addedAt:desc'}
          onChange={(value) => onChange({ ...filters, sort: value as any })}
          options={PLEX_SORT_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          placeholder="Sort by"
        />

        {/* Genre Filter */}
        {genres.length > 0 && (
          <Select
            value={filters.genre || ''}
            onChange={(value) => onChange({ ...filters, genre: value || undefined })}
            options={[
              { value: '', label: 'All Genres' },
              ...genres.map((g) => ({ value: g, label: g })),
            ]}
            placeholder="Genre"
          />
        )}

        {/* Year Filter */}
        {years.length > 0 && (
          <Select
            value={filters.year?.toString() || ''}
            onChange={(value) =>
              onChange({ ...filters, year: value ? parseInt(value) : undefined })
            }
            options={[
              { value: '', label: 'All Years' },
              ...years.map((y) => ({ value: y.toString(), label: y.toString() })),
            ]}
            placeholder="Year"
          />
        )}

        {/* Content Rating */}
        {contentRatings.length > 0 && (
          <Select
            value={filters.contentRating || ''}
            onChange={(value) => onChange({ ...filters, contentRating: value || undefined })}
            options={[
              { value: '', label: 'All Ratings' },
              ...contentRatings.map((r) => ({ value: r, label: r })),
            ]}
            placeholder="Rating"
          />
        )}
      </div>
    </div>
  );
}
