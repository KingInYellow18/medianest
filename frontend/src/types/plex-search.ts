// Types for Plex search functionality
import type { PlexLibrary, PlexMediaItem } from './plex';

export interface PlexSearchQuery {
  query: string;
  libraries?: string[]; // Empty = all libraries
  mediaTypes?: ('movie' | 'show' | 'episode' | 'artist' | 'album' | 'track')[];
  filters?: PlexSearchFilters;
}

export interface PlexSearchFilters {
  year?: { min?: number; max?: number };
  rating?: { min?: number; max?: number };
  genre?: string[];
  actor?: string[];
  director?: string[];
  studio?: string[];
  contentRating?: string[];
  resolution?: string[];
  decade?: number;
}

export interface PlexSearchResults {
  query: string;
  totalResults: number;
  results: PlexSearchResultGroup[];
  suggestions?: string[];
  availableFilters?: AvailableFilters;
}

export interface PlexSearchResultGroup {
  library: PlexLibrary;
  mediaType: string;
  items: PlexMediaItem[];
  totalCount: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'history' | 'suggestion' | 'filter';
  metadata?: Record<string, unknown>;
}

export interface AvailableFilters {
  genres?: string[];
  contentRatings?: string[];
  studios?: string[];
  actors?: string[];
  directors?: string[];
  resolutions?: string[];
  years?: { min: number; max: number };
}

// Re-export types for convenience
export type { PlexLibrary, PlexMediaItem };