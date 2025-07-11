import { PlexClient } from '@/integrations/plex/plex.client';
import { userRepository, serviceConfigRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';
import { redisClient } from '@/config/redis';
import { encryptionService } from './encryption.service';

export class PlexService {
  private clients: Map<string, PlexClient> = new Map();
  private cachePrefix = 'plex:';
  private cacheTTL = {
    serverInfo: 3600,    // 1 hour
    libraries: 300,      // 5 minutes
    search: 60,          // 1 minute
    recentlyAdded: 300   // 5 minutes
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
    } catch (error) {
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
    await redisClient.setex(
      cacheKey, 
      this.cacheTTL.serverInfo, 
      JSON.stringify(serverInfo)
    );

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
    await redisClient.setex(
      cacheKey, 
      this.cacheTTL.libraries, 
      JSON.stringify(libraries)
    );

    return libraries;
  }

  async getLibraryItems(userId: string, libraryKey: string, options?: {
    offset?: number;
    limit?: number;
  }) {
    // Library items are not cached due to potential size
    const client = await this.getClientForUser(userId);
    return client.getLibraryItems(libraryKey, options);
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
    await redisClient.setex(
      cacheKey, 
      this.cacheTTL.search, 
      JSON.stringify(results)
    );

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
    await redisClient.setex(
      cacheKey, 
      this.cacheTTL.recentlyAdded, 
      JSON.stringify(items)
    );

    return items;
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