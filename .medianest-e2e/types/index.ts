/**
 * TypeScript definitions for MediaNest E2E testing
 * Provides type safety and intellisense for test automation
 */

// Base types
export interface BasePageOptions {
  timeout?: number;
  retries?: number;
}

export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface ClickOptions {
  timeout?: number;
  force?: boolean;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface FillOptions {
  timeout?: number;
  clear?: boolean;
  validate?: boolean;
  noWaitAfter?: boolean;
}

// Authentication types
export interface SignInCredentials {
  username: string;
  password: string;
}

export interface PlexAuthData {
  pin: string;
  sessionId: string;
  authUrl: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

// Service status types
export type ServiceStatus = 'online' | 'offline' | 'loading' | 'error';

export interface ServiceCardData {
  name: string;
  status: ServiceStatus;
  url?: string;
  version?: string;
  lastUpdated?: string;
}

export interface ServiceStatuses {
  plex: ServiceStatus;
  overseerr: ServiceStatus;
  uptimeKuma: ServiceStatus;
}

// Media types
export interface MediaItem {
  title: string;
  year?: string;
  genre?: string;
  rating?: string;
  description?: string;
  poster?: string;
  type: 'movie' | 'tv' | 'music';
}

export interface PlexLibrary {
  id: string;
  title: string;
  type: 'movie' | 'show' | 'artist' | 'photo';
  itemCount: number;
}

export interface PlexCollection {
  id: string;
  title: string;
  description?: string;
  itemCount: number;
  items?: MediaItem[];
}

// Search types
export interface SearchOptions {
  query: string;
  contentType?: 'movies' | 'shows' | 'music' | 'all';
  library?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  ratingMin?: number;
  ratingMax?: number;
  resolution?: '4K' | '1080p' | '720p' | 'SD';
}

export interface SearchResult extends MediaItem {
  available: boolean;
  partiallyAvailable?: boolean;
  requested?: boolean;
}

// Request types
export type RequestStatus = 'pending' | 'approved' | 'in-progress' | 'completed' | 'rejected' | 'failed' | 'cancelled';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RequestType = 'movie' | 'tv' | 'music';

export interface MediaRequest {
  id: string;
  title: string;
  type: RequestType;
  status: RequestStatus;
  priority: RequestPriority;
  user: string;
  date: string;
  notes?: string;
  reason?: string;
  seasons?: number[] | 'all';
  quality?: '4K' | '1080p' | '720p' | 'any';
  language?: string;
}

export interface RequestOptions {
  type?: RequestType;
  quality?: '4K' | '1080p' | '720p' | 'any';
  language?: string;
  priority?: RequestPriority;
  notes?: string;
  reason?: string;
  seasons?: number[] | 'all';
  urgent?: boolean;
}

export interface RequestHistory {
  status: string;
  date: string;
  comment?: string;
  user?: string;
}

export interface RequestDetails {
  title: string;
  description: string;
  notes: string;
  history: RequestHistory[];
}

// Filter types
export interface FilterOptions {
  status?: RequestStatus | 'all';
  type?: RequestType | 'all';
  user?: string | 'all';
  priority?: RequestPriority | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface SortOptions {
  field: 'title' | 'date' | 'status' | 'priority' | 'user' | 'type';
  direction: 'asc' | 'desc';
}

// Statistics types
export interface RequestsStats {
  total: number;
  pending: number;
  approved: number;
  inProgress: number;
  completed: number;
  rejected: number;
  failed: number;
}

// YouTube Downloader types
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';

export interface VideoMetadata {
  title: string;
  duration: string;
  description: string;
  channel: string;
  views: string;
  uploadDate: string;
  thumbnail?: string;
  tags?: string[];
}

export interface DownloadOptions {
  quality?: '4K' | '1080p' | '720p' | '480p' | 'best' | 'worst';
  format?: 'mp4' | 'webm' | 'mkv' | 'best';
  audioOnly?: boolean;
  subtitles?: boolean;
  thumbnail?: boolean;
}

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  status: DownloadStatus;
  progress: number;
  size: string;
  speed?: string;
  eta?: string;
  error?: string;
}

export interface DownloadProgress {
  progress: number;
  speed: string;
  eta: string;
  activeDownloads: number;
}

export interface QuotaInfo {
  used: number;
  remaining: number;
  resetTime: string;
  hasWarning: boolean;
}

export interface DownloadSettings {
  maxConcurrentDownloads?: number;
  downloadPath?: string;
  autoDownload?: boolean;
  defaultQuality?: string;
  defaultFormat?: string;
}

// Navigation types
export interface NavigationItem {
  label: string;
  url: string;
  icon?: string;
  active?: boolean;
}

// Error types
export interface ErrorInfo {
  message: string;
  code?: string;
  details?: string;
  timestamp?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Performance types
export interface PerformanceMetrics {
  loadTime: number;
  renderTime?: number;
  networkTime?: number;
  jsTime?: number;
  memoryUsage?: number;
}

export interface LoadPerformance {
  libraryLoadTime: number;
  searchTime: number;
  navigationTime?: number;
}

// Accessibility types
export interface AccessibilityCheck {
  hasHeadings: boolean;
  hasLabels: boolean;
  hasAltText: boolean;
  keyboardNavigable: boolean;
  ariaCompliant: boolean;
}

// Test data types
export interface TestUser {
  username: string;
  password: string;
  email?: string;
  role?: 'admin' | 'user' | 'moderator';
}

export interface TestMedia {
  title: string;
  year: string;
  type: 'movie' | 'tv' | 'music';
  imdbId?: string;
  tmdbId?: string;
}

export interface TestData {
  users: TestUser[];
  media: TestMedia[];
  urls: {
    validYouTubeUrls: string[];
    invalidUrls: string[];
  };
}

// Configuration types
export interface PageConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  screenshot: boolean;
  video: boolean;
}

export interface TestConfig extends PageConfig {
  parallelTests: boolean;
  maxWorkers: number;
  reporter: string[];
  outputDir: string;
}

// Export utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Re-export common Playwright types for convenience
export type { Page, Locator, BrowserContext, Browser, PlaywrightTestOptions } from '@playwright/test';