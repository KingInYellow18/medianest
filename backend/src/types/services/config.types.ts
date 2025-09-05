// Service configuration types

export interface ServiceConfig {
  plex: PlexConfig;
  overseerr: OverseerrConfig;
  uptimeKuma: UptimeKumaConfig;
}

export interface PlexConfig {
  url: string;
  token?: string;
  clientIdentifier?: string;
  product?: string;
  version?: string;
  platform?: string;
  platformVersion?: string;
  device?: string;
  deviceName?: string;
}

export interface OverseerrConfig {
  url: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface UptimeKumaConfig {
  url: string;
  token?: string;
  username?: string;
  password?: string;
  reconnectInterval?: number;
  timeout?: number;
}

// Configuration repository types
export interface ServiceConfigData {
  id?: string;
  serviceName: string;
  configData: Record<string, unknown>;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateServiceConfigOptions {
  serviceName: string;
  configData: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateServiceConfigOptions {
  configData?: Record<string, unknown>;
  isActive?: boolean;
}

// YouTube download configuration
export interface YouTubeDownloadConfig {
  outputPath: string;
  audioFormat?: string;
  videoFormat?: string;
  quality?: string;
  maxFileSize?: number;
  playlistLimit?: number;
}

export interface YouTubeDownloadJob {
  id?: string;
  userId: string;
  playlistUrl: string;
  outputPath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  filePaths?: string[];
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}