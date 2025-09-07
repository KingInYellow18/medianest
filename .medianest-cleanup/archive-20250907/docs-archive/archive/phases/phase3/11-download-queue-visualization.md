# Download Queue Visualization Implementation ✅ COMPLETED

## Overview

Create a comprehensive download queue interface that displays all queued, active, and completed YouTube downloads. Users should see real-time progress updates, manage their downloads, and track the status of each item in the queue.

## Prerequisites

- YouTube URL submission interface implemented
- WebSocket connection for real-time updates
- BullMQ job queue integrated
- User authentication with download permissions
- Progress tracking backend endpoints

## Acceptance Criteria

1. Display all user's downloads with status indicators
2. Real-time progress updates for active downloads
3. Queue position for pending downloads
4. Cancel/retry functionality for appropriate states
5. Download speed and ETA calculations
6. Completed downloads show Plex integration status
7. Mobile-responsive card/list layout
8. Filter by status (queued, downloading, completed, failed)

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/youtube-queue.ts
export interface DownloadQueueItem extends YouTubeDownloadRequest {
  queuePosition?: number;
  downloadSpeed?: number; // bytes/sec
  eta?: number; // seconds
  downloadedSize?: number; // bytes
  totalSize?: number; // bytes
  currentVideo?: number; // For playlist progress
  retryCount?: number;
  plexStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface QueueFilters {
  status?: DownloadStatus | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface DownloadProgress {
  downloadId: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
  speed: number;
  eta: number;
  currentVideo?: {
    index: number;
    total: number;
    title: string;
  };
}
```

### Component Structure

```typescript
// frontend/src/components/youtube/DownloadQueue.tsx
interface DownloadQueueProps {
  userId?: string; // For admin viewing
}

// frontend/src/components/youtube/DownloadCard.tsx
interface DownloadCardProps {
  download: DownloadQueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onViewInPlex: (id: string) => void;
}

// frontend/src/components/youtube/DownloadProgress.tsx
interface DownloadProgressProps {
  download: DownloadQueueItem;
  compact?: boolean;
}

// frontend/src/components/youtube/QueueFilters.tsx
interface QueueFiltersProps {
  filters: QueueFilters;
  onChange: (filters: QueueFilters) => void;
}
```

## Implementation Steps

1. **Create Queue Types**

   ```bash
   frontend/src/types/youtube-queue.ts
   ```

2. **Build Download Queue Component**

   ```bash
   frontend/src/components/youtube/DownloadQueue.tsx
   ```

3. **Implement Download Card**

   ```bash
   frontend/src/components/youtube/DownloadCard.tsx
   ```

4. **Create Progress Display**

   ```bash
   frontend/src/components/youtube/DownloadProgress.tsx
   ```

5. **Add Queue Filters**

   ```bash
   frontend/src/components/youtube/QueueFilters.tsx
   ```

6. **Implement Queue Management Hook**
   ```bash
   frontend/src/hooks/useDownloadQueue.ts
   ```

## Component Implementation

### Main Download Queue Component

```typescript
// frontend/src/components/youtube/DownloadQueue.tsx
import { useState } from 'react';
import { DownloadCard } from './DownloadCard';
import { QueueFilters } from './QueueFilters';
import { EmptyQueue } from './EmptyQueue';
import { useDownloadQueue } from '@/hooks/useDownloadQueue';
import { useToast } from '@/hooks/useToast';
import { Download } from 'lucide-react';

export function DownloadQueue({ userId }: DownloadQueueProps) {
  const [filters, setFilters] = useState<QueueFilters>({
    status: 'all',
  });

  const { downloads, isLoading, cancelDownload, retryDownload } = useDownloadQueue({
    userId,
    filters,
  });

  const { toast } = useToast();

  const handleCancel = async (downloadId: string) => {
    try {
      await cancelDownload(downloadId);
      toast({
        title: 'Download Cancelled',
        description: 'The download has been cancelled.',
        variant: 'info',
      });
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: error.message || 'Failed to cancel download',
        variant: 'error',
      });
    }
  };

  const handleRetry = async (downloadId: string) => {
    try {
      await retryDownload(downloadId);
      toast({
        title: 'Download Requeued',
        description: 'The download has been added back to the queue.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: error.message || 'Failed to retry download',
        variant: 'error',
      });
    }
  };

  const handleViewInPlex = (downloadId: string) => {
    const download = downloads.find((d) => d.id === downloadId);
    if (download?.plexCollectionId) {
      window.open(`/plex/collection/${download.plexCollectionId}`, '_blank');
    }
  };

