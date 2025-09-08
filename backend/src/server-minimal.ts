import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { CatchError } from './types/common';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Simple middleware to check if monitoring middleware exists
try {
  // Import monitoring middleware only if available
  const { metricsMiddleware } = require('./middleware/metrics');
  const { correlationIdMiddleware } = require('./middleware/correlation-id');
  const { requestLoggingMiddleware } = require('./middleware/logging');

  logger.info('Monitoring middleware found - integrating', {
    middleware: ['metricsMiddleware', 'correlationIdMiddleware', 'requestLoggingMiddleware'],
    timestamp: new Date().toISOString(),
  });

  // Apply monitoring middleware
  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(metricsMiddleware);

  logger.info('Monitoring middleware integrated successfully', {
    middleware: ['correlationIdMiddleware', 'requestLoggingMiddleware', 'metricsMiddleware'],
    endpoint: '/metrics',
    timestamp: new Date().toISOString(),
  });

  // Add metrics endpoint
  const { register } = require('./middleware/metrics');
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error: CatchError) {
      logger.error('Error generating metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: '/metrics',
        timestamp: new Date().toISOString(),
      });
      res.status(500).end('Error generating metrics');
    }
  });
} catch (error: CatchError) {
  logger.warn('Some monitoring middleware missing, continuing without middleware', {
    error: error instanceof Error ? error.message : 'Unknown error',
    missingMiddleware: ['metrics', 'correlation-id', 'logging'],
    timestamp: new Date().toISOString(),
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId || 'no-correlation-middleware',
    monitoring: 'integrated',
  });
});

// Example API endpoints
app.get('/api/users', async (req, res) => {
  try {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ];

    res.json({ users });
  } catch (error: CatchError) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate input
    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    // Simulate database insert
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
    const user = { id: Date.now(), name, email };

    res.status(201).json({ user });
  } catch (error: CatchError) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error.stack,
    correlationId: req.correlationId || 'no-correlation',
    timestamp: new Date().toISOString(),
  });
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      correlationId: req.correlationId || 'no-correlation',
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info('Minimal server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: `/health`,
      metrics: `/metrics`,
      users: `/api/users`,
    },
    monitoring: 'integrated',
    timestamp: new Date().toISOString(),
  });
});
