// @ts-nocheck
import { performance } from 'perf_hooks';

// @ts-ignore
import {
  recordDatabaseMetrics,
  recordRedisMetrics,
  recordExternalServiceMetrics,
  recordBusinessMetrics,
} from '../middleware/metrics';
import { CatchError } from '../types/common';

/**
 * Higher-order function to wrap database operations with metrics
 */
export function withDatabaseMetrics<T extends (...args: unknown[]) => Promise<any>>(
  operation: string,
  table: string,
  fn: T,
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const startTime = performance.now();
    let success = true;

    try {
      const result = await fn(...args);
      return result;
    } catch (error: CatchError) {
      success = false;
      throw error;
    } finally {
      const duration = (performance.now() - startTime) / 1000;
      (recordDatabaseMetrics as any).recordQuery(operation, table, duration, success);
    }
  }) as T;
}

/**
 * Higher-order function to wrap Redis operations with metrics
 */
export function withRedisMetrics<T extends (...args: unknown[]) => Promise<any>>(
  operation: string,
  fn: T,
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const startTime = performance.now();
    let success = true;

    try {
      const result = await fn(...args);
      return result;
    } catch (error: CatchError) {
      success = false;
      throw error;
    } finally {
      const duration = (performance.now() - startTime) / 1000;
      (recordRedisMetrics as any).recordOperation(operation, duration, success);
    }
  }) as T;
}

/**
 * Higher-order function to wrap external service calls with metrics
 */
export function withExternalServiceMetrics<T extends (...args: unknown[]) => Promise<any>>(
  service: string,
  endpoint: string,
  fn: T,
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const startTime = performance.now();
    let statusCode = 200;

    try {
      const result = await fn(...args);
      // Try to extract status code from result if it's a response object
      if (result && typeof result === 'object' && 'status' in result) {
        statusCode = result.status;
      }
      return result;
    } catch (error: CatchError) {
      // Extract status code from error if available
      statusCode = error?.response?.status || error?.status || 500;
      throw error;
    } finally {
      const duration = (performance.now() - startTime) / 1000;
      (recordExternalServiceMetrics as any).recordRequest(service, endpoint, duration, statusCode);
    }
  }) as T;
}

/**
 * Utility class for collecting periodic metrics
 */
export class MetricsCollector {
  private intervals: NodeJS.Timeout[] = [];
  private isCollecting = false;

  /**
   * Start collecting periodic metrics
   */
  start(): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;

    // Collect database connection pool metrics every 30 seconds
    const dbInterval = setInterval(async () => {
      try {
        // TODO: Replace with actual database pool status
        // const pool = await getConnectionPool();
        // recordDatabaseMetrics.updateConnectionPool(pool.active, pool.idle);

        // Placeholder values for now
        (recordDatabaseMetrics as any).updateConnectionPool(5, 10);
      } catch (error: CatchError) {
        // Use proper logger instead of console.error
        logger.error('Error collecting database metrics:', error);
      }
    }, 30000);

    // Collect Redis connection metrics every 30 seconds
    const redisInterval = setInterval(async () => {
      try {
        // TODO: Replace with actual Redis connection count
        // const connections = await getRedisConnections();
        // recordRedisMetrics.updateConnections(connections);

        // Placeholder value for now
        (recordRedisMetrics as any).updateConnections(2);
      } catch (error: CatchError) {
        // Use proper logger instead of console.error
        logger.error('Error collecting Redis metrics:', error);
      }
    }, 30000);

    // Collect business metrics every 60 seconds
    const businessInterval = setInterval(async () => {
      try {
        // TODO: Replace with actual business metric queries
        // const activeUsers = await getActiveUserCount();
        // const queueSizes = await getQueueSizes();
        // const libraryStats = await getMediaLibraryStats();

        // recordBusinessMetrics.updateActiveUsers(activeUsers);
        // recordBusinessMetrics.updateQueueSize('download', queueSizes.download);
        // recordBusinessMetrics.updateQueueSize('process', queueSizes.process);
        // recordBusinessMetrics.updateMediaLibrarySize('movies', libraryStats.movies);
        // recordBusinessMetrics.updateMediaLibrarySize('tv', libraryStats.tv);

        // Placeholder values for now
        (recordBusinessMetrics as any).updateActiveUsers(Math.floor(Math.random() * 50));
        (recordBusinessMetrics as any).updateQueueSize('download', Math.floor(Math.random() * 10));
        (recordBusinessMetrics as any).updateQueueSize('process', Math.floor(Math.random() * 5));
        (recordBusinessMetrics as any).updateMediaLibrarySize('movies', 1000);
        (recordBusinessMetrics as any).updateMediaLibrarySize('tv', 500);
      } catch (error: CatchError) {
        // Use proper logger instead of console.error
        logger.error('Error collecting business metrics:', error);
      }
    }, 60000);

    this.intervals.push(dbInterval, redisInterval, businessInterval);
  }

  /**
   * Stop collecting periodic metrics
   */
  stop(): void {
    if (!this.isCollecting) {
      return;
    }

    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    this.isCollecting = false;
  }

  /**
   * Get collection status
   */
  isActive(): boolean {
    return this.isCollecting;
  }
}

/**
 * Global metrics collector instance
 */
export const metricsCollector = new MetricsCollector();

/**
 * Utility functions for common metric patterns
 */
export const MetricsUtils = {
  /**
   * Record a media request with proper labels
   */
  recordMediaRequest(
    type: 'movie' | 'tv' | 'music',
    status: 'requested' | 'approved' | 'downloaded' | 'failed',
    userId: string,
  ): void {
    (recordBusinessMetrics as any).recordMediaRequest(type, status, userId);
  },

  /**
   * Record user activity with proper labels
   */
  recordUserActivity(
    activity: 'login' | 'logout' | 'search' | 'request' | 'download',
    userId: string,
  ): void {
    (recordBusinessMetrics as any).recordUserActivity(activity, userId);
  },

  /**
   * Helper to time operations
   */
  timeOperation<T>(fn: () => T): { result: T; duration: number } {
    const startTime = performance.now();
    const result = fn();
    const duration = (performance.now() - startTime) / 1000;
    return { result, duration };
  },

  /**
   * Helper to time async operations
   */
  async timeAsyncOperation<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const duration = (performance.now() - startTime) / 1000;
    return { result, duration };
  },

  /**
   * Create a timer that can be stopped later
   */
  createTimer(): () => number {
    const startTime = performance.now();
    return () => (performance.now() - startTime) / 1000;
  },
};
