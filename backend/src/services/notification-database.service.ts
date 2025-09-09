/**
 * Production Notification Database Service
 * Replaces mock notification data with real database operations
 */
import { executeQuery, executeTransaction } from '../config/database-connection-pool';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  title: string;
  message: string;
  data?: any;
  actions?: {
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }[];
  persistent: boolean;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
  dismissedAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationRecord['type'];
  title: string;
  message: string;
  data?: any;
  actions?: NotificationRecord['actions'];
  persistent?: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  userId?: string;
  type?: NotificationRecord['type'];
  unreadOnly?: boolean;
  persistent?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  recentCount: number;
}

class NotificationDatabaseService {
  /**
   * Create a new notification
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    return executeQuery(async (client) => {
      const notification = await client.notification.create({
        data: {
          id: this.generateNotificationId(),
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          data: input.data ? JSON.stringify(input.data) : null,
          actions: input.actions ? JSON.stringify(input.actions) : null,
          persistent: input.persistent || false,
          expiresAt: input.expiresAt,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          createdAt: new Date(),
        },
      });

      return this.mapNotificationRecord(notification);
    }, 'createNotification');
  }

  /**
   * Get notifications for a user with pagination
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ notifications: NotificationRecord[]; total: number }> {
    return executeQuery(async (client) => {
      const where: any = {
        userId,
        // Auto-filter expired notifications unless explicitly requested
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      };

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.unreadOnly) {
        where.readAt = null;
      }

      if (filters.persistent !== undefined) {
        where.persistent = filters.persistent;
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      const [notifications, total] = await Promise.all([
        client.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        client.notification.count({ where }),
      ]);

      return {
        notifications: notifications.map(this.mapNotificationRecord),
        total,
      };
    }, 'getUserNotifications');
  }

  /**
   * Get pending notifications for a user (unread and unexpired)
   */
  async getPendingNotifications(userId: string): Promise<NotificationRecord[]> {
    return executeQuery(async (client) => {
      const notifications = await client.notification.findMany({
        where: {
          userId,
          readAt: null,
          dismissedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to prevent overwhelming client
      });

      return notifications.map(this.mapNotificationRecord);
    }, 'getPendingNotifications');
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<NotificationRecord | null> {
    return executeQuery(async (client) => {
      // Verify ownership before updating
      const existing = await client.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!existing) {
        logger.warn('Attempted to mark non-existent or unauthorized notification as read', {
          notificationId,
          userId,
        });
        return null;
      }

      const notification = await client.notification.update({
        where: { id: notificationId },
        data: {
          readAt: new Date(),
        },
      });

      return this.mapNotificationRecord(notification);
    }, 'markNotificationRead');
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(userId: string): Promise<number> {
    return executeQuery(async (client) => {
      const result = await client.notification.updateMany({
        where: {
          userId,
          readAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        data: {
          readAt: new Date(),
        },
      });

      return result.count;
    }, 'markAllNotificationsRead');
  }

  /**
   * Dismiss notification (remove from UI without marking as read)
   */
  async dismissNotification(notificationId: string, userId: string): Promise<NotificationRecord | null> {
    return executeQuery(async (client) => {
      // Verify ownership before updating
      const existing = await client.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!existing) {
        logger.warn('Attempted to dismiss non-existent or unauthorized notification', {
          notificationId,
          userId,
        });
        return null;
      }

      const notification = await client.notification.update({
        where: { id: notificationId },
        data: {
          dismissedAt: new Date(),
        },
      });

      return this.mapNotificationRecord(notification);
    }, 'dismissNotification');
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    return executeQuery(async (client) => {
      const [totalCount, unreadCount, typeStats, recentCount] = await Promise.all([
        // Total notifications
        client.notification.count({
          where: {
            userId,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        }),
        // Unread notifications
        client.notification.count({
          where: {
            userId,
            readAt: null,
            dismissedAt: null,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        }),
        // Group by type
        client.notification.groupBy({
          by: ['type'],
          where: {
            userId,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          _count: true,
        }),
        // Recent notifications (last 24 hours)
        client.notification.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        }),
      ]);

      const byType = typeStats.reduce((acc: any, item: any) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: totalCount,
        unread: unreadCount,
        byType,
        recentCount,
      };
    }, 'getNotificationStats');
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    return executeQuery(async (client) => {
      const result = await client.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up expired notifications', {
          deletedCount: result.count,
        });
      }

      return result.count;
    }, 'cleanupExpiredNotifications');
  }

