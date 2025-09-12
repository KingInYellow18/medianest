/**
 * PlexService Mock Implementation - Aligned with Actual Interface
 * Fixes mock mismatches with real PlexService implementation
 */

import { AppError } from '@medianest/shared';
import { vi } from 'vitest';

import type { Result, success, failure } from '../../../src/types/common';

// Mock PlexClient interface to match actual implementation
export const createMockPlexClient = () => ({
  testConnection: vi.fn().mockResolvedValue({
    friendlyName: 'Mock Plex Server',
    version: '1.32.0',
    platform: 'Linux',
    platformVersion: 'Ubuntu 20.04',
    machineIdentifier: 'mock-machine-id',
  }),
  getLibraries: vi.fn().mockResolvedValue([
    {
      key: '1',
      title: 'Movies',
      type: 'movie',
      agent: 'tv.plex.agents.movie',
      scanner: 'Plex Movie',
      language: 'en',
      uuid: 'mock-movies-uuid',
    },
    {
      key: '2',
      title: 'TV Shows',
      type: 'show',
      agent: 'tv.plex.agents.series',
      scanner: 'Plex TV Series',
      language: 'en',
      uuid: 'mock-tv-uuid',
    },
    {
      key: '3',
      title: 'YouTube Downloads',
      type: 'other',
      agent: 'tv.plex.agents.none',
      scanner: 'Plex Video Files',
      language: 'en',
      uuid: 'mock-youtube-uuid',
    },
  ]),
  getLibraryItems: vi.fn().mockImplementation((libraryKey: string, options?: any) => {
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return Promise.resolve({
      items: Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
        ratingKey: `${libraryKey}-item-${offset + i + 1}`,
        key: `/library/metadata/${libraryKey}-item-${offset + i + 1}`,
        title: `Mock Item ${offset + i + 1}`,
        type: libraryKey === '1' ? 'movie' : libraryKey === '2' ? 'episode' : 'video',
        year: 2020 + (i % 5),
        addedAt: Date.now() - i * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - i * 24 * 60 * 60 * 1000,
        thumb: `/library/metadata/${libraryKey}-item-${offset + i + 1}/thumb`,
        duration: 120000 + i * 1000, // milliseconds
      })),
      totalSize: 100,
      size: Math.min(limit, 20),
      offset,
    });
  }),
  search: vi.fn().mockImplementation((query: string) => {
    return Promise.resolve({
      results: [
        {
          ratingKey: `search-result-1-${query}`,
          key: `/library/metadata/search-result-1-${query}`,
          title: `Search Result for "${query}"`,
          type: 'movie',
          year: 2023,
          thumb: `/library/metadata/search-result-1-${query}/thumb`,
          score: 95,
        },
        {
          ratingKey: `search-result-2-${query}`,
          key: `/library/metadata/search-result-2-${query}`,
          title: `Another Result for "${query}"`,
          type: 'show',
          year: 2022,
          thumb: `/library/metadata/search-result-2-${query}/thumb`,
          score: 87,
        },
      ],
      totalSize: 2,
    });
  }),
  getRecentlyAdded: vi.fn().mockResolvedValue([
    {
      ratingKey: 'recent-1',
      key: '/library/metadata/recent-1',
      title: 'Recently Added Movie 1',
      type: 'movie',
      year: 2024,
      addedAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
      thumb: '/library/metadata/recent-1/thumb',
    },
    {
      ratingKey: 'recent-2',
      key: '/library/metadata/recent-2',
      title: 'Recently Added Episode 1',
      type: 'episode',
      year: 2024,
      addedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      thumb: '/library/metadata/recent-2/thumb',
    },
  ]),
  refreshLibrary: vi.fn().mockResolvedValue(undefined),
  scanDirectory: vi.fn().mockResolvedValue(undefined),
  getCollections: vi.fn().mockImplementation((libraryKey: string) => {
    return Promise.resolve([
      {
        ratingKey: `${libraryKey}-collection-1`,
        key: `/library/collections/${libraryKey}-collection-1`,
        title: 'Marvel Movies',
        type: 'collection',
        childCount: 25,
        addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        thumb: `/library/collections/${libraryKey}-collection-1/thumb`,
      },
      {
        ratingKey: `${libraryKey}-collection-2`,
        key: `/library/collections/${libraryKey}-collection-2`,
        title: 'Top Rated',
        type: 'collection',
        childCount: 50,
        addedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
        thumb: `/library/collections/${libraryKey}-collection-2/thumb`,
      },
    ]);
  }),
  getCollectionDetails: vi.fn().mockImplementation((collectionKey: string) => {
    return Promise.resolve({
      ratingKey: collectionKey,
      key: `/library/collections/${collectionKey}`,
      title: 'Mock Collection Details',
      summary: 'Mock collection summary',
      childCount: 10,
      items: Array.from({ length: 10 }, (_, i) => ({
        ratingKey: `${collectionKey}-item-${i + 1}`,
        title: `Collection Item ${i + 1}`,
        type: 'movie',
        year: 2020 + i,
        thumb: `/library/metadata/${collectionKey}-item-${i + 1}/thumb`,
      })),
    });
  }),
  createCollection: vi.fn().mockResolvedValue(undefined),
});

