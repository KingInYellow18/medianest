import 'tsconfig-paths/register';
import 'dotenv/config';
import { createServer } from 'http';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { initializeDatabase } from './config/database';
import { initializeQueues } from './config/queues';
import { initializeRedis } from './config/redis';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { errorHandler } from './middleware/error';
import {
  handleUncaughtException,
  handleUnhandledRejection,
  notFoundHandler,
  secureErrorHandler,
} from './middleware/secure-error';
import { securityHeaders } from './middleware/security';
import { requestLogger } from './middleware/logging';
import { setupRoutes } from './routes';
import { setIntegrationService } from './routes/integrations';
import { IntegrationService } from './services/integration.service';
import { MediaNestSocketServer } from './socket/socket-server';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Trust proxy - important for reverse proxy setup
app.set('trust proxy', true);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow media embedding
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Strict API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 500,
  message: {
    error: 'Too many API requests, please try again later.',
  },
});
app.use('/api', apiLimiter);

// CORS configuration
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000'
)
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  }),
);

// Body parsing with size limits
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Reasonable limit for API requests
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(correlationIdMiddleware);
app.use(securityHeaders());
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

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handling
app.use(secureErrorHandler);
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

    // Initialize Socket.IO server
    socketServer = new MediaNestSocketServer(httpServer);
    logger.info('Socket.IO server initialized with authentication');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info('Available namespaces: /, /authenticated, /admin, /media, /system');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Store services for graceful shutdown
let globalIntegrationService: IntegrationService | null = null;
let socketServer: MediaNestSocketServer | null = null;

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  // Close Socket.IO server first
  if (socketServer) {
    await socketServer.close();
    logger.info('Socket.IO server shutdown complete');
  }

  // Close integration service
  if (globalIntegrationService) {
    await globalIntegrationService.shutdown();
    logger.info('Integration service shutdown complete');
  }

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force close after timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Setup global error handlers
handleUncaughtException();
handleUnhandledRejection();

startServer();
