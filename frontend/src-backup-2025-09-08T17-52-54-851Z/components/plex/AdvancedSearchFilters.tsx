'use client';

import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';

import { PlexSearchFilters, AvailableFilters } from '@/types/plex-search';

interface AdvancedSearchFiltersProps {
  filters: PlexSearchFilters;
  onChange: (filters: PlexSearchFilters) => void;
  availableFilters?: AvailableFilters;
}

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}

function MultiSelect({ options, value, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <div className="flex items-center justify-between">
          <span className={value.length === 0 ? 'text-gray-400' : 'text-white'}>
            {value.length === 0 ? placeholder : `${value.length} selected`}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => handleToggle(option)}
                className="mr-3 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-white text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  format?: (value: number) => string;
}

function RangeSlider({ min, max, value, onChange, step = 1, format }: RangeSliderProps) {
  const formatValue = format || ((v: number) => v.toString());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{formatValue(value[0])}</span>
        <span>{formatValue(value[1])}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onChange([Number(e.target.value), value[1]])}
          className="absolute w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(e) => onChange([value[0], Number(e.target.value)])}
          className="absolute w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}

function formatFilterLabel(key: string, value: any): string {
  switch (key) {
    case 'year':
      return value.min === value.max ? `Year: ${value.min}` : `Year: ${value.min}-${value.max}`;
    case 'rating':
      return value.min === value.max ? `Rating: ${value.min}` : `Rating: ${value.min}-${value.max}`;
    case 'genre':
      return `Genres: ${value.join(', ')}`;
    case 'contentRating':
      return `Rating: ${value.join(', ')}`;
    default:
      return `${key}: ${Array.isArray(value) ? value.join(', ') : value}`;
  }
}

export function AdvancedSearchFilters({
  filters,
  onChange,
  availableFilters = {},
}: AdvancedSearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
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

  const currentYear = new Date().getFullYear();

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
                min={availableFilters.years?.min || 1900}
                max={availableFilters.years?.max || currentYear}
                value={[
                  filters.year?.min || availableFilters.years?.min || 1900,
                  filters.year?.max || availableFilters.years?.max || currentYear,
                ]}
                onChange={([min, max]) =>
                  onChange({
                    ...filters,
                    year: { min, max },
                  })
                }
              />
            </div>

            {/* Rating Range */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Rating</label>
              <RangeSlider
                min={0}
                max={10}
                step={0.1}
                value={[filters.rating?.min || 0, filters.rating?.max || 10]}
                onChange={([min, max]) =>
                  onChange({
                    ...filters,
                    rating: { min, max },
                  })
                }
                format={(value) => value.toFixed(1)}
              />
            </div>

            {/* Content Rating */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Content Rating</label>
              <MultiSelect
                options={
                  availableFilters.contentRatings || [
                    'G',
                    'PG',
                    'PG-13',
                    'R',
                    'NC-17',
                    'TV-G',
                    'TV-PG',
                    'TV-14',
                    'TV-MA',
                  ]
                }
                value={filters.contentRating || []}
                onChange={(value) =>
                  onChange({
                    ...filters,
                    contentRating: value,
                  })
                }
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
                options={
                  availableFilters.genres || [
                    'Action',
                    'Comedy',
                    'Drama',
                    'Horror',
                    'Sci-Fi',
                    'Thriller',
                  ]
                }
                value={filters.genre || []}
                onChange={(value) =>
                  onChange({
                    ...filters,
                    genre: value,
                  })
                }
                placeholder="Select genres"
              />
            </div>

            {/* Studios */}
            {availableFilters.studios && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Studios</label>
                <MultiSelect
                  options={availableFilters.studios}
                  value={filters.studio || []}
                  onChange={(value) =>
                    onChange({
                      ...filters,
                      studio: value,
                    })
                  }
                  placeholder="Select studios"
                />
              </div>
            )}
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
