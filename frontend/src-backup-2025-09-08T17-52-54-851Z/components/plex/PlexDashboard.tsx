'use client';

import React, { useState, useEffect } from 'react';
import { MediaGrid } from './MediaGrid';
import { AdvancedSearchFilters } from './AdvancedSearchFilters';
import { PlexSearchFilters } from '@/types/plex-search';

export interface PlexDashboardProps {
  className?: string;
}

export function PlexDashboard({ className = '' }: PlexDashboardProps) {
  const [filters, setFilters] = useState<PlexSearchFilters>({});
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      image?: string;
      type: 'movie' | 'show' | 'episode';
    }>
  >([]);

  useEffect(() => {
    // Mock data loading
    setLoading(true);
    const timer = setTimeout(() => {
      setItems([
        { id: '1', title: 'Sample Movie 1', type: 'movie' },
        { id: '2', title: 'Sample TV Show 1', type: 'show' },
        { id: '3', title: 'Sample Episode 1', type: 'episode' },
      ]);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [filters]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Plex Media Library</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">{items.length} items</div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <AdvancedSearchFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Media Grid */}
      <MediaGrid
        items={items}
        loading={loading}
        onItemSelect={(id) => console.log('Selected item:', id)}
      />
    </div>
  );
}
