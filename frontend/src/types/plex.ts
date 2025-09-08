// Context7 Enhanced Plex Types with Better Type Inference
type PlexLibraryType = 'movie' | 'show' | 'youtube';

export interface PlexLibrary {
  id: string;
  key: string;
  title: string;
  type: PlexLibraryType;
  agent: string;
  scanner: string;
  language: string;
  updatedAt: string; // ISO string for better serialization
  itemCount: number;
  thumb?: string;
  art?: string;
}

type PlexMediaType = 'movie' | 'episode' | 'season' | 'show';
type SortOrder = 'asc' | 'desc';
type PlexSortField = 'title' | 'year' | 'rating' | 'addedAt' | 'lastViewedAt';

export interface PlexMediaItem {
  id: string;
  key: string;
  title: string;
  originalTitle?: string;
  type: PlexMediaType;
  summary?: string;
  year?: number;
  rating?: number;
  duration?: number;
  thumb?: string;
  art?: string;
  addedAt: string; // ISO string
  updatedAt: string; // ISO string
  viewCount?: number;
  lastViewedAt?: Date;
  viewOffset?: number;
  // Movie specific
  tagline?: string;
  contentRating?: string;
  // TV specific
  seasonCount?: number;
  episodeCount?: number;
  // Metadata
  genres?: string[];
  directors?: string[];
  actors?: string[];
  studio?: string;
}

export interface PlexCollectionSummary {
  id: string;
  key: string;
  title: string;
  summary?: string;
  thumb?: string;
  art?: string;
  childCount: number;
  addedAt: string; // ISO string
  updatedAt: string; // ISO string
  collectionSort?: string;
  collectionMode?: string;
}

export interface PlexCollectionDetail extends PlexCollectionSummary {
  items: PlexMediaItem[];
}

export interface CollectionFilters {
  search?: string;
  sort?: 'title' | 'addedAt' | 'childCount';
  minItems?: number;
}

export interface PlexFilters {
  sort?: PlexSortField;
  sortOrder?: SortOrder;
  genre?: string;
  year?: number;
  contentRating?: string;
  resolution?: string;
}

export interface PlexLibraryResponse {
  items: PlexMediaItem[];
  totalSize: number;
}

export interface PlexLibraryMetadata {
  genres: string[];
  years: number[];
  contentRatings: string[];
}

// Admin configuration for which libraries to display
export interface PlexLibraryConfig {
  enabledLibraries: {
    movies: boolean;
    tv: boolean;
    youtube: boolean;
  };
  libraryMappings: {
    movies?: string; // Plex library key for Movies
    tv?: string; // Plex library key for TV Shows
    youtube?: string; // Plex library key for YouTube
  };
}
