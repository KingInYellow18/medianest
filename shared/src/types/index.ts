// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Media Types
export interface MediaItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  duration?: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Collection Types
export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: MediaItem[];
  userId: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Download Types
export interface DownloadRequest {
  url: string;
  format?: string;
  quality?: string;
  collectionId?: string;
}

export interface DownloadProgress {
  id: string;
  progress: number;
  speed?: string;
  eta?: string;
  status: 'queued' | 'downloading' | 'completed' | 'error';
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}