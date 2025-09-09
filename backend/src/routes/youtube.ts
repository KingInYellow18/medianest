import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma';
import { sendSuccess, sendError } from '../utils/response.utils';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { CatchError } from '../types/common';

const router = Router();

// All YouTube endpoints require authentication
router.use(authMiddleware);

// POST /api/youtube/download - Submit playlist for download
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { playlistUrl, playlistTitle } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }
    
    if (!playlistUrl) {
      return sendError(res, 'Playlist URL is required', 400);
    }
    
    const prisma = getPrisma();
    
    // Check for duplicate downloads
    const existingDownload = await prisma.youtubeDownload.findFirst({
      where: {
        userId,
        playlistUrl,
        status: { in: ['queued', 'downloading', 'processing'] }
      }
    });
    
    if (existingDownload) {
      return sendError(res, 'Download already in progress for this playlist', 409);
    }
    
    const download = await prisma.youtubeDownload.create({
      data: {
        userId,
        playlistUrl,
        playlistTitle: playlistTitle || 'Unknown Playlist',
        status: 'queued'
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });
    
    logger.info('YouTube download queued', {
      downloadId: download.id,
      userId,
      playlistUrl,
      playlistTitle
    });
    
    sendSuccess(res, { download }, 201);
  } catch (error: CatchError) {
    logger.error('YouTube download creation failed:', error);
    sendError(res, 'Failed to queue YouTube download', 500);
  }
});

// GET /api/youtube/downloads - Get user's downloads
router.get('/downloads', async (req: Request, res: Response) => {
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
    
    const [downloads, total] = await Promise.all([
      prisma.youtubeDownload.findMany({
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
      prisma.youtubeDownload.count({ where })
    ]);
    
    sendSuccess(res, {
      downloads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: CatchError) {
    logger.error('Get YouTube downloads failed:', error);
    sendError(res, 'Failed to fetch YouTube downloads', 500);
  }
});

export default router;
