// @ts-nocheck
import { redisClient } from '@/config/redis';
import { PlexClient } from '@/integrations/plex/plex.client';
import { userRepository, serviceConfigRepository } from '@/repositories';
import { AppError } from '../utils/errors';
import { logger } from '@/utils/logger';

import { encryptionService } from './encryption.service';

export class PlexService {
  private clients: Map<string, PlexClient> = new Map();
  private cachePrefix = 'plex:';
  private cacheTTL = {
    serverInfo: 3600, // 1 hour
    libraries: 3600, // 1 hour (Plex libraries don't change often)
    search: 300, // 5 minutes (search results can be cached longer for homelab)
    recentlyAdded: 1800, // 30 minutes (recently added doesn't update that frequently)
    libraryItems: 1800, // 30 minutes for library items
    collections: 3600, // 1 hour for collections
  };

  async getClientForUser(userId: string): Promise<PlexClient> {
    // Check if we already have a client for this user
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    // Get user's Plex token
    const user = await userRepository.findById(userId);
    if (!user || !user.plexToken) {
      throw new AppError('User not found or missing Plex token', 401);
    }

    // Get Plex server configuration
    const config = await serviceConfigRepository.findByName('plex');
    if (!config || !config.serviceUrl) {
      throw new AppError('Plex server not configured', 500);
    }

    // Decrypt the user's Plex token
    const decryptedToken = await encryptionService.decrypt(user.plexToken);

    // Create new client
    const client = new PlexClient(config.serviceUrl, decryptedToken);

    // Test connection
    try {
      await client.testConnection();
      this.clients.set(userId, client);
      return client;
    } catch (error: any) {
      logger.error('Failed to connect to Plex', { userId, error });
      throw new AppError('Failed to connect to Plex server', 503);
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
    const client = await this.getClientForUser(userId);
    const serverInfo = await client.testConnection();

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
    const client = await this.getClientForUser(userId);
    const libraries = await client.getLibraries();

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
    },
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
    const client = await this.getClientForUser(userId);
    const items = await client.getLibraryItems(libraryKey, options);

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
    const client = await this.getClientForUser(userId);
    const results = await client.search(query);

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
    const client = await this.getClientForUser(userId);
    const items = await client.getRecentlyAdded();

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.recentlyAdded, JSON.stringify(items));

    return items;
  }

  async refreshLibrary(userId: string, libraryKey: string): Promise<void> {
    const client = await this.getClientForUser(userId);
    await client.refreshLibrary(libraryKey);

    // Clear library cache after refresh
    const cacheKey = `${this.cachePrefix}libraries:${userId}`;
    await redisClient.del(cacheKey);
  }

  async scanDirectory(userId: string, libraryKey: string, directory: string): Promise<void> {
    const client = await this.getClientForUser(userId);
    await client.scanDirectory(libraryKey, directory);

    // Clear related caches
    const librariesKey = `${this.cachePrefix}libraries:${userId}`;
    const recentKey = `${this.cachePrefix}recent:${userId}`;
    await redisClient.del([librariesKey, recentKey]);
  }

  async getCollections(
    userId: string,
    libraryKey: string,
    options?: { search?: string; sort?: string },
  ) {
    const client = await this.getClientForUser(userId);
    const collections = await client.getCollections(libraryKey);

    // Apply filters if provided
    let filteredCollections = collections;

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      filteredCollections = filteredCollections.filter((collection: any) =>
        collection.title.toLowerCase().includes(searchLower),
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
    const client = await this.getClientForUser(userId);
    return client.getCollectionDetails(collectionKey);
  }

  async createCollection(
    userId: string,
    libraryKey: string,
    title: string,
    items: string[] = [],
  ): Promise<void> {
    const client = await this.getClientForUser(userId);
    await client.createCollection(libraryKey, title, items);
  }

  // Find YouTube library section
  async findYouTubeLibrary(userId: string): Promise<string | null> {
    const libraries = await this.getLibraries(userId);

    // Look for library with 'youtube' in the name or type
    const youtubeLib = libraries.find(
      (lib: any) =>
        lib.title.toLowerCase().includes('youtube') ||
        lib.type === 'youtube' ||
        lib.type === 'other', // YouTube content might be in 'other' type library
    );

    if (youtubeLib) {
      return youtubeLib.key;
    }

    // Fallback: look for 'Other Videos' or similar
    const otherLib = libraries.find(
      (lib: any) =>
        lib.title.toLowerCase().includes('other') || lib.title.toLowerCase().includes('video'),
    );

    return otherLib ? otherLib.key : null;
  }

  // Clean up idle clients periodically (every 30 minutes)
  startCleanupTimer(): void {
    setInterval(
      () => {
        const now = Date.now();
        const maxIdleTime = 30 * 60 * 1000; // 30 minutes

        // In a production app, we'd track last access time
        // For MVP, just clear all clients periodically
        if (this.clients.size > 10) {
          logger.info('Clearing Plex client cache', { count: this.clients.size });
          this.clients.clear();
        }
      },
      30 * 60 * 1000,
    );
  }
}

export const plexService = new PlexService();
