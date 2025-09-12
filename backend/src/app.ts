/**
 * MediaNest Application Server - Main Express application setup
 *
 * This module configures and initializes the complete MediaNest backend application including:
 * - Express server with optimized middleware stack
 * - Socket.IO server for real-time communication
 * - Security headers and CORS configuration
 * - Performance optimizations and compression
 * - Request logging and error handling
 * - API route mounting and 404 handling
 *
 * @fileoverview Main application entry point with comprehensive middleware configuration
 * @version 2.0.0
 * @author MediaNest Team
 * @since 1.0.0
 */

import { createServer } from 'http';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

// Middleware imports
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { timeoutPresets } from './middleware/timeout';

// Route imports
import v1Router from './routes/v1';

// Utils
import { initSocketHandlers, setIO } from './socket/socket';
import { logger } from './utils/logger';

/**
 * Express application instance
 * @type {express.Application}
 * @description Main Express app with all middleware and routes configured
 */
export const app = express();

/**
 * HTTP server instance
 * @type {http.Server}
 * @description HTTP server wrapping the Express app for Socket.IO integration
 */
export const httpServer = createServer(app);

/**
 * Socket.IO server instance
 * @type {SocketIOServer}
 * @description Real-time WebSocket server for live updates and notifications
 *
 * Configuration:
 * - CORS enabled for frontend domain
 * - 60s ping timeout for connection stability
 * - 25s ping interval for keepalive
 * - Credentials support for authenticated connections
 */
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/**
 * Initialize Socket.IO global instance and event handlers
 * @description Sets up Socket.IO for global access and initializes all event handlers
 */
setIO(io);
initSocketHandlers(io);

/**
 * CORS Configuration
 * @description Cross-Origin Resource Sharing middleware for frontend communication
 *
 * Features:
 * - Restricts origin to configured frontend URL
 * - Supports credentials for authenticated requests
 * - Allows standard HTTP methods plus PATCH
 * - Permits required headers for API and security
 */
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  }),
);

/**
 * Security Headers Middleware
 * @description Helmet.js security middleware for setting various HTTP headers
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - And many other security headers
 */
app.use(helmet());

/**
 * Enhanced Compression Middleware
 * @description Context7 Pattern: Advanced compression with performance optimizations
 *
 * Features:
 * - Dynamic compression level based on environment
 * - 1KB threshold to avoid compressing small responses
 * - 16KB chunks for optimal streaming performance
 * - Memory usage optimization with reduced window bits
 * - RLE strategy optimized for JSON/text content
 * - Smart filtering to skip images and pre-compressed content
 *
 * @performance Production uses level 4 compression for CPU efficiency
 * @performance Development uses level 6 for better compression ratio
 */
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
  }),
);

/**
 * Enhanced JSON Body Parsing
 * @description Context7 Pattern: Optimized body parsing with security enhancements
 *
 * Security Features:
 * - 1MB limit for DoS protection
 * - Strict JSON parsing
 * - Content-type validation
 * - Early JSON format validation
 * - Buffer inspection to prevent malformed payloads
 *
 * @security Prevents large payload attacks
 * @security Validates JSON format before parsing
 */
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
  }),
);

/**
 * URL-Encoded Body Parsing
 * @description Context7 Pattern: Secure URL-encoded data parsing
 *
 * Security Features:
 * - Simple parsing (extended: false) for better security
 * - 100KB limit for form data protection
 * - 20 parameter limit to prevent parameter pollution attacks
 * - Explicit content-type restriction
 *
 * @security Prevents parameter pollution and large form attacks
 */
app.use(
  express.urlencoded({
    extended: false, // Context7: Use simple parsing for better security
    limit: '100kb', // Context7: Smaller limit for URL-encoded data
    parameterLimit: 20, // Context7: Limit parameters to prevent abuse
    type: 'application/x-www-form-urlencoded',
  }),
);

/**
 * Cookie Parser Middleware
 * @description Parses cookies for CSRF token validation and session management
 */
app.use(cookieParser());

/**
 * Performance Optimization Middleware
 * @description Context7 Pattern: Early performance optimizations and security headers
 *
 * Features:
 * - Efficient security headers for all responses
 * - Keep-alive connection optimization
 * - Early exit optimization for health check endpoints
 * - Caching headers for health endpoints
 *
 * @performance Keep-alive with 5s timeout and 1000 max requests
 * @performance Pre-compiled health check paths for fast lookup
 */
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

/**
 * Request Timeout Middleware
 * @description Default 30-second timeout for all requests to prevent hanging connections
 * @timeout 30 seconds (medium preset)
 */
app.use(timeoutPresets.medium as express.RequestHandler);

/**
 * Enhanced Request Logging Middleware
 * @description Context7 Pattern: High-performance logging with optimizations
 *
 * Features:
 * - High-precision timing with process.hrtime.bigint()
 * - Smart filtering to reduce noise from health checks
 * - Structured logging with performance metrics
 * - Slow request detection and warnings
 * - User agent and IP tracking for security
 *
 * @performance Pre-compiled health check paths for fast lookup
 * @performance Skips detailed logging for health endpoints
 * @performance Sub-millisecond timing precision
 */
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

/**
 * API Routes Configuration
 * @description Mounts all API v1 routes under /api/v1 prefix
 * @note Health check endpoint is located at /api/v1/health
 */
app.use('/api/v1', v1Router);

/**
 * 404 Not Found Handler
 * @description Handles all unmatched routes with structured error response
 *
 * Response Format:
 * - error: Human-readable error type
 * - message: Specific error with method and path
 * - path: Requested path for debugging
 * - timestamp: ISO timestamp for tracking
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Global Error Handler
 * @description Central error handling middleware (must be mounted last)
 * @important This middleware must be the last middleware in the stack
 */
app.use(errorHandler as express.ErrorRequestHandler);

/**
 * Create Application Instance
 * @function createApp
 * @description Factory function for creating the Express app instance (primarily for testing)
 * @returns {express.Application} Configured Express application
 *
 * @example
 * // In tests
 * const testApp = createApp();
 * const response = await request(testApp).get('/api/v1/health');
 */
export function createApp() {
  return app;
}
