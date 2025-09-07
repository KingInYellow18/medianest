import { apiClient } from './client';
import {
  MediaSearchResponse,
  MediaRequestPayload,
  MediaRequest,
  MediaAvailability,
} from '@/types/media';

export interface SearchParams {
  query: string;
  mediaType?: 'all' | 'movie' | 'tv';
  year?: number;
  genre?: number;
  page?: number;
}

export async function searchMedia(params: SearchParams): Promise<MediaSearchResponse> {
  const queryParams: Record<string, string> = {
    query: params.query,
  };

  if (params.mediaType && params.mediaType !== 'all') {
    queryParams.type = params.mediaType;
  }
  if (params.year) {
    queryParams.year = params.year.toString();
  }
  if (params.genre) {
    queryParams.genre = params.genre.toString();
  }
  if (params.page) {
    queryParams.page = params.page.toString();
  }

  const response = await apiClient.get<any>('/media/search', { params: queryParams });

  // Check availability for each result
  const resultsWithAvailability = await Promise.all(
    response.data.map(async (item: any) => {
      const availability = await checkAvailability(item.id, item.mediaType);
      return { ...item, availability };
    }),
  );

  return {
    results: resultsWithAvailability,
    totalResults: response.meta?.totalResults || response.data.length,
    page: response.meta?.page || 1,
    totalPages: response.meta?.totalPages || 1,
  };
}

export async function checkAvailability(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<MediaAvailability> {
  try {
    const response = await apiClient.get<any>(`/media/${mediaType}/${tmdbId}`);

    // Map the response to our MediaAvailability interface
    return {
      status: response.mediaInfo?.status || 'unavailable',
      plexUrl: response.mediaInfo?.plexUrl,
      requestedBy: response.mediaInfo?.requestedBy,
      requestedAt: response.mediaInfo?.requestedAt,
      seasons: response.mediaInfo?.seasons,
    };
  } catch (error) {
    // If we can't check availability, assume it's unavailable
    return {
      status: 'unavailable',
    };
  }
}

export async function requestMedia(payload: MediaRequestPayload): Promise<MediaRequest> {
  const response = await apiClient.post<MediaRequest>('/media/request', payload);
  return response;
}

export async function getUserRequests(
  skip = 0,
  take = 20,
): Promise<{ requests: MediaRequest[]; total: number }> {
  const response = await apiClient.get<any>('/media/requests', {
    params: {
      skip: skip.toString(),
      take: take.toString(),
    },
  });

  return {
    requests: response.data || response,
    total: response.meta?.total || response.length,
  };
}

export async function deleteRequest(requestId: string): Promise<void> {
  await apiClient.delete(`/media/requests/${requestId}`);
}
