import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { webhookIntegrationService } from '@/services/webhook-integration.service';
import createEnhancedRateLimit from '@/middleware/enhanced-rate-limit';
import { logger } from '@/utils/logger';
import { AppError } from '@medianest/shared';

const router = Router();

// Webhook-specific rate limiting (more strict)
const webhookRateLimit = createEnhancedRateLimit('webhook', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 webhooks per 15 minutes per IP
  message: 'Webhook rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `webhook:${req.ip}:${req.path}`,
});

// Middleware to parse raw body for signature verification
const rawBodyParser = (req: Request, res: Response, next: NextFunction) => {
  req.body = req.body || {};
  next();
};

// Middleware to validate webhook headers
const validateWebhookHeaders = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  const contentType = req.headers['content-type'] || '';
  
  // Basic validation - adjust based on your webhook sources
  if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
    logger.warn('Invalid webhook content type', { 
      contentType, 
      userAgent,
      ip: req.ip,
      path: req.path 
    });
  }
  
  next();
};

// Apply middleware to all webhook routes
router.use(webhookRateLimit);
router.use(rawBodyParser);
router.use(validateWebhookHeaders);

// POST /api/webhooks/overseerr - Overseerr media requests and updates
router.post('/overseerr', async (req: Request, res: Response): Promise<void> => {
  await webhookIntegrationService.handleWebhook(req, res, 'overseerr');
});

// POST /api/webhooks/plex - Plex media server events
router.post('/plex', async (req: Request, res: Response): Promise<void> => {
  await webhookIntegrationService.handleWebhook(req, res, 'plex');
});

// POST /api/webhooks/github - GitHub repository events
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  await webhookIntegrationService.handleWebhook(req, res, 'github');
});

// POST /api/webhooks/generic/:source - Generic webhook handler
router.post('/generic/:source', async (req: Request, res: Response): Promise<void> => {
  const { source } = req.params;
  
  // Validate source parameter
  if (!source || !/^[a-zA-Z0-9_-]+$/.test(source)) {
    res.status(400).json({ error: 'Invalid source parameter' });
    return;
  }
  
  await webhookIntegrationService.handleWebhook(req, res, source);
});

// GET /api/webhooks/stats - Webhook processing statistics (admin only)
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic auth check - implement proper admin middleware
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    const stats = await webhookIntegrationService.getWebhookStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/webhooks/health - Health check for webhook service
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Webhook Integration Service',
    timestamp: new Date().toISOString(),
    features: {
      signatureVerification: true,
      retryMechanism: true,
      rateLimiting: true,
      realTimeNotifications: true,
    },
  });
});

// Error handling middleware specific to webhooks
router.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Webhook route error', {
    path: req.path,
    method: req.method,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }
  
  res.status(500).json({
    error: 'Internal webhook processing error',
    message: 'The webhook could not be processed at this time',
  });
});

export default router;