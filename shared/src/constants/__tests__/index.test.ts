import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS, SERVICES, SOCKET_EVENTS, ERROR_CODES, RATE_LIMITS } from '../index';

describe('Constants', () => {
  describe('API_ENDPOINTS', () => {
    it('should define all required endpoints', () => {
      expect(API_ENDPOINTS.AUTH.LOGIN).toBe('/api/v1/auth/login');
      expect(API_ENDPOINTS.AUTH.LOGOUT).toBe('/api/v1/auth/logout');
      expect(API_ENDPOINTS.AUTH.SESSION).toBe('/api/v1/auth/session');
      expect(API_ENDPOINTS.AUTH.PLEX.PIN).toBe('/api/v1/auth/plex/pin');
      expect(API_ENDPOINTS.AUTH.PLEX.VERIFY).toBe('/api/v1/auth/plex/verify');
    });

    it('should have consistent versioning', () => {
      const endpoints = Object.values(API_ENDPOINTS)
        .flatMap((group) => Object.values(group))
        .filter((endpoint) => typeof endpoint === 'string');

      endpoints.forEach((endpoint) => {
        expect(endpoint).toMatch(/^\/api\/v1\//);
      });
    });
  });

  describe('SERVICES', () => {
    it('should define all service names', () => {
      expect(SERVICES.PLEX).toBe('plex');
      expect(SERVICES.OVERSEERR).toBe('overseerr');
      expect(SERVICES.UPTIME_KUMA).toBe('uptime-kuma');
    });

    it('should have lowercase service names', () => {
      Object.values(SERVICES).forEach((service) => {
        expect(service).toBe(service.toLowerCase());
      });
    });
  });

  describe('SOCKET_EVENTS', () => {
    it('should define all socket events', () => {
      expect(SOCKET_EVENTS.CONNECTION).toBe('connection');
      expect(SOCKET_EVENTS.DISCONNECT).toBe('disconnect');
      expect(SOCKET_EVENTS.SERVICE_STATUS).toBe('service:status');
      expect(SOCKET_EVENTS.REQUEST_UPDATE).toBe('request:update');
      expect(SOCKET_EVENTS.DOWNLOAD_PROGRESS).toBe('download:progress');
      expect(SOCKET_EVENTS.NOTIFICATION).toBe('notification');
    });

    it('should follow naming convention', () => {
      const events = Object.values(SOCKET_EVENTS);
      events.forEach((event) => {
        expect(event).toMatch(/^[a-z]+(:?[a-z]+)*$/);
      });
    });
  });

  describe('ERROR_CODES', () => {
    it('should define all error codes', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    });

    it('should use uppercase with underscores', () => {
      Object.values(ERROR_CODES).forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe('RATE_LIMITS', () => {
    it('should define all rate limits', () => {
      expect(RATE_LIMITS.API).toEqual({
        windowMs: 60000,
        max: 100,
        keyPrefix: 'rate:api:',
      });

      expect(RATE_LIMITS.YOUTUBE).toEqual({
        windowMs: 3600000,
        max: 5,
        keyPrefix: 'rate:youtube:',
      });

      expect(RATE_LIMITS.MEDIA_REQUEST).toEqual({
        windowMs: 3600000,
        max: 20,
        keyPrefix: 'rate:request:',
      });
    });

    it('should have valid window and max values', () => {
      Object.values(RATE_LIMITS).forEach((limit) => {
        expect(limit.windowMs).toBeGreaterThan(0);
        expect(limit.max).toBeGreaterThan(0);
        expect(limit.keyPrefix).toMatch(/^rate:[a-z]+:$/);
      });
    });

    it('should have appropriate limits for each service', () => {
      // API should have highest rate limit
      expect(RATE_LIMITS.API.max).toBeGreaterThan(RATE_LIMITS.YOUTUBE.max);
      expect(RATE_LIMITS.API.max).toBeGreaterThan(RATE_LIMITS.MEDIA_REQUEST.max);

      // YouTube should have strictest limit
      expect(RATE_LIMITS.YOUTUBE.max).toBeLessThanOrEqual(5);

      // Window sizes should make sense
      expect(RATE_LIMITS.API.windowMs).toBe(60 * 1000); // 1 minute
      expect(RATE_LIMITS.YOUTUBE.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(RATE_LIMITS.MEDIA_REQUEST.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });
  });
});