// Mock success/failure Result types
const mockSuccess = <T>(data: T): Result<T, AppError> => ({ success: true, data });
const mockFailure = <E>(error: E): Result<any, E> => ({ success: false, error });

// Enhanced PlexService mock with correct interface
export const createMockPlexService = () => {
  const mockClients = new Map();
  const mockPlexClient = createMockPlexClient();

  const plexService = {
    // Core method that returns Result<PlexClient, AppError>
    getClientForUser: vi.fn().mockImplementation(async (userId: string) => {
      // Simulate different user scenarios
      if (userId.includes('no-plex-token')) {
        return mockFailure(
          new AppError('PLEX_USER_NOT_FOUND', 'User not found or missing Plex token', 401),
        );
      }

      if (userId.includes('plex-config-missing')) {
        return mockFailure(new AppError('PLEX_CONFIG_MISSING', 'Plex server not configured', 500));
      }

      if (userId.includes('connection-failed')) {
        return mockFailure(
          new AppError('PLEX_CONNECTION_FAILED', 'Failed to connect to Plex server', 503),
        );
      }

      // Return successful client
      return mockSuccess(mockPlexClient);
    }),

    // Cached methods
    getServerInfo: vi.fn().mockImplementation(async (userId: string) => {
      const clientResult = await plexService.getClientForUser(userId);
      if (!clientResult.success) {
        throw clientResult.error;
      }
      return clientResult.data.testConnection();
    }),

    getLibraries: vi.fn().mockImplementation(async (userId: string) => {
      const clientResult = await plexService.getClientForUser(userId);
      if (!clientResult.success) {
        throw clientResult.error;
      }
      return clientResult.data.getLibraries();
    }),

    getLibraryItems: vi
      .fn()
      .mockImplementation(
        async (
          userId: string,
          libraryKey: string,
          options?: { offset?: number; limit?: number },
        ) => {
          const clientResult = await plexService.getClientForUser(userId);
          if (!clientResult.success) {
            throw clientResult.error;
          }
          return clientResult.data.getLibraryItems(libraryKey, options);
        },
      ),

    search: vi.fn().mockImplementation(async (userId: string, query: string) => {
      const clientResult = await plexService.getClientForUser(userId);
      if (!clientResult.success) {
        throw clientResult.error;
      }
      return clientResult.data.search(query);
    }),

    getRecentlyAdded: vi.fn().mockImplementation(async (userId: string) => {
      const clientResult = await plexService.getClientForUser(userId);
      if (!clientResult.success) {
        throw clientResult.error;
      }
      return clientResult.data.getRecentlyAdded();
    }),

    // Library management
    refreshLibrary: vi.fn().mockImplementation(async (userId: string, libraryKey: string) => {
      const clientResult = await plexService.getClientForUser(userId);
      if (!clientResult.success) {
        throw clientResult.error;
      }
      await clientResult.data.refreshLibrary(libraryKey);
    }),

    scanDirectory: vi
      .fn()
      .mockImplementation(async (userId: string, libraryKey: string, directory: string) => {
        const clientResult = await plexService.getClientForUser(userId);
        if (!clientResult.success) {
          throw clientResult.error;
        }
        await clientResult.data.scanDirectory(libraryKey, directory);
      }),

    // Collections
    getCollections: vi
      .fn()
      .mockImplementation(
        async (
          userId: string,
          libraryKey: string,
          options?: { search?: string; sort?: string },
        ) => {
          const clientResult = await plexService.getClientForUser(userId);
          if (!clientResult.success) {
            throw clientResult.error;
          }

          let collections = await clientResult.data.getCollections(libraryKey);

          // Apply search filter if provided
          if (options?.search) {
            const searchLower = options.search.toLowerCase();
            collections = collections.filter((collection: any) =>
              collection.title.toLowerCase().includes(searchLower),
            );
          }

          // Apply sorting if provided
          if (options?.sort) {
            collections = [...collections].sort((a: any, b: any) => {
              switch (options.sort) {
                case 'title':
                  return a.title.localeCompare(b.title);
                case 'addedAt':
                  return b.addedAt - a.addedAt;
                case 'childCount':
                  return b.childCount - a.childCount;
                default:
                  return 0;
              }
            });
          }

          return collections;
        },
      ),

    getCollectionDetails: vi
      .fn()
      .mockImplementation(async (userId: string, collectionKey: string) => {
        const clientResult = await plexService.getClientForUser(userId);
        if (!clientResult.success) {
          throw clientResult.error;
        }
        return clientResult.data.getCollectionDetails(collectionKey);
      }),

    createCollection: vi
      .fn()
      .mockImplementation(
        async (userId: string, libraryKey: string, title: string, items: string[] = []) => {
          const clientResult = await plexService.getClientForUser(userId);
          if (!clientResult.success) {
            throw clientResult.error;
          }
          await clientResult.data.createCollection(libraryKey, title, items);
        },
      ),

    // YouTube library helper
    findYouTubeLibrary: vi.fn().mockImplementation(async (userId: string) => {
      const libraries = await plexService.getLibraries(userId);

      // Look for YouTube library
      const youtubeLib = libraries.find(
        (lib: any) =>
          lib.title.toLowerCase().includes('youtube') ||
          lib.type === 'youtube' ||
          lib.type === 'other',
      );

      if (youtubeLib) {
        return youtubeLib.key;
      }

      // Fallback to 'Other Videos' or similar
      const otherLib = libraries.find(
        (lib: any) =>
          lib.title.toLowerCase().includes('other') || lib.title.toLowerCase().includes('video'),
      );

      return otherLib ? otherLib.key : null;
    }),

    // Cache management
    clearUserCache: vi.fn().mockImplementation((userId: string) => {
      // Mock cache clearing
      console.log(`[MOCK] Cleared Plex cache for user: ${userId}`);
    }),

    // Client cleanup timer
    startCleanupTimer: vi.fn().mockImplementation(() => {
      // Mock timer setup - in real implementation this would set up interval
      console.log('[MOCK] Started Plex client cleanup timer');
    }),
  };

  return plexService;
};

