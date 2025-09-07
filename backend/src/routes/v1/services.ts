import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

/**
 * Service monitoring status endpoint
 * Returns status of various services for monitoring
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
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

    res.json({
      success: true,
      data: {
        services,
        timestamp: new Date().toISOString(),
        summary: {
          total: services.length,
          online: services.filter((s) => s.status === 'online').length,
          offline: services.filter((s) => s.status === 'offline').length,
          degraded: services.filter((s) => s.status === 'degraded').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching service status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch service status',
    });
  }
});

export default router;
