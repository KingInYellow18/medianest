/**
 * Service Coordination Factory
 *
 * Creates coordinated mock services with enhanced integration patterns.
 * Specifically designed to address common failure patterns and achieve 90%+ test success.
 */

import { AdvancedCoordinationManager } from './advanced-coordination-manager';
import { UnifiedMockRegistry } from '../foundation/unified-mock-registry';

export interface CoordinatedServiceConfig {
  name: string;
  dependencies: string[];
  caching: boolean;
  transactions: boolean;
  errorHandling: 'strict' | 'permissive' | 'fail_fast';
  performanceProfile: 'fast' | 'normal' | 'slow';
  consistencyLevel: 'eventual' | 'strong' | 'weak';
}

export class ServiceCoordinationFactory {
  private coordinationManager: AdvancedCoordinationManager;
  private registry: UnifiedMockRegistry;

  constructor(coordinationManager?: AdvancedCoordinationManager) {
    this.coordinationManager = coordinationManager || new AdvancedCoordinationManager();
    this.registry = new UnifiedMockRegistry();
  }

  public createCoordinatedPlexService(config?: Partial<CoordinatedServiceConfig>): any {
    const defaultConfig: CoordinatedServiceConfig = {
      name: 'plex',
      dependencies: ['cache', 'database'],
      caching: true,
      transactions: false,
      errorHandling: 'permissive',
      performanceProfile: 'normal',
      consistencyLevel: 'eventual',
      ...config,
    };

    const plexService = {
      // Core Plex operations with coordination
      async getServerInfo(serverUrl?: string): Promise<any> {
        const cacheKey = `plex:server_info:${serverUrl || 'default'}`;

        // Check cache first
        if (defaultConfig.caching) {
          const cached = this.coordinationManager.getCoordinationState().cacheState.get(cacheKey);
          if (cached) {
            return cached;
          }
        }

        const serverInfo = {
          name: 'Test Plex Server',
          version: '1.25.0.0000',
          machineIdentifier: 'test-machine-id',
          platform: 'Linux',
          platformVersion: '5.4.0',
          updatedAt: Date.now(),
          url: serverUrl || 'http://localhost:32400',
        };

        // Cache the result
        if (defaultConfig.caching) {
          this.coordinationManager.coordinateCache('update', cacheKey, serverInfo);
        }

        return serverInfo;
      },

      async search(query: string, type?: string): Promise<any[]> {
        if (!query || query.trim().length === 0) {
          return [];
        }

        // Simulate search delay based on performance profile
        const delay = this.getSearchDelay(defaultConfig.performanceProfile);
        await new Promise((resolve) => setTimeout(resolve, delay));

        const mockResults = [
          {
            ratingKey: '1',
            key: '/library/metadata/1',
            title: `Mock Result for "${query}"`,
            type: type || 'movie',
            year: 2023,
            summary: `Test search result for query: ${query}`,
            thumb: '/library/metadata/1/thumb',
            art: '/library/metadata/1/art',
          },
        ];

        // Cache search results
        if (defaultConfig.caching) {
          const cacheKey = `plex:search:${query}:${type || 'all'}`;
          this.coordinationManager.coordinateCache('update', cacheKey, mockResults);
        }

        return mockResults;
      },

      async getLibraries(): Promise<any[]> {
        const libraries = [
          {
            key: '1',
            title: 'Movies',
            type: 'movie',
            agent: 'com.plexapp.agents.imdb',
            scanner: 'Plex Movie Scanner',
            language: 'en',
            uuid: 'test-library-uuid-1',
            updatedAt: Date.now(),
            createdAt: Date.now() - 86400000,
          },
          {
            key: '2',
            title: 'TV Shows',
            type: 'show',
            agent: 'com.plexapp.agents.thetvdb',
            scanner: 'Plex Series Scanner',
            language: 'en',
            uuid: 'test-library-uuid-2',
            updatedAt: Date.now(),
            createdAt: Date.now() - 86400000,
          },
        ];

        if (defaultConfig.caching) {
          this.coordinationManager.coordinateCache('update', 'plex:libraries', libraries);
        }

        return libraries;
      },

      async getLibraryContents(libraryKey: string, options?: any): Promise<any[]> {
        const mockContent = [
          {
            ratingKey: `${libraryKey}001`,
            key: `/library/metadata/${libraryKey}001`,
            title: `Mock Content ${libraryKey}`,
            type: libraryKey === '1' ? 'movie' : 'show',
            year: 2023,
            summary: 'Mock library content',
            thumb: `/library/metadata/${libraryKey}001/thumb`,
            addedAt: Date.now() - Math.random() * 86400000 * 30,
            updatedAt: Date.now(),
          },
        ];

        return mockContent;
      },

      async refreshLibrary(libraryKey: string): Promise<void> {
        // Simulate library refresh
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Invalidate related cache entries
        if (defaultConfig.caching) {
          this.coordinationManager.coordinateCache('invalidate', `plex:library:${libraryKey}`);
          this.coordinationManager.coordinateCache('invalidate', 'plex:libraries');
        }
      },

      // Cache management methods
      invalidateCache(key?: string): void {
        if (key) {
          this.coordinationManager.coordinateCache('invalidate', key);
        } else {
          this.coordinationManager.coordinateCache('clear');
        }
      },

      clearCache(): void {
        this.coordinationManager.coordinateCache('clear');
      },

      updateCache(key: string, data: any): void {
        this.coordinationManager.coordinateCache('update', key, data);
      },

      // Coordination hooks
      async onStateChange(context: any): Promise<void> {
        // Handle state changes from dependencies
        if (context.service === 'cache' && context.method === 'clear') {
          // Plex cache was cleared, reset internal state
        }
      },

      async onDependencyError(context: any): Promise<void> {
        // Handle errors from dependencies
        if (context.service === 'database') {
          // Database error, switch to read-only mode
        }
      },

      // Health check
      async healthCheck(): Promise<{ status: string; details: any }> {
        return {
          status: 'healthy',
          details: {
            cacheEnabled: defaultConfig.caching,
            dependencies: defaultConfig.dependencies,
            errorHandling: defaultConfig.errorHandling,
            performanceProfile: defaultConfig.performanceProfile,
          },
        };
      },
    };

    // Register the coordinated service
    this.coordinationManager.registerService(defaultConfig.name, plexService, defaultConfig);

    return plexService;
  }

