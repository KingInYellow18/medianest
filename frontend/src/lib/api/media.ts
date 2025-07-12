import {
  MediaSearchResponse,
  MediaRequestPayload,
  MediaRequest,
  MediaAvailability,
} from '@/types/media';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface SearchParams {
  query: string;
  mediaType?: 'all' | 'movie' | 'tv';
  year?: number;
  genre?: number;
  page?: number;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // In a real app, you'd get the token from your auth context or storage
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function searchMedia(params: SearchParams): Promise<MediaSearchResponse> {
  const queryParams = new URLSearchParams({
    query: params.query,
    ...(params.mediaType && params.mediaType !== 'all' && { type: params.mediaType }),
    ...(params.year && { year: params.year.toString() }),
    ...(params.genre && { genre: params.genre.toString() }),
    ...(params.page && { page: params.page.toString() }),
  });

  const response = await fetch(`${API_BASE_URL}/media/search?${queryParams}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to search media');
  }

  const data = await response.json();

  // Check availability for each result
  const resultsWithAvailability = await Promise.all(
    data.data.map(async (item: any) => {
      const availability = await checkAvailability(item.id, item.mediaType);
      return { ...item, availability };
    }),
  );

  return {
    results: resultsWithAvailability,
    totalResults: data.meta?.totalResults || data.data.length,
    page: data.meta?.page || 1,
    totalPages: data.meta?.totalPages || 1,
  };
}

export async function checkAvailability(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<MediaAvailability> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/${mediaType}/${tmdbId}`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      return {
        status: 'unavailable',
      };
    }

    const data = await response.json();

    // Map the response to our MediaAvailability interface
    return {
      status: data.data?.mediaInfo?.status || 'unavailable',
      plexUrl: data.data?.mediaInfo?.plexUrl,
      requestedBy: data.data?.mediaInfo?.requestedBy,
      requestedAt: data.data?.mediaInfo?.requestedAt,
      seasons: data.data?.mediaInfo?.seasons,
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      status: 'unavailable',
    };
  }
}

export async function requestMedia(payload: MediaRequestPayload): Promise<MediaRequest> {
  const response = await fetch(`${API_BASE_URL}/media/request`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to submit media request');
  }

  const data = await response.json();
  return data.data;
}

export async function getUserRequests(
  skip = 0,
  take = 20,
): Promise<{ requests: MediaRequest[]; total: number }> {
  const queryParams = new URLSearchParams({
    skip: skip.toString(),
    take: take.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/media/requests?${queryParams}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user requests');
  }

  const data = await response.json();
  return {
    requests: data.data,
    total: data.meta?.total || data.data.length,
  };
}

export async function deleteRequest(requestId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/media/requests/${requestId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete request');
  }
}
