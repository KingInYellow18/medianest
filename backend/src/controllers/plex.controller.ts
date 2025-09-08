import { Request, Response } from 'express';

import { plexService } from '@/services/plex.service';
import { AppError } from '@medianest/shared';
import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

export class PlexController {
  async getServerInfo(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const serverInfo = await plexService.getServerInfo(userId);

      res.json({
        success: true,
        data: serverInfo,
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get server info', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve server information', 500);
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get libraries', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve libraries', 500);
    }
  }

  async getLibraryItems(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { libraryKey } = req.params;
      const { offset = 0, limit = 50 } = req.query;

      const result = await plexService.getLibraryItems(userId, libraryKey!, {
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get library items', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve library items', 500);
    }
  }

  async search(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('VALIDATION_ERROR', 'Search query is required', 400);
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Search failed', { error });
      throw new AppError('SERVER_ERROR', 'Search failed', 500);
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
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get recently added', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve recently added items', 500);
    }
  }

  async getCollections(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { libraryKey } = req.params;
      const { search, sort } = req.query;

      const collections = await plexService.getCollections(userId, libraryKey!, {
        search: search as string,
        sort: sort as string,
      });

      res.json({
        success: true,
        data: collections,
        meta: {
          count: collections.length,
        },
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get collections', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve collections', 500);
    }
  }

  async getCollectionDetails(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { collectionKey } = req.params;

      const collection = await plexService.getCollectionDetails(userId, collectionKey!);

      res.json({
        success: true,
        data: collection,
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get collection details', { error });
      throw new AppError('SERVER_ERROR', 'Failed to retrieve collection details', 500);
    }
  }
}

export const plexController = new PlexController();
