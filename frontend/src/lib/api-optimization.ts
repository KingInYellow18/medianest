import { NextApiRequest, NextApiResponse } from 'next';
import { apiCache } from '@medianest/shared/cache/performance-cache';

// High-performance API route wrapper
export function withPerformanceOptimization(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();

    // Set performance headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable compression
    res.setHeader('Content-Encoding', 'gzip');

    // CORS optimization
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(200).end();
    }

    // Caching for GET requests
    if (req.method === 'GET') {
      const cacheKey = apiCache.generateKey(req.method, req.url, req.query);
      const cached = await apiCache.get(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
        return res.status(200).json(cached);
      }

      // Execute handler
      const originalSend = res.json;
      res.json = function (data: any) {
        // Cache successful responses
        if (res.statusCode === 200) {
          apiCache.set(cacheKey, data, 300000); // 5 minutes
        }
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
        return originalSend.call(this, data);
      };
    }

    // Rate limiting headers
    res.setHeader('X-RateLimit-Limit', '1000');
    res.setHeader('X-RateLimit-Remaining', '999');
    res.setHeader('X-RateLimit-Reset', Date.now() + 3600000);

    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

// Database query optimization helper
export async function withDatabaseOptimization<T>(
  operation: () => Promise<T>,
  cacheKey?: string,
  ttl = 300000
): Promise<T> {
  if (cacheKey) {
    const cached = await apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = await operation();

  if (cacheKey && result) {
    await apiCache.set(cacheKey, result, ttl);
  }

  return result;
}

// Export utilities
export { apiCache };
