import 'tsconfig-paths/register';
import 'dotenv/config';
import { createServer } from 'http';

import compression from 'compression';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import helmet from 'helmet';

import { initializeDatabase } from './config/database';
import { initializeQueues } from './config/queues';
import { initializeRedis } from './config/redis';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { setupRoutes } from './routes';
import { socketService } from './services/socket.service';
import { initializeSocketServer } from './socket';
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
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(compression());
app.use(json());
app.use(urlencoded({ extended: true }));
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

  void (async () => {
    const monitoring = await import('./utils/monitoring');
    res.json(monitoring.metrics.getMetrics());
  })();
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

    // Initialize Socket.io
    const io = initializeSocketServer(httpServer);
    socketService.initialize(io);
    logger.info('Socket.io initialized');

    // Initialize external services
    await initializeServices();

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

// Initialize external services
async function initializeServices() {
  try {
    // Initialize Plex service
    const { plexService } = await import('./services/plex.service');
    plexService.startCleanupTimer();
    logger.info('Plex service initialized');

    // Initialize Overseerr service
    const { overseerrService } = await import('./services/overseerr.service');
    await overseerrService.initialize();
    logger.info('Overseerr service initialized');

    // Initialize Status service (Uptime Kuma)
    const { statusService } = await import('./services/status.service');
    await statusService.initialize();
    logger.info('Status service initialized');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    // Continue running even if external services fail
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Disconnect services
  void (async () => {
    const { statusService } = await import('./services/status.service');
    statusService.disconnect();
  })();

  httpServer.close(() => {
    logger.info('HTTP server closed');
    // Allow process to exit naturally
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }, 10000).unref();
});

void startServer();
// Test comment
// Test comment for lint-staged
