/**
 * NotificationDatabaseService Mock Implementation
 * Comprehensive mocking for the notification database service
 */

import { vi } from 'vitest';

import type {
  NotificationRecord,
  CreateNotificationInput,
  NotificationFilters,
  NotificationStats,
} from '../../../src/services/notification-database.service';

// Mock notification record factory
export const createMockNotificationRecord = (
  overrides?: Partial<NotificationRecord>,
): NotificationRecord => ({
  id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  userId: 'mock-user-123',
  type: 'info',
  title: 'Mock Notification',
  message: 'This is a mock notification message',
  data: undefined,
  actions: undefined,
  persistent: false,
  expiresAt: undefined,
  createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  readAt: null,
  dismissedAt: null,
  metadata: undefined,
  ...overrides,
});

// Mock notification input factory
export const createMockNotificationInput = (
  overrides?: Partial<CreateNotificationInput>,
): CreateNotificationInput => ({
  userId: 'mock-user-123',
  type: 'info',
  title: 'Mock Notification Input',
  message: 'Mock notification message',
  ...overrides,
});

// Mock notification stats factory
export const createMockNotificationStats = (
  overrides?: Partial<NotificationStats>,
): NotificationStats => ({
  total: 10,
  unread: 3,
  byType: {
    info: 4,
    success: 2,
    warning: 2,
    error: 1,
    system: 1,
  },
  recentCount: 2,
  ...overrides,
});

