/**
 * Mock Service Worker (MSW) server setup for MediaNest frontend integration tests
 * Provides comprehensive API mocking for authentication, media services, and WebSocket connections
 */

import { http, HttpResponse, ws } from 'msw';
import { setupServer } from 'msw/node';

// Mock data types matching MediaNest backend
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

interface MediaService {
  id: string;
  name: string;
  type: 'plex' | 'youtube' | 'jellyfin' | 'emby';
  url: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastChecked: string;
  uptime: number;
  responseTime?: number;
  errorCount: number;
  metadata?: Record<string, any>;
}

interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Mock database
const mockUsers: User[] = [
  {
    id: 'user-123',
    email: 'test@medianest.com',
    name: 'Test User',
    role: 'user',
  },
  {
    id: 'admin-456',
    email: 'admin@medianest.com',
    name: 'Admin User',
    role: 'admin',
  },
];

const mockServices: MediaService[] = [
  {
    id: 'service-1',
    name: 'Plex Server',
    type: 'plex',
    url: 'http://localhost:32400',
    status: 'connected',
    lastChecked: new Date().toISOString(),
    uptime: 0.995,
    responseTime: 150,
    errorCount: 0,
  },
  {
    id: 'service-2',
    name: 'YouTube Downloader',
    type: 'youtube',
    url: 'http://localhost:3001',
    status: 'error',
    lastChecked: new Date(Date.now() - 300000).toISOString(),
    uptime: 0.85,
    responseTime: undefined,
    errorCount: 5,
  },
  {
    id: 'service-3',
    name: 'Jellyfin Server',
    type: 'jellyfin',
    url: 'http://localhost:8096',
    status: 'connecting',
    lastChecked: new Date().toISOString(),
    uptime: 0.0,
    responseTime: undefined,
    errorCount: 1,
  },
];

let currentUser: User | null = null;
let authToken: string | null = null;

