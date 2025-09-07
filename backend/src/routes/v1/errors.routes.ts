import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../lib/logger';
import { errorRepository } from '../../repositories/error.repository';

const router = Router();

// Schema for error reporting from frontend
const errorReportSchema = z.object({
  errors: z.array(
    z.object({
      timestamp: z.string(),
      level: z.enum(['debug', 'info', 'warn', 'error']),
      message: z.string(),
      error: z
        .object({
          message: z.string(),
          stack: z.string().optional(),
          code: z.string().optional(),
          statusCode: z.number().optional(),
        })
        .optional(),
      context: z.any().optional(),
    }),
  ),
  timestamp: z.string(),
  userAgent: z.string(),
  url: z.string(),
});

/**
 * POST /api/v1/errors/report
 * Report errors from frontend
 */
router.post(
  '/report',
  authMiddleware,
  validateRequest({ body: errorReportSchema }),
  asyncHandler(async (req, res) => {
    const { errors, timestamp, userAgent, url } = req.body;
    const userId = req.user!.id;
    const correlationId = req.correlationId;

    // Log each error
    for (const errorEntry of errors) {
      const logData = {
        correlationId,
        userId,
        source: 'frontend',
        userAgent,
        url,
        ...errorEntry,
      };

      // Use appropriate log level
      switch (errorEntry.level) {
        case 'debug':
          logger.debug('Frontend error reported', logData);
          break;
        case 'info':
          logger.info('Frontend error reported', logData);
          break;
        case 'warn':
          logger.warn('Frontend error reported', logData);
          break;
        case 'error':
        default:
          logger.error('Frontend error reported', logData);

          // Store error in database for analysis
          if (errorEntry.error) {
            await errorRepository.create({
              correlationId,
              userId,
              errorCode: (errorEntry.error as any).code || 'FRONTEND_ERROR',
              errorMessage: errorEntry.error.message as any,
              stackTrace: errorEntry.error.stack as any,
              requestPath: url,
              requestMethod: 'N/A',
              statusCode: (errorEntry.error as any).statusCode || 500,
              metadata: {
                userAgent,
                context: errorEntry.context,
                timestamp: errorEntry.timestamp,
              },
            });
          }
          break;
      }
    }

    res.json({
      success: true,
      message: 'Errors reported successfully',
      correlationId,
    });
  }),
);

/**
 * GET /api/v1/errors/recent
 * Get recent errors for the current user (admin only shows all)
 */
router.get(
  '/recent',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const errors = await errorRepository.findRecent(userId, limit);

    res.json({
      success: true,
      data: errors,
    });
  }),
);

export const errorsRoutes = router;
