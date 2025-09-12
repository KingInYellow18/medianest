import { AppError } from '@medianest/shared';
import { Request, Response } from 'express';

import { CatchError } from '../types/common';

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export class AdminController {
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
    } catch (error: CatchError) {
      logger.error('Failed to get users', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get users', 500);
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
      const decryptedServices = services.map((service: any) => ({
        ...service,
        // Note: In production, you might want to mask these values
        // or implement a separate endpoint for updating credentials
      }));

      res.json({
        success: true,
        data: decryptedServices,
      });
    } catch (error: CatchError) {
      logger.error('Failed to get services', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get services', 500);
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Validate role
      if (!role || !['user', 'admin'].includes(role)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid role', 400);
      }

      // Prevent admin from removing their own admin role
      if (userId === req.user!.id && role === 'user') {
        throw new AppError('VALIDATION_ERROR', 'Cannot remove your own admin role', 400);
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update user role', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to update user role', 500);
    }
  }

  /**
   * Delete a user account
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      // Prevent admin from deleting their own account
      if (userId === req.user!.id) {
        throw new AppError('VALIDATION_ERROR', 'Cannot delete your own account', 400);
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('NOT_FOUND', 'User not found', 404);
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete user', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to delete user', 500);
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
    } catch (error: CatchError) {
      logger.error('Failed to get system stats', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get system statistics', 500);
    }
  }
}

export const adminController = new AdminController();
