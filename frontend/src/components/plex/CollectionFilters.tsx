'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import type { CollectionFilters } from '@/types/plex';

interface CollectionFiltersProps {
  filters: CollectionFilters;
  onChange: (filters: CollectionFilters) => void;
}

export function CollectionFilters({ filters, onChange }: CollectionFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    onChange({ ...filters, search: debouncedSearch || undefined });
  }, [debouncedSearch]);

  const handleSortChange = (sort: CollectionFilters['sort']) => {
    onChange({ ...filters, sort });
  };

  const handleMinItemsChange = (minItems: number | undefined) => {
    onChange({ ...filters, minItems });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder="Search collections..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Sort and Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>

        <Button
          variant={filters.sort === 'title' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('title')}
        >
          Title
        </Button>

        <Button
          variant={filters.sort === 'addedAt' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('addedAt')}
        >
          Date Added
        </Button>

        <Button
          variant={filters.sort === 'childCount' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('childCount')}
        >
          Item Count
        </Button>

        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Min items:</span>
          <select
            value={filters.minItems || ''}
            onChange={(e) => {
              const value = e.target.value;
              handleMinItemsChange(value ? parseInt(value, 10) : undefined);
            }}
            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any</option>
            <option value="5">5+</option>
            <option value="10">10+</option>
            <option value="20">20+</option>
            <option value="50">50+</option>
          </select>
        </div>
      </div>
    </div>
  );
}
