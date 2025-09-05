import { Express } from 'express';

import adminRoutes from './admin';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import { healthRouter } from './health';
import integrationsRoutes from './integrations';
import mediaRoutes from './media';
import plexRoutes from './plex';
import youtubeRoutes from './youtube';

export const setupRoutes = (app: Express) => {
  // Health check (no auth required)
  app.use('/api/health', healthRouter);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/plex', plexRoutes);
  app.use('/api/youtube', youtubeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/integrations', integrationsRoutes);

  // 404 handler
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });
};
