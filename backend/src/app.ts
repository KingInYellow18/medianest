import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

// Middleware imports
import { errorHandler } from './middleware/error';
import { timeoutPresets } from './middleware/timeout';

// Route imports
import v1Router from './routes/v1';

// Utils
import { logger } from './utils/logger';
import { env } from './config/env';
import { initSocketHandlers, setIO } from './socket/socket';

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
  })
);

app.use(helmet());

// Context7 Pattern: Enhanced compression with performance optimizations
app.use(
  compression({
    level: process.env.NODE_ENV === 'production' ? 4 : 6, // Context7: Lower CPU in prod
    threshold: 1024, // Only compress responses > 1kb
    chunkSize: 16 * 1024, // Context7: 16KB chunks for better streaming
    windowBits: 13, // Context7: Reduced memory usage
    memLevel: 8, // Memory usage optimization
    strategy: require('zlib').constants.Z_RLE, // Context7: Optimized for JSON/text
    filter: (req, res) => {
      // Context7 Pattern: Enhanced compression filtering
      if (req.headers['x-no-compression']) return false;

      // Context7 Pattern: Skip compression for images and already compressed formats
      const contentType = res.getHeader('content-type') as string;
      if (contentType && contentType.includes('image/')) return false;
      if (req.path.match(/\.(gz|zip|png|jpg|jpeg|webp|woff|woff2)$/i)) return false;

      // Use default compression filter for other content
      return compression.filter(req, res);
    },
  })
);

// Context7 Pattern: Optimized body parsing with security enhancements
app.use(
  express.json({
    limit: '1mb', // Context7: Reduced limit for better performance and security
    strict: true,
    type: ['application/json', 'application/vnd.api+json'],
    verify: (_req, _res, buf) => {
      // Context7 Pattern: Early JSON validation
      if (buf.length > 0 && buf[0] !== 123 && buf[0] !== 91) {
        // Not starting with { or [
        throw new Error('Invalid JSON format');
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: false, // Context7: Use simple parsing for better security
    limit: '100kb', // Context7: Smaller limit for URL-encoded data
    parameterLimit: 20, // Context7: Limit parameters to prevent abuse
    type: 'application/x-www-form-urlencoded',
  })
);

// Cookie parser for CSRF tokens
app.use(cookieParser());

// Context7 Pattern: Performance optimization middleware applied early
app.use((req, res, next) => {
  // Context7 Pattern: Set efficient headers for all responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=1000');

  // Context7 Pattern: Early exit for health checks
  if (req.path === '/health' || req.path === '/ping') {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json');
  }

  next();
});

// Default request timeout (30 seconds)
app.use(timeoutPresets.medium as express.RequestHandler);

// Context7 Pattern: Enhanced logging middleware with performance optimizations
if (env.NODE_ENV !== 'test') {
  // Context7 Pattern: Pre-compile health check paths for fast lookup
  const healthPaths = new Set(['/health', '/ping', '/status', '/metrics']);

  app.use((req, res, next) => {
    // Context7 Pattern: Skip detailed logging for health checks to reduce noise
    const skipDetailedLogging = healthPaths.has(req.path);

    const start = process.hrtime.bigint(); // Context7: More precise timing

    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms

      if (!skipDetailedLogging) {
        // Context7 Pattern: Structured logging with performance metrics
        logger.info({
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
          userAgent: req.headers['user-agent']?.substring(0, 50) || 'unknown',
          ip: req.ip || req.connection?.remoteAddress,
        });

        // Context7 Pattern: Warn on slow requests
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            duration: `${duration.toFixed(2)}ms`,
            threshold: '1000ms',
          });
        }
      }
    });

    next();
  });
}

// Health check endpoint moved to /api/v1/health

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
app.use(errorHandler as express.ErrorRequestHandler);

// Export createApp function for tests
export function createApp() {
  return app;
}
