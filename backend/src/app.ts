import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import { pinoHttp } from 'pino-http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

// Middleware imports
import { errorHandler } from './middleware/error';

// Route imports
import { router as v1Router } from './routes/v1';

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
  }),
);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  });
});

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
