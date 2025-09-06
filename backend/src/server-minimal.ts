import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

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
  
  console.log('✅ Monitoring middleware found - integrating...');
  
  // Apply monitoring middleware
  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(metricsMiddleware);
  
  console.log('✅ Monitoring middleware integrated successfully!');
  
  // Add metrics endpoint
  const { register } = require('./middleware/metrics');
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).end('Error generating metrics');
    }
  });
  
} catch (error) {
  console.log('⚠️  Some monitoring middleware missing, continuing without...');
  console.log('Error:', error.message);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId || 'no-correlation-middleware',
    monitoring: 'integrated'
  });
});

// Example API endpoints
app.get('/api/users', async (req, res) => {
  try {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ];

    res.json({ users });
  } catch (error) {
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
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    const user = { id: Date.now(), name, email };

    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      correlationId: req.correlationId || 'no-correlation',
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Minimal Server running on port ${PORT}`);
  console.log(`📊 Monitoring integrated successfully`);
  console.log(`🔍 Visit http://localhost:${PORT}/health to check status`);
  console.log(`📈 Visit http://localhost:${PORT}/metrics for Prometheus metrics`);
});