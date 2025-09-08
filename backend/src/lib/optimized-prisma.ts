import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Optimized Prisma client with connection pooling and caching
class OptimizedPrismaClient {
  private static instance: PrismaClient;
  private static queryCache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL = 300000; // 5 minutes

  static getInstance(): PrismaClient {
    if (!OptimizedPrismaClient.instance) {
      OptimizedPrismaClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        // Connection pooling optimization
        __internal: {
          engine: {
            // Optimize connection pool
            connection_limit: 20,
            pool_timeout: 10,
            socket_timeout: 30,
          },
        },
      });

      // Add query caching middleware
      OptimizedPrismaClient.instance.$use(async (params, next) => {
        // Only cache read operations
        if (
          params.action === 'findMany' ||
          params.action === 'findUnique' ||
          params.action === 'findFirst'
        ) {
          const queryKey = OptimizedPrismaClient.generateCacheKey(params);
          const cached = OptimizedPrismaClient.queryCache.get(queryKey);

          if (cached && Date.now() - cached.timestamp < OptimizedPrismaClient.CACHE_TTL) {
            console.log(`Cache hit for: ${params.model}.${params.action}`);
            return cached.data;
          }

          const result = await next(params);
          OptimizedPrismaClient.queryCache.set(queryKey, {
            data: result,
            timestamp: Date.now(),
          });

          return result;
        }

        // Clear relevant cache entries on write operations
        if (['create', 'update', 'delete', 'upsert'].includes(params.action)) {
          OptimizedPrismaClient.clearModelCache(params.model);
        }

        return next(params);
      });
    }

    return OptimizedPrismaClient.instance;
  }

  private static generateCacheKey(params: any): string {
    const keyData = {
      model: params.model,
      action: params.action,
      args: params.args,
    };
    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  private static clearModelCache(model?: string) {
    if (model) {
      for (const [key] of OptimizedPrismaClient.queryCache) {
        if (key.includes(model)) {
          OptimizedPrismaClient.queryCache.delete(key);
        }
      }
    } else {
      OptimizedPrismaClient.queryCache.clear();
    }
  }

  static async disconnect() {
    if (OptimizedPrismaClient.instance) {
      await OptimizedPrismaClient.instance.$disconnect();
    }
  }
}

export default OptimizedPrismaClient;