  /**
   * Delete old read notifications to prevent database growth
   */
  async cleanupOldNotifications(olderThanDays: number = 30): Promise<number> {
    return executeQuery(async (client) => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await client.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          readAt: {
            not: null,
          },
          persistent: false, // Don't delete persistent notifications
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up old read notifications', {
          deletedCount: result.count,
          olderThanDays,
        });
      }

      return result.count;
    }, 'cleanupOldNotifications');
  }

  /**
   * Create system-wide notification for all users
   */
  async createSystemNotification(
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<NotificationRecord> {
    return executeQuery(async (client) => {
      // Create system notification with special userId
      const notification = await client.notification.create({
        data: {
          id: this.generateNotificationId('sys'),
          userId: 'system',
          type: 'system',
          title: input.title,
          message: input.message,
          data: input.data ? JSON.stringify(input.data) : null,
          actions: input.actions ? JSON.stringify(input.actions) : null,
          persistent: input.persistent || false,
          expiresAt: input.expiresAt,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          createdAt: new Date(),
        },
      });

      return this.mapNotificationRecord(notification);
    }, 'createSystemNotification');
  }

  /**
   * Get system notifications (visible to all users)
   */
  async getSystemNotifications(): Promise<NotificationRecord[]> {
    return executeQuery(async (client) => {
      const notifications = await client.notification.findMany({
        where: {
          userId: 'system',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return notifications.map(this.mapNotificationRecord);
    }, 'getSystemNotifications');
  }

  /**
   * Bulk create notifications for multiple users
   */
  async createBulkNotifications(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    return executeTransaction(async (client) => {
      const notifications = userIds.map(userId => ({
        id: this.generateNotificationId(),
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ? JSON.stringify(input.data) : null,
        actions: input.actions ? JSON.stringify(input.actions) : null,
        persistent: input.persistent || false,
        expiresAt: input.expiresAt,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: new Date(),
      }));

      const result = await client.notification.createMany({
        data: notifications,
        skipDuplicates: true,
      });

      return result.count;
    }, 'createBulkNotifications');
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(prefix: string = 'notif'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Map database record to NotificationRecord interface
   */
  private mapNotificationRecord(dbRecord: any): NotificationRecord {
    return {
      id: dbRecord.id,
      userId: dbRecord.userId,
      type: dbRecord.type,
      title: dbRecord.title,
      message: dbRecord.message,
      data: dbRecord.data ? JSON.parse(dbRecord.data) : undefined,
      actions: dbRecord.actions ? JSON.parse(dbRecord.actions) : undefined,
      persistent: dbRecord.persistent,
      expiresAt: dbRecord.expiresAt,
      createdAt: dbRecord.createdAt,
      readAt: dbRecord.readAt,
      dismissedAt: dbRecord.dismissedAt,
      metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) : undefined,
    };
  }
}

export const notificationDatabaseService = new NotificationDatabaseService();

// Setup cleanup cron jobs
if (process.env.NODE_ENV === 'production') {
  // Clean up expired notifications every hour
  setInterval(() => {
    notificationDatabaseService.cleanupExpiredNotifications().catch((error) => {
      logger.error('Failed to cleanup expired notifications', { error });
    });
  }, 60 * 60 * 1000);

  // Clean up old read notifications daily at 2 AM
  const scheduleCleanup = () => {
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(2, 0, 0, 0);
    
    if (nextCleanup <= now) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }
    
    const msUntilCleanup = nextCleanup.getTime() - now.getTime();
    
    setTimeout(() => {
      notificationDatabaseService.cleanupOldNotifications().catch((error) => {
        logger.error('Failed to cleanup old notifications', { error });
      });
      
      // Schedule next cleanup
      setInterval(() => {
        notificationDatabaseService.cleanupOldNotifications().catch((error) => {
          logger.error('Failed to cleanup old notifications', { error });
        });
      }, 24 * 60 * 60 * 1000); // Daily
    }, msUntilCleanup);
  };
  
  scheduleCleanup();
}
