import { Request, Response } from 'express';

import { plexService } from '@/services/plex.service';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class PlexController {
  async getServerInfo(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const serverInfo = await plexService.getServerInfo(userId);

      res.json({
        success: true,
        data: serverInfo,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get server info', { error });
      throw new AppError('Failed to retrieve server information', 500);
    }
  }

  async getLibraries(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const libraries = await plexService.getLibraries(userId);

      res.json({
        success: true,
        data: libraries,
        meta: {
          count: libraries.length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get libraries', { error });
      throw new AppError('Failed to retrieve libraries', 500);
    }
  }

  async getLibraryItems(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { libraryKey } = req.params;
      const { offset = 0, limit = 50 } = req.query;

      const result = await plexService.getLibraryItems(userId, libraryKey, {
        offset: Number(offset),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.items,
        meta: {
          offset: Number(offset),
          limit: Number(limit),
          total: result.totalSize,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get library items', { error });
      throw new AppError('Failed to retrieve library items', 500);
    }
  }

  async search(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('Search query is required', 400);
      }

      const results = await plexService.search(userId, query);

      res.json({
        success: true,
        data: results,
        meta: {
          query,
          count: results.length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Search failed', { error });
      throw new AppError('Search failed', 500);
    }
  }

  async getRecentlyAdded(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const items = await plexService.getRecentlyAdded(userId);

      res.json({
        success: true,
        data: items,
        meta: {
          count: items.length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get recently added', { error });
      throw new AppError('Failed to retrieve recently added items', 500);
    }
  }
}

export const plexController = new PlexController();
