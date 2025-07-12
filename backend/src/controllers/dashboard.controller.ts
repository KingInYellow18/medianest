import { Request, Response } from 'express';

import { mediaRequestRepository, userRepository } from '@/repositories';
import { plexService } from '@/services/plex.service';
import { statusService } from '@/services/status.service';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class DashboardController {
  async getServiceStatuses(req: Request, res: Response) {
    try {
      const statuses = await statusService.getAllStatuses();

      res.json({
        success: true,
        data: statuses,
        meta: {
          timestamp: new Date(),
          count: statuses.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get service statuses', { error });
      throw new AppError('Failed to retrieve service statuses', 500);
    }
  }

  async getServiceStatus(req: Request, res: Response) {
    try {
      const { service } = req.params;
      const status = await statusService.getServiceStatus(service);

      if (!status) {
        throw new AppError(`Service '${service}' not found`, 404);
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get service status', { error });
      throw new AppError('Failed to retrieve service status', 500);
    }
  }

  async getDashboardStats(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      // Get user's recent requests
      const recentRequests = await mediaRequestRepository.findByUser(userId, {
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      // Get request counts
      const requestCounts = await mediaRequestRepository.getCountsByStatus(userId);

      // Get recently added from Plex (if available)
      let recentlyAdded = [];
      try {
        recentlyAdded = await plexService.getRecentlyAdded(userId);
      } catch (error) {
        logger.warn('Failed to get recently added from Plex', { error });
      }

      // Get user info
      const user = await userRepository.findById(userId);

      res.json({
        success: true,
        data: {
          user: {
            username: user?.plexUsername,
            email: user?.email,
            role: user?.role,
            lastLogin: user?.lastLoginAt,
          },
          requests: {
            recent: recentRequests,
            counts: requestCounts,
          },
          recentlyAdded: recentlyAdded.slice(0, 10),
          stats: {
            totalRequests: requestCounts.total || 0,
            pendingRequests: requestCounts.pending || 0,
            availableRequests: requestCounts.available || 0,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error });
      throw new AppError('Failed to retrieve dashboard statistics', 500);
    }
  }

  async getNotifications(req: Request, res: Response) {
    try {
      // For MVP, return empty notifications
      // In production, you'd fetch from a notifications table using req.user!.id
      res.json({
        success: true,
        data: [],
        meta: {
          unreadCount: 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get notifications', { error });
      throw new AppError('Failed to retrieve notifications', 500);
    }
  }
}

export const dashboardController = new DashboardController();
