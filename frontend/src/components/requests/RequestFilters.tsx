'use client';

import { Calendar, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { RequestFilters as RequestFiltersType } from '@/types/requests';

interface RequestFiltersProps {
  filters: RequestFiltersType;
  onChange: (filters: RequestFiltersType) => void;
}

export function RequestFilters({ filters, onChange }: RequestFiltersProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <select
          value={filters.status || 'all'}
          onChange={(e) => onChange({ ...filters, status: e.target.value as any })}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="available">Available</option>
          <option value="denied">Denied</option>
          <option value="failed">Failed</option>
        </select>

        {/* Media Type Filter */}
        <select
          value={filters.mediaType || 'all'}
          onChange={(e) => onChange({ ...filters, mediaType: e.target.value as any })}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by title..."
            className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
        </div>

        {/* Date Range - Simplified for now */}
        <button
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
          onClick={() => {
            // TODO: Implement date range picker
            console.log('Date range picker not yet implemented');
          }}
        >
          <Calendar className="w-4 h-4" />
          <span>Filter by date</span>
        </button>
      </div>
    </div>
  );
}
