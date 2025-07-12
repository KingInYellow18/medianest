import { PlexLibrary, PlexLibraryResponse, PlexMediaItem } from '@/types/plex';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function getAuthHeaders(): Promise<HeadersInit> {
  // In Next.js with NextAuth, we can get the token from the session
  const response = await fetch('/api/auth/session');
  const session = await response.json();

  return {
    'Content-Type': 'application/json',
    ...(session?.accessToken && { Authorization: `Bearer ${session.accessToken}` }),
  };
}

export async function fetchPlexServerInfo() {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/plex/server`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch Plex server info');
  }

  const data = await response.json();
  return data.data;
}

export async function fetchLibraries(): Promise<PlexLibrary[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/plex/libraries`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch libraries');
  }

  const data = await response.json();

  // Filter to only include Movies, TV Shows, and YouTube libraries
  const allowedTypes = ['movie', 'show'];
  return data.data
    .filter(
      (library: any) =>
        allowedTypes.includes(library.type) || library.title.toLowerCase() === 'youtube',
    )
    .map((lib: any) => ({
      ...lib,
      type: lib.title.toLowerCase() === 'youtube' ? 'youtube' : lib.type,
      updatedAt: new Date(lib.updatedAt * 1000),
    }));
}

export async function fetchLibraryItems(
  libraryKey: string,
  params: {
    sort?: string;
    filters?: Record<string, any>;
    offset?: number;
    limit?: number;
  },
): Promise<PlexLibraryResponse> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams({
    offset: String(params.offset || 0),
    limit: String(params.limit || 50),
  });

  // Add filters to search params
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }

  if (params.sort) {
    searchParams.append('sort', params.sort);
  }

  const response = await fetch(`${API_BASE}/plex/libraries/${libraryKey}/items?${searchParams}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch library items');
  }

  const data = await response.json();

  return {
    items: data.data.map(transformPlexItem),
    totalSize: data.meta.total,
  };
}

export async function searchLibrary(libraryKey: string, query: string): Promise<PlexMediaItem[]> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams({ query });

  const response = await fetch(`${API_BASE}/plex/search?${searchParams}`, { headers });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const data = await response.json();

  // Filter results to only include items from the specified library
  return data.data
    .filter((item: any) => item.librarySectionID === libraryKey)
    .map(transformPlexItem);
}

export async function fetchRecentlyAdded(
  libraryKey?: string,
  params: { limit?: number } = {},
): Promise<PlexMediaItem[]> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams({
    limit: String(params.limit || 20),
  });

  if (libraryKey) {
    searchParams.append('libraryKey', libraryKey);
  }

  const response = await fetch(`${API_BASE}/plex/recently-added?${searchParams}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch recently added');
  }

  const data = await response.json();
  return data.data.map(transformPlexItem);
}

// Transform backend Plex item to frontend format
function transformPlexItem(item: any): PlexMediaItem {
  return {
    id: item.ratingKey,
    key: item.key,
    title: item.title,
    originalTitle: item.originalTitle,
    type: item.type,
    summary: item.summary,
    year: item.year,
    rating: item.rating,
    duration: item.duration,
    thumb: item.thumb,
    art: item.art,
    addedAt: new Date(item.addedAt * 1000),
    updatedAt: new Date(item.updatedAt * 1000),
    viewCount: item.viewCount,
    lastViewedAt: item.lastViewedAt ? new Date(item.lastViewedAt * 1000) : undefined,
    viewOffset: item.viewOffset,
    tagline: item.tagline,
    contentRating: item.contentRating,
    seasonCount: item.childCount,
    episodeCount: item.leafCount,
    genres: item.Genre?.map((g: any) => g.tag) || [],
    directors: item.Director?.map((d: any) => d.tag) || [],
    actors: item.Role?.map((r: any) => r.tag) || [],
    studio: item.studio,
  };
}