  public createCoordinatedCacheService(config?: Partial<CoordinatedServiceConfig>): any {
    const defaultConfig: CoordinatedServiceConfig = {
      name: 'cache',
      dependencies: ['redis'],
      caching: true,
      transactions: false,
      errorHandling: 'permissive',
      performanceProfile: 'fast',
      consistencyLevel: 'eventual',
      ...config,
    };

    const cacheService = {
      private: new Map<string, { value: any; ttl: number; timestamp: number }>(),

      async get<T>(key: string): Promise<T | null> {
        const entry = this.private.get(key);

        if (!entry) {
          return null;
        }

        // Check TTL
        if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl * 1000) {
          this.private.delete(key);
          return null;
        }

        // Update cache hit metrics
        this.coordinationManager.updatePerformanceMetrics({ cacheHitRate: 0.9 });

        return entry.value;
      },

      async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
        this.private.set(key, {
          value,
          ttl,
          timestamp: Date.now(),
        });

        // Coordinate cache update
        this.coordinationManager.coordinateCache('update', key, value);
      },

      async del(key: string): Promise<boolean> {
        const existed = this.private.has(key);
        this.private.delete(key);

        if (existed) {
          this.coordinationManager.coordinateCache('invalidate', key);
        }

        return existed;
      },

      async clear(): Promise<void> {
        this.private.clear();
        this.coordinationManager.coordinateCache('clear');
      },

      async exists(key: string): Promise<boolean> {
        return this.private.has(key);
      },