// API route handlers
const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (body.email === 'invalid@test.com') {
      return HttpResponse.json(
        {
          message: 'Invalid credentials',
          code: 'AUTH_INVALID_CREDENTIALS',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    if (body.email === 'network-error@test.com') {
      return HttpResponse.json(
        {
          message: 'Network timeout',
          code: 'NETWORK_ERROR',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 500 },
      );
    }

    const user = mockUsers.find((u) => u.email === body.email) || mockUsers[0];
    authToken = `mock-token-${Date.now()}`;
    currentUser = user;

    const response: AuthResponse = {
      user,
      token: authToken,
      refreshToken: `refresh-${authToken}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    };

    return HttpResponse.json(response);
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const authHeader = request.headers.get('authorization');

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (!authHeader || !authHeader.includes('Bearer')) {
      return HttpResponse.json(
        {
          message: 'Missing or invalid authorization header',
          code: 'AUTH_INVALID_TOKEN',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    if (!currentUser) {
      return HttpResponse.json(
        {
          message: 'No user session found',
          code: 'AUTH_NO_SESSION',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    authToken = `refreshed-token-${Date.now()}`;

    const response: AuthResponse = {
      user: currentUser,
      token: authToken,
      refreshToken: `refresh-${authToken}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    return HttpResponse.json(response);
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    currentUser = null;
    authToken = null;

    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    const authHeader = request.headers.get('authorization');

    await new Promise((resolve) => setTimeout(resolve, 150));

    if (!authHeader || !authToken || !authHeader.includes(authToken)) {
      return HttpResponse.json(
        {
          message: 'Unauthorized',
          code: 'AUTH_UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    if (!currentUser) {
      return HttpResponse.json(
        {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 404 },
      );
    }

    return HttpResponse.json({ user: currentUser });
  }),

  // Media services endpoints
  http.get('/api/services', async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!authHeader || !authToken || !authHeader.includes(authToken)) {
      return HttpResponse.json(
        {
          message: 'Unauthorized access to services',
          code: 'AUTH_UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    let filteredServices = [...mockServices];

    if (status) {
      filteredServices = filteredServices.filter((service) => service.status === status);
    }

    // Simulate pagination
    const startIndex = (page - 1) * limit;
    const paginatedServices = filteredServices.slice(startIndex, startIndex + limit);

    return HttpResponse.json({
      services: paginatedServices,
      pagination: {
        page,
        limit,
        total: filteredServices.length,
        totalPages: Math.ceil(filteredServices.length / limit),
      },
    });
  }),

  http.get('/api/services/:id', async ({ params, request }) => {
    const authHeader = request.headers.get('authorization');
    const { id } = params;

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (!authHeader || !authToken || !authHeader.includes(authToken)) {
      return HttpResponse.json(
        {
          message: 'Unauthorized',
          code: 'AUTH_UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    const service = mockServices.find((s) => s.id === id);

    if (!service) {
      return HttpResponse.json(
        {
          message: `Service with id ${id} not found`,
          code: 'SERVICE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 404 },
      );
    }

    return HttpResponse.json({ service });
  }),

  http.post('/api/services/:id/test', async ({ params, request }) => {
    const authHeader = request.headers.get('authorization');
    const { id } = params;

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate longer test operation

    if (!authHeader || !authToken || !authHeader.includes(authToken)) {
      return HttpResponse.json(
        {
          message: 'Unauthorized',
          code: 'AUTH_UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    const service = mockServices.find((s) => s.id === id);

    if (!service) {
      return HttpResponse.json(
        {
          message: `Service with id ${id} not found`,
          code: 'SERVICE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 404 },
      );
    }

    // Simulate different test results based on service status
    if (service.status === 'error') {
      return HttpResponse.json(
        {
          message: 'Service test failed - connection timeout',
          code: 'SERVICE_TEST_FAILED',
          details: { responseTime: null, error: 'Connection timeout after 5000ms' },
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 400 },
      );
    }

    return HttpResponse.json({
      success: true,
      responseTime: Math.floor(Math.random() * 500) + 100,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }),

  http.put('/api/services/:id', async ({ params, request }) => {
    const authHeader = request.headers.get('authorization');
    const { id } = params;
    const body = (await request.json()) as Partial<MediaService>;

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!authHeader || !authToken || !authHeader.includes(authToken)) {
      return HttpResponse.json(
        {
          message: 'Unauthorized',
          code: 'AUTH_UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 401 },
      );
    }

    const serviceIndex = mockServices.findIndex((s) => s.id === id);

    if (serviceIndex === -1) {
      return HttpResponse.json(
        {
          message: `Service with id ${id} not found`,
          code: 'SERVICE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        } as ApiError,
        { status: 404 },
      );
    }

    // Update the service
    mockServices[serviceIndex] = {
      ...mockServices[serviceIndex],
      ...body,
      lastChecked: new Date().toISOString(),
    };

    return HttpResponse.json({ service: mockServices[serviceIndex] });
  }),

  // Health check endpoint
  http.get('/api/health', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        queue: 'healthy',
      },
    });
  }),

  // Error simulation endpoints
  http.get('/api/error/500', async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return HttpResponse.json(
      {
        message: 'Internal server error simulation',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      } as ApiError,
      { status: 500 },
    );
  }),

  http.get('/api/error/timeout', async () => {
    // Simulate timeout - never resolve
    await new Promise(() => {});
    return HttpResponse.json({});
  }),

  // Rate limiting simulation
  http.get('/api/rate-limited', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return HttpResponse.json(
      {
        message: 'Too many requests',
        code: 'RATE_LIMITED',
        details: { retryAfter: 60 },
        timestamp: new Date().toISOString(),
      } as ApiError,
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + 60000).toString(),
        },
      },
    );
  }),
];

// WebSocket handlers for real-time updates
const websocketHandlers = [ws.link('ws://localhost:3000/ws'), ws.link('ws://localhost:3001/ws')];

// Create MSW server
export const mswServer = setupServer(...handlers, ...websocketHandlers);

// Test utilities for controlling mock behavior
export const mswUtils = {
  // Reset mock state
  resetMockState: () => {
    currentUser = null;
    authToken = null;
    // Reset services to original state
    mockServices.splice(
      0,
      mockServices.length,
      {
        id: 'service-1',
        name: 'Plex Server',
        type: 'plex' as const,
        url: 'http://localhost:32400',
        status: 'connected' as const,
        lastChecked: new Date().toISOString(),
        uptime: 0.995,
        responseTime: 150,
        errorCount: 0,
      },
      {
        id: 'service-2',
        name: 'YouTube Downloader',
        type: 'youtube' as const,
        url: 'http://localhost:3001',
        status: 'error' as const,
        lastChecked: new Date(Date.now() - 300000).toISOString(),
        uptime: 0.85,
        responseTime: undefined,
        errorCount: 5,
      },
      {
        id: 'service-3',
        name: 'Jellyfin Server',
        type: 'jellyfin' as const,
        url: 'http://localhost:8096',
        status: 'connecting' as const,
        lastChecked: new Date().toISOString(),
        uptime: 0.0,
        responseTime: undefined,
        errorCount: 1,
      },
    );
  },

  // Set authenticated user
  setAuthenticatedUser: (user: User, token?: string) => {
    currentUser = user;
    authToken = token || `mock-token-${Date.now()}`;
  },

  // Get current mock state
  getMockState: () => ({
    currentUser,
    authToken,
    services: [...mockServices],
  }),

  // Update service status
  updateServiceStatus: (serviceId: string, status: MediaService['status']) => {
    const service = mockServices.find((s) => s.id === serviceId);
    if (service) {
      service.status = status;
      service.lastChecked = new Date().toISOString();
    }
  },

  // Add custom service
  addService: (service: MediaService) => {
    mockServices.push(service);
  },

  // Remove service
  removeService: (serviceId: string) => {
    const index = mockServices.findIndex((s) => s.id === serviceId);
    if (index > -1) {
      mockServices.splice(index, 1);
    }
  },
};

export default mswServer;
