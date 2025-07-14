import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '@/middleware/auth';
import { createAuthToken, createExpiredToken, createInvalidToken } from '../../helpers/auth';
import { AuthenticationError, AuthorizationError } from '@medianest/shared';

// Mock the repository
vi.mock('@/repositories/instances', () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid Bearer token', async () => {
      const token = createAuthToken();
      req.headers = { authorization: `Bearer ${token}` };

      const { userRepository } = await import('@/repositories');
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      });

      await authenticate()(req as Request, res as Response, next);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('test-user-id');
      expect(req.user?.role).toBe('user');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate token from cookie', async () => {
      const token = createAuthToken();
      req.cookies = { token };

      const { userRepository } = await import('@/repositories');
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      });

      await authenticate()(req as Request, res as Response, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      const token = createExpiredToken();
      req.headers = { authorization: `Bearer ${token}` };

      await authenticate()(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject invalid token', async () => {
      const token = createInvalidToken();
      req.headers = { authorization: `Bearer ${token}` };

      await authenticate()(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject if no token provided', async () => {
      await authenticate()(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject if user not found', async () => {
      const token = createAuthToken();
      req.headers = { authorization: `Bearer ${token}` };

      const { userRepository } = await import('@/repositories');
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await authenticate()(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject if user is inactive', async () => {
      const token = createAuthToken();
      req.headers = { authorization: `Bearer ${token}` };

      const { userRepository } = await import('@/repositories');
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'inactive',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      });

      await authenticate()(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('requireRole', () => {
    it('should allow user with required role', () => {
      req.user = {
        id: 'admin-user-id',
        plexId: 'plex-admin',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      };

      requireRole('admin')(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      req.user = {
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      };

      requireRole('admin')(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should reject if no user in request', () => {
      req.user = undefined;

      requireRole('admin')(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should allow multiple roles', () => {
      req.user = {
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null,
      };

      requireRole('user', 'admin')(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
