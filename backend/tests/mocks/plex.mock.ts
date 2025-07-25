import { vi } from 'vitest';

export const createMockPlexClient = () => ({
  authenticate: vi.fn(),
  getLibraries: vi.fn(),
  getLibraryContent: vi.fn(),
  getMetadata: vi.fn(),
  search: vi.fn(),
  getServerInfo: vi.fn(),
  getUserInfo: vi.fn(),
  refreshToken: vi.fn(),
  checkConnection: vi.fn()
});

export const mockPlexHealthy = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.checkConnection.mockResolvedValue({
    status: 'healthy',
    version: '1.40.0.7998',
    machineIdentifier: 'test-server-id'
  });
  
  mockPlexClient.getServerInfo.mockResolvedValue({
    name: 'Test Plex Server',
    version: '1.40.0.7998',
    status: 'online'
  });
};

export const mockPlexUnhealthy = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.checkConnection.mockRejectedValue(new Error('Plex server unreachable'));
  mockPlexClient.getServerInfo.mockRejectedValue(new Error('Connection timeout'));
};

export const mockPlexLibraries = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.getLibraries.mockResolvedValue([
    {
      key: '1',
      title: 'Movies',
      type: 'movie',
      agent: 'tv.plex.agents.movie',
      scanner: 'Plex Movie'
    },
    {
      key: '2',
      title: 'TV Shows',
      type: 'show',
      agent: 'tv.plex.agents.series',
      scanner: 'Plex TV Series'
    }
  ]);
  
  mockPlexClient.getLibraryContent.mockImplementation(async (libraryKey: string) => {
    if (libraryKey === '1') {
      return [
        {
          key: '/library/metadata/1',
          title: 'Test Movie',
          year: 2023,
          type: 'movie'
        }
      ];
    }
    if (libraryKey === '2') {
      return [
        {
          key: '/library/metadata/2',
          title: 'Test TV Show',
          year: 2023,
          type: 'show'
        }
      ];
    }
    return [];
  });
};

export const mockPlexAuthentication = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.authenticate.mockImplementation(async (token: string) => {
    if (token === 'valid-token') {
      return {
        user: {
          id: 'test-plex-user-id',
          email: 'test@plex.tv',
          username: 'testuser',
          title: 'Test User'
        },
        authToken: 'authenticated-token'
      };
    }
    throw new Error('Invalid token');
  });
  
  mockPlexClient.getUserInfo.mockResolvedValue({
    id: 'test-plex-user-id',
    email: 'test@plex.tv',
    username: 'testuser',
    title: 'Test User'
  });
};

export const mockPlexSearch = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.search.mockImplementation(async (query: string) => {
    if (query.toLowerCase().includes('test')) {
      return [
        {
          key: '/library/metadata/1',
          title: 'Test Movie',
          year: 2023,
          type: 'movie',
          summary: 'A test movie for unit testing'
        },
        {
          key: '/library/metadata/2',
          title: 'Test TV Show',
          year: 2023,
          type: 'show',
          summary: 'A test TV show for unit testing'
        }
      ];
    }
    return [];
  });
};

export const mockPlexMetadata = (mockPlexClient: ReturnType<typeof createMockPlexClient>) => {
  mockPlexClient.getMetadata.mockImplementation(async (key: string) => {
    if (key === '/library/metadata/1') {
      return {
        key,
        title: 'Test Movie',
        year: 2023,
        type: 'movie',
        summary: 'A test movie',
        duration: 7200000, // 2 hours in ms
        addedAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      };
    }
    if (key === '/library/metadata/2') {
      return {
        key,
        title: 'Test TV Show',
        year: 2023,
        type: 'show',
        summary: 'A test TV show',
        childCount: 2,
        addedAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      };
    }
    throw new Error('Metadata not found');
  });
};