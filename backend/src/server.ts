import 'tsconfig-paths/register';
import 'dotenv/config';

// Validate all required secrets before starting the application
import { validateSecretsOrThrow } from './config/secrets-validator';
validateSecretsOrThrow();

// Import centralized configuration service
import { configService } from './config/config.service';

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
import { applyPerformanceMiddleware } from './middleware/performance';
import { setupRoutes } from './routes';
import { setIntegrationService } from './routes/integrations';
import { IntegrationService } from './services/integration.service';
import { MediaNestSocketServer } from './socket/socket-server';
import { logger } from './utils/logger';
import { CatchError } from './types/common';

const app = express();
const httpServer = createServer(app);
const PORT = configService.get('server', 'PORT');

// Express.js Performance Optimization - Context7 Pattern: Trust Proxy Configuration
// Trust proxy - important for reverse proxy setup and accurate client IP detection
app.set('trust proxy', true);

// Disable x-powered-by header for security and slight performance gain
app.disable('x-powered-by');

// Set JSON spaces to 0 for production (Context7 Pattern: Minimize JSON overhead)
if (configService.isProduction()) {
  app.set('json spaces', 0);
}

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
  })
);

// Context7 Pattern: Optimized Rate Limiting with Memory Store
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: configService.isProduction() ? 100 : 1000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Context7 Pattern: Skip successful requests in development
  skip: (req) => !configService.isProduction() && req.method === 'GET',
  // Context7 Pattern: Custom key generator for better performance
  keyGenerator: (req): string => {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.connection as any)?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  },
});
app.use(limiter);

// Strict API rate limiting
const apiLimiter = rateLimit({
  windowMs: configService.get('security', 'RATE_LIMIT_API_WINDOW') * 1000,
  max: configService.get('security', 'RATE_LIMIT_API_REQUESTS'),
  message: {
    error: 'Too many API requests, please try again later.',
  },
});
app.use('/api', apiLimiter);

// Context7 Pattern: Optimized CORS Configuration for Performance
const allowedOrigins = (
  configService.get('security', 'ALLOWED_ORIGINS') ||
  configService.get('server', 'FRONTEND_URL') ||
  'http://localhost:3000'
)
  .split(',')
  .map((origin) => origin.trim());

