import type { CollectionStatus } from '@/types/plex-collections';

/**
 * Get step information from collection status
 */
export function getStepFromStatus(status: CollectionStatus): {
  step: number;
  label: string;
} {
  const steps = {
    pending: { step: 0, label: 'Waiting to start' },
    creating: { step: 1, label: 'Creating collection' },
    'adding-media': { step: 2, label: 'Adding videos' },
    'updating-metadata': { step: 3, label: 'Updating metadata' },
    completed: { step: 4, label: 'Complete' },
    failed: { step: -1, label: 'Failed' },
  } as const;

  return steps[status];
}

/**
 * Get the status of a specific step based on current collection status
 */
export function getStepStatus(
  currentStatus: CollectionStatus,
  targetStep: 'creating' | 'adding-media' | 'updating-metadata'
): 'pending' | 'active' | 'completed' | 'failed' {
  const statusOrder = ['creating', 'adding-media', 'updating-metadata'] as const;
  const currentIndex = statusOrder.indexOf(currentStatus as any);
  const targetIndex = statusOrder.indexOf(targetStep);

  // Handle special cases
  if (currentStatus === 'failed') return 'failed';
  if (currentStatus === 'completed') return 'completed';
  if (currentStatus === 'pending') return 'pending';

  // Normal status progression
  if (currentIndex === targetIndex) return 'active';
  if (currentIndex > targetIndex) return 'completed';
  return 'pending';
}

/**
 * Format collection creation duration
 */
export function formatCollectionDuration(
  createdAt: Date | string,
  completedAt?: Date | string
): string {
  const start = new Date(createdAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const durationMs = end.getTime() - start.getTime();

  if (durationMs < 1000) return 'Less than 1 second';
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)} seconds`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)} minutes`;

  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.round((durationMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Calculate collection success rate
 */
export function calculateSuccessRate(
  processedCount: number,
  videoCount: number
): {
  percentage: number;
  label: string;
} {
  if (videoCount === 0) {
    return { percentage: 0, label: 'No videos' };
  }

  const percentage = Math.round((processedCount / videoCount) * 100);
  return {
    percentage,
    label: `${processedCount}/${videoCount} (${percentage}%)`,
  };
}

/**
 * Determine collection health status based on success rate and errors
 */
export function getCollectionHealth(
  status: CollectionStatus,
  processedCount: number,
  videoCount: number,
  hasErrors: boolean
): 'healthy' | 'warning' | 'error' {
  if (status === 'failed') return 'error';
  if (status === 'completed') {
    if (hasErrors || processedCount < videoCount) return 'warning';
    return 'healthy';
  }
  return 'healthy'; // In-progress collections are considered healthy
}

/**
 * Generate collection poster URL from YouTube thumbnail
 */
export function generateCollectionPosterUrl(thumbnailUrl?: string, fallbackTitle?: string): string {
  // If we have a YouTube thumbnail, use it
  if (thumbnailUrl) {
    // Try to get the highest quality version
    return thumbnailUrl.replace(/\/[^\/]*default\.jpg$/, '/maxresdefault.jpg');
  }

  // Fallback to a generated poster based on title
  if (fallbackTitle) {
    const encoded = encodeURIComponent(fallbackTitle);
    return `/api/generate-poster?title=${encoded}&type=collection`;
  }

  // Ultimate fallback
  return '/images/default-collection-poster.png';
}

/**
 * Sort collections by various criteria
 */
export function sortCollections<
  T extends {
    createdAt: Date | string;
    completedAt?: Date | string;
    collectionTitle: string;
    videoCount: number;
    status: CollectionStatus;
  }
>(
  collections: T[],
  sortBy: 'createdAt' | 'completedAt' | 'title' | 'videoCount' | 'status',
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...collections].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'completedAt':
        const aCompleted = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bCompleted = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        comparison = aCompleted - bCompleted;
        break;
      case 'title':
        comparison = a.collectionTitle.localeCompare(b.collectionTitle);
        break;
      case 'videoCount':
        comparison = a.videoCount - b.videoCount;
        break;
      case 'status':
        const statusOrder = {
          pending: 0,
          creating: 1,
          'adding-media': 2,
          'updating-metadata': 3,
          completed: 4,
          failed: 5,
        };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
    }

    return direction === 'desc' ? -comparison : comparison;
  });
}

/**
 * Filter collections based on criteria
 */
export function filterCollections<
  T extends {
    status: CollectionStatus;
    collectionTitle: string;
    librarySection: string;
    createdAt: Date | string;
  }
>(
  collections: T[],
  filters: {
    status?: CollectionStatus | 'all';
    search?: string;
    librarySection?: string;
    dateRange?: { start: Date; end: Date };
  }
): T[] {
  return collections.filter((collection) => {
    // Status filter
    if (filters.status && filters.status !== 'all' && collection.status !== filters.status) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!collection.collectionTitle.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Library section filter
    if (filters.librarySection && collection.librarySection !== filters.librarySection) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const collectionDate = new Date(collection.createdAt);
      if (collectionDate < filters.dateRange.start || collectionDate > filters.dateRange.end) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get estimated time remaining for collection creation
 */
export function getEstimatedTimeRemaining(
  status: CollectionStatus,
  processedCount: number,
  videoCount: number,
  startTime: Date | string
): string | null {
  if (status === 'completed' || status === 'failed' || videoCount === 0) {
    return null;
  }

  if (processedCount === 0) {
    return 'Calculating...';
  }

  const elapsed = Date.now() - new Date(startTime).getTime();
  const avgTimePerVideo = elapsed / processedCount;
  const remainingVideos = videoCount - processedCount;
  const estimatedRemainingMs = avgTimePerVideo * remainingVideos;

  if (estimatedRemainingMs < 60000) {
    return `< 1 minute`;
  } else if (estimatedRemainingMs < 3600000) {
    return `${Math.round(estimatedRemainingMs / 60000)} minutes`;
  } else {
    const hours = Math.floor(estimatedRemainingMs / 3600000);
    const minutes = Math.round((estimatedRemainingMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}
