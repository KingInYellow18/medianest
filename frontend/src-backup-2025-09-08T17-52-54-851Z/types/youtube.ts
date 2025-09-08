// Types for YouTube download functionality
export interface YouTubeDownloadRequest {
  id: string;
  userId: string;
  url: string;
  type: 'video' | 'playlist';
  title: string;
  thumbnail?: string;
  duration?: number;
  videoCount?: number; // For playlists
  status: DownloadStatus;
  format: DownloadFormat;
  progress: number;
  queuePosition?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  plexCollectionId?: string;
}

export type DownloadStatus =
  | 'validating'
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadFormat {
  quality: 'best' | '1080p' | '720p' | '480p';
  container: 'mp4' | 'mkv';
}

export interface YouTubeMetadata {
  url: string;
  type: 'video' | 'playlist';
  title: string;
  author: string;
  thumbnail: string;
  duration?: number; // seconds
  videoCount?: number;
  videos?: YouTubeVideoInfo[]; // For playlists
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export interface UserQuota {
  used: number;
  limit: number;
  resetAt: Date;
  canDownload: boolean;
}

export interface AvailableFormats {
  qualities: string[];
  containers: string[];
}
