import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationDatabaseService } from '@/services/notification-database.service';

// Mock dependencies
vi.mock('@/config/database', () => ({
  getDatabase: vi.fn(() => mockDatabase),
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
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('NotificationDatabaseService', () => {
  let service: NotificationDatabaseService;

  beforeEach(() => {
    service = new NotificationDatabaseService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'REQUEST_APPROVED',
        title: 'Request Approved',
        message: 'Your media request has been approved',
        metadata: { requestId: 'req-123' },
      };

      const mockNotification = {
        id: 'notif-123',
        ...notificationData,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification(notificationData);

      expect(mockDatabase.notification.create).toHaveBeenCalledWith({
        data: {
          ...notificationData,
          read: false,
        },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should handle database errors during creation', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'REQUEST_APPROVED',
        title: 'Request Approved',
        message: 'Your media request has been approved',
      };

      mockDatabase.notification.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createNotification(notificationData)).rejects.toThrow('Database error');
    });

    it('should create notification with minimal data', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'SYSTEM_ALERT',
        title: 'Alert',
        message: 'System alert message',
      };

      const mockNotification = {
        id: 'notif-123',
        ...notificationData,
        read: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification(notificationData);

      expect(result).toEqual(mockNotification);
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications with default pagination', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        {
          id: 'notif-1',
          userId,
          type: 'REQUEST_APPROVED',
          title: 'Request 1',
          message: 'Message 1',
          read: false,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId,
          type: 'REQUEST_DENIED',
          title: 'Request 2',
          message: 'Message 2',
          read: true,
          createdAt: new Date(),
        },
      ];

      mockDatabase.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications(userId);

      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should get user notifications with custom pagination', async () => {
      const userId = 'user-123';
      const options = { limit: 10, offset: 20 };

      mockDatabase.notification.findMany.mockResolvedValue([]);

      await service.getUserNotifications(userId, options);

      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should filter unread notifications only', async () => {
      const userId = 'user-123';
      const options = { unreadOnly: true };

      mockDatabase.notification.findMany.mockResolvedValue([]);

      await service.getUserNotifications(userId, options);

      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should handle database errors during fetch', async () => {
      mockDatabase.notification.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserNotifications('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read successfully', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      const mockNotification = {
        id: notificationId,
        userId,
        read: true,
        updatedAt: new Date(),
      };

      mockDatabase.notification.update.mockResolvedValue(mockNotification);

      const result = await service.markNotificationAsRead(notificationId, userId);

      expect(mockDatabase.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
        data: { read: true, updatedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should handle non-existent notification', async () => {
      mockDatabase.notification.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.markNotificationAsRead('nonexistent', 'user-123')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      const userId = 'user-123';
      const mockResult = { count: 5 };

      mockDatabase.notification.updateMany = vi.fn().mockResolvedValue(mockResult);

      const result = await service.markAllNotificationsAsRead(userId);

      expect(mockDatabase.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        data: { read: true, updatedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle database errors', async () => {
      mockDatabase.notification.updateMany = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.markAllNotificationsAsRead('user-123')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      const mockNotification = {
        id: notificationId,
        userId,
      };

      mockDatabase.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.deleteNotification(notificationId, userId);

      expect(mockDatabase.notification.delete).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should handle non-existent notification', async () => {
      mockDatabase.notification.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.deleteNotification('nonexistent', 'user-123')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      const userId = 'user-123';
      const expectedCount = 3;

      mockDatabase.notification.count.mockResolvedValue(expectedCount);

      const result = await service.getUnreadCount(userId);

      expect(mockDatabase.notification.count).toHaveBeenCalledWith({
        where: { userId, read: false },
      });
      expect(result).toBe(expectedCount);
    });

    it('should handle database errors', async () => {
      mockDatabase.notification.count.mockRejectedValue(new Error('Database error'));

      await expect(service.getUnreadCount('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete notifications older than specified days', async () => {
      const days = 30;
      const mockResult = { count: 10 };

      mockDatabase.notification.deleteMany = vi.fn().mockResolvedValue(mockResult);

      const result = await service.deleteOldNotifications(days);

      expect(mockDatabase.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(mockResult);

      // Check that the date calculation is approximately correct (within 1 minute)
      const callArgs = mockDatabase.notification.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - days);
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });

    it('should use default of 90 days if no days specified', async () => {
      const mockResult = { count: 5 };

      mockDatabase.notification.deleteMany = vi.fn().mockResolvedValue(mockResult);

      await service.deleteOldNotifications();

      const callArgs = mockDatabase.notification.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 90);
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });
  });

  describe('createBulkNotifications', () => {
    it('should create multiple notifications in a transaction', async () => {
      const notifications = [
        {
          userId: 'user-1',
          type: 'REQUEST_APPROVED',
          title: 'Request 1',
          message: 'Message 1',
        },
        {
          userId: 'user-2',
          type: 'REQUEST_APPROVED',
          title: 'Request 2',
          message: 'Message 2',
        },
      ];

      const mockCreatedNotifications = notifications.map((notif, index) => ({
        id: `notif-${index + 1}`,
        ...notif,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockDatabase.$transaction.mockResolvedValue(mockCreatedNotifications);

      const result = await service.createBulkNotifications(notifications);

      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedNotifications);
    });

    it('should handle empty notifications array', async () => {
      const result = await service.createBulkNotifications([]);
      expect(result).toEqual([]);
      expect(mockDatabase.$transaction).not.toHaveBeenCalled();
    });

    it('should handle transaction failures', async () => {
      const notifications = [
        {
          userId: 'user-1',
          type: 'REQUEST_APPROVED',
          title: 'Request 1',
          message: 'Message 1',
        },
      ];

      mockDatabase.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.createBulkNotifications(notifications)).rejects.toThrow(
        'Transaction failed',
      );
    });
  });

  describe('getNotificationsByType', () => {
    it('should get notifications by type', async () => {
      const userId = 'user-123';
      const type = 'REQUEST_APPROVED';
      const mockNotifications = [
        {
          id: 'notif-1',
          userId,
          type,
          title: 'Request 1',
          message: 'Message 1',
        },
      ];

      mockDatabase.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getNotificationsByType(userId, type);

      expect(mockDatabase.notification.findMany).toHaveBeenCalledWith({
        where: { userId, type },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should handle database errors', async () => {
      mockDatabase.notification.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getNotificationsByType('user-123', 'REQUEST_APPROVED')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
