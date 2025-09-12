import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DeviceSessionService } from '@/services/device-session.service';

// Mock dependencies
vi.mock('@/config/database', () => ({
  getDatabase: vi.fn(() => mockDatabase),
}));

vi.mock('@/services/redis.service', () => ({
  redisService: mockRedisService,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDatabase = {
  deviceSession: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockRedisService = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  setex: vi.fn(),
};

describe('DeviceSessionService', () => {
  let service: DeviceSessionService;

  beforeEach(() => {
    service = new DeviceSessionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a new device session successfully', async () => {
      const sessionData = {
        userId: 'user-123',
        deviceId: 'device-456',
        deviceName: 'iPhone 12',
        deviceType: 'mobile',
        userAgent: 'Mozilla/5.0 (iPhone)',
        ipAddress: '192.168.1.1',
        location: 'New York, NY',
      };

      const mockSession = {
        id: 'session-789',
        ...sessionData,
        isActive: true,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.deviceSession.create.mockResolvedValue(mockSession);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.createSession(sessionData);

      expect(mockDatabase.deviceSession.create).toHaveBeenCalledWith({
        data: {
          ...sessionData,
          isActive: true,
          lastActivityAt: expect.any(Date),
        },
      });

      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `device_session:${mockSession.id}`,
        3600,
        JSON.stringify(mockSession),
      );

      expect(result).toEqual(mockSession);
    });

    it('should handle database errors during creation', async () => {
      const sessionData = {
        userId: 'user-123',
        deviceId: 'device-456',
        deviceName: 'iPhone 12',
        deviceType: 'mobile',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockDatabase.deviceSession.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createSession(sessionData)).rejects.toThrow('Database error');
    });

    it('should create session with minimal required data', async () => {
      const sessionData = {
        userId: 'user-123',
        deviceId: 'device-456',
        deviceName: 'Unknown Device',
        deviceType: 'unknown',
        userAgent: '',
        ipAddress: '0.0.0.0',
      };

      const mockSession = {
        id: 'session-789',
        ...sessionData,
        isActive: true,
        location: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.deviceSession.create.mockResolvedValue(mockSession);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.createSession(sessionData);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getActiveSessionsForUser', () => {
    it('should return active sessions for user', async () => {
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          userId,
          deviceId: 'device-1',
          deviceName: 'iPhone',
          isActive: true,
          lastActivityAt: new Date(),
        },
        {
          id: 'session-2',
          userId,
          deviceId: 'device-2',
          deviceName: 'Chrome',
          isActive: true,
          lastActivityAt: new Date(),
        },
      ];

      mockDatabase.deviceSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.getActiveSessionsForUser(userId);

      expect(mockDatabase.deviceSession.findMany).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        orderBy: { lastActivityAt: 'desc' },
      });
      expect(result).toEqual(mockSessions);
    });

    it('should handle database errors', async () => {
      mockDatabase.deviceSession.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getActiveSessionsForUser('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session activity successfully', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.deviceSession.update.mockResolvedValue(mockSession);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.updateSessionActivity(sessionId);

      expect(mockDatabase.deviceSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { lastActivityAt: expect.any(Date) },
      });

      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `device_session:${sessionId}`,
        3600,
        JSON.stringify(mockSession),
      );

      expect(result).toEqual(mockSession);
    });

    it('should handle non-existent session', async () => {
      mockDatabase.deviceSession.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.updateSessionActivity('nonexistent')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const sessionId = 'session-123';
      const userId = 'user-123';

      const mockSession = {
        id: sessionId,
        userId,
        isActive: false,
        revokedAt: new Date(),
      };

      mockDatabase.deviceSession.update.mockResolvedValue(mockSession);
      mockRedisService.del.mockResolvedValue(1);

      const result = await service.revokeSession(sessionId, userId);

      expect(mockDatabase.deviceSession.update).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });

      expect(mockRedisService.del).toHaveBeenCalledWith(`device_session:${sessionId}`);
      expect(result).toEqual(mockSession);
    });

    it('should handle unauthorized revocation attempt', async () => {
      mockDatabase.deviceSession.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.revokeSession('session-123', 'wrong-user')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all user sessions except current', async () => {
      const userId = 'user-123';
      const currentSessionId = 'current-session';

      const mockResult = { count: 3 };

      mockDatabase.deviceSession.updateMany = vi.fn().mockResolvedValue(mockResult);
      mockRedisService.del.mockResolvedValue(3);

      const result = await service.revokeAllUserSessions(userId, currentSessionId);

      expect(mockDatabase.deviceSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true,
          id: { not: currentSessionId },
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockResult);
    });

    it('should revoke all user sessions if no current session specified', async () => {
      const userId = 'user-123';

      const mockResult = { count: 5 };

      mockDatabase.deviceSession.updateMany = vi.fn().mockResolvedValue(mockResult);

      const result = await service.revokeAllUserSessions(userId);

      expect(mockDatabase.deviceSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('getSessionById', () => {
    it('should get session from cache first', async () => {
      const sessionId = 'session-123';
      const cachedSession = {
        id: sessionId,
        userId: 'user-123',
        deviceName: 'iPhone',
        isActive: true,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedSession));

      const result = await service.getSessionById(sessionId);

      expect(mockRedisService.get).toHaveBeenCalledWith(`device_session:${sessionId}`);
      expect(mockDatabase.deviceSession.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual(cachedSession);
    });

    it('should get session from database if not cached', async () => {
      const sessionId = 'session-123';
      const dbSession = {
        id: sessionId,
        userId: 'user-123',
        deviceName: 'iPhone',
        isActive: true,
      };

      mockRedisService.get.mockResolvedValue(null);
      mockDatabase.deviceSession.findFirst.mockResolvedValue(dbSession);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.getSessionById(sessionId);

      expect(mockRedisService.get).toHaveBeenCalledWith(`device_session:${sessionId}`);
      expect(mockDatabase.deviceSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `device_session:${sessionId}`,
        3600,
        JSON.stringify(dbSession),
      );
      expect(result).toEqual(dbSession);
    });

    it('should return null if session not found', async () => {
      const sessionId = 'nonexistent';

      mockRedisService.get.mockResolvedValue(null);
      mockDatabase.deviceSession.findFirst.mockResolvedValue(null);

      const result = await service.getSessionById(sessionId);

      expect(result).toBeNull();
      expect(mockRedisService.setex).not.toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      const sessionId = 'session-123';
      const dbSession = {
        id: sessionId,
        userId: 'user-123',
        deviceName: 'iPhone',
        isActive: true,
      };

      mockRedisService.get.mockRejectedValue(new Error('Cache error'));
      mockDatabase.deviceSession.findFirst.mockResolvedValue(dbSession);

      const result = await service.getSessionById(sessionId);

      expect(result).toEqual(dbSession);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup sessions older than specified hours', async () => {
      const hoursOld = 24;
      const mockResult = { count: 10 };

      mockDatabase.deviceSession.deleteMany.mockResolvedValue(mockResult);

      const result = await service.cleanupExpiredSessions(hoursOld);

      expect(mockDatabase.deviceSession.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { isActive: false },
            {
              lastActivityAt: {
                lt: expect.any(Date),
              },
            },
          ],
        },
      });

      expect(result).toEqual(mockResult);

      // Check that the date calculation is approximately correct
      const callArgs = mockDatabase.deviceSession.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.OR[1].lastActivityAt.lt;
      const expectedDate = new Date();
      expectedDate.setHours(expectedDate.getHours() - hoursOld);
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });

    it('should use default cleanup period of 720 hours (30 days)', async () => {
      const mockResult = { count: 5 };

      mockDatabase.deviceSession.deleteMany.mockResolvedValue(mockResult);

      await service.cleanupExpiredSessions();

      const callArgs = mockDatabase.deviceSession.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.OR[1].lastActivityAt.lt;
      const expectedDate = new Date();
      expectedDate.setHours(expectedDate.getHours() - 720);
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics for user', async () => {
      const userId = 'user-123';

      mockDatabase.deviceSession.count
        .mockResolvedValueOnce(5) // total sessions
        .mockResolvedValueOnce(3); // active sessions

      const result = await service.getSessionStats(userId);

      expect(mockDatabase.deviceSession.count).toHaveBeenCalledTimes(2);
      expect(mockDatabase.deviceSession.count).toHaveBeenNthCalledWith(1, {
        where: { userId },
      });
      expect(mockDatabase.deviceSession.count).toHaveBeenNthCalledWith(2, {
        where: { userId, isActive: true },
      });

      expect(result).toEqual({
        totalSessions: 5,
        activeSessions: 3,
        inactiveSessions: 2,
      });
    });

    it('should handle database errors', async () => {
      mockDatabase.deviceSession.count.mockRejectedValue(new Error('Database error'));

      await expect(service.getSessionStats('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('isSessionActive', () => {
    it('should return true for active session', async () => {
      const sessionId = 'session-123';

      mockRedisService.exists.mockResolvedValue(1);

      const result = await service.isSessionActive(sessionId);

      expect(mockRedisService.exists).toHaveBeenCalledWith(`device_session:${sessionId}`);
      expect(result).toBe(true);
    });

    it('should return false for inactive session', async () => {
      const sessionId = 'session-123';

      mockRedisService.exists.mockResolvedValue(0);

      const result = await service.isSessionActive(sessionId);

      expect(result).toBe(false);
    });

    it('should handle cache errors gracefully', async () => {
      const sessionId = 'session-123';

      mockRedisService.exists.mockRejectedValue(new Error('Cache error'));

      const result = await service.isSessionActive(sessionId);

      expect(result).toBe(false);
    });
  });
});