// Convert to Set for O(1) lookup performance (Context7 optimization)
const allowedOriginsSet = new Set(allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      // Context7 Pattern: Fast Set lookup instead of Array.includes
      if (allowedOriginsSet.has(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    // Context7 Pattern: Cache preflight responses
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Context7 Pattern: Optimized Body Parsing and Compression
// Compression with enhanced Context7 optimization patterns
app.use(
  compression({
    threshold: 1024, // Only compress responses > 1KB
    level: configService.isProduction() ? 4 : 6, // Context7: Lower CPU usage in prod
    memLevel: 8, // Memory usage (1-9, 8 is default)
    strategy: require('zlib').constants.Z_RLE, // Context7: Optimized for JSON/text
    chunkSize: 16 * 1024, // Context7: 16KB chunks for better streaming
    windowBits: 13, // Context7: Reduced memory usage
    filter: (req, res) => {
      // Context7 Pattern: Enhanced compression filtering
      if (req.headers['x-no-compression']) return false;

      // Context7 Pattern: Skip compression for small responses
      const contentType = res.getHeader('content-type') as string;
      if (contentType && contentType.includes('image/')) return false;

      // Context7 Pattern: Skip compression for already compressed formats
      if (req.path.match(/\.(gz|zip|png|jpg|jpeg|webp)$/i)) return false;

      return compression.filter(req, res);
    },
  })
);

// Context7 Pattern: Optimized JSON parsing with enhanced security and performance
app.use(
  express.json({
    limit: '1mb', // Reduced from 10mb for better performance
    strict: true,
    type: ['application/json', 'application/vnd.api+json'], // Context7: Explicit types
    verify: (req, res, buf) => {
      // Context7 Pattern: Early validation for malformed JSON
      if (buf.length > 0 && buf[0] !== 123 && buf[0] !== 91) {
        // Not starting with { or [
        throw new Error('Invalid JSON format');
      }
    },
    reviver: configService.isProduction()
      ? undefined
      : (key, value) => {
          // Context7 Pattern: Development-only JSON reviver for debugging
          if (typeof value === 'string' && value.length > 10000) {
            logger.warn('Large string value in JSON', { key, length: value.length });
          }
          return value;
        },
  })
);

// Context7 Pattern: Enhanced URL encoded parsing with security measures
app.use(
  express.urlencoded({
    extended: false, // Context7: Use simple querystring parsing for better security
    limit: '100kb', // Context7: Smaller limit for URL-encoded data
    parameterLimit: 20, // Context7: Stricter parameter limit
    type: 'application/x-www-form-urlencoded',
    verify: (req, res, buf) => {
      // Context7 Pattern: Validate URL-encoded content
      const str = buf.toString();
      if (str.includes('%00') || str.includes('\x00')) {
        throw new Error('Invalid URL-encoded content');
      }
    },
  })
);
// Context7 Pattern: Apply performance middleware early in the stack
app.use(applyPerformanceMiddleware());
app.use(correlationIdMiddleware);
app.use(securityHeaders());
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint (protected in production) - Prometheus format
app.get('/metrics', async (req, res) => {
  // In production, protect this endpoint
  if (configService.isProduction()) {
    const authHeader = req.headers.authorization;
    const metricsToken = configService.get('auth', 'METRICS_TOKEN');
    if (!authHeader || authHeader !== `Bearer ${metricsToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    const { register } = require('./middleware/metrics');
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error: CatchError) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// Setup routes
setupRoutes(app);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handling
app.use(secureErrorHandler);
app.use(errorHandler);

// Context7 Pattern: Optimized service initialization with parallel loading
async function startServer() {
  const initStartTime = process.hrtime.bigint();

  try {
    // Context7 Pattern: Parallel service initialization for faster startup
    const [databaseResult, redisResult, queuesResult] = await Promise.allSettled([
      initializeDatabase(),
      initializeRedis(),
      initializeQueues(),
    ]);

    // Context7 Pattern: Detailed initialization reporting
    if (databaseResult.status === 'fulfilled') {
      logger.info('Database connected');
    } else {
      logger.error('Database initialization failed:', databaseResult.reason);
      throw databaseResult.reason;
    }

    if (redisResult.status === 'fulfilled') {
      logger.info('Redis connected');
    } else {
      logger.error('Redis initialization failed:', redisResult.reason);
      throw redisResult.reason;
    }

    if (queuesResult.status === 'fulfilled') {
      logger.info('Queues initialized');
    } else {
      logger.error('Queues initialization failed:', queuesResult.reason);
      throw queuesResult.reason;
    }

    // Initialize integration service
    const plexConfig = configService.getPlexConfig();
    const integrationsConfig = configService.getIntegrationsConfig();

    const integrationService = new IntegrationService({
      plex: {
        enabled: plexConfig.PLEX_ENABLED === true,
        defaultToken: plexConfig.PLEX_DEFAULT_TOKEN,
        serverUrl: plexConfig.PLEX_SERVER_URL,
      },
      overseerr: {
        enabled: integrationsConfig.OVERSEERR_ENABLED === true,
        url: integrationsConfig.OVERSEERR_URL,
        apiKey: integrationsConfig.OVERSEERR_API_KEY,
      },
      uptimeKuma: {
        enabled: integrationsConfig.UPTIME_KUMA_ENABLED === true,
        url: integrationsConfig.UPTIME_KUMA_URL,
        username: integrationsConfig.UPTIME_KUMA_USERNAME,
        password: integrationsConfig.UPTIME_KUMA_PASSWORD,
      },
    });

    await integrationService.initialize();
    setIntegrationService(integrationService);
    globalIntegrationService = integrationService;
    logger.info('External service integrations initialized');

    // Initialize Socket.IO server
    socketServer = new MediaNestSocketServer(httpServer);
    logger.info('Socket.IO server initialized with authentication');

    // Context7 Pattern: Enhanced server startup with performance metrics
    httpServer.listen(PORT, () => {
      const initEndTime = process.hrtime.bigint();
      const initDuration = Number(initEndTime - initStartTime) / 1e6; // Convert to milliseconds

      logger.info(`Server running on port ${PORT}`, {
        initializationTime: `${initDuration.toFixed(2)}ms`,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      });
      logger.info('Available namespaces: /, /authenticated, /admin, /media, /system');

      // Context7 Pattern: Set server keep-alive timeout for better connection management
      httpServer.keepAliveTimeout = 61000; // Slightly longer than load balancer timeout
      httpServer.headersTimeout = 65000; // Must be longer than keepAliveTimeout
    });
  } catch (error: CatchError) {
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