// Enhanced NotificationDatabaseService mock
export const createMockNotificationDatabaseService = () => {
  const notificationStore = new Map<string, NotificationRecord>();

  // Pre-populate with some mock notifications
  const seedNotifications = [
    createMockNotificationRecord({
      id: 'notif_1',
      type: 'info',
      title: 'Welcome',
      message: 'Welcome to MediaNest!',
    }),
    createMockNotificationRecord({
      id: 'notif_2',
      type: 'success',
      title: 'Request Approved',
      message: 'Your media request has been approved',
      readAt: new Date(Date.now() - 30 * 60 * 1000), // Read 30 mins ago
    }),
    createMockNotificationRecord({
      id: 'notif_3',
      type: 'warning',
      title: 'Server Maintenance',
      message: 'Scheduled maintenance in 2 hours',
      persistent: true,
    }),
  ];

  seedNotifications.forEach((notif) => notificationStore.set(notif.id, notif));

  const service = {
    // Create notification
    createNotification: vi
      .fn()
      .mockImplementation(async (input: CreateNotificationInput): Promise<NotificationRecord> => {
        const notification = createMockNotificationRecord({
          ...input,
          id: service.generateNotificationId(),
          createdAt: new Date(),
        });

        notificationStore.set(notification.id, notification);
        return notification;
      }),

    // Get user notifications with pagination
    getUserNotifications: vi
      .fn()
      .mockImplementation(
        async (
          userId: string,
          filters: NotificationFilters = {},
          limit: number = 50,
          offset: number = 0,
        ) => {
          let notifications = Array.from(notificationStore.values()).filter(
            (n) => n.userId === userId || n.userId === 'system',
          );

          // Apply filters
          if (filters.type) {
            notifications = notifications.filter((n) => n.type === filters.type);
          }

          if (filters.unreadOnly) {
            notifications = notifications.filter((n) => n.readAt === null);
          }

          if (filters.persistent !== undefined) {
            notifications = notifications.filter((n) => n.persistent === filters.persistent);
          }

          if (filters.createdAfter) {
            notifications = notifications.filter((n) => n.createdAt >= filters.createdAfter!);
          }

          if (filters.createdBefore) {
            notifications = notifications.filter((n) => n.createdAt <= filters.createdBefore!);
          }

          // Filter expired notifications
          const now = new Date();
          notifications = notifications.filter((n) => !n.expiresAt || n.expiresAt > now);

          // Sort by creation date (desc)
          notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          // Apply pagination
          const total = notifications.length;
          const paginatedNotifications = notifications.slice(offset, offset + limit);

          return {
            notifications: paginatedNotifications,
            total,
          };
        },
      ),

    // Get pending notifications
    getPendingNotifications: vi
      .fn()
      .mockImplementation(async (userId: string): Promise<NotificationRecord[]> => {
        const now = new Date();
        return Array.from(notificationStore.values())
          .filter(
            (n) =>
              (n.userId === userId || n.userId === 'system') &&
              n.readAt === null &&
              n.dismissedAt === null &&
              (!n.expiresAt || n.expiresAt > now),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 100);
      }),

    // Mark notification as read
    markNotificationRead: vi
      .fn()
      .mockImplementation(
        async (notificationId: string, userId: string): Promise<NotificationRecord | null> => {
          const notification = notificationStore.get(notificationId);

          if (
            !notification ||
            (notification.userId !== userId && notification.userId !== 'system')
          ) {
            return null;
          }

          const updatedNotification = {
            ...notification,
            readAt: new Date(),
          };

          notificationStore.set(notificationId, updatedNotification);
          return updatedNotification;
        },
      ),

    // Mark all notifications as read
    markAllNotificationsRead: vi
      .fn()
      .mockImplementation(async (userId: string): Promise<number> => {
        let count = 0;
        const now = new Date();

        for (const [id, notification] of notificationStore.entries()) {
          if (
            (notification.userId === userId || notification.userId === 'system') &&
            notification.readAt === null &&
            (!notification.expiresAt || notification.expiresAt > now)
          ) {
            notificationStore.set(id, { ...notification, readAt: now });
            count++;
          }
        }

        return count;
      }),

    // Dismiss notification
    dismissNotification: vi
      .fn()
      .mockImplementation(
        async (notificationId: string, userId: string): Promise<NotificationRecord | null> => {
          const notification = notificationStore.get(notificationId);

          if (
            !notification ||
            (notification.userId !== userId && notification.userId !== 'system')
          ) {
            return null;
          }

          const updatedNotification = {
            ...notification,
            dismissedAt: new Date(),
          };

          notificationStore.set(notificationId, updatedNotification);
          return updatedNotification;
        },
      ),

    // Get notification statistics
    getNotificationStats: vi
      .fn()
      .mockImplementation(async (userId: string): Promise<NotificationStats> => {
        const now = new Date();
        const userNotifications = Array.from(notificationStore.values()).filter(
          (n) =>
            (n.userId === userId || n.userId === 'system') && (!n.expiresAt || n.expiresAt > now),
        );

        const unread = userNotifications.filter(
          (n) => n.readAt === null && n.dismissedAt === null,
        ).length;

        const byType = userNotifications.reduce(
          (acc, notification) => {
            acc[notification.type] = (acc[notification.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentCount = userNotifications.filter((n) => n.createdAt >= oneDayAgo).length;

        return {
          total: userNotifications.length,
          unread,
          byType,
          recentCount,
        };
      }),

    // Clean up expired notifications
    cleanupExpiredNotifications: vi.fn().mockImplementation(async (): Promise<number> => {
      const now = new Date();
      let deletedCount = 0;

      for (const [id, notification] of notificationStore.entries()) {
        if (notification.expiresAt && notification.expiresAt < now) {
          notificationStore.delete(id);
          deletedCount++;
        }
      }

      return deletedCount;
    }),

    // Clean up old notifications
    cleanupOldNotifications: vi
      .fn()
      .mockImplementation(async (olderThanDays: number = 30): Promise<number> => {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        for (const [id, notification] of notificationStore.entries()) {
          if (
            notification.createdAt < cutoffDate &&
            notification.readAt !== null &&
            !notification.persistent
          ) {
            notificationStore.delete(id);
            deletedCount++;
          }
        }

        return deletedCount;
      }),

    // Create system notification
    createSystemNotification: vi
      .fn()
      .mockImplementation(
        async (input: Omit<CreateNotificationInput, 'userId'>): Promise<NotificationRecord> => {
          const notification = createMockNotificationRecord({
            ...input,
            id: service.generateNotificationId('sys'),
            userId: 'system',
            type: 'system',
            createdAt: new Date(),
          });

          notificationStore.set(notification.id, notification);
          return notification;
        },
      ),

    // Get system notifications
    getSystemNotifications: vi.fn().mockImplementation(async (): Promise<NotificationRecord[]> => {
      const now = new Date();
      return Array.from(notificationStore.values())
        .filter((n) => n.userId === 'system' && (!n.expiresAt || n.expiresAt > now))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50);
    }),

    // Create bulk notifications
    createBulkNotifications: vi
      .fn()
      .mockImplementation(
        async (
          userIds: string[],
          input: Omit<CreateNotificationInput, 'userId'>,
        ): Promise<number> => {
          if (userIds.length === 0) return 0;

          let createdCount = 0;
          for (const userId of userIds) {
            const notification = createMockNotificationRecord({
              ...input,
              id: service.generateNotificationId(),
              userId,
              createdAt: new Date(),
            });

            notificationStore.set(notification.id, notification);
            createdCount++;
          }

          return createdCount;
        },
      ),

    // Generate notification ID
    generateNotificationId: vi.fn().mockImplementation((prefix: string = 'notif') => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      return `${prefix}_${timestamp}_${random}`;
    }),

    // Internal store access for testing
    _getNotificationStore: () => notificationStore,
    _clearNotificationStore: () => notificationStore.clear(),
    _seedNotifications: (notifications: NotificationRecord[]) => {
      notificationStore.clear();
      notifications.forEach((n) => notificationStore.set(n.id, n));
    },
  };

  return service;
};

// Setup NotificationDatabaseService mocks
export const setupNotificationDatabaseServiceMocks = () => {
  const mockService = createMockNotificationDatabaseService();

  vi.mock('../../../src/services/notification-database.service', () => ({
    NotificationDatabaseService: vi.fn().mockImplementation(() => mockService),
    notificationDatabaseService: mockService,
  }));

  return mockService;
};

// Test scenario helpers
export const createNotificationTestScenarios = () => ({
  validNotificationInput: createMockNotificationInput({
    type: 'info',
    title: 'Test Notification',
    message: 'This is a test notification',
  }),

  urgentNotification: createMockNotificationInput({
    type: 'error',
    title: 'Urgent Alert',
    message: 'This requires immediate attention',
    persistent: true,
    actions: [
      { label: 'View Details', action: 'view_details', style: 'primary' },
      { label: 'Dismiss', action: 'dismiss', style: 'secondary' },
    ],
  }),

  expiringNotification: createMockNotificationInput({
    type: 'warning',
    title: 'Expiring Soon',
    message: 'This notification will expire in 1 hour',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  }),

  systemMaintenance: {
    type: 'system' as const,
    title: 'Scheduled Maintenance',
    message: 'System will be down for maintenance from 2-4 AM EST',
    persistent: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },

  mediaRequestApproved: createMockNotificationInput({
    type: 'success',
    title: 'Request Approved',
    message: 'Your request for "The Matrix" has been approved',
    data: {
      requestId: 'req_123',
      mediaTitle: 'The Matrix',
      mediaType: 'movie',
      tmdbId: 603,
    },
    actions: [{ label: 'View Request', action: 'view_request', style: 'primary' }],
  }),
});

// Reset notification database service mocks
export const resetNotificationDatabaseServiceMocks = (
  mockService: ReturnType<typeof createMockNotificationDatabaseService>,
) => {
  // Reset all mock functions
  Object.values(mockService).forEach((method) => {
    if (method && typeof method.mockReset === 'function') {
      method.mockReset();
    }
  });

  // Clear notification store
  mockService._clearNotificationStore();

  // Restore default implementations
  const restoredService = createMockNotificationDatabaseService();
  Object.assign(mockService, restoredService);
};

// Performance and load testing helpers
export const simulateNotificationLoad = {
  highVolume: (mockService: ReturnType<typeof createMockNotificationDatabaseService>) => {
    // Simulate high volume of notifications
    const notifications = Array.from({ length: 1000 }, (_, i) =>
      createMockNotificationRecord({
        id: `load_test_${i}`,
        title: `Load Test Notification ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }),
    );
    mockService._seedNotifications(notifications);
  },

  mixedTypes: (mockService: ReturnType<typeof createMockNotificationDatabaseService>) => {
    const types: NotificationRecord['type'][] = ['info', 'success', 'warning', 'error', 'system'];
    const notifications = Array.from({ length: 100 }, (_, i) =>
      createMockNotificationRecord({
        id: `mixed_${i}`,
        type: types[i % types.length],
        title: `Mixed Type Notification ${i}`,
      }),
    );
    mockService._seedNotifications(notifications);
  },
};

export default createMockNotificationDatabaseService;
