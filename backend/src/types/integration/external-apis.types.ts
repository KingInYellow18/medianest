// External API integration types

// Plex API types
export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  title: string;
  email?: string;
  thumb?: string;
  authenticationToken?: string;
}

export interface PlexAuthPin {
  id: number;
  code: string;
  product: string;
  trusted: boolean;
  clientIdentifier: string;
  location: {
    code: string;
    country: string;
    city: string;
  };
  expiresIn: number;
  createdAt: string;
  expiresAt: string;
  authToken?: string;
  newRegistration?: boolean;
}

export interface PlexAuthResponse {
  authToken: string;
  user: PlexUser;
}

// Overseerr API types
export interface OverseerrUser {
  id: number;
  email: string;
  username?: string;
  plexUsername?: string;
  avatar?: string;
  userType: number;
  permissions: number;
  createdAt: string;
  updatedAt: string;
}

export interface OverseerrMediaRequest {
  id: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  type: 'movie' | 'tv';
  media: {
    id: number;
    mediaType: 'movie' | 'tv';
    tmdbId: number;
    tvdbId?: number;
    imdbId?: string;
    status: number;
  };
  requestedBy: OverseerrUser;
}

export interface OverseerrSearchResult {
  page: number;
  totalPages: number;
  totalResults: number;
  results: Array<{
    id: number;
    mediaType: 'movie' | 'tv';
    title: string;
    originalTitle?: string;
    overview: string;
    posterPath?: string;
    backdropPath?: string;
    voteAverage: number;
    voteCount: number;
    genreIds: number[];
    popularity: number;
    adult: boolean;
    video?: boolean;
    releaseDate?: string;
    firstAirDate?: string;
  }>;
}

// Uptime Kuma types
export interface UptimeKumaMonitor {
  id: number;
  name: string;
  url?: string;
  hostname?: string;
  port?: number;
  type: string;
  interval: number;
  active: boolean;
  tags?: string[];
}

export interface UptimeKumaStatus {
  ok: boolean;
  msg: string;
}

export interface UptimeKumaHeartbeat {
  monitorID: number;
  status: 0 | 1 | 2; // 0: down, 1: up, 2: pending
  time: string;
  msg: string;
  ping?: number;
}

// Base API client types
export interface ApiClientResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiClientError {
  message: string;
  status?: number;
  statusText?: string;
  data?: unknown;
}

export interface ApiClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  baseURL?: string;
}