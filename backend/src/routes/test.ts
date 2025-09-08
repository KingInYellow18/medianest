import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Test database query endpoint for load testing
 */
router.post(
  '/db-query',
  async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      // Whitelist of allowed test queries for security
      const allowedQueries = [
        'SELECT COUNT(*) FROM information_schema.tables',
        'SELECT current_timestamp, pg_backend_pid()',
        "SELECT * FROM pg_stat_activity WHERE state = 'active' LIMIT 5",
        'SELECT datname, numbackends FROM pg_stat_database LIMIT 10',
        'SELECT usename, query_start, state FROM pg_stat_activity LIMIT 10',
        'SELECT 1 as health_check',
        'SELECT current_database() as db_name',
        'SELECT version() as pg_version',
      ];

      if (!allowedQueries.includes(query)) {
        return res.status(403).json({ error: 'Query not allowed for testing' });
      }

      const startTime = process.hrtime.bigint();
      const db = getDatabase();
      const result = await db.$queryRaw`${query}`;
      const endTime = process.hrtime.bigint();

      const executionTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      return res.json({
        success: true,
        executionTime: `${executionTime.toFixed(2)}ms`,
        rowCount: Array.isArray(result) ? result.length : 1,
        data: result,
      });
    } catch (error: any) {
      logger.error('Database query test error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Test Redis cache SET operation
 */
router.post(
  '/cache-set',
  async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const { key, value } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: 'Key and value are required' });
      }

      // Ensure test keys are prefixed to avoid conflicts
      const testKey = `load-test:${key}`;

      const startTime = process.hrtime.bigint();
      const redis = getRedis();
      await redis.set(testKey, JSON.stringify(value), 'EX', 300); // 5 minute expiry
      const endTime = process.hrtime.bigint();

      const executionTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      return res.json({
        success: true,
        executionTime: `${executionTime.toFixed(2)}ms`,
        key: testKey,
      });
    } catch (error: any) {
      logger.error('Redis set test error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Test Redis cache GET operation
 */
router.get(
  '/cache-get/:key',
  async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }

      // Ensure test keys are prefixed
      const testKey = `load-test:${key}`;

      const startTime = process.hrtime.bigint();
      const redis = getRedis();
      const value = await redis.get(testKey);
      const endTime = process.hrtime.bigint();

      const executionTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      return res.json({
        success: true,
        executionTime: `${executionTime.toFixed(2)}ms`,
        key: testKey,
        found: value !== null,
        value: value ? JSON.parse(value) : null,
      });
    } catch (error: any) {
      logger.error('Redis get test error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
