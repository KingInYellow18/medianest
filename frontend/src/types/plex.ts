export interface PlexLibrary {
  id: string;
  key: string;
  title: string;
  type: 'movie' | 'show' | 'youtube';
  agent: string;
  scanner: string;
  language: string;
  updatedAt: Date;
  itemCount: number;
  thumb?: string;
  art?: string;
}

export interface PlexMediaItem {
  id: string;
  key: string;
  title: string;
  originalTitle?: string;
  type: 'movie' | 'episode' | 'season' | 'show';
  summary?: string;
  year?: number;
  rating?: number;
  duration?: number;
  thumb?: string;
  art?: string;
  addedAt: Date;
  updatedAt: Date;
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
  addedAt: Date;
  updatedAt: Date;
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
  sort?: 'title' | 'year' | 'rating' | 'addedAt' | 'lastViewedAt';
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
