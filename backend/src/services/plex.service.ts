// Context7 Optimized Plex Service - Removed @ts-nocheck for better type safety
import { redisClient } from '@/config/redis';
import { PlexClient } from '@/integrations/plex/plex.client';
import { userRepository, serviceConfigRepository } from '@/repositories';
import { AppError } from '@medianest/shared';
import { logger } from '@/utils/logger';

import { encryptionService } from './encryption.service';
import { CatchError, UserId, isNotNull, Result, success, failure } from '../types/common';
import type { Brand } from '../types/context7-optimizations';

// Context7 Pattern: Branded types for type safety
type PlexUserId = Brand<string, 'PlexUserId'>;

// Context7 Pattern: Readonly configuration
interface PlexServiceConfig {
  readonly serverInfo: number;
  readonly libraries: number;
  readonly search: number;
  readonly recentlyAdded: number;
  readonly libraryItems: number;
  readonly collections: number;
}

const CACHE_TTL: PlexServiceConfig = {
  serverInfo: 3600, // 1 hour
  libraries: 3600, // 1 hour (Plex libraries don't change often)
  search: 300, // 5 minutes (search results can be cached longer for homelab)
  recentlyAdded: 1800, // 30 minutes (recently added doesn't update that frequently)
  libraryItems: 1800, // 30 minutes for library items
  collections: 3600, // 1 hour for collections
} as const;

export class PlexService {
  private readonly clients = new Map<PlexUserId, PlexClient>();
  private readonly cachePrefix = 'plex:' as const;
  private readonly cacheTTL = CACHE_TTL;

  // Context7 Pattern: Better parameter typing
  async getClientForUser(userId: string): Promise<Result<PlexClient, AppError>> {
    const plexUserId = userId as PlexUserId;

    // Check if we already have a client for this user
    const existingClient = this.clients.get(plexUserId);
    if (existingClient) {
      return success(existingClient);
    }

    try {
      // Get user's Plex token
      const user = await userRepository.findById(userId);
      if (!user?.plexToken) {
        return failure(
          new AppError('PLEX_USER_NOT_FOUND', 'User not found or missing Plex token', 401)
        );
      }

      // Get Plex server configuration
      const config = await serviceConfigRepository.findByName('plex');
      if (!config?.serviceUrl) {
        return failure(new AppError('PLEX_CONFIG_MISSING', 'Plex server not configured', 500));
      }

      // Decrypt the user's Plex token
      const decryptedToken = encryptionService.decryptFromStorage(user.plexToken);

      // Create new client
      const client = new PlexClient(config.serviceUrl, decryptedToken);

      // Test connection
      await client.testConnection();
      this.clients.set(plexUserId, client);
      return success(client);
    } catch (error: CatchError) {
      logger.error('Failed to connect to Plex', { userId, error });
      return failure(
        new AppError('PLEX_CONNECTION_FAILED', 'Failed to connect to Plex server', 503)
      );
    }
  }

  async getServerInfo(userId: string) {
    const cacheKey = `${this.cachePrefix}server:${userId}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const serverInfo = await clientResult.data.testConnection();

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.serverInfo, JSON.stringify(serverInfo));

    return serverInfo;
  }

  async getLibraries(userId: string) {
    const cacheKey = `${this.cachePrefix}libraries:${userId}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const libraries = await clientResult.data.getLibraries();

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.libraries, JSON.stringify(libraries));