  if (isLoading) {
    return <QueueSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Active Downloads"
          value={downloads.filter((d) => d.status === 'downloading').length}
          icon={<Download className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="In Queue"
          value={downloads.filter((d) => d.status === 'queued').length}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          label="Completed Today"
          value={
            downloads.filter((d) => d.status === 'completed' && isToday(new Date(d.completedAt!)))
              .length
          }
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Filters */}
      <QueueFilters filters={filters} onChange={setFilters} />

      {/* Download List */}
      {downloads.length === 0 ? (
        <EmptyQueue filters={filters} />
      ) : (
        <div className="space-y-4">
          {downloads.map((download) => (
            <DownloadCard
              key={download.id}
              download={download}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onViewInPlex={handleViewInPlex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Download Card Component

```typescript
// frontend/src/components/youtube/DownloadCard.tsx
import { useState } from 'react';
import Image from 'next/image';
import {
  MoreVertical,
  X,
  RefreshCw,
  ExternalLink,
  Clock,
  Download as DownloadIcon,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { DownloadProgress } from './DownloadProgress';
import { Dropdown } from '@/components/ui/Dropdown';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const statusIcons = {
  queued: Clock,
  downloading: DownloadIcon,
  completed: CheckCircle,
  failed: AlertCircle,
  cancelled: X,
};

export function DownloadCard({ download, onCancel, onRetry, onViewInPlex }: DownloadCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = statusIcons[download.status] || Clock;

  const canCancel = ['queued', 'downloading'].includes(download.status);
  const canRetry = ['failed', 'cancelled'].includes(download.status);
  const canViewInPlex = download.status === 'completed' && download.plexStatus === 'completed';

  return (
    <div
      className={clsx(
        'bg-gray-800 rounded-lg overflow-hidden transition-all duration-200',
        showDetails && 'ring-2 ring-blue-500'
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 relative">
            <Image
              src={download.thumbnail || '/images/youtube-placeholder.png'}
              alt=""
              width={120}
              height={68}
              className="rounded"
            />
            {download.type === 'playlist' && download.videoCount && (
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                {download.videoCount} videos
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-white line-clamp-1">{download.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Icon className="w-4 h-4" />
                    {download.status}
                  </span>
                  {download.queuePosition && download.status === 'queued' && (
                    <span>Position #{download.queuePosition}</span>
                  )}
                  <span>
                    {formatDistanceToNow(new Date(download.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Actions Menu */}
              <Dropdown
                trigger={
                  <button className="p-1 hover:bg-gray-700 rounded">
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                }
              >
                <Dropdown.Item onClick={() => setShowDetails(!showDetails)}>
                  {showDetails ? 'Hide' : 'Show'} Details
                </Dropdown.Item>

                {canCancel && (
                  <Dropdown.Item
                    onClick={() => onCancel(download.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Cancel Download
                  </Dropdown.Item>
                )}

                {canRetry && (
                  <Dropdown.Item onClick={() => onRetry(download.id)}>Retry Download</Dropdown.Item>
                )}

                {canViewInPlex && (
                  <Dropdown.Item onClick={() => onViewInPlex(download.id)}>
                    View in Plex
                  </Dropdown.Item>
                )}
              </Dropdown>
            </div>

            {/* Progress Bar */}
            {download.status === 'downloading' && (
              <div className="mt-3">
                <DownloadProgress download={download} compact />
              </div>
            )}

            {/* Error Message */}
            {download.status === 'failed' && download.error && (
              <div className="mt-2 text-sm text-red-400 bg-red-900/20 rounded px-2 py-1">
                {download.error}
              </div>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
            <DetailRow label="URL" value={download.url} copyable />
            <DetailRow
              label="Format"
              value={`${download.format.quality} ${download.format.container.toUpperCase()}`}
            />
            {download.status === 'downloading' && (
              <>
                <DetailRow label="Speed" value={formatSpeed(download.downloadSpeed)} />
                <DetailRow label="ETA" value={formatETA(download.eta)} />
                {download.type === 'playlist' && download.currentVideo && (
                  <DetailRow
                    label="Current Video"
                    value={`${download.currentVideo}/${download.videoCount}`}
                  />
                )}
              </>
            )}
            {download.completedAt && (
              <DetailRow
                label="Completed"
                value={new Date(download.completedAt).toLocaleString()}
              />
            )}
            {download.plexStatus && (
              <DetailRow label="Plex Status" value={download.plexStatus} badge />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  copyable,
  badge,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}:</span>
      {badge ? (
        <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-white">{value}</span>
      ) : copyable ? (
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-gray-300 hover:text-white truncate max-w-xs"
          title={value}
        >
          {value}
        </button>
      ) : (
        <span className="text-gray-300">{value}</span>
      )}
    </div>
  );
}
```

### Download Progress Component

```typescript
// frontend/src/components/youtube/DownloadProgress.tsx
import { Progress } from '@/components/ui/Progress';
import { formatBytes, formatSpeed, formatETA } from '@/lib/utils/format';

export function DownloadProgress({ download, compact = false }: DownloadProgressProps) {
  const progress = download.progress || 0;
  const hasSize = download.totalSize && download.downloadedSize !== undefined;

  if (compact) {
    return (
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{progress.toFixed(1)}%</span>
          {download.eta && <span>{formatETA(download.eta)}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Progress</span>
        <span className="text-white font-medium">{progress.toFixed(1)}%</span>
      </div>

      <Progress value={progress} className="h-3" />

      {hasSize && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {formatBytes(download.downloadedSize!)} / {formatBytes(download.totalSize!)}
          </span>
          {download.downloadSpeed && <span>{formatSpeed(download.downloadSpeed)}</span>}
        </div>
      )}

      {download.eta && (
        <div className="text-xs text-gray-400">
          Estimated time remaining: {formatETA(download.eta)}
        </div>
      )}

      {download.type === 'playlist' && download.currentVideo && download.videoCount && (
        <div className="mt-2 p-2 bg-gray-700 rounded text-xs">
          <div className="text-gray-400 mb-1">
            Video {download.currentVideo} of {download.videoCount}
          </div>
          {/* Current video title could be shown here if available */}
        </div>
      )}
    </div>
  );
}
```

### Queue Filters Component

```typescript
// frontend/src/components/youtube/QueueFilters.tsx
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

export function QueueFilters({ filters, onChange }: QueueFiltersProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onChange={(value) => onChange({ ...filters, status: value as any })}
          options={[
            { value: 'all', label: 'All Downloads' },
            { value: 'queued', label: 'Queued' },
            { value: 'downloading', label: 'Downloading' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          placeholder="Filter by status"
        />

        {/* Search */}
        <div className="sm:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={filters.search || ''}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Search by title..."
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Download Queue Hook

```typescript
// frontend/src/hooks/useDownloadQueue.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchDownloadQueue, cancelDownload, retryDownload } from '@/lib/api/youtube';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useDownloadQueue(options: { userId?: string; filters: QueueFilters }) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  const queryKey = ['youtube', 'queue', options.userId || 'me', options.filters];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDownloadQueue(options),
    refetchInterval: 5000, // Poll every 5 seconds as backup
  });

  // Real-time progress updates
  useEffect(() => {
    if (!socket) return;

    const handleProgressUpdate = (update: DownloadProgress) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          downloads: old.downloads.map((download) =>
            download.id === update.downloadId
              ? {
                  ...download,
                  progress: update.progress,
                  downloadedSize: update.downloadedSize,
                  totalSize: update.totalSize,
                  downloadSpeed: update.speed,
                  eta: update.eta,
                  currentVideo: update.currentVideo?.index,
                }
              : download
          ),
        };
      });
    };

    const handleStatusUpdate = (update: { downloadId: string; status: DownloadStatus }) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          downloads: old.downloads.map((download) =>
            download.id === update.downloadId ? { ...download, status: update.status } : download
          ),
        };
      });
    };

    socket.on('download:progress', handleProgressUpdate);
    socket.on('download:status', handleStatusUpdate);

    // Subscribe to updates for all downloads in view
    data?.downloads.forEach((download) => {
      socket.emit('subscribe:download', download.id);
    });

    return () => {
      socket.off('download:progress', handleProgressUpdate);
      socket.off('download:status', handleStatusUpdate);

      data?.downloads.forEach((download) => {
        socket.emit('unsubscribe:download', download.id);
      });
    };
  }, [socket, data, queryClient, queryKey]);

  const cancelMutation = useMutation({
    mutationFn: cancelDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'queue'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'queue'] });
    },
  });

  return {
    downloads: data?.downloads || [],
    isLoading,
    cancelDownload: cancelMutation.mutateAsync,
    retryDownload: retryMutation.mutateAsync,
  };
}
```

### Empty Queue Component

```typescript
// frontend/src/components/youtube/EmptyQueue.tsx
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export function EmptyQueue({ filters }: { filters: QueueFilters }) {
  const router = useRouter();

  const hasFilters = filters.status !== 'all' || filters.search;

  if (hasFilters) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No downloads match your filters</p>
        <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 bg-gray-800 rounded-lg">
      <Download className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-white mb-2">No downloads in queue</h3>
      <p className="text-gray-400 mb-6">Start by adding a YouTube video or playlist to download</p>
      <Button onClick={() => router.push('/youtube?tab=download')} variant="primary">
        Add Download
      </Button>
    </div>
  );
}
```

## Utility Functions

```typescript
// frontend/src/lib/utils/format.ts
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatETA(seconds: number): string {
  if (!seconds || seconds === Infinity) return 'Unknown';

  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
```

## Testing Requirements

1. **Queue Display**:

   - All downloads show with correct status
   - Real-time updates reflect immediately
   - Queue positions update correctly
   - Filters work as expected

2. **Progress Tracking**:

   - Progress bars update smoothly
   - Speed calculations are accurate
   - ETA estimates are reasonable
   - Playlist progress shows correctly

3. **Actions**:

   - Cancel stops active downloads
   - Retry requeues failed downloads
   - View in Plex opens correct page
   - Actions disabled in appropriate states

4. **Performance**:
   - Handles many downloads efficiently
   - No memory leaks with real-time updates
   - Smooth animations and transitions

## Performance Considerations

1. **Virtual Scrolling**: For users with many downloads
2. **Debounced Search**: 300ms delay on search input
3. **Optimistic Updates**: Immediate UI feedback
4. **Connection Management**: Cleanup WebSocket subscriptions
5. **Progressive Loading**: Load more on scroll if needed

## Accessibility

- Status announced to screen readers
- Keyboard navigation for all actions
- Progress updates announced periodically
- Clear focus indicators
- Action confirmations

## Related Tasks

- YouTube URL Submission
- Progress Tracking Backend
- Plex Collection Creation
- Download History Archive
