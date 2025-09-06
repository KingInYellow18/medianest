import { Router } from 'express';

import { authenticate } from '@/middleware/auth';

import adminRoutes from './admin';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import healthRoutes from './health';
import mediaRoutes from './media';
import plexRoutes from './plex';
import webhookRoutes from './webhooks';
import youtubeRoutes from './youtube';
import { errorsRoutes } from './errors.routes';
import { router as csrfRoutes } from './csrf';
import { performanceRoutes } from '../performance';
import { resilienceRouter } from './resilience';
import { simpleHealthRouter } from '../simple-health';

const router = Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/simple-health', simpleHealthRouter); // Simple health for Docker
router.use('/csrf', csrfRoutes); // CSRF endpoints available to all
router.use('/webhooks', webhookRoutes); // Webhooks don't require auth
router.use('/resilience', resilienceRouter); // Resilience monitoring (public for health checks)

// Protected routes
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/media', authenticate, mediaRoutes);
router.use('/performance', authenticate, performanceRoutes);
router.use('/plex', authenticate, plexRoutes);
router.use('/youtube', authenticate, youtubeRoutes);
router.use('/errors', authenticate, errorsRoutes);

// Admin routes
router.use('/admin', authenticate, adminRoutes);

export default router;
