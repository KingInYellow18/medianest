import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the axios interceptor and client setup
const mockAxios = {
  create: vi.fn(() => mockAxiosInstance),
  defaults: {
    baseURL: '',
    timeout: 10000,
    headers: {},
  },
};

const mockAxiosInstance = {
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  request: vi.fn(),
};

vi.mock('axios', () => ({
  default: mockAxios,
  isAxiosError: vi.fn((error) => error && error.isAxiosError === true),
}));

vi.mock('../../lib/auth/plex-provider', () => ({
  getPlexHeaders: vi.fn(() => ({
    'X-Plex-Client-Identifier': 'test-client',
    'X-Plex-Product': 'MediaNest',
  })),
}));

vi.mock('next-auth/react', () => ({
  getSession: vi.fn(() =>
    Promise.resolve({
      user: { id: '123', name: 'Test User' },
      accessToken: 'test-access-token',
    })
  ),
}));

// Import after mocking
import apiClient from '../../lib/api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create axios instance with correct configuration', () => {
    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: expect.stringContaining('/api'),
      timeout: expect.any(Number),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should setup request interceptor', () => {
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();

    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    expect(typeof requestInterceptor).toBe('function');
  });

  it('should setup response interceptor', () => {
    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();

    const responseInterceptorSuccess = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
    const responseInterceptorError = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    expect(typeof responseInterceptorSuccess).toBe('function');
    expect(typeof responseInterceptorError).toBe('function');
  });

  it('should add auth headers in request interceptor', async () => {
    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const mockConfig = {
      headers: {},
      url: '/test-endpoint',
    };

    const modifiedConfig = await requestInterceptor(mockConfig);

    expect(modifiedConfig.headers).toHaveProperty('Authorization');
    expect(modifiedConfig.headers['Authorization']).toContain('Bearer');
  });

  it('should add plex headers for plex endpoints', async () => {
    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const mockConfig = {
      headers: {},
      url: '/plex/test-endpoint',
    };

    const modifiedConfig = await requestInterceptor(mockConfig);

    expect(modifiedConfig.headers).toHaveProperty('X-Plex-Client-Identifier');
    expect(modifiedConfig.headers).toHaveProperty('X-Plex-Product');
  });

  it('should add request timestamp', async () => {
    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const mockConfig = {
      headers: {},
      url: '/test-endpoint',
    };

    const modifiedConfig = await requestInterceptor(mockConfig);

    expect(modifiedConfig.metadata).toBeDefined();
    expect(modifiedConfig.metadata.startTime).toBeDefined();
    expect(typeof modifiedConfig.metadata.startTime).toBe('number');
  });

  it('should handle successful response in response interceptor', () => {
    const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

    const mockResponse = {
      data: { success: true },
      status: 200,
      config: {
        metadata: { startTime: Date.now() - 100 },
      },
    };

    const result = responseInterceptor(mockResponse);

    expect(result).toBe(mockResponse);
  });

  it('should handle 401 unauthorized error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
      config: { url: '/test-endpoint' },
      isAxiosError: true,
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should handle 403 forbidden error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
      config: { url: '/test-endpoint' },
      isAxiosError: true,
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should handle 429 rate limit error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      response: {
        status: 429,
        data: { message: 'Rate limit exceeded' },
        headers: {
          'retry-after': '60',
        },
      },
      config: { url: '/test-endpoint' },
      isAxiosError: true,
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should handle 500 server error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
      config: { url: '/test-endpoint' },
      isAxiosError: true,
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should handle network error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      message: 'Network Error',
      code: 'NETWORK_ERROR',
      isAxiosError: true,
      config: { url: '/test-endpoint' },
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should handle timeout error', async () => {
    const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const mockError = {
      message: 'Timeout Error',
      code: 'ECONNABORTED',
      isAxiosError: true,
      config: { url: '/test-endpoint' },
    };

    await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should calculate response time', () => {
    const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

    const startTime = Date.now() - 150;
    const mockResponse = {
      data: { success: true },
      status: 200,
      config: {
        metadata: { startTime },
      },
    };

    const result = responseInterceptor(mockResponse);

    expect(result.config.metadata.responseTime).toBeDefined();
    expect(result.config.metadata.responseTime).toBeGreaterThan(0);
  });

  it('should preserve original config in request interceptor', async () => {
    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const mockConfig = {
      method: 'POST',
      url: '/test-endpoint',
      data: { test: 'data' },
      headers: {
        'Custom-Header': 'custom-value',
      },
      timeout: 5000,
    };

    const modifiedConfig = await requestInterceptor(mockConfig);

    expect(modifiedConfig.method).toBe('POST');
    expect(modifiedConfig.url).toBe('/test-endpoint');
    expect(modifiedConfig.data).toEqual({ test: 'data' });
    expect(modifiedConfig.headers['Custom-Header']).toBe('custom-value');
    expect(modifiedConfig.timeout).toBe(5000);
  });

  it('should handle missing session gracefully', async () => {
    // Mock getSession to return null
    const { getSession } = await import('next-auth/react');
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const mockConfig = {
      headers: {},
      url: '/test-endpoint',
    };

    const modifiedConfig = await requestInterceptor(mockConfig);

    // Should not have Authorization header when no session
    expect(modifiedConfig.headers['Authorization']).toBeUndefined();
  });

  it('should handle request interceptor error', async () => {
    const requestErrorInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][1];

    const mockError = new Error('Request setup error');

    await expect(requestErrorInterceptor(mockError)).rejects.toBe(mockError);
  });

  it('should provide the configured axios instance', () => {
    expect(apiClient).toBe(mockAxiosInstance);
  });
});
