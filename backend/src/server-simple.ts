import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import promClient from 'prom-client';
import { CatchError } from './types/common';

const app = express();
const PORT = process.env.PORT || 3000;

// Create a Registry to register metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(compression());

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
      },
      duration
    );
  });

  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error: CatchError) {
    console.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
});

app.get('/api/users', async (req, res) => {
  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

  res.json({
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ],
  });
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));

  res.status(201).json({
    user: { id: Date.now(), name, email },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
});
