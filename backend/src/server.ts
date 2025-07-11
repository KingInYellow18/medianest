import 'tsconfig-paths/register'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/error'
import { correlationIdMiddleware } from './middleware/correlation-id'
import { requestLogger } from './middleware/logging'
import { setupRoutes } from './routes'
import { initializeDatabase } from './config/database'
import { initializeRedis } from './config/redis'
import { initializeQueues } from './config/queues'
import { initializeSocketServer } from './socket'
import { socketService } from './services/socket.service'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 4000

// Trust proxy - important for reverse proxy setup
app.set('trust proxy', true)

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(correlationIdMiddleware)
app.use(requestLogger)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Metrics endpoint (protected in production)
app.get('/metrics', (req, res) => {
  // In production, protect this endpoint
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization
    if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }
  
  const { metrics } = require('./utils/monitoring')
  res.json(metrics.getMetrics())
})

// Setup routes
setupRoutes(app)

// Error handling
app.use(errorHandler)

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase()
    logger.info('Database connected')

    // Initialize Redis
    await initializeRedis()
    logger.info('Redis connected')

    // Initialize queues
    await initializeQueues()
    logger.info('Queues initialized')

    // Initialize Socket.io
    const io = initializeSocketServer(httpServer)
    socketService.setIoInstance(io)
    logger.info('Socket.io initialized')

    // Initialize external services
    await initializeServices()

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Initialize external services
async function initializeServices() {
  try {
    // Initialize Plex service
    const { plexService } = require('./services/plex.service')
    plexService.startCleanupTimer()
    logger.info('Plex service initialized')

    // Initialize Overseerr service
    const { overseerrService } = require('./services/overseerr.service')
    await overseerrService.initialize()
    logger.info('Overseerr service initialized')

    // Initialize Status service (Uptime Kuma)
    const { statusService } = require('./services/status.service')
    await statusService.initialize()
    logger.info('Status service initialized')
  } catch (error) {
    logger.error('Failed to initialize services:', error)
    // Continue running even if external services fail
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  
  // Disconnect services
  const { statusService } = require('./services/status.service')
  statusService.disconnect()
  
  httpServer.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

startServer()