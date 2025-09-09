import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma';
import { sendSuccess, sendError } from '../utils/response.utils';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

const router = Router();

// GET /api/admin/users - List all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const { page = 1, limit = 20, search } = req.query as any;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;
    
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { plexUsername: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plexUsername: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          requiresPasswordChange: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);
    
    sendSuccess(res, {
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: CatchError) {
    logger.error('Admin users list failed:', error);
    sendError(res, 'Failed to fetch users', 500);
  }
});

// GET /api/admin/services - Get all service configs
router.get('/services', async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    
    const services = await prisma.serviceConfig.findMany({
      select: {
        id: true,
        serviceName: true,
        serviceUrl: true,
        enabled: true,
        configData: true,
        updatedAt: true,
        updatedBy: true,
        updatedByUser: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
        // Note: apiKey excluded for security
      },
      orderBy: { serviceName: 'asc' }
    });
    
    sendSuccess(res, { services });
  } catch (error: CatchError) {
    logger.error('Admin services list failed:', error);
    sendError(res, 'Failed to fetch service configurations', 500);
  }
});

export default router;
