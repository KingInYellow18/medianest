# Request History View Implementation ✅ COMPLETE

## Overview

Create a comprehensive request history view that allows users to track all their media requests, filter by status, and see detailed information about each request. This view should update in real-time as request statuses change.

## Prerequisites

- Media request submission implemented
- WebSocket real-time updates configured
- User authentication functional
- Request status types defined

## Acceptance Criteria

1. Display all user's requests in a paginated list
2. Filter requests by status (pending, approved, available, etc.)
3. Sort by date, title, or status
4. Real-time status updates without page refresh
5. Show request details in expandable rows or modal
6. Display requester information (for admins)
7. Mobile-responsive table/list view

## Technical Requirements

### Component Structure

```typescript
// frontend/src/components/requests/RequestHistory.tsx
interface RequestHistoryProps {
  isAdmin?: boolean;
  userId?: string; // For admin viewing specific user
}

// frontend/src/components/requests/RequestTable.tsx
interface RequestTableProps {
  requests: MediaRequest[];
  isLoading: boolean;
  onRequestClick: (request: MediaRequest) => void;
  showRequester?: boolean;
}

// frontend/src/components/requests/RequestFilters.tsx
interface RequestFiltersProps {
  filters: RequestFilters;
  onChange: (filters: RequestFilters) => void;
}

interface RequestFilters {
  status?: RequestStatus | 'all';
  mediaType?: 'movie' | 'tv' | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}
```

### Data Management

```typescript
// frontend/src/hooks/useRequestHistory.ts
interface UseRequestHistoryOptions {
  userId?: string;
  filters: RequestFilters;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'title' | 'status';
  sortOrder: 'asc' | 'desc';
}
```

## Implementation Steps

1. **Create Request History Page**

   ```bash
   frontend/src/app/(auth)/requests/page.tsx
   ```

2. **Build Request Table Component**

   ```bash
   frontend/src/components/requests/RequestTable.tsx
   ```

3. **Implement Filter Controls**

   ```bash
   frontend/src/components/requests/RequestFilters.tsx
   ```

4. **Create Request History Hook**

   ```bash
   frontend/src/hooks/useRequestHistory.ts
   ```

5. **Add Request Detail Modal**

   ```bash
   frontend/src/components/requests/RequestDetailModal.tsx
   ```

6. **Build Mobile List View**
   ```bash
   frontend/src/components/requests/RequestList.tsx
   ```

## Component Implementation

### Request History Page

```typescript
// frontend/src/app/(auth)/requests/page.tsx
'use client';

import { useState } from 'react';
import { RequestHistory } from '@/components/requests/RequestHistory';
import { RequestFilters } from '@/components/requests/RequestFilters';
import { PageHeader } from '@/components/ui/PageHeader';

export default function RequestsPage() {
  const [filters, setFilters] = useState<RequestFilters>({
    status: 'all',
    mediaType: 'all',
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Request History" description="Track the status of your media requests" />

      <div className="mt-8 space-y-6">
        <RequestFilters filters={filters} onChange={setFilters} />
        <RequestHistory filters={filters} />
      </div>
    </div>
  );
}
```

### Request Table Component

