import { User, MediaRequest, ServiceStatus, RequestStatus } from '../types';
import { generateId } from './test-helpers';

/**
 * Factory for creating test users
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: generateId('user'),
    plexId: generateId('plex'),
    plexUsername: 'testuser',
    email: 'test@example.com',
    role: 'user',
    plexToken: 'encrypted-token',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    status: 'active',
    ...overrides,
  };
}

/**
 * Factory for creating test media requests
 */
export function createTestMediaRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
  return {
    id: generateId('request'),
    userId: generateId('user'),
    title: 'Test Movie',
    mediaType: 'movie',
    tmdbId: '12345',
    status: RequestStatus.PENDING,
    createdAt: new Date(),
    overseerrId: generateId('overseerr'),
    completedAt: null,
    ...overrides,
  };
}

/**
 * Factory for creating test YouTube downloads
 */
export function createTestYoutubeDownload(
  overrides: Partial<YoutubeDownload> = {},
): YoutubeDownload {
  return {
    id: generateId('download'),
    userId: generateId('user'),
    playlistUrl: 'https://youtube.com/playlist?list=TEST123',
    playlistTitle: 'Test Playlist',
    status: 'queued',
    filePaths: [],
    plexCollectionId: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

/**
 * Factory for creating test service status
 */
export function createTestServiceStatus(overrides: Partial<ServiceStatus> = {}): ServiceStatus {
  return {
    name: 'test-service',
    displayName: 'Test Service',
    url: 'http://localhost:8080',
    status: 'online',
    responseTime: 100,
    uptime: 99.9,
    lastCheck: new Date(),
    error: null,
    ...overrides,
  };
}

/**
 * Factory for creating batch test data
 */
export class TestDataFactory {
  /**
   * Create multiple test users
   */
  static createUsers(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, (_, i) =>
      createTestUser({
        plexUsername: `testuser${i + 1}`,
        email: `test${i + 1}@example.com`,
        ...overrides,
      }),
    );
  }

  /**
   * Create multiple test media requests
   */
  static createMediaRequests(
    count: number,
    userId: string,
    overrides: Partial<MediaRequest> = {},
  ): MediaRequest[] {
    return Array.from({ length: count }, (_, i) =>
      createTestMediaRequest({
        userId,
        title: `Test Movie ${i + 1}`,
        tmdbId: `${12345 + i}`,
        ...overrides,
      }),
    );
  }

  /**
   * Create a complete test dataset
   */
  static createFullDataset() {
    const users = this.createUsers(3);
    const adminUser = createTestUser({ role: 'admin', plexUsername: 'admin' });

    const mediaRequests = [
      ...this.createMediaRequests(5, users[0].id, { status: RequestStatus.PENDING }),
      ...this.createMediaRequests(3, users[0].id, { status: RequestStatus.AVAILABLE }),
      ...this.createMediaRequests(2, users[1].id, { status: RequestStatus.PENDING }),
      ...this.createMediaRequests(1, adminUser.id, { status: RequestStatus.FAILED }),
    ];

    const youtubeDownloads = [
      createTestYoutubeDownload({ userId: users[0].id, status: 'completed' }),
      createTestYoutubeDownload({ userId: users[0].id, status: 'downloading' }),
      createTestYoutubeDownload({ userId: users[1].id, status: 'queued' }),
    ];

    const serviceStatuses = [
      createTestServiceStatus({ name: 'plex', displayName: 'Plex', status: 'online' }),
      createTestServiceStatus({ name: 'overseerr', displayName: 'Overseerr', status: 'online' }),
      createTestServiceStatus({
        name: 'uptime-kuma',
        displayName: 'Uptime Kuma',
        status: 'offline',
      }),
    ];

    return {
      users: [...users, adminUser],
      mediaRequests,
      youtubeDownloads,
      serviceStatuses,
    };
  }
}

/**
 * Create test JWT payload
 */
export function createTestJwtPayload(userId: string, role: 'user' | 'admin' = 'user') {
  return {
    userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };
}

/**
 * Create test error response
 */
export function createTestErrorResponse(code: string, message: string, details: any = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Create test success response
 */
export function createTestSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  };
}
