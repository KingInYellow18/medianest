export interface DownloadQueueItem {
  id: string;
  userId: string;
  url: string;
  title: string;
  type: 'video' | 'playlist';
  format: {
    quality: string;
    container: string;
  };
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress?: number; // 0-100
  queuePosition?: number;
  downloadSpeed?: number; // bytes/sec
  eta?: number; // seconds
  downloadedSize?: number; // bytes
  totalSize?: number; // bytes
  currentVideo?: number; // For playlist progress
  videoCount?: number; // Total videos in playlist
  retryCount?: number;
  error?: string;
  thumbnail?: string;
  plexStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  plexCollectionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface QueueFilters {
  status?: 'all' | 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
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

export interface QueueStats {
  total: number;
  active: number;
  queued: number;
  completed: number;
  failed: number;
}

export interface DownloadQueueResponse {
  downloads: DownloadQueueItem[];
  stats: QueueStats;
  totalCount: number;
}

export type DownloadStatus = DownloadQueueItem['status'];

// Component prop types
export interface DownloadQueueProps {
  userId?: string; // For admin viewing
}

export interface DownloadCardProps {
  download: DownloadQueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onViewInPlex: (id: string) => void;
}

export interface DownloadProgressProps {
  download: DownloadQueueItem;
  compact?: boolean;
}

export interface QueueFiltersProps {
  filters: QueueFilters;
  onChange: (filters: QueueFilters) => void;
}

export interface EmptyQueueProps {
  filters: QueueFilters;
}