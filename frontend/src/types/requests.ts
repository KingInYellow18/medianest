import { MediaSearchResult } from './media';

export interface MediaRequest {
  id: string;
  userId: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  status: RequestStatus;
  seasons?: SeasonRequest[];
  requestedAt: Date;
  approvedAt?: Date;
  availableAt?: Date;
  overseerrId?: string;
  deniedReason?: string;
  user?: {
    id: string;
    plexUsername: string;
    email?: string;
  };
}

export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'partially-available'
  | 'available'
  | 'denied'
  | 'failed';

export interface SeasonRequest {
  seasonNumber: number;
  episodes?: number[];
  status: RequestStatus;
}

export interface RequestSubmission {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  seasons?: number[]; // For TV shows
  episodes?: { [seasonNumber: number]: number[] }; // Specific episodes
}

export interface RequestStatusUpdate {
  requestId: string;
  status: RequestStatus;
  updatedAt: Date;
  message?: string;
}

export interface TVShowDetails extends MediaSearchResult {
  mediaType: 'tv';
  numberOfSeasons: number;
  seasons?: SeasonInfo[];
}

export interface SeasonInfo {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
  overview?: string;
  posterPath?: string;
}

export interface RequestFilters {
  status?: RequestStatus | 'all';
  mediaType?: 'movie' | 'tv' | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface UseRequestHistoryOptions {
  userId?: string;
  filters: RequestFilters;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'title' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface RequestHistoryResponse {
  requests: MediaRequest[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface RequestUpdate {
  requestId: string;
  data: Partial<MediaRequest>;
}
