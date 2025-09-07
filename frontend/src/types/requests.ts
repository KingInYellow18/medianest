import { MediaSearchResult } from './media';

// Re-export from shared package
export type {
  MediaRequest,
  RequestStatus,
  SeasonRequest,
  RequestSubmission,
  RequestStatusUpdate,
  RequestFilters,
  RequestHistoryOptions,
  RequestHistoryResponse,
} from '@medianest/shared/client';

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

// Local types for frontend-specific needs
export interface RequestUpdate {
  requestId: string;
  data: Partial<MediaRequest>;
}