// Factory for creating PlexService instances
export const createMockPlexServiceFactory = () => {
  return vi.fn().mockImplementation(() => createMockPlexService());
};

// Setup PlexService mocks
export const setupPlexServiceMocks = () => {
  const mockPlexService = createMockPlexService();

  vi.mock('../../../src/services/plex.service', () => ({
    PlexService: vi.fn().mockImplementation(() => mockPlexService),
    plexService: mockPlexService,
  }));

  return mockPlexService;
};

// Test scenario helpers for PlexService
export const createPlexTestScenarios = () => ({
  validUser: {
    userId: 'user-with-plex-token',
    expectedSuccess: true,
  },
  userWithoutPlexToken: {
    userId: 'no-plex-token-user',
    expectedError: 'PLEX_USER_NOT_FOUND',
  },
  missingPlexConfig: {
    userId: 'plex-config-missing-user',
    expectedError: 'PLEX_CONFIG_MISSING',
  },
  connectionFailure: {
    userId: 'connection-failed-user',
    expectedError: 'PLEX_CONNECTION_FAILED',
  },
  libraryOperations: {
    userId: 'user-with-plex-token',
    libraryKey: '1',
    searchQuery: 'Avengers',
    collectionName: 'Marvel Movies',
  },
});

// Reset PlexService mocks
export const resetPlexServiceMocks = (
  mockPlexService: ReturnType<typeof createMockPlexService>,
) => {
  Object.values(mockPlexService).forEach((method) => {
    if (method && typeof method.mockReset === 'function') {
      method.mockReset();
    }
  });

  // Restore default implementations
  mockPlexService.getClientForUser.mockImplementation(async (userId: string) => {
    if (userId.includes('no-plex-token')) {
      return mockFailure(
        new AppError('PLEX_USER_NOT_FOUND', 'User not found or missing Plex token', 401),
      );
    }
    return mockSuccess(createMockPlexClient());
  });
};

// Performance monitoring mocks for PlexService
export const createMockPlexPerformanceMetrics = () => ({
  cacheHitRate: vi.fn().mockReturnValue(0.85),
  averageResponseTime: vi.fn().mockReturnValue(250),
  activeConnections: vi.fn().mockReturnValue(5),
  errorRate: vi.fn().mockReturnValue(0.02),
});

// Error simulation helpers
export const simulatePlexErrors = {
  networkTimeout: (mockService: ReturnType<typeof createMockPlexService>) => {
    mockService.getClientForUser.mockRejectedValue(new Error('Network timeout'));
  },

  authenticationFailure: (mockService: ReturnType<typeof createMockPlexService>) => {
    mockService.getClientForUser.mockResolvedValue(
      mockFailure(new AppError('PLEX_AUTH_FAILED', 'Invalid Plex token', 401)),
    );
  },

  serverUnavailable: (mockService: ReturnType<typeof createMockPlexService>) => {
    mockService.getClientForUser.mockResolvedValue(
      mockFailure(new AppError('PLEX_SERVER_UNAVAILABLE', 'Plex server is unavailable', 503)),
    );
  },
};

export default createMockPlexService;
