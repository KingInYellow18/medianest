import { createServer } from 'http';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
// import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { metricsMiddleware, metricsHandler } from './metrics';
import { errorHandler } from './middleware/error';
import { timeoutPresets } from './middleware/timeout';
import v1Router from './routes/v1';
import { initSocketHandlers, setIO } from './socket/socket';
import { logger } from './utils/logger';

// Create Express app
export const app = express();

// Create HTTP server
export const httpServer = createServer(app);

// Create Socket.IO server
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Set Socket.IO instance globally
setIO(io);

// Initialize Socket.IO handlers
initSocketHandlers(io);

// Middleware
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  }),
);

app.use(helmet());

// Optimize compression for homelab
app.use(
  compression({
    level: 6, // Balanced compression level (1-9, default is 6)
    threshold: 1024, // Only compress responses > 1kb
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use default compression filter (text/json/javascript)
      return compression.filter(req, res);
    },
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Default request timeout (30 seconds)
app.use(timeoutPresets.medium);

// Logging middleware (skip in test environment)
if (env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
      });
    });
    next();
  });
}

// Metrics middleware
app.use(metricsMiddleware);

// Health check endpoint moved to /api/v1/health

// Metrics endpoint (not under /api/v1 for easier Prometheus scraping)
app.get('/metrics', metricsHandler);

// API routes
app.use('/api/v1', v1Router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Error handler (must be last)
app.use(errorHandler);
