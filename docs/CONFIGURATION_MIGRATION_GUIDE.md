# Configuration Migration Guide

This guide provides step-by-step instructions for migrating to the new centralized configuration management system in MediaNest.

## Overview

The new configuration system provides:
- Type-safe configuration with runtime validation
- Centralized dependency management
- Structured logging architecture
- Environment-specific configuration loading
- Development workflow automation

## Migration Steps

### 1. Update Dependencies

The root package.json now manages common dependencies. Run the dependency consistency check:

```bash
npm run check-deps
```

If inconsistencies are found, they will be displayed. To fix them:

1. Remove duplicate dependencies from workspace package.json files
2. Add them to root package.json if they're truly shared
3. Use "*" version in workspace package.json to inherit from root

### 2. Environment Configuration Migration

#### Before (scattered configuration)
```typescript
// backend/src/config/database.ts
const config = {
  url: process.env.DATABASE_URL,
  // ... other config
};

// frontend/src/lib/redis.ts  
const redisClient = new Redis(process.env.REDIS_URL);
```

#### After (centralized configuration)
```typescript
// Any workspace
import { loadConfig, getConfigSection } from '@medianest/shared';

// Load complete configuration with validation
const config = loadConfig();

// Or get specific sections
const dbConfig = getConfigSection('DATABASE_URL');
const redisConfig = getConfigSection('REDIS_HOST');
```

#### Environment File Structure

Create environment files with the following precedence (highest to lowest):

1. **Custom environment file** (if specified)
2. **Workspace-specific files**:
   - `backend/.env.local`
   - `frontend/.env.local`
   - `shared/.env.local`
3. **Environment-specific files**:
   - `.env.development`
   - `.env.production`
   - `.env.test`
4. **Base files**:
   - `.env`
   - `.env.defaults`

Example `.env.defaults`:
```bash
# Application Configuration
NODE_ENV=development
APP_NAME=MediaNest
LOG_LEVEL=info

# Database Configuration  
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_KEY_PREFIX=medianest:

# Security Configuration
BCRYPT_ROUNDS=12
JWT_EXPIRES_IN=24h
```

### 3. Replace Console.log with Structured Logging

#### Before
```typescript
console.log('User authenticated:', user.id);
console.error('Database error:', error);
```

#### After
```typescript
import { createServiceLogger } from '@medianest/shared';

const logger = createServiceLogger('auth-service');

// Info logging
logger.info('User authenticated', { userId: user.id });

// Error logging  
logger.error('Database error', { 
  error: error.message,
  stack: error.stack,
  userId: user.id 
});
```

#### Correlation ID Support
```typescript
import { createCorrelatedLogger } from '@medianest/shared';

// In middleware or request handlers
const correlatedLogger = createCorrelatedLogger(logger, req.correlationId);
correlatedLogger.info('Processing request', { userId: req.user?.id });
```

#### Performance Logging
```typescript
import { createPerformanceLogger } from '@medianest/shared';

const perfLogger = createPerformanceLogger(logger);
const timer = perfLogger.time('database-query', { query: 'findUser' });

// ... perform operation
await user.findById(id);

timer.end({ recordsFound: 1 });
```

### 4. Database Configuration Migration

#### Before
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
```

#### After
```typescript
import { 
  createPrismaClient, 
  connectDatabase,
  getConfig 
} from '@medianest/shared';

// Load configuration
const config = getConfig();

// Create configured Prisma client
const prisma = createPrismaClient(config, {
  clientId: 'main',
  logLevel: ['warn', 'error']
});

// Connect with health checks
await connectDatabase('main', {
  maxRetries: 3,
  healthCheck: true
});
```

### 5. Redis Configuration Migration

#### Before
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
```

#### After
```typescript
import { 
  createRedisClient, 
  connectRedis,
  getConfig 
} from '@medianest/shared';

// Load configuration
const config = getConfig();

// Create configured Redis client
const redis = createRedisClient(config, {
  clientId: 'cache',
  keyPrefix: 'cache:'
});

// Connect with health checks
await connectRedis('cache', {
  maxRetries: 3,
  healthCheck: true
});
```

### 6. Update Import Statements

Replace configuration imports throughout your codebase:

#### Before
```typescript
import { logger } from '../utils/logger';
import { redis } from '../config/redis';
import { prisma } from '../db/prisma';
```

