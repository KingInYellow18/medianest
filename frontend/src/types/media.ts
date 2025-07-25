export interface Genre {
  id: number;
  name: string;
}

export interface MediaAvailability {
  status: 'available' | 'partial' | 'requested' | 'processing' | 'unavailable';
  plexUrl?: string;
  seasons?: SeasonAvailability[]; // TV only
  requestedBy?: string;
  requestedAt?: Date;
}

export interface SeasonAvailability {
  seasonNumber: number;
  status: 'available' | 'partial' | 'unavailable';
  episodes: EpisodeAvailability[];
}

export interface EpisodeAvailability {
  episodeNumber: number;
  available: boolean;
}

export interface MediaSearchResult {
  id: number;
  tmdbId: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: Genre[];
  runtime?: number; // movies only
  numberOfSeasons?: number; // TV only
  status?: string; // TV only
  availability: MediaAvailability;
}

export interface MediaSearchResponse {
  results: MediaSearchResult[];
  totalResults: number;
  page: number;
  totalPages: number;
}

export interface MediaRequestPayload {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  seasons?: number[]; // For TV shows
}

export interface MediaRequest {
  id: string;
  userId: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  status: 'pending' | 'approved' | 'available' | 'failed';
  overseerrId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SearchFilters {
  mediaType: 'all' | 'movie' | 'tv';
  year?: number;
  genre?: number;
}
