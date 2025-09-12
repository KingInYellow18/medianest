import { Router, Request, Response } from 'express';

import { getPrisma } from '../db/prisma';
import { authMiddleware } from '../middleware/auth';
import { CatchError } from '../types/common';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response.utils';

const router = Router();

// All dashboard endpoints require authentication
router.use(authMiddleware);

// GET /api/dashboard/status - Get all service statuses
router.get('/status', async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    // Get service statuses and recent activity
    const [serviceStatuses, recentRequests, recentDownloads] = await Promise.all([
      prisma.serviceStatus.findMany({
        orderBy: { serviceName: 'asc' },
      }),
      prisma.mediaRequest.findMany({
        take: 5,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.youtubeDownload.findMany({
        take: 5,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate summary statistics
    const requestStats = await prisma.mediaRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const downloadStats = await prisma.youtubeDownload.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    sendSuccess(res, {
      services: serviceStatuses.map((service: any) => ({
        name: service.serviceName,
        status: service.status,
        responseTime: service.responseTimeMs,
        lastCheck: service.lastCheckAt,
        uptime: service.uptimePercentage,
      })),
      recentActivity: {
        mediaRequests: recentRequests,
        youtubeDownloads: recentDownloads,
      },
      statistics: {
        mediaRequests: requestStats.reduce((acc: any, stat: any) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as any),
        youtubeDownloads: downloadStats.reduce((acc: any, stat: any) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as any),
      },
    });
  } catch (error: CatchError) {
    logger.error('Dashboard status check failed:', error);
    sendError(res, 'Failed to fetch dashboard status', 500);
  }
});

export default router;
