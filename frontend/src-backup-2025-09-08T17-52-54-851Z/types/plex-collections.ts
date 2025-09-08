/**
 * Types and interfaces for Plex collection creation and management
 */

export interface PlexCollectionCreation {
  id: string;
  downloadId: string;
  userId: string;
  collectionTitle: string;
  collectionKey?: string;
  librarySection: string;
  status: CollectionStatus;
  videoCount: number;
  processedCount: number;
  videos: PlexCollectionVideo[];
  metadata: CollectionMetadata;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export type CollectionStatus =
  | 'pending'
  | 'creating'
  | 'adding-media'
  | 'updating-metadata'
  | 'completed'
  | 'failed';

export interface PlexCollectionVideo {
  youtubeId: string;
  title: string;
  filePath: string;
  plexKey?: string;
  status: 'pending' | 'added' | 'failed';
  error?: string;
}

export interface CollectionMetadata {
  title: string;
  summary?: string;
  posterUrl?: string;
  backgroundUrl?: string;
  year?: number;
  tags?: string[];
}

export interface CollectionProgress {
  collectionId: string;
  status: CollectionStatus;
  progress: number;
  currentVideo?: string;
  message?: string;
}

export interface CollectionStatusProps {
  downloadId: string;
  onComplete: (collectionKey: string) => void;
}

export interface CollectionProgressProps {
  collection: PlexCollectionCreation;
  compact?: boolean;
}

export interface CollectionManagerProps {
  collections: PlexCollectionCreation[];
  onViewCollection: (collectionKey: string) => void;
}

export interface EmptyCollectionState {
  hasFilters: boolean;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

export interface CollectionDetailModalProps {
  collection: PlexCollectionCreation;
  isOpen: boolean;
  onClose: () => void;
  onViewInPlex: () => void;
}

// API response types
export interface CollectionStatusResponse {
  collection: PlexCollectionCreation;
}

export interface UserCollectionsResponse {
  collections: PlexCollectionCreation[];
  total: number;
}

// Collection creation request
export interface CreateCollectionRequest {
  downloadId: string;
  collectionTitle: string;
  librarySection: string;
  metadata: CollectionMetadata;
}

// Collection update request
export interface UpdateCollectionRequest {
  collectionKey: string;
  metadata: Partial<CollectionMetadata>;
  addVideos?: string[];
  removeVideos?: string[];
}

// WebSocket event types
export interface CollectionProgressEvent {
  type: 'collection:progress';
  collectionId: string;
  status: CollectionStatus;
  progress: number;
  currentVideo?: string;
  message?: string;
}

export interface CollectionStatusEvent {
  type: 'collection:status';
  collectionId: string;
  status: CollectionStatus;
  error?: string;
}

export interface CollectionCompleteEvent {
  type: 'collection:complete';
  collectionId: string;
  collectionKey: string;
  totalVideos: number;
  successCount: number;
  failedCount: number;
}

// Collection step information
export interface CollectionStep {
  step: number;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

// Collection stats for dashboard
export interface CollectionStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  completedToday: number;
}

// Collection filter options
export interface CollectionFilters {
  status?: CollectionStatus | 'all';
  librarySection?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

// Collection sorting options
export type CollectionSortBy = 'createdAt' | 'completedAt' | 'title' | 'videoCount';
export type CollectionSortDirection = 'asc' | 'desc';

export interface CollectionSort {
  by: CollectionSortBy;
  direction: CollectionSortDirection;
}
