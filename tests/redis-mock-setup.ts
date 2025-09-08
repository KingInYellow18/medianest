/**
 * Redis Mock Setup for Test Environment
 * Provides Redis connection mocking to prevent ECONNREFUSED errors during testing
 */

import { vi } from 'vitest';

// Mock Redis for test environment
export const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  flushall: vi.fn().mockResolvedValue('OK'),
  quit: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

// Mock Redis client creation
vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  };
});

// Mock Redis connection from config
vi.mock('@/config/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
  redis: mockRedis,
}));

export default mockRedis;