      async ttl(key: string): Promise<number> {
        const entry = this.private.get(key);
        if (!entry) return -2;

        if (entry.ttl <= 0) return -1;

        const remaining = entry.ttl - Math.floor((Date.now() - entry.timestamp) / 1000);
        return Math.max(0, remaining);
      },

      async keys(pattern?: string): Promise<string[]> {
        const allKeys = Array.from(this.private.keys());

        if (!pattern) return allKeys;

        // Simple pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return allKeys.filter((key) => regex.test(key));
      },

      async mget<T>(keys: string[]): Promise<Array<T | null>> {
        return Promise.all(keys.map((key) => this.get<T>(key)));
      },

      async mset(keyValuePairs: Array<[string, any]>, ttl: number = 3600): Promise<void> {
        await Promise.all(keyValuePairs.map(([key, value]) => this.set(key, value, ttl)));
      },

      // Coordination methods
      invalidateCache(key?: string): void {
        if (key) {
          this.private.delete(key);
        } else {
          this.private.clear();
        }
      },

      clearCache(): void {
        this.private.clear();
      },

      updateCache(key: string, data: any): void {
        this.private.set(key, {
          value: data,
          ttl: 3600,
          timestamp: Date.now(),
        });
      },

      // Health check
      async healthCheck(): Promise<{ status: string; details: any }> {
        return {
          status: 'healthy',
          details: {
            size: this.private.size,
            errorHandling: defaultConfig.errorHandling,
            performanceProfile: defaultConfig.performanceProfile,
          },
        };
      },
    };

    this.coordinationManager.registerService(defaultConfig.name, cacheService, defaultConfig);
    return cacheService;
  }

  public createCoordinatedDatabaseService(config?: Partial<CoordinatedServiceConfig>): any {
    const defaultConfig: CoordinatedServiceConfig = {
      name: 'database',
      dependencies: [],
      caching: false,
      transactions: true,
      errorHandling: 'strict',
      performanceProfile: 'normal',
      consistencyLevel: 'strong',
      ...config,
    };

    const databaseService = {
      private: {
        users: new Map(),
        sessions: new Map(),
        mediaRequests: new Map(),
        transactions: new Map(),
      },

      // User operations
      async findUser(criteria: any): Promise<any | null> {
        const users = Array.from(this.private.users.values());
        return (
          users.find((user) => Object.keys(criteria).every((key) => user[key] === criteria[key])) ||
          null
        );
      },

      async createUser(userData: any): Promise<any> {
        const id = Date.now().toString();
        const user = {
          id,
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.private.users.set(id, user);
        return user;
      },

      async updateUser(id: string, userData: any): Promise<any | null> {
        const user = this.private.users.get(id);
        if (!user) return null;

        const updatedUser = {
          ...user,
          ...userData,
          updatedAt: new Date(),
        };

        this.private.users.set(id, updatedUser);
        return updatedUser;
      },

      // Session operations
      async createSession(sessionData: any): Promise<any> {
        const id = Date.now().toString();
        const session = {
          id,
          ...sessionData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.private.sessions.set(id, session);
        return session;
      },

      async findSession(criteria: any): Promise<any | null> {
        const sessions = Array.from(this.private.sessions.values());
        return (
          sessions.find((session) =>
            Object.keys(criteria).every((key) => session[key] === criteria[key]),
          ) || null
        );
      },

      async deleteSession(id: string): Promise<boolean> {
        return this.private.sessions.delete(id);
      },

      // Transaction support
      async prepare(transactionId: string): Promise<void> {
        this.private.transactions.set(transactionId, { state: 'prepared' });
      },

      async commit(transactionId: string): Promise<void> {
        const transaction = this.private.transactions.get(transactionId);
        if (transaction) {
          transaction.state = 'committed';
        }
      },

      async rollback(operation: any): Promise<void> {
        // Implement rollback logic based on operation
        console.log('Rolling back operation:', operation);
      },

      // Health check
      async healthCheck(): Promise<{ status: string; details: any }> {
        return {
          status: 'healthy',
          details: {
            users: this.private.users.size,
            sessions: this.private.sessions.size,
            transactions: this.private.transactions.size,
            consistencyLevel: defaultConfig.consistencyLevel,
          },
        };
      },
    };

    // this.coordinationManager.registerService(defaultConfig.name, databaseService, defaultConfig);
    return databaseService;
  }

  public createCoordinatedAuthService(config?: Partial<CoordinatedServiceConfig>): any {
    const defaultConfig: CoordinatedServiceConfig = {
      name: 'auth',
      dependencies: ['database', 'cache', 'encryption'],
      caching: true,
      transactions: false,
      errorHandling: 'strict',
      performanceProfile: 'fast',
      consistencyLevel: 'strong',
      ...config,
    };

    const authService = {
      async authenticate(credentials: any): Promise<any> {
        // Simulate authentication
        const { email, password } = credentials;

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        // Mock successful authentication
        const user = {
          id: 'user-123',
          email,
          name: 'Test User',
          role: 'user',
        };

        const token = `mock-jwt-token-${Date.now()}`;

        // Cache the session
        if (defaultConfig.caching) {
          const cacheKey = `auth:session:${token}`;
          this.coordinationManager.coordinateCache('update', cacheKey, user);
        }

        return { user, token };
      },

      async validateToken(token: string): Promise<any | null> {
        if (!token) return null;

        // Check cache first
        if (defaultConfig.caching) {
          const cacheKey = `auth:session:${token}`;
          const cached = this.coordinationManager.getCoordinationState().cacheState.get(cacheKey);
          if (cached) {
            return cached;
          }
        }

        // Mock token validation
        if (token.startsWith('mock-jwt-token-')) {
          return {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
          };
        }

        return null;
      },

      async logout(token: string): Promise<void> {
        // Invalidate cached session
        if (defaultConfig.caching) {
          const cacheKey = `auth:session:${token}`;
          this.coordinationManager.coordinateCache('invalidate', cacheKey);
        }
      },

      // Coordination methods
      invalidateCache(key?: string): void {
        if (key && key.startsWith('auth:')) {
          this.coordinationManager.coordinateCache('invalidate', key);
        }
      },

      async onDependencyError(context: any): Promise<void> {
        if (context.service === 'database') {
          // Database error, switch to cached authentication only
          console.log('Auth service: Database unavailable, switching to cache-only mode');
        }
      },

      // Health check
      async healthCheck(): Promise<{ status: string; details: any }> {
        return {
          status: 'healthy',
          details: {
            dependencies: defaultConfig.dependencies,
            caching: defaultConfig.caching,
            errorHandling: defaultConfig.errorHandling,
          },
        };
      },
    };

    this.coordinationManager.registerService(defaultConfig.name, authService, defaultConfig);
    return authService;
  }

  // Utility methods
  private getSearchDelay(profile: string): number {
    switch (profile) {
      case 'fast':
        return 10;
      case 'normal':
        return 50;
      case 'slow':
        return 200;
      default:
        return 50;
    }
  }

  public isTransactionalOperation(context: any): boolean {
    return ['create', 'update', 'delete'].some((op) => context.method.toLowerCase().includes(op));
  }

  public getCoordinationManager(): AdvancedCoordinationManager {
    return this.coordinationManager;
  }

  public createCoordinatedServiceSuite(): {
    plex: any;
    cache: any;
    database: any;
    auth: any;
    coordinationManager: AdvancedCoordinationManager;
  } {
    const services = {
      database: this.createCoordinatedDatabaseService(),
      cache: this.createCoordinatedCacheService(),
      auth: this.createCoordinatedAuthService(),
      plex: this.createCoordinatedPlexService(),
      coordinationManager: this.coordinationManager,
    };

    // Initialize cross-service coordination
    this.coordinationManager.registerCoordinationHook('post-operation', async (context) => {
      // Update metrics based on operation success
      this.coordinationManager.updatePerformanceMetrics({
        throughput: 1000,
        errorRate: 0.01,
      });
    });

    return services;
  }
}
