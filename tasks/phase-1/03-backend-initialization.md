# Task: Backend Express.js Initialization

**Task ID:** PHASE1-03  
**Priority:** Critical  
**Estimated Time:** 4 hours  
**Dependencies:** PHASE1-02 (Docker Environment)

## Objective
Initialize the Express.js backend with TypeScript, proper project structure, and core middleware setup.

## Acceptance Criteria
- [ ] Express server starts successfully
- [ ] TypeScript compilation works
- [ ] Basic health check endpoint responds
- [ ] Logging system operational
- [ ] Error handling middleware in place
- [ ] Correlation ID tracking works

## Detailed Steps

### 1. Initialize Backend Project
```bash
cd backend
npm init -y
```

### 2. Install Dependencies
```bash
# Core dependencies
npm install express cors helmet morgan compression cookie-parser
npm install dotenv joi bcrypt jsonwebtoken
npm install redis ioredis bull
npm install prisma @prisma/client
npm install winston winston-daily-rotate-file
npm install express-rate-limit rate-limit-redis
npm install uuid nanoid
npm install axios retry-axios

# TypeScript and dev dependencies
npm install -D typescript @types/node @types/express
npm install -D @types/cors @types/morgan @types/compression @types/cookie-parser
npm install -D @types/bcrypt @types/jsonwebtoken @types/uuid
npm install -D nodemon ts-node tsconfig-paths
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint eslint-config-prettier eslint-plugin-prettier
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

### 3. Create TypeScript Configuration
Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowJs": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"],
      "@config/*": ["./src/config/*"],
      "@controllers/*": ["./src/controllers/*"],
      "@middleware/*": ["./src/middleware/*"],
      "@services/*": ["./src/services/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### 4. Update Package.json Scripts
Update `backend/package.json`:

```json
{
  "name": "medianest-backend",
  "version": "1.0.0",
  "description": "MediaNest Backend API",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "keywords": ["medianest", "api", "express"],
  "author": "MediaNest Team",
  "license": "MIT"
}
```

### 5. Create Nodemon Configuration
Create `backend/nodemon.json`:

```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts", "src/**/*.test.ts"],
  "exec": "ts-node -r tsconfig-paths/register ./src/index.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### 6. Create Main Application Entry Point
Create `backend/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { correlationId } from './middleware/correlationId';
import { logger } from './utils/logger';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import healthRouter from './routes/health';

const app = express();

// Initialize services
async function initializeServices() {
  try {
    await initializeDatabase();
    await initializeRedis();
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(correlationId);
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
app.use('/api/health', healthRouter);

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.port || 4000;

initializeServices().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${config.env} mode`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

export default app;
```

### 7. Create Configuration Module
Create `backend/src/config/index.ts`:

```typescript
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(32).required(),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  ADMIN_USERNAME: Joi.string().default('admin'),
  ADMIN_PASSWORD: Joi.string().default('admin'),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  database: {
    url: envVars.DATABASE_URL,
  },
  redis: {
    url: envVars.REDIS_URL,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: '24h',
  },
  encryption: {
    key: envVars.ENCRYPTION_KEY,
  },
  cors: {
    origin: envVars.CORS_ORIGIN.split(','),
  },
  logging: {
    level: envVars.LOG_LEVEL,
  },
  admin: {
    username: envVars.ADMIN_USERNAME,
    password: envVars.ADMIN_PASSWORD,
  },
};
```

### 8. Create Logger Utility
Create `backend/src/utils/logger.ts`:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (config.env === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
});
```

### 9. Create Correlation ID Middleware
Create `backend/src/middleware/correlationId.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || nanoid();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
```

### 10. Create Error Handler Middleware
Create `backend/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  logger.error({
    correlationId: req.correlationId,
    error: {
      message: err.message,
      stack: err.stack,
      code,
      details: err.details,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'Internal Server Error' : message,
      correlationId: req.correlationId,
      ...(process.env.NODE_ENV === 'development' && { details: err.details }),
    },
  });
}
```

### 11. Create Health Check Route
Create `backend/src/routes/health.ts`:

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { redis } from '../config/redis';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    correlationId: req.correlationId,
  };

  res.json(health);
});

router.get('/detailed', async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  // Check Redis
  try {
    await redis.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
  }

  const allHealthy = Object.values(checks).every(status => status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: checks,
    correlationId: req.correlationId,
  });
});

export default router;
```

### 12. Create Database Configuration
Create `backend/src/config/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export async function initializeDatabase() {
  prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

  prisma.$on('query', (e) => {
    logger.debug('Query:', e);
  });

  prisma.$on('error', (e) => {
    logger.error('Database error:', e);
  });

  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export { prisma };
```

### 13. Create Redis Configuration
Create `backend/src/config/redis.ts`:

```typescript
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export let redis: Redis;

export async function initializeRedis() {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redis.on('error', (error) => {
    logger.error('Redis error:', error);
  });

  // Test connection
  try {
    await redis.ping();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}
```

## Verification Steps
1. Run `npm install` to install all dependencies
2. Run `npm run dev` to start the development server
3. Visit http://localhost:4000/api/health - should return OK
4. Visit http://localhost:4000/api/health/detailed - should show service status
5. Check logs for proper formatting and correlation IDs
6. Verify TypeScript compilation with `npm run build`
7. Run linting with `npm run lint`

## Testing Requirements
- [ ] Unit tests for configuration validation module
- [ ] Unit tests for logger utility with different log levels
- [ ] Unit tests for correlation ID middleware
- [ ] Unit tests for error handler middleware with various error types
- [ ] Integration tests for health check endpoints
- [ ] Integration tests for database connectivity
- [ ] Integration tests for Redis connectivity
- [ ] Test middleware chain execution order
- [ ] Test graceful shutdown handling
- [ ] Mock external dependencies (database, Redis) in unit tests
- [ ] Test coverage should exceed 80% for all modules
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **TypeScript errors**: Ensure all @types packages are installed
- **Database connection fails**: Check DATABASE_URL in environment
- **Redis connection fails**: Verify Redis is running in Docker
- **Port already in use**: Change PORT in environment or stop conflicting service

## Notes
- This setup includes comprehensive error handling and logging
- Correlation IDs help track requests across services
- Health checks are essential for container orchestration
- Consider adding API documentation with Swagger in future

## Related Documentation
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Configuration](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)
- [Backend Implementation Guide](/docs/BACKEND_IMPLEMENTATION_GUIDE.md)