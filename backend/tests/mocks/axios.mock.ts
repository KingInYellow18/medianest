import { vi } from 'vitest';
import { AxiosResponse, AxiosRequestConfig } from 'axios';

export const createMockAxios = () => {
  const mockAxios = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    create: vi.fn(),
    defaults: {
      headers: {
        common: {},
        delete: {},
        get: {},
        head: {},
        patch: {},
        post: {},
        put: {}
      },
      timeout: 0,
      baseURL: ''
    },
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn()
      },
      response: {
        use: vi.fn(),
        eject: vi.fn()
      }
    }
  };

  return mockAxios;
};

export const createMockAxiosResponse = <T = any>(data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {} as AxiosRequestConfig
});

export const mockPlexApiResponse = (mockAxios: ReturnType<typeof createMockAxios>) => {
  // Mock Plex PIN generation
  mockAxios.post.mockImplementation(async (url: string) => {
    if (url.includes('plex.tv/pins.xml')) {
      return createMockAxiosResponse(
        '<response><id>12345</id><code>ABCD1234</code><expires_at>2024-01-01</expires_at></response>'
      );
    }
    throw new Error('Unmocked Plex API call');
  });

  // Mock Plex PIN verification
  mockAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('plex.tv/pins/12345.xml')) {
      return createMockAxiosResponse(
        '<response><id>12345</id><code>ABCD1234</code><auth_token>test-auth-token</auth_token></response>'
      );
    }
    if (url.includes('plex.tv/users/account')) {
      return createMockAxiosResponse({
        user: {
          id: 'test-plex-user-id',
          email: 'test@plex.tv',
          username: 'testuser'
        }
      });
    }
    throw new Error('Unmocked Plex API call');
  });
};

export const mockYouTubeApiResponse = (mockAxios: ReturnType<typeof createMockAxios>) => {
  mockAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('youtube.com/watch')) {
      return createMockAxiosResponse({
        title: 'Test YouTube Video',
        duration: 180,
        formats: [
          { quality: '720p', format: 'mp4' },
          { quality: '1080p', format: 'mp4' }
        ]
      });
    }
    throw new Error('Unmocked YouTube API call');
  });
};

export const mockOverseerrApiResponse = (mockAxios: ReturnType<typeof createMockAxios>) => {
  mockAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('/api/v1/status')) {
      return createMockAxiosResponse({
        version: '1.33.2',
        commitTag: 'v1.33.2',
        status: 'OK'
      });
    }
    if (url.includes('/api/v1/request')) {
      return createMockAxiosResponse({
        pageInfo: { page: 1, pages: 1, results: 0, pageSize: 20 },
        results: []
      });
    }
    throw new Error('Unmocked Overseerr API call');
  });
};

export const mockApiErrors = (mockAxios: ReturnType<typeof createMockAxios>) => {
  const networkError = new Error('Network Error');
  (networkError as any).code = 'ECONNREFUSED';
  
  const timeoutError = new Error('Timeout Error');
  (timeoutError as any).code = 'ECONNABORTED';
  
  return {
    networkError: () => mockAxios.get.mockRejectedValue(networkError),
    timeoutError: () => mockAxios.get.mockRejectedValue(timeoutError),
    serverError: () => mockAxios.get.mockRejectedValue({
      response: {
        status: 500,
        data: { error: 'Internal Server Error' }
      }
    }),
    authError: () => mockAxios.get.mockRejectedValue({
      response: {
        status: 401,
        data: { error: 'Unauthorized' }
      }
    })
  };
};