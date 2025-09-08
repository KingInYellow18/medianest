/**
 * API client functions for Plex collection management
 */

import type {
  PlexCollectionCreation,
  CollectionStatusResponse,
  UserCollectionsResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  CollectionFilters,
  CollectionSort,
} from '@/types/plex-collections';

const API_BASE_URL = '/api/v1';

/**
 * Get authentication token from storage or context
 */
function getAuthToken(): string {
  // This should be implemented based on your auth system
  // For now, we'll assume it's available in a cookie or localStorage
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('auth-token='))
      ?.split('=')[1] || ''
  );
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message ||
        errorData?.error ||
        `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch collection status for a specific download
 */
export async function fetchCollectionStatus(downloadId: string): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(
    `/youtube/downloads/${downloadId}/collection`
  );
  return response.collection;
}

/**
 * Fetch all collections for the current user
 */
export async function fetchUserCollections(
  filters?: CollectionFilters,
  sort?: CollectionSort
): Promise<UserCollectionsResponse> {
  const searchParams = new URLSearchParams();

  if (filters?.status && filters.status !== 'all') {
    searchParams.append('status', filters.status);
  }
  if (filters?.search) {
    searchParams.append('search', filters.search);
  }
  if (filters?.librarySection) {
    searchParams.append('librarySection', filters.librarySection);
  }
  if (filters?.dateRange) {
    searchParams.append('startDate', filters.dateRange.start.toISOString());
    searchParams.append('endDate', filters.dateRange.end.toISOString());
  }

  if (sort) {
    searchParams.append('sortBy', sort.by);
    searchParams.append('sortDirection', sort.direction);
  }

  const queryString = searchParams.toString();
  const endpoint = `/plex/collections/youtube${queryString ? `?${queryString}` : ''}`;

  return apiRequest<UserCollectionsResponse>(endpoint);
}

/**
 * Create a new Plex collection from a YouTube download
 */
export async function createCollection(
  request: CreateCollectionRequest
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>('/plex/collections', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.collection;
}

/**
 * Update an existing Plex collection
 */
export async function updateCollection(
  request: UpdateCollectionRequest
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(
    `/plex/collections/${request.collectionKey}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    }
  );
  return response.collection;
}

/**
 * Delete a Plex collection
 */
export async function deleteCollection(collectionKey: string): Promise<void> {
  await apiRequest(`/plex/collections/${collectionKey}`, {
    method: 'DELETE',
  });
}

/**
 * Retry failed collection creation
 */
export async function retryCollectionCreation(
  collectionId: string
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(
    `/plex/collections/${collectionId}/retry`,
    {
      method: 'POST',
    }
  );
  return response.collection;
}

/**
 * Cancel an in-progress collection creation
 */
export async function cancelCollectionCreation(collectionId: string): Promise<void> {
  await apiRequest(`/plex/collections/${collectionId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Add items to an existing collection
 */
export async function addItemsToCollection(
  collectionKey: string,
  itemKeys: string[]
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(
    `/plex/collections/${collectionKey}/items`,
    {
      method: 'POST',
      body: JSON.stringify({ itemKeys }),
    }
  );
  return response.collection;
}

/**
 * Remove items from an existing collection
 */
export async function removeItemsFromCollection(
  collectionKey: string,
  itemKeys: string[]
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(
    `/plex/collections/${collectionKey}/items`,
    {
      method: 'DELETE',
      body: JSON.stringify({ itemKeys }),
    }
  );
  return response.collection;
}

/**
 * Get collection creation statistics
 */
export async function fetchCollectionStats(): Promise<{
  total: number;
  active: number;
  completed: number;
  failed: number;
  completedToday: number;
}> {
  return apiRequest('/plex/collections/stats');
}

/**
 * Get available Plex library sections for collection creation
 */
export async function fetchLibrarySections(): Promise<
  Array<{
    key: string;
    title: string;
    type: string;
  }>
> {
  return apiRequest('/plex/libraries');
}

/**
 * Search for media items in Plex to add to collections
 */
export async function searchPlexMedia(
  query: string,
  librarySection?: string
): Promise<
  Array<{
    key: string;
    title: string;
    type: string;
    thumbnail?: string;
    year?: number;
  }>
> {
  const searchParams = new URLSearchParams({ query });
  if (librarySection) {
    searchParams.append('librarySection', librarySection);
  }

  return apiRequest(`/plex/search?${searchParams.toString()}`);
}

/**
 * Get detailed information about a specific collection
 */
export async function fetchCollectionDetail(
  collectionKey: string
): Promise<PlexCollectionCreation> {
  const response = await apiRequest<CollectionStatusResponse>(`/plex/collections/${collectionKey}`);
  return response.collection;
}

/**
 * Export collection data
 */
export async function exportCollection(
  collectionKey: string,
  format: 'json' | 'csv'
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/plex/collections/${collectionKey}/export?format=${format}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}
