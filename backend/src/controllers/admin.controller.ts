import { uptime } from 'os';

import { AppError } from '@medianest/shared';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';

import { prisma } from '@/lib/prisma';
import { monitorVisibilityService } from '@/services/monitor-visibility.service';
import { logger } from '@/utils/logger';
import {
  UpdateMonitorVisibilityInput,
  BulkUpdateMonitorVisibilityInput,
  ResetAllVisibilityInput,
} from '@/validations/monitor-visibility.validation';

class AdminController {
  /**
   * Get all users with pagination, filtering, and sorting
   */
  async getUsers(req: Request, res: Response) {
    try {
      const {
        page = 1,
        pageSize = 20,
        search,
        role,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build filters
      const where: any = {};

      if (search) {
        where.OR = [
          {
            plexUsername: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (role && role !== 'all') {
        where.role = role as string;
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(pageSize);
      const total = await prisma.user.count({ where });

      // Get users with counts
      const users = await prisma.user.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: {
          [sortBy as string]: sortOrder,
        },
        select: {
          id: true,
          plexId: true,
          plexUsername: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              mediaRequests: true,
              youtubeDownloads: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            pageSize: Number(pageSize),
            totalPages: Math.ceil(total / Number(pageSize)),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get users', { error });
      throw new AppError('ADMIN_GET_USERS_FAILED', 'Failed to get users', 500);
    }
  }

  /**
   * Get service configurations
   */
  async getServices(_req: Request, res: Response) {
    try {
      // Service configurations don't need pagination as there are only a few
      const services = await prisma.serviceConfig.findMany({
        orderBy: {
          serviceName: 'asc',
        },
      });

      // Decrypt sensitive data for admin view
      const decryptedServices = services.map((service) => ({
        ...service,
        // Note: In production, you might want to mask these values
        // or implement a separate endpoint for updating credentials
      }));

      res.json({
        success: true,
        data: decryptedServices,
      });
    } catch (error) {
      logger.error('Failed to get services', { error });
      throw new AppError('ADMIN_GET_SERVICES_FAILED', 'Failed to get services', 500);
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Validate role
      if (!['user', 'admin'].includes(role)) {
        throw new AppError('INVALID_ROLE', 'Invalid role', 400);
      }

      // Prevent admin from removing their own admin role
      if (userId === req.user!.id && role !== 'admin') {
        throw new AppError(
          'CANNOT_REMOVE_OWN_ADMIN_ROLE',
          'Cannot remove your own admin role',
          400,
        );
      }

      // Update user role
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          plexUsername: true,
          email: true,
          role: true,
        },
      });

      logger.info('User role updated', {
        adminId: req.user!.id,
        userId,
        newRole: role,
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update user role', { error });
      throw new AppError('ADMIN_UPDATE_USER_ROLE_FAILED', 'Failed to update user role', 500);
    }
  }

  /**
   * Update user status (active/inactive/suspended)
   */
  async updateUserStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body;

      // Validate status
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        throw new AppError(
          'INVALID_STATUS',
          'Invalid status. Must be active, inactive, or suspended',
          400,
        );
      }

      // Prevent admin from suspending their own account
      if (userId === req.user!.id && status === 'suspended') {
        throw new AppError('CANNOT_SUSPEND_OWN_ACCOUNT', 'Cannot suspend your own account', 400);
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          status,
          // Note: statusReason and related fields need to be added to schema
          // statusReason: reason || null,
          // statusUpdatedAt: new Date(),
          // statusUpdatedBy: req.user!.id,
        },
        select: {
          id: true,
          plexUsername: true,
          email: true,
          role: true,
          status: true,
          // statusReason: true,
          // statusUpdatedAt: true,
        },
      });

      logger.info('User status updated', {
        adminId: req.user!.id,
        userId,
        newStatus: status,
        reason,
      });

      res.json({
        success: true,
        data: updatedUser,
        message: `User status updated to ${status}`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update user status', { error });
      throw new AppError('ADMIN_UPDATE_USER_STATUS_FAILED', 'Failed to update user status', 500);
    }
  }

  /**
   * Delete a user account
   */
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;

      // Prevent admin from deleting their own account
      if (userId === req.user!.id) {
        throw new AppError('CANNOT_DELETE_OWN_ACCOUNT', 'Cannot delete your own account', 400);
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Delete user (cascades to related records)
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info('User deleted', {
        adminId: req.user!.id,
        userId,
        username: user.plexUsername,
      });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete user', { error });
      throw new AppError('ADMIN_DELETE_USER_FAILED', 'Failed to delete user', 500);
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(_req: Request, res: Response) {
    try {
      const [
        totalUsers,
        activeUsers,
        totalRequests,
        pendingRequests,
        totalDownloads,
        activeDownloads,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
        prisma.mediaRequest.count(),
        prisma.mediaRequest.count({
          where: { status: 'pending' },
        }),
        prisma.youtubeDownload.count(),
        prisma.youtubeDownload.count({
          where: { status: 'downloading' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
          },
          requests: {
            total: totalRequests,
            pending: pendingRequests,
          },
          downloads: {
            total: totalDownloads,
            active: activeDownloads,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get system stats', { error });
      throw new AppError('ADMIN_GET_SYSTEM_STATS_FAILED', 'Failed to get system statistics', 500);
    }
  }

  /**
   * Get detailed system health information
   */
  async getSystemHealth(_req: Request, res: Response) {
    try {
      const startTime = Date.now();

      // Database health check
      const dbHealthPromise = prisma.$queryRaw`SELECT 1 as health`
        .then(() => ({ status: 'healthy', responseTime: Date.now() - startTime }))
        .catch((error) => ({
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - startTime,
        }));

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryInfo = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      };

      // System uptime
      const systemUptime = process.uptime();
      const uptimeInfo = {
        process: Math.round(systemUptime),
        system: uptime(),
      };

      // CPU usage (approximation)
      const cpuUsage = process.cpuUsage();
      const cpuInfo = {
        user: cpuUsage.user,
        system: cpuUsage.system,
      };

      // Service status checks
      const serviceChecks = await Promise.allSettled([
        // Database check
        dbHealthPromise,

        // Redis check (if available)
        // You can add Redis health check here if needed

        // Queue health (check if jobs are processing)
        // You can add queue health check here if needed
      ]);

      const dbHealth =
        serviceChecks[0].status === 'fulfilled'
          ? serviceChecks[0].value
          : { status: 'unhealthy', error: 'Connection failed' };

      // Recent error logs (last 24 hours)
      const recentErrors =
        (await prisma.errorLog?.count?.({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        })) || 0;

      // Active connections/sessions
      const activeSessions = await prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      // Disk usage (if available)
      const diskUsage = {
        // You can implement disk usage check here if needed
        status: 'unknown',
      };

      const overallHealth = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

      res.json({
        success: true,
        data: {
          overall: {
            status: overallHealth,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
          },
          services: {
            database: dbHealth,
            api: {
              status: 'healthy',
              responseTime: Date.now() - startTime,
            },
          },
          system: {
            memory: memoryInfo,
            uptime: uptimeInfo,
            cpu: cpuInfo,
            disk: diskUsage,
          },
          metrics: {
            activeSessions,
            recentErrors,
            nodeVersion: process.version,
            platform: process.platform,
            environment: process.env.NODE_ENV || 'unknown',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get system health', { error });
      throw new AppError(
        'ADMIN_GET_SYSTEM_HEALTH_FAILED',
        'Failed to get system health information',
        500,
      );
    }
  }

  /**
   * Monitor Visibility Management
   */

  // Get all monitors with visibility settings
  async getMonitorsWithVisibility(req: AuthenticatedRequest, res: Response) {
    try {
      const monitors = await monitorVisibilityService.getAllMonitorsWithVisibility(req.user?.id);

      res.json({
        success: true,
        data: {
          monitors,
          stats: await monitorVisibilityService.getVisibilityStats(),
        },
      });
    } catch (error) {
      logger.error('Failed to get monitors with visibility', { error });
      throw new AppError(
        'ADMIN_GET_MONITORS_VISIBILITY_FAILED',
        'Failed to get monitors with visibility',
        500,
      );
    }
  }

  // Update single monitor visibility
  async updateMonitorVisibility(
    req: AuthenticatedRequest &
      Request<UpdateMonitorVisibilityInput['params'], object, UpdateMonitorVisibilityInput['body']>,
    res: Response,
  ) {
    try {
      const { id: monitorId } = req.params;
      const { isPublic } = req.body;
      const userId = req.user!.id;

      const visibility = await monitorVisibilityService.updateMonitorVisibility(
        monitorId,
        isPublic,
        userId,
      );

      logger.info('Monitor visibility updated', {
        monitorId,
        isPublic,
        userId,
      });

      res.json({
        success: true,
        message: 'Monitor visibility updated successfully',
        data: visibility,
      });
    } catch (error) {
      logger.error('Failed to update monitor visibility', { error });
      throw new AppError(
        'ADMIN_UPDATE_MONITOR_VISIBILITY_FAILED',
        'Failed to update monitor visibility',
        500,
      );
    }
  }

  // Update multiple monitors visibility
  async bulkUpdateMonitorVisibility(
    req: AuthenticatedRequest & Request<object, object, BulkUpdateMonitorVisibilityInput['body']>,
    res: Response,
  ) {
    try {
      const { monitorIds, isPublic } = req.body;
      const userId = req.user!.id;

      const updatedCount = await monitorVisibilityService.updateBulkMonitorVisibility(
        { monitorIds, isPublic },
        userId,
      );

      logger.info('Bulk monitor visibility updated', {
        count: updatedCount,
        isPublic,
        userId,
      });

      res.json({
        success: true,
        message: `Updated visibility for ${updatedCount} monitors`,
        data: {
          updatedCount,
        },
      });
    } catch (error) {
      logger.error('Failed to bulk update monitor visibility', { error });
      throw new AppError(
        'ADMIN_BULK_UPDATE_MONITOR_VISIBILITY_FAILED',
        'Failed to bulk update monitor visibility',
        500,
      );
    }
  }

  // Reset all monitors to admin-only
  async resetAllMonitorVisibility(
    req: AuthenticatedRequest & Request<object, object, ResetAllVisibilityInput['body']>,
    res: Response,
  ) {
    try {
      const userId = req.user!.id;

      const resetCount = await monitorVisibilityService.resetAllToAdminOnly(userId);

      logger.warn('All monitors reset to admin-only', {
        count: resetCount,
        userId,
      });

      res.json({
        success: true,
        message: `Reset ${resetCount} monitors to admin-only visibility`,
        data: {
          resetCount,
        },
      });
    } catch (error) {
      logger.error('Failed to reset all monitor visibility', { error });
      throw new AppError(
        'ADMIN_RESET_MONITOR_VISIBILITY_FAILED',
        'Failed to reset all monitor visibility',
        500,
      );
    }
  }

  // Get visibility statistics
  async getVisibilityStats(_req: Request, res: Response) {
    try {
      const stats = await monitorVisibilityService.getVisibilityStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get visibility stats', { error });
      throw new AppError(
        'ADMIN_GET_VISIBILITY_STATS_FAILED',
        'Failed to get visibility stats',
        500,
      );
    }
  }
}

export const adminController = new AdminController();
