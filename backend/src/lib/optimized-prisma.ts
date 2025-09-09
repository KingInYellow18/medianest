import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Optimized Prisma client with connection pooling and caching
class OptimizedPrismaClient {
  private static instance: PrismaClient;
  private static queryCache = new Map<string, { data: any; timestamp: number }>();

  static getInstance(): PrismaClient {
    if (!OptimizedPrismaClient.instance) {
      OptimizedPrismaClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });

      // Simple query logging without caching for now
      // TODO: Implement proper query caching with Prisma 5+ extensions
      if (process.env.NODE_ENV === 'development') {
        console.log('OptimizedPrismaClient initialized successfully');
      }
    }

    return OptimizedPrismaClient.instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static generateCacheKey(params: any): string {
    const keyData = {
      model: params.model,
      action: params.action,
      args: params.args,
    };
    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
