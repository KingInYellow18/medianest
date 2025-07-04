// Shared type definitions for MediaNest

export interface User {
  id: string;
  plexId: string;
  plexUsername: string;
  email?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  lastLoginAt?: Date;
  status: 'active' | 'suspended';
}

export interface MediaRequest {
  id: string;
  userId: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId?: string;
  status: 'pending' | 'approved' | 'available' | 'failed';
  overseerrId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ServiceStatus {
  serviceName: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptimePercentage?: number;
}

export interface YouTubeDownload {
  id: string;
  userId: string;
  playlistUrl: string;
  playlistTitle?: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  filePaths?: string[];
  plexCollectionId?: string;
  createdAt: Date;
  completedAt?: Date;
}