/**
 * Optimized Notification Repository with Connection Pool
 */
import { OptimizedBaseRepository } from './optimized-base.repository';
import { NotificationRecord, CreateNotificationInput, NotificationFilters } from '../services/notification-database.service';

interface NotificationCreateInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: string;
  actions?: string;
  persistent: boolean;
  expiresAt?: Date;
  metadata?: string;
}

interface NotificationUpdateInput {
  readAt?: Date;
  dismissedAt?: Date;
  metadata?: string;
}

export class OptimizedNotificationRepository extends OptimizedBaseRepository<
  NotificationRecord,
  NotificationCreateInput,
  NotificationUpdateInput
> {
  constructor() {
    super('Notification');
  }

  protected getModel(client: any) {
    return client.notification;
  }

  /**
   * Create notification with optimized insert
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    const data: NotificationCreateInput = {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ? JSON.stringify(input.data) : undefined,
      actions: input.actions ? JSON.stringify(input.actions) : undefined,
      persistent: input.persistent || false,
      expiresAt: input.expiresAt,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    };

    const notification = await this.create(data, (client) => client.notification);
    return this.mapNotificationRecord(notification);
  }

  /**
   * Get user notifications with optimized pagination
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {},
    limit: number = 50,
    offset: number = 0
  ) {
    return this.query(async (client) => {
      const where: any = {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      };

      // Apply filters
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
   * Get pending notifications (unread and unexpired)
   */
  async getPendingNotifications(userId: string): Promise<NotificationRecord[]> {
    return this.query(async (client) => {
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
        take: 100,
      });

      return notifications.map(this.mapNotificationRecord);
    }, 'getPendingNotifications');
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationRecord | null> {
    return this.query(async (client) => {
      // Verify ownership before updating
      const existing = await client.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!existing) {
        return null;
      }

      const notification = await client.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });

      return this.mapNotificationRecord(notification);
    }, 'markAsRead');
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.query(async (client) => {
      const result = await client.notification.updateMany({
        where: {
          userId,
          readAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        data: { readAt: new Date() },
      });

      return result.count;
    }, 'markAllAsRead');
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string) {
    return this.query(async (client) => {
      const [totalCount, unreadCount, typeStats, recentCount] = await Promise.all([
        client.notification.count({
          where: {
            userId,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        }),
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

      const byType = typeStats.reduce((acc: Record<string, number>, item: any) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: totalCount,
        unread: unreadCount,
        byType,
        recentCount,
      };
    }, 'getStats');
  }

  /**
   * Bulk create notifications
   */
  async createBulkNotifications(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    const notifications = userIds.map(userId => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ? JSON.stringify(input.data) : null,
      actions: input.actions ? JSON.stringify(input.actions) : null,
      persistent: input.persistent || false,
      expiresAt: input.expiresAt,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    }));

    return this.query(async (client) => {
      const result = await client.notification.createMany({
        data: notifications,
        skipDuplicates: true,
      });

      return result.count;
    }, 'createBulkNotifications');
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpired(): Promise<number> {
    return this.query(async (client) => {
      const result = await client.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    }, 'cleanupExpired');
  }

  /**
   * Map database record to NotificationRecord
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

export const optimizedNotificationRepository = new OptimizedNotificationRepository();
