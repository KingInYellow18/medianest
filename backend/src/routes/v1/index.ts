import { Router } from 'express';

import { authenticate } from '@/middleware/auth';

import adminRoutes from './admin';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import healthRoutes from './health';
import mediaRoutes from './media';
import plexRoutes from './plex';
import servicesRoutes from './services';
import webhookRoutes from './webhooks';
import youtubeRoutes from './youtube';
import { errorsRoutes } from './errors.routes';
import { router as csrfRoutes } from './csrf';
import { performanceRoutes } from '../performance';
import { resilienceRouter } from './resilience';
import { simpleHealthRouter } from '../simple-health';

// Context7 Pattern: Optimized Router with Performance Considerations
const router = Router();

// Context7 Pattern: Enhanced route grouping with performance optimizations
// Public routes (no authentication middleware overhead) - optimized order by frequency
router.use('/health', healthRoutes); // Most frequent - health checks
router.use('/simple-health', simpleHealthRouter); // Docker health checks
router.use('/auth', authRoutes); // High frequency - authentication endpoints
router.use('/webhooks', webhookRoutes); // Medium frequency - external webhooks
router.use('/csrf', csrfRoutes); // CSRF endpoints available to all
router.use('/resilience', resilienceRouter); // Low frequency - monitoring

// Context7 Pattern: Enhanced authentication with route-specific optimizations
const protectedRouter = Router();

// Context7 Pattern: Pre-authentication middleware for performance metrics
protectedRouter.use((req, res, next) => {
  // Add authentication start time for performance monitoring
  (req as any).authStartTime = Number(process.hrtime.bigint());
  next();
});

protectedRouter.use(authenticate); // Single authentication point

// Context7 Pattern: Post-authentication metrics
protectedRouter.use((req, res, next) => {
  const authStartTime = (req as any).authStartTime;
  if (authStartTime) {
    const authDuration = (Number(process.hrtime.bigint()) - authStartTime) / 1e6;
    res.setHeader('X-Auth-Time', `${authDuration.toFixed(2)}ms`);
  }
  next();
});

// Context7 Pattern: Protected routes ordered by frequency and resource intensity
// High frequency, low resource routes first
protectedRouter.use('/dashboard', dashboardRoutes); // Most frequent user endpoint
protectedRouter.use('/media', mediaRoutes); // High frequency media operations
protectedRouter.use('/services', servicesRoutes); // Service status checks
protectedRouter.use('/performance', performanceRoutes); // Performance monitoring
protectedRouter.use('/plex', plexRoutes); // Plex integration
protectedRouter.use('/youtube', youtubeRoutes); // YouTube operations
protectedRouter.use('/errors', errorsRoutes); // Error handling
// Resource-intensive routes last
protectedRouter.use('/admin', adminRoutes); // Admin operations (typically heavier)

// Mount protected routes
router.use('/', protectedRouter);

export default router;
