/**
 * Metrics endpoint for Prometheus monitoring
 * Provides application and system metrics in Prometheus format
 */

import { Request, Response, Router } from 'express';

import { register } from '@/middleware/metrics';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /metrics
 * Returns Prometheus metrics with bearer token authentication
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check for bearer token authentication
    const authHeader = req.headers.authorization;
    const expectedToken = env.METRICS_TOKEN;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Metrics endpoint accessed without proper authorization', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!expectedToken || token !== expectedToken) {
      logger.warn('Metrics endpoint accessed with invalid token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid bearer token',
      });
    }

    // Return Prometheus metrics
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.status(200).send(metrics);

    logger.debug('Metrics endpoint accessed successfully', {
      ip: req.ip,
      metricsSize: metrics.length,
    });
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate metrics',
    });
  }
});

export default router;
