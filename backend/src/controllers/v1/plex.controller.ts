import { Request, Response } from 'express';
import { z } from 'zod';

import { plexService } from '@/services/plex.service';
import { ApiError } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/types/auth';

// Validation schemas
const refreshLibrarySchema = z.object({
  libraryKey: z.string().min(1),
});

const scanDirectorySchema = z.object({
  libraryKey: z.string().min(1),
  directory: z.string().min(1),
});

export const getServerInfo = async (req: AuthRequest, res: Response) => {
  try {
    const serverInfo = await plexService.getServerInfo(req.user!.id);
    res.json(serverInfo);
  } catch (error: any) {
    logger.error('Failed to get Plex server info', {
      userId: req.user!.id,
      error: error.message,
    });
    throw new ApiError('Failed to get Plex server info', 503);
  }
};

export const getLibraries = async (req: AuthRequest, res: Response) => {
  try {
    const libraries = await plexService.getLibraries(req.user!.id);
    res.json(libraries);
  } catch (error: any) {
    logger.error('Failed to get Plex libraries', {
      userId: req.user!.id,
      error: error.message,
    });
    throw new ApiError('Failed to get Plex libraries', 503);
  }
};

export const getLibraryItems = async (req: AuthRequest, res: Response) => {
  const { libraryKey } = req.params;
  const { offset = 0, limit = 50 } = req.query;

  try {
    const items = await plexService.getLibraryItems(req.user!.id, libraryKey, {
      offset: Number(offset),
      limit: Number(limit),
    });
    res.json(items);
  } catch (error: any) {
    logger.error('Failed to get library items', {
      userId: req.user!.id,
      libraryKey,
      error: error.message,
    });
    throw new ApiError('Failed to get library items', 503);
  }
};

export const searchPlex = async (req: AuthRequest, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    throw new ApiError('Search query is required', 400);
  }

  try {
    const results = await plexService.search(req.user!.id, q);
    res.json(results);
  } catch (error: any) {
    logger.error('Failed to search Plex', {
      userId: req.user!.id,
      query: q,
      error: error.message,
    });
    throw new ApiError('Failed to search Plex', 503);
  }
};

export const getRecentlyAdded = async (req: AuthRequest, res: Response) => {
  try {
    const items = await plexService.getRecentlyAdded(req.user!.id);
    res.json(items);
  } catch (error: any) {
    logger.error('Failed to get recently added', {
      userId: req.user!.id,
      error: error.message,
    });
    throw new ApiError('Failed to get recently added items', 503);
  }
};

export const refreshLibrary = async (req: AuthRequest, res: Response) => {
  const validation = refreshLibrarySchema.safeParse(req.body);
  if (!validation.success) {
    throw new ApiError('Invalid request body', 400, validation.error.errors);
  }

  const { libraryKey } = validation.data;

  try {
    await plexService.refreshLibrary(req.user!.id, libraryKey);
    res.json({ message: 'Library refresh initiated', libraryKey });
  } catch (error: any) {
    logger.error('Failed to refresh library', {
      userId: req.user!.id,
      libraryKey,
      error: error.message,
    });
    throw new ApiError('Failed to refresh library', 503);
  }
};

export const scanDirectory = async (req: AuthRequest, res: Response) => {
  const validation = scanDirectorySchema.safeParse(req.body);
  if (!validation.success) {
    throw new ApiError('Invalid request body', 400, validation.error.errors);
  }

  const { libraryKey, directory } = validation.data;

  try {
    await plexService.scanDirectory(req.user!.id, libraryKey, directory);
    res.json({ message: 'Directory scan initiated', libraryKey, directory });
  } catch (error: any) {
    logger.error('Failed to scan directory', {
      userId: req.user!.id,
      libraryKey,
      directory,
      error: error.message,
    });
    throw new ApiError('Failed to scan directory', 503);
  }
};

export const scanYouTubeLibrary = async (req: AuthRequest, res: Response) => {
  try {
    // Find YouTube library
    const youtubeLibraryKey = await plexService.findYouTubeLibrary(req.user!.id);

    if (!youtubeLibraryKey) {
      throw new ApiError('YouTube library not found in Plex', 404);
    }

    // Trigger full library refresh
    await plexService.refreshLibrary(req.user!.id, youtubeLibraryKey);

    res.json({
      message: 'YouTube library scan initiated',
      libraryKey: youtubeLibraryKey,
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;

    logger.error('Failed to scan YouTube library', {
      userId: req.user!.id,
      error: error.message,
    });
    throw new ApiError('Failed to scan YouTube library', 503);
  }
};

export const getCollections = async (req: AuthRequest, res: Response) => {
  const { libraryKey } = req.params;
  const { search, sort } = req.query;

  try {
    const collections = await plexService.getCollections(req.user!.id, libraryKey, {
      search: search as string,
      sort: sort as string,
    });
    res.json(collections);
  } catch (error: any) {
    logger.error('Failed to get collections', {
      userId: req.user!.id,
      libraryKey,
      error: error.message,
    });
    throw new ApiError('Failed to get collections', 503);
  }
};

export const getCollectionDetails = async (req: AuthRequest, res: Response) => {
  const { collectionKey } = req.params;

  try {
    const collection = await plexService.getCollectionDetails(req.user!.id, collectionKey);
    res.json(collection);
  } catch (error: any) {
    logger.error('Failed to get collection details', {
      userId: req.user!.id,
      collectionKey,
      error: error.message,
    });
    throw new ApiError('Failed to get collection details', 503);
  }
};
