/**
 * Simple Health Check Routes
 *
 * Provides basic health endpoints without dependencies on complex systems
 * for Docker container health checks and quick status verification.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

const router = Router();

/**
 * Simple health check endpoint
 * Returns basic service status without authentication or database dependencies
 */
router.get('/', (_req: Request, res: Response) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  res.json({
    status: 'healthy',
    service: 'medianest-backend',
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
    },
    pid: process.pid,
  });
});

/**
 * Readiness check endpoint
 * Indicates if the service is ready to accept requests
 */
router.get('/ready', (req: Request, res: Response) => {
  const checks = [];
  let allReady = true;

  // Check if basic dependencies are available
  try {
    // Check if prisma client is available
    const prisma = req.app.get('prisma');
    checks.push({
      name: 'database',
      status: prisma ? 'ready' : 'not_configured',
    });
  } catch (error: CatchError) {
    checks.push({
      name: 'database',
      status: 'error',
      error: error instanceof Error ? error.message : ('Unknown error' as any),
    });
    allReady = false;
  }

  try {
    // Check if redis is available
    const redis = req.app.get('redis');
    checks.push({
      name: 'cache',
      status: redis ? 'ready' : 'not_configured',
    });
  } catch (error: CatchError) {
    checks.push({
      name: 'cache',
      status: 'error',
      error: error instanceof Error ? error.message : ('Unknown error' as any),
    });
    allReady = false;
  }

  const response = {
    status: allReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  };

  res.status(allReady ? 200 : 503).json(response);
});

/**
 * Liveness check endpoint
 * Indicates if the service is alive and running
 */
router.get('/live', (_req: Request, res: Response) => {
  // Simple alive check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as simpleHealthRouter };
