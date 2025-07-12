import type {
  YouTubeMetadata,
  YouTubeDownloadRequest,
  DownloadFormat,
  UserQuota,
} from '@/types/youtube';
import type {
  DownloadQueueResponse,
  DownloadQueueItem,
  QueueFilters,
} from '@/types/youtube-queue';

import { getAuthHeaders } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function validateAndFetchMetadata(url: string): Promise<YouTubeMetadata> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Invalid YouTube URL');
  }

  return response.json();
}

export async function queueYouTubeDownload(
  url: string,
  format: DownloadFormat,
): Promise<YouTubeDownloadRequest> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ url, format }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      throw new Error('Download quota exceeded. Please try again later.');
    }
    throw new Error(error.message || 'Failed to queue download');
  }

  return response.json();
}

export async function getUserQuota(): Promise<UserQuota> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/quota`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user quota');
  }

  return response.json();
}

export async function getDownloadQueue(): Promise<YouTubeDownloadRequest[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/downloads`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch download queue');
  }

  return response.json();
}

export interface FetchDownloadQueueOptions {
  userId?: string;
  filters: QueueFilters;
  page?: number;
  limit?: number;
}

export async function fetchDownloadQueue(
  options: FetchDownloadQueueOptions
): Promise<DownloadQueueResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  
  if (options.userId) {
    params.append('userId', options.userId);
  }
  
  if (options.filters.status && options.filters.status !== 'all') {
    params.append('status', options.filters.status);
  }
  
  if (options.filters.search) {
    params.append('search', options.filters.search);
  }
  
  if (options.filters.dateRange) {
    params.append('startDate', options.filters.dateRange.start.toISOString());
    params.append('endDate', options.filters.dateRange.end.toISOString());
  }
  
  if (options.page) {
    params.append('page', options.page.toString());
  }
  
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }

  const response = await fetch(`${API_BASE}/youtube/downloads?${params.toString()}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch download queue');
  }

  return response.json();
}

export async function cancelDownload(downloadId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/downloads/${downloadId}/cancel`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel download');
  }
}

export async function retryDownload(downloadId: string): Promise<YouTubeDownloadRequest> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/downloads/${downloadId}/retry`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to retry download');
  }

  return response.json();
}

export async function checkDuplicateURL(url: string): Promise<{ isDuplicate: boolean; existingDownload?: any }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/youtube/check-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error('Failed to check for duplicate URL');
  }

  return response.json();
}

export async function deleteDownload(downloadId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/downloads/${downloadId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete download');
  }
}

export async function getDownloadDetails(downloadId: string): Promise<DownloadQueueItem> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/youtube/downloads/${downloadId}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get download details');
  }

  return response.json();
}

// Utility function to validate YouTube URL format
export function validateYouTubeURL(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if it's a YouTube domain
    const isYoutube =
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'm.youtube.com';

    if (!isYoutube) return false;

    // Check for video or playlist patterns
    const isVideo = urlObj.pathname === '/watch' && urlObj.searchParams.has('v');
    const isPlaylist = urlObj.searchParams.has('list');
    const isShortUrl = hostname === 'youtu.be' && urlObj.pathname.length > 1;

    return isVideo || isPlaylist || isShortUrl;
  } catch {
    return false;
  }
}