```typescript
// frontend/src/components/requests/RequestTable.tsx
import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { RequestStatusBadge } from './RequestStatusBadge';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function RequestTable({
  requests,
  isLoading,
  onRequestClick,
  showRequester = false,
}: RequestTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (requestId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <RequestTableSkeleton />;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-lg">No requests found</p>
        <p className="text-gray-500 text-sm mt-2">Start by searching for something to watch!</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-gray-800 rounded-lg">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Media
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              {showRequester && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Requested By
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Requested
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {requests.map((request) => (
              <React.Fragment key={request.id}>
                <tr className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {request.posterPath && (
                        <div className="flex-shrink-0 h-10 w-7 mr-3">
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${request.posterPath}`}
                            alt=""
                            width={28}
                            height={40}
                            className="rounded"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-white">{request.title}</div>
                        {request.mediaType === 'tv' && request.seasons && (
                          <div className="text-xs text-gray-400">
                            {request.seasons.length} season{request.seasons.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300 capitalize">{request.mediaType}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  {showRequester && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {request.requestedBy}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleRow(request.id)}
                      className="text-blue-500 hover:text-blue-400 mr-3"
                    >
                      {expandedRows.has(request.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {request.overseerrId && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_OVERSEERR_URL}/request/${request.overseerrId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>

                {/* Expanded Row */}
                {expandedRows.has(request.id) && (
                  <tr>
                    <td colSpan={showRequester ? 6 : 5} className="px-6 py-4 bg-gray-750">
                      <RequestDetails request={request} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden">
        <RequestList
          requests={requests}
          showRequester={showRequester}
          onRequestClick={onRequestClick}
        />
      </div>
    </div>
  );
}
```

### Request Filters

```typescript
// frontend/src/components/requests/RequestFilters.tsx
import { Calendar } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

export function RequestFilters({ filters, onChange }: RequestFiltersProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onChange={(value) => onChange({ ...filters, status: value as any })}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'processing', label: 'Processing' },
            { value: 'available', label: 'Available' },
            { value: 'denied', label: 'Denied' },
            { value: 'failed', label: 'Failed' },
          ]}
          placeholder="Filter by status"
        />

        {/* Media Type Filter */}
        <Select
          value={filters.mediaType || 'all'}
          onChange={(value) => onChange({ ...filters, mediaType: value as any })}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
          ]}
          placeholder="Filter by type"
        />

        {/* Search */}
        <Input
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by title..."
          className="w-full"
        />

        {/* Date Range */}
        <DateRangePicker
          value={filters.dateRange}
          onChange={(dateRange) => onChange({ ...filters, dateRange })}
          placeholder="Filter by date"
          icon={<Calendar className="w-4 h-4" />}
        />
      </div>
    </div>
  );
}
```

### Request History Hook

```typescript
// frontend/src/hooks/useRequestHistory.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchUserRequests } from '@/lib/api/requests';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useRequestHistory(options: UseRequestHistoryOptions) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  const queryKey = ['requests', options.userId || 'me', options];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchUserRequests(options),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleRequestUpdate = (update: RequestUpdate) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          requests: old.requests.map((req) =>
            req.id === update.requestId ? { ...req, ...update.data } : req
          ),
        };
      });
    };

    socket.on('request:update', handleRequestUpdate);

    // Subscribe to updates for all requests in view
    data?.requests.forEach((request) => {
      socket.emit('subscribe:request', request.id);
    });

    return () => {
      socket.off('request:update', handleRequestUpdate);
      data?.requests.forEach((request) => {
        socket.emit('unsubscribe:request', request.id);
      });
    };
  }, [socket, data, queryClient, queryKey]);

  return {
    requests: data?.requests || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 1,
    isLoading,
    error,
  };
}
```

### Mobile List View

```typescript
// frontend/src/components/requests/RequestList.tsx
export function RequestList({ requests, showRequester, onRequestClick }: RequestListProps) {
  return (
    <div className="divide-y divide-gray-700">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onRequestClick(request)}
          className="p-4 hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            {request.posterPath && (
              <Image
                src={`https://image.tmdb.org/t/p/w92${request.posterPath}`}
                alt=""
                width={46}
                height={69}
                className="rounded flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">{request.title}</h3>

              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <span className="capitalize">{request.mediaType}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                </span>
              </div>

              {showRequester && (
                <p className="mt-1 text-xs text-gray-500">Requested by {request.requestedBy}</p>
              )}

              <div className="mt-2">
                <RequestStatusBadge status={request.status} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Pagination Implementation

```typescript
// frontend/src/components/ui/Pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = getPaginationItems(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      {pages.map((page, index) => (
        <React.Fragment key={index}>
          {page === '...' ? (
            <span className="px-3 py-2 text-gray-500">...</span>
          ) : (
            <button
              onClick={() => onPageChange(page as number)}
              className={clsx(
                'px-3 py-2 rounded-lg transition-colors',
                currentPage === page
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              {page}
            </button>
          )}
        </React.Fragment>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}
```

## Testing Requirements

1. **Data Display**:

   - All user requests load correctly
   - Pagination works as expected
   - Sorting changes order appropriately

2. **Filtering**:

   - Status filter shows only matching requests
   - Date range filter works correctly
   - Search filters by title

3. **Real-time Updates**:

   - Status changes reflect immediately
   - New requests appear in list
   - No duplicate entries

4. **Mobile Responsiveness**:
   - Table switches to list view on mobile
   - All information accessible on small screens
   - Touch interactions work properly

## Performance Considerations

1. **Pagination**: Limit to 20-50 items per page
2. **Virtual Scrolling**: Consider for large datasets
3. **Debounce Search**: 300ms delay on search input
4. **Memoization**: Prevent unnecessary re-renders
5. **Image Optimization**: Lazy load poster images

## Related Tasks

- Media Request Submission
- Request Status Updates
- Admin Request Management
- Request Notifications