#### After
```typescript
import { 
  createServiceLogger,
  createRedisClient,
  createPrismaClient,
  getConfig
} from '@medianest/shared';

const config = getConfig();
const logger = createServiceLogger('my-service');
const redis = createRedisClient(config);
const prisma = createPrismaClient(config);
```

### 7. Development Workflow Integration

Use the new development workflow commands:

```bash
# Complete environment setup
npm run setup

# Run dependency audit
npm run audit

# Check dependency consistency
npm run check-deps

# Run full CI pipeline locally
npm run ci

# Use the workflow manager directly
npm run dev-workflow -- <command>
```

### 8. Docker Configuration Update

Replace your existing Dockerfile with the optimized multi-stage build:

```bash
# Copy the optimized Dockerfile
cp Dockerfile.optimized Dockerfile

# Build with new stages
docker build --target backend-production -t medianest-backend .
docker build --target frontend-production -t medianest-frontend .
docker build --target development -t medianest-dev .
```

### 9. Error Handling Updates

Update error handling to use structured logging:

#### Before
```typescript
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

#### After
```typescript
import { createCorrelatedLogger } from '@medianest/shared';

app.use((err, req, res, next) => {
  const logger = createCorrelatedLogger(
    createServiceLogger('error-handler'), 
    req.correlationId
  );
  
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    correlationId: req.correlationId 
  });
});
```

### 10. Health Check Integration

Add health checks using the new configuration:

```typescript
import { 
  checkDatabaseHealth, 
  checkRedisHealth 
} from '@medianest/shared';

app.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();
  
  const health = {
    status: dbHealth.healthy && redisHealth.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth
    }
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

## Validation and Testing

### 1. Configuration Validation
```bash
# Test configuration loading
node -e "
const { validateEnvironment } = require('./shared/dist/config');
const result = validateEnvironment();
if (!result.valid) {
  console.error('Configuration errors:', result.errors.issues);
  process.exit(1);
}
console.log('Configuration is valid');
"
```

### 2. Dependency Consistency
```bash
npm run check-deps
```

### 3. Build Verification
```bash
npm run ci
```

### 4. Docker Build Test
```bash
docker build --target development -t medianest-test .
docker run --rm medianest-test npm run type-check
```

## Common Migration Issues

### Issue 1: Missing Environment Variables
**Error**: `Configuration validation failed`
**Solution**: Check that all required environment variables are set in your .env files

### Issue 2: Dependency Version Conflicts  
**Error**: Version mismatch warnings in check-deps
**Solution**: Update workspace package.json to use "*" for shared dependencies

### Issue 3: Import Resolution
**Error**: Cannot resolve '@medianest/shared'
**Solution**: Ensure shared package is built: `npm run build:shared`

### Issue 4: Logger Not Found
**Error**: `Cannot read property 'info' of undefined`
**Solution**: Import and create logger: `const logger = createServiceLogger('service-name')`

### Issue 5: Database Connection Errors
**Error**: Prisma client connection issues
**Solution**: Use the new database configuration manager with proper connection handling

## Best Practices

1. **Always load configuration at application startup**:
   ```typescript
   const config = loadConfig();
   ```

2. **Use correlation IDs for request tracing**:
   ```typescript
   const logger = createCorrelatedLogger(baseLogger, correlationId);
   ```

3. **Implement proper error handling**:
   ```typescript
   try {
     await operation();
   } catch (error) {
     logger.error('Operation failed', { error: error.message });
     throw error;
   }
   ```

4. **Use health checks**:
   ```typescript
   const health = await checkDatabaseHealth();
   if (!health.healthy) {
     logger.warn('Database unhealthy', { error: health.error });
   }
   ```

5. **Validate configuration early**:
   ```typescript
   const validation = validateEnvironment();
   if (!validation.valid) {
     process.exit(1);
   }
   ```

## Support

If you encounter issues during migration:

1. Check the ADRs in `docs/ARCHITECTURE_DECISIONS.md`
2. Review logs in the `logs/` directory
3. Run `npm run dev-workflow -- check-deps` to verify setup
4. Use `npm run ci` to validate the complete build pipeline

---

**Migration Checklist**:
- [ ] Dependencies updated and consistent
- [ ] Environment files created/updated
- [ ] Console.log statements replaced
- [ ] Configuration imports updated
- [ ] Database configuration migrated
- [ ] Redis configuration migrated
- [ ] Error handling updated
- [ ] Health checks implemented
- [ ] Docker configuration updated
- [ ] Tests passing with new configuration