    return libraries;
  }

  async getLibraryItems(
    userId: string,
    libraryKey: string,
    options?: {
      offset?: number;
      limit?: number;
    }
  ) {
    // Cache library items with pagination parameters
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    const cacheKey = `${this.cachePrefix}items:${userId}:${libraryKey}:${offset}:${limit}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const items = await clientResult.data.getLibraryItems(libraryKey, options);

    // Cache result (30 minutes for library items)
    await redisClient.setex(cacheKey, this.cacheTTL.libraryItems, JSON.stringify(items));

    return items;
  }

  async search(userId: string, query: string) {
    const cacheKey = `${this.cachePrefix}search:${userId}:${query}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Search in Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const results = await clientResult.data.search(query);

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.search, JSON.stringify(results));

    return results;
  }

  async getRecentlyAdded(userId: string) {
    const cacheKey = `${this.cachePrefix}recent:${userId}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const items = await clientResult.data.getRecentlyAdded();

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.recentlyAdded, JSON.stringify(items));

    return items;
  }

  async refreshLibrary(userId: string, libraryKey: string): Promise<void> {
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    await clientResult.data.refreshLibrary(libraryKey);

    // Clear library cache after refresh
    const cacheKey = `${this.cachePrefix}libraries:${userId}`;
    await redisClient.del(cacheKey);
  }

  async scanDirectory(userId: string, libraryKey: string, directory: string): Promise<void> {
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    await clientResult.data.scanDirectory(libraryKey, directory);

    // Clear related caches
    const librariesKey = `${this.cachePrefix}libraries:${userId}`;
    const recentKey = `${this.cachePrefix}recent:${userId}`;
    await redisClient.del([librariesKey, recentKey]);
  }

  async getCollections(
    userId: string,
    libraryKey: string,
    options?: { search?: string; sort?: string }
  ) {
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const collections = await clientResult.data.getCollections(libraryKey);

    // Apply filters if provided
    let filteredCollections = collections;

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      filteredCollections = filteredCollections.filter((collection: any) =>
        collection.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting if provided
    if (options?.sort) {
      filteredCollections = [...filteredCollections].sort((a: any, b: any) => {
        switch (options.sort) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'addedAt':
            return b.addedAt - a.addedAt;
          case 'childCount':
            return b.childCount - a.childCount;
          default:
            return 0;
        }
      });
    }

    return filteredCollections;
  }

  async getCollectionDetails(userId: string, collectionKey: string) {
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    return clientResult.data.getCollectionDetails(collectionKey);
  }

  async createCollection(
    userId: string,
    libraryKey: string,
    title: string,
    items: string[] = []
  ): Promise<void> {
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    await clientResult.data.createCollection(libraryKey, title, items);
  }

  // Find YouTube library section
  async findYouTubeLibrary(userId: string): Promise<string | null> {
    const libraries = await this.getLibraries(userId);

    // Look for library with 'youtube' in the name or type
    const youtubeLib = libraries.find(
      (lib: any) =>
        lib.title.toLowerCase().includes('youtube') ||
        lib.type === 'youtube' ||
        lib.type === 'other' // YouTube content might be in 'other' type library
    );

    if (youtubeLib) {
      return youtubeLib.key;
    }

    // Fallback: look for 'Other Videos' or similar
    const otherLib = libraries.find(
      (lib: any) =>
        lib.title.toLowerCase().includes('other') || lib.title.toLowerCase().includes('video')
    );

    return otherLib ? otherLib.key : null;
  }

  // Clear all cache entries for a specific user
  async clearUserCache(userId: string): Promise<void> {
    try {
      const plexUserId = userId as PlexUserId;
      
      // Remove client from memory cache
      this.clients.delete(plexUserId);
      
      // Clear all Redis cache keys for this user
      const cacheKeys = [
        `${this.cachePrefix}server:${userId}`,
        `${this.cachePrefix}libraries:${userId}`,
        `${this.cachePrefix}recent:${userId}`,
      ];
      
      // Also clear any search and item cache keys (using pattern)
      const searchPattern = `${this.cachePrefix}search:${userId}:*`;
      const itemPattern = `${this.cachePrefix}items:${userId}:*`;
      
      // Get keys matching patterns
      const searchKeys = await redisClient.keys(searchPattern);
      const itemKeys = await redisClient.keys(itemPattern);
      
      // Combine all keys to delete
      const allKeys = [...cacheKeys, ...searchKeys, ...itemKeys];
      
      if (allKeys.length > 0) {
        await redisClient.del(allKeys);
        logger.info('Cleared Plex cache for user', { userId, keysCleared: allKeys.length });
      }
    } catch (error: CatchError) {
      // Don't throw - cache clearing should be graceful
      logger.warn('Failed to clear user cache, continuing gracefully', { userId, error });
    }
  }

  // Clean up idle clients periodically (every 30 minutes)
  startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const maxIdleTime = 30 * 60 * 1000; // 30 minutes

      // In a production app, we'd track last access time
      // For MVP, just clear all clients periodically
      if (this.clients.size > 10) {
        logger.info('Clearing Plex client cache', { count: this.clients.size });
        this.clients.clear();
      }
    }, 30 * 60 * 1000);
  }
}

export const plexService = new PlexService();
