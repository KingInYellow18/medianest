import { Express } from 'express';

import { healthRouter } from './health';
import { simpleHealthRouter } from './simple-health';
import v1Routes from './v1';

export const setupRoutes = (app: Express) => {
  // Simple health check for Docker (no auth required)
  app.use('/health', simpleHealthRouter);

  // Detailed health check (no auth required, unversioned)
  app.use('/api/health', healthRouter);

  // API v1 routes
  app.use('/api/v1', v1Routes);

  // Future versions would be added here
  // app.use('/api/v2', v2Routes);

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
