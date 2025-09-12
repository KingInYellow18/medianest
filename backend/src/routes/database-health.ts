/**
 * Database Health and Security Monitoring API
 * Provides comprehensive database health checks with security validation
 *
 * @author MediaNest Security Team
 * @version 1.0.0
 * @since 2025-09-11
 */

import { Router } from 'express';

import { configService } from '../config/config.service';
import { getRedis } from '../config/redis';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import {
  validateDatabaseSecurity,
  checkDatabaseConnectionSecurity,
  setDatabaseSecurityHeaders,
} from '../middleware/database-security';
import { createEnhancedRateLimit } from '../middleware/enhanced-rate-limit';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// Import database security manager
const { DatabaseSecurityManager } = require('../../../config/security/database-security');

// Apply middleware
router.use(createEnhancedRateLimit('healthCheck'));
router.use(validateDatabaseSecurity());
router.use(checkDatabaseConnectionSecurity());
router.use(setDatabaseSecurityHeaders());

/**
 * GET /api/database/health - Comprehensive database health check
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const healthData: any = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      databases: {
        postgresql: { status: 'unknown', latency: 0 },
        redis: { status: 'unknown', latency: 0 },
      },
      security: res.locals.databaseSecurityReport || { validated: false },
      environment: configService.get('server', 'NODE_ENV'),
    };

    try {
      // PostgreSQL Health Check
      const pgStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1 as test`;
      const pgLatency = Date.now() - pgStartTime;

      healthData.databases.postgresql = {
        status: 'healthy',
        latency: pgLatency,
        connectionPool: {
          // Basic connection info without exposing sensitive details
          configured: !!configService.get('database', 'DATABASE_URL'),
        },
      };

      logger.info('PostgreSQL health check passed', { latency: pgLatency });
    } catch (error) {
      healthData.databases.postgresql = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: 0,
      };
      healthData.status = 'degraded';

      logger.error('PostgreSQL health check failed', {
        error: error instanceof Error ? error.message : error,
      });
    }

    try {
      // Redis Health Check
      const redis = getRedis();
      const redisStartTime = Date.now();
      await redis.ping();
      const redisLatency = Date.now() - redisStartTime;

      // Get Redis info
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

      healthData.databases.redis = {
        status: 'healthy',
        latency: redisLatency,
        memory: {
          used: memoryMatch?.[1] || 'unknown',
        },
      };

      logger.info('Redis health check passed', { latency: redisLatency });
    } catch (error) {
      healthData.databases.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: 0,
      };
      healthData.status = 'degraded';

      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : error,
      });
    }

    // Overall status determination
    const allHealthy = Object.values(healthData.databases).every(
      (db: any) => db.status === 'healthy',
    );

    if (!allHealthy) {
      healthData.status = 'unhealthy';
    }

    // Set appropriate HTTP status
    const httpStatus = healthData.status === 'healthy' ? 200 : 503;

    res.status(httpStatus).json({
      success: healthData.status === 'healthy',
      data: healthData,
    });
  }),
);

/**
 * GET /api/database/security - Database security validation report
 * Requires authentication for detailed security information
 */
