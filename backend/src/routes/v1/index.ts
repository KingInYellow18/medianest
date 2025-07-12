import { Router } from 'express';

import { authenticate } from '@/middleware/auth';

import adminRoutes from './admin';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import mediaRoutes from './media';
import plexRoutes from './plex';
import webhookRoutes from './webhooks';
import youtubeRoutes from './youtube';

const router = Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes); // Webhooks don't require auth

// Protected routes
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/media', authenticate, mediaRoutes);
router.use('/plex', authenticate, plexRoutes);
router.use('/youtube', authenticate, youtubeRoutes);

// Admin routes
router.use('/admin', authenticate, adminRoutes);

export default router;
