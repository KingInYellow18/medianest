import 'tsconfig-paths/register';
import 'dotenv/config';
import { createServer } from 'http';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { initializeDatabase } from './config/database';
import { initializeQueues } from './config/queues';
import { initializeRedis } from './config/redis';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { setupRoutes } from './routes';
import { setIntegrationService } from './routes/integrations';
import { IntegrationService } from './services/integration.service';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Trust proxy - important for reverse proxy setup
app.set('trust proxy', true);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint (protected in production)
app.get('/metrics', (req, res) => {
  // In production, protect this endpoint
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { metrics } = require('./utils/monitoring');
  res.json(metrics.getMetrics());
});

// Setup routes
setupRoutes(app);

// Error handling
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected');

    // Initialize queues
    await initializeQueues();
    logger.info('Queues initialized');

    // Initialize integration service
    const integrationService = new IntegrationService({
      plex: {
        enabled: process.env.PLEX_ENABLED === 'true',
        defaultToken: process.env.PLEX_DEFAULT_TOKEN,
        serverUrl: process.env.PLEX_SERVER_URL,
      },
      overseerr: {
        enabled: process.env.OVERSEERR_ENABLED === 'true',
        url: process.env.OVERSEERR_URL,
        apiKey: process.env.OVERSEERR_API_KEY,
      },
      uptimeKuma: {
        enabled: process.env.UPTIME_KUMA_ENABLED === 'true',
        url: process.env.UPTIME_KUMA_URL,
        username: process.env.UPTIME_KUMA_USERNAME,
        password: process.env.UPTIME_KUMA_PASSWORD,
      },
    });

    await integrationService.initialize();
    setIntegrationService(integrationService);
    globalIntegrationService = integrationService;
    logger.info('External service integrations initialized');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Store integration service for graceful shutdown
let globalIntegrationService: IntegrationService | null = null;

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  if (globalIntegrationService) {
    await globalIntegrationService.shutdown();
    logger.info('Integration service shutdown complete');
  }

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

startServer();
