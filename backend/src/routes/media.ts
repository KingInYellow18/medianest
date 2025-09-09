import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma';
import { sendSuccess, sendError } from '../utils/response.utils';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { CatchError } from '../types/common';

const router = Router();

// All media endpoints require authentication
router.use(authMiddleware);

// GET /api/media/search - Search for media
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, type = 'all', page = 1, limit = 20 } = req.query as any;
    
    if (!q) {
      return sendError(res, 'Search query is required', 400);
    }
    
    // For now, search in existing media requests
    // TODO: Integrate with external media APIs (TMDB, etc.)
    const prisma = getPrisma();
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;
    
    const where = {
      AND: [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { tmdbId: { contains: q, mode: 'insensitive' as const } }
          ]
        },
        type !== 'all' ? { mediaType: type } : {}
      ]
    };
    
    const [requests, total] = await Promise.all([
      prisma.mediaRequest.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.mediaRequest.count({ where })
    ]);
    
    sendSuccess(res, {
      results: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      query: q,
      type
    });
  } catch (error: CatchError) {
    logger.error('Media search failed:', error);
    sendError(res, 'Media search failed', 500);
  }
});

// POST /api/media/request - Submit media request
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { title, mediaType, tmdbId } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }
    
    if (!title || !mediaType) {
      return sendError(res, 'Title and media type are required', 400);
    }
    
    const prisma = getPrisma();
    
    // Check for duplicate requests
    const existingRequest = await prisma.mediaRequest.findFirst({
      where: {
        userId,
        title,
        mediaType,
        status: { in: ['pending', 'processing'] }
      }
    });
    
    if (existingRequest) {
      return sendError(res, 'Similar request already exists', 409);
    }
    
    const mediaRequest = await prisma.mediaRequest.create({
      data: {
        userId,
        title,
        mediaType,
        tmdbId: tmdbId || null,
        status: 'pending'
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });
    
    logger.info('Media request created', {
      requestId: mediaRequest.id,
      userId,
      title,
      mediaType
    });
    
    sendSuccess(res, { request: mediaRequest }, 201);
  } catch (error: CatchError) {
    logger.error('Media request creation failed:', error);
    sendError(res, 'Failed to create media request', 500);
  }
});

// GET /api/media/requests - Get user's requests
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const { status, page = 1, limit = 20 } = req.query as any;
    const prisma = getPrisma();
    
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;
    
    const where = {
      userId,
      ...(status && { status })
    };
    
    const [requests, total] = await Promise.all([
      prisma.mediaRequest.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.mediaRequest.count({ where })
    ]);
    
    sendSuccess(res, {
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: CatchError) {
    logger.error('Get media requests failed:', error);
    sendError(res, 'Failed to fetch media requests', 500);
  }
});

export default router;