router.get(
  '/security',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const securityManager = new DatabaseSecurityManager();

    // Get configuration for security validation
    const dbConfig = {
      DATABASE_URL: configService.get('database', 'DATABASE_URL'),
      DB_HOST: process.env.DB_HOST,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      REDIS_URL: configService.get('redis', 'REDIS_URL'),
      REDIS_HOST: configService.get('redis', 'REDIS_HOST'),
      REDIS_PORT: configService.get('redis', 'REDIS_PORT'),
      REDIS_PASSWORD: configService.get('redis', 'REDIS_PASSWORD'),
    };

    // Validate security configuration
    const validationResults = securityManager.validateDatabaseSecurity(dbConfig);
    const securityReport = securityManager.generateSecurityReport(validationResults);

    // Detailed security information (admin only)
    const securityData = {
      timestamp: new Date().toISOString(),
      overall: validationResults.overall,
      postgresql: {
        secure: validationResults.postgresql.secure,
        issues: validationResults.postgresql.issues.map((issue: any) => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          recommendation: issue.recommendation,
        })),
      },
      redis: {
        secure: validationResults.redis.secure,
        issues: validationResults.redis.issues.map((issue: any) => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          recommendation: issue.recommendation,
        })),
      },
      recommendations: [
        ...(validationResults.postgresql.issues.length > 0
          ? ['Review PostgreSQL security configuration']
          : []),
        ...(validationResults.redis.issues.length > 0
          ? ['Review Redis security configuration']
          : []),
        'Regular security audits recommended',
        'Monitor database access patterns',
        'Keep database software updated',
      ],
      textReport: securityReport,
    };

    logger.info('Database security report requested', {
      user: req.user?.email,
      secure: validationResults.overall.secure,
      criticalIssues: validationResults.overall.criticalIssues,
      warnings: validationResults.overall.warnings,
    });

    res.json({
      success: true,
      data: securityData,
    });
  }),
);

/**
 * GET /api/database/connections - Database connection status
 * Admin-only endpoint for monitoring active connections
 */
router.get(
  '/connections',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const connectionData: any = {
      timestamp: new Date().toISOString(),
      postgresql: {
        configured: !!configService.get('database', 'DATABASE_URL'),
        poolSize: configService.get('database', 'DATABASE_POOL_SIZE') || 10,
        timeout: configService.get('database', 'DATABASE_TIMEOUT') || 30000,
      },
      redis: {
        configured: !!(
          configService.get('redis', 'REDIS_URL') || configService.get('redis', 'REDIS_HOST')
        ),
        host: configService.get('redis', 'REDIS_HOST'),
        port: configService.get('redis', 'REDIS_PORT'),
      },
    };

    try {
      // Test PostgreSQL connection
      await prisma.$queryRaw`SELECT current_database(), current_user`;
      connectionData.postgresql.status = 'connected';
    } catch (error) {
      connectionData.postgresql.status = 'disconnected';
      connectionData.postgresql.error = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // Test Redis connection
      const redis = getRedis();
      await redis.ping();
      connectionData.redis.status = 'connected';

      // Get connection info
      const info = await redis.info('clients');
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      connectionData.redis.connectedClients =
        clientsMatch && clientsMatch[1] ? parseInt(clientsMatch[1], 10) : 0;
    } catch (error) {
      connectionData.redis.status = 'disconnected';
      connectionData.redis.error = error instanceof Error ? error.message : 'Unknown error';
    }

    logger.info('Database connections report requested', {
      user: req.user?.email,
      postgresStatus: connectionData.postgresql.status,
      redisStatus: connectionData.redis.status,
    });

    res.json({
      success: true,
      data: connectionData,
    });
  }),
);

/**
 * POST /api/database/test-security - Test database security configuration
 * Admin-only endpoint for validating security changes
 */
router.post(
  '/test-security',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const { testConfig } = req.body;

    if (!testConfig || typeof testConfig !== 'object') {
      throw new AppError('INVALID_TEST_CONFIG', 'Test configuration is required', 400);
    }

    const securityManager = new DatabaseSecurityManager();

    // Merge test config with current config
    const dbConfig = {
      DATABASE_URL: testConfig.DATABASE_URL || configService.get('database', 'DATABASE_URL'),
      REDIS_URL: testConfig.REDIS_URL || configService.get('redis', 'REDIS_URL'),
      REDIS_PASSWORD: testConfig.REDIS_PASSWORD || configService.get('redis', 'REDIS_PASSWORD'),
      ...testConfig,
    };

    // Validate the test configuration
    const validationResults = securityManager.validateDatabaseSecurity(dbConfig);

    logger.info('Database security test requested', {
      user: req.user?.email,
      testConfigKeys: Object.keys(testConfig),
      secure: validationResults.overall.secure,
    });

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        testConfig: Object.keys(testConfig),
        results: validationResults,
        report: securityManager.generateSecurityReport(validationResults),
      },
    });
  }),
);

export default router;
