import { Router, Request, Response } from 'express';

import { sendSuccess, asyncHandler } from '../../utils/response.utils';

const router = Router();

/**
 * Service monitoring status endpoint
 * Returns status of various services for monitoring
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    // Mock service status data for testing
    // In production this would check actual service health
    const services = [
      {
        name: 'Database',
        status: 'online',
        responseTime: 15,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Redis Cache',
        status: 'online',
        responseTime: 3,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Plex API',
        status: 'online',
        responseTime: 120,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'YouTube API',
        status: 'online',
        responseTime: 85,
        lastCheck: new Date().toISOString(),
      },
    ];

    const data = {
      services,
      timestamp: new Date().toISOString(),
      summary: {
        total: services.length,
        online: services.filter((s) => s.status === 'online').length,
        offline: services.filter((s) => s.status === 'offline').length,
        degraded: services.filter((s) => s.status === 'degraded').length,
      },
    };

    sendSuccess(res, data);
  }),
);

export default router;
