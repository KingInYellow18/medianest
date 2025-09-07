import { User, MediaRequest, ServiceStatus, RequestStatus } from '../types';

// Mock user data
export const mockUsers: Partial<User>[] = [
  {
    id: 'user-1',
    plexId: 'plex-123',
    plexUsername: 'testuser',
    email: 'test@example.com',
    role: 'user',
    plexToken: 'mock-plex-token',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
    status: 'active',
  },
  {
    id: 'admin-1',
    plexId: 'plex-admin-456',
    plexUsername: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    plexToken: 'mock-admin-plex-token',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
    status: 'active',
  },
];

// Mock media requests
export const mockMediaRequests: Partial<MediaRequest>[] = [
  {
    id: 'request-1',
    userId: 'user-1',
    title: 'The Matrix',
    mediaType: 'movie',
    tmdbId: '603',
    status: RequestStatus.PENDING,
    createdAt: new Date('2024-01-10'),
    overseerrId: 'overseerr-123',
  },
  {
    id: 'request-2',
    userId: 'user-1',
    title: 'Breaking Bad',
    mediaType: 'tv',
    tmdbId: '1396',
    status: RequestStatus.AVAILABLE,
    createdAt: new Date('2024-01-05'),
    completedAt: new Date('2024-01-06'),
    overseerrId: 'overseerr-456',
  },
];

// Mock service status data
export const mockServiceStatus: ServiceStatus[] = [
  {
    name: 'plex',
    displayName: 'Plex Media Server',
    url: 'http://localhost:32400',
    status: 'online',
    responseTime: 45,
    uptime: 99.9,
    lastCheck: new Date('2024-01-15T10:00:00Z'),
    error: null,
  },
  {
    name: 'overseerr',
    displayName: 'Overseerr',
    url: 'http://localhost:5055',
    status: 'online',
    responseTime: 120,
    uptime: 98.5,
    lastCheck: new Date('2024-01-15T10:00:00Z'),
    error: null,
  },
  {
    name: 'uptime-kuma',
    displayName: 'Uptime Kuma',
    url: 'http://localhost:3001',
    status: 'offline',
    responseTime: null,
    uptime: 95.2,
    lastCheck: new Date('2024-01-15T10:00:00Z'),
    error: 'Connection timeout',
  },
];

// Mock Plex OAuth data
export const mockPlexOAuth = {
  pin: {
    id: '12345',
    code: 'ABCD',
  },
  authToken: 'mock-plex-auth-token',
  userInfo: {
    id: 'plex-user-789',
    username: 'plexuser',
    email: 'plexuser@example.com',
    thumb: 'https://plex.tv/users/avatar.jpg',
  },
};

// Mock JWT tokens
export const mockTokens = {
  validUser:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwNDEyMDAwMCwiZXhwIjoxNzA0MjA2NDAwfQ.mock',
  validAdmin:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbi0xIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzA0MTIwMDAwLCJleHAiOjE3MDQyMDY0MDB9.mock',
  expired:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAwMDAxfQ.mock',
  invalid: 'invalid.jwt.token',
};

// Mock API responses
export const mockApiResponses = {
  success: {
    success: true,
    data: {},
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  },
  error: {
    success: false,
    error: {
      code: 'GENERIC_ERROR',
      message: 'An error occurred',
      details: {},
    },
  },
  unauthorized: {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      details: {},
    },
  },
  rateLimited: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      details: {
        limit: 100,
        window: '60s',
        retryAfter: 45,
      },
    },
  },
};
