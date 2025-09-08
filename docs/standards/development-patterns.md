# MediaNest Development Patterns

## Overview
This document establishes core development patterns discovered from the MediaNest codebase analysis using Serena MCP server and validated with Context7 dependency analysis.

## Project Architecture Patterns

### Monorepo Structure
```
medianest/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── config/         # Centralized configuration
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── repositories/   # Data access layer
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API route definitions
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── tests/              # Test suites
│   └── scripts/            # Build and deployment scripts
├── frontend/               # React/Next.js frontend
├── shared/                 # Shared types and utilities
├── docs/                   # Documentation
├── config/                 # Environment-specific configurations
└── scripts/                # Project-wide automation scripts
```

## TypeScript Development Patterns

### Type Safety with Context7 Validation

**Branded Types Pattern:**
```typescript
// Brand type for enhanced type safety
type Brand<K, T> = K & { __brand: T };

// Domain-specific types
type UserId = Brand<string, 'UserId'>;
type PlexUserId = Brand<string, 'PlexUserId'>;
type CacheKey = Brand<string, 'CacheKey'>;

// Template literal types for API patterns
type APIEndpoint = `/api/v1/${string}`;
type ServiceName = `${string}Service`;
```

**Result Pattern for Error Handling:**
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Usage in services
async function getClientForUser(userId: string): Promise<Result<PlexClient, AppError>> {
  try {
    const user = await userRepository.findById(userId);
    if (!user?.plexToken) {
      return failure(new AppError('PLEX_USER_NOT_FOUND', 'User not found', 401));
    }
    
    const client = new PlexClient(config.serviceUrl, decryptedToken);
    return success(client);
  } catch (error) {
    return failure(new AppError('PLEX_CONNECTION_FAILED', 'Connection failed', 503));
  }
}
```

### Configuration Management Pattern

**Centralized Configuration Service:**
```typescript
export class ConfigService {
  private readonly config: AppConfig;
  private readonly configSources: ConfigSource[] = [];

  // Type-safe generic getter
  get<T extends keyof AppConfig>(category: T): AppConfig[T];
  get<T extends keyof AppConfig, K extends keyof AppConfig[T]>(
    category: T,
    key: K
  ): AppConfig[T][K];

  // Environment checking methods
  isDevelopment(): boolean { return this.config.server.NODE_ENV === 'development'; }
  isProduction(): boolean { return this.config.server.NODE_ENV === 'production'; }
  isTest(): boolean { return this.config.server.NODE_ENV === 'test'; }

  // Security: Masked configuration for logging
  getMaskedConfig(): Partial<AppConfig> {
    return {
      // ... mask sensitive values
      auth: {
        ...this.config.auth,
        JWT_SECRET: this.maskSensitiveValue(this.config.auth.JWT_SECRET),
        ENCRYPTION_KEY: this.maskSensitiveValue(this.config.auth.ENCRYPTION_KEY),
      }
    };
  }

  private maskSensitiveValue(value: string | undefined): string {
    if (!value || value.length < 8) return '[hidden]';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }
}

// Singleton export
export const configService = new ConfigService();
```

## Service Layer Patterns

### Repository Pattern with Base Class
```typescript
export abstract class BaseRepository<T> {
  protected abstract tableName: string;
  protected abstract prisma: PrismaClient;

  async findById(id: string): Promise<T | null> {
    return this.prisma[this.tableName].findUnique({
      where: { id }
    });
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return this.prisma[this.tableName].create({
      data: {
        ...data,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return this.prisma[this.tableName].update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma[this.tableName].delete({
      where: { id }
    });
  }
}
```

### Service Layer with Caching
**MediaNest Established Pattern:**
```typescript
export class PlexService {
  private readonly clients = new Map<PlexUserId, PlexClient>();
  private readonly cachePrefix = 'plex:' as const;
  private readonly cacheTTL: PlexServiceConfig = {
    serverInfo: 3600,      // 1 hour
    libraries: 3600,       // 1 hour (libraries don't change often)
    search: 300,           // 5 minutes
    recentlyAdded: 1800,   // 30 minutes
    libraryItems: 1800,    // 30 minutes
    collections: 3600,     // 1 hour
  } as const;

  async getServerInfo(userId: string) {
    const cacheKey: CacheKey = `${this.cachePrefix}server:${userId}` as CacheKey;

    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from Plex
    const clientResult = await this.getClientForUser(userId);
    if (!clientResult.success) {
      throw clientResult.error;
    }

    const serverInfo = await clientResult.data.testConnection();

    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.serverInfo, JSON.stringify(serverInfo));

    return serverInfo;
  }
}
```

## Express.js Patterns

### Performance-Optimized Router Organization
**Context7 Validated Pattern from MediaNest:**
```typescript
// Context7 Pattern: Optimized Router with Performance Considerations
const router = Router();

// Public routes (no authentication middleware overhead) - optimized order by frequency
router.use('/health', healthRoutes);           // Most frequent - health checks
router.use('/simple-health', simpleHealthRouter); // Docker health checks
router.use('/auth', authRoutes);               // High frequency - authentication
router.use('/webhooks', webhookRoutes);        // Medium frequency - external webhooks
router.use('/csrf', csrfRoutes);               // CSRF endpoints
router.use('/resilience', resilienceRouter);   // Low frequency - monitoring

// Test routes for non-production only
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

// Protected routes with single authentication point
const protectedRouter = Router();

// Context7 Pattern: Pre-authentication metrics
protectedRouter.use((req, res, next) => {
  (req as any).authStartTime = Number(process.hrtime.bigint());
  next();
});

protectedRouter.use(authenticate);

// Context7 Pattern: Post-authentication metrics
protectedRouter.use((req, res, next) => {
  const authStartTime = (req as any).authStartTime;
  if (authStartTime) {
    const authDuration = (Number(process.hrtime.bigint()) - authStartTime) / 1e6;
    res.setHeader('X-Auth-Time', `${authDuration.toFixed(2)}ms`);
  }
  next();
});

// Protected routes ordered by frequency and resource intensity
protectedRouter.use('/dashboard', dashboardRoutes); // Most frequent user endpoint
protectedRouter.use('/media', mediaRoutes);         // High frequency media operations
protectedRouter.use('/services', servicesRoutes);   // Service status checks
protectedRouter.use('/performance', performanceRoutes); // Performance monitoring
protectedRouter.use('/admin', adminRoutes);         // Admin operations (heavier)
```

### Middleware Pattern with Error Handling
```typescript
// Async handler wrapper for error handling
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage in controllers
export const getMedia = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const media = await mediaService.getById(id);
  
  if (!media) {
    throw new AppError('MEDIA_NOT_FOUND', 'Media not found', 404);
  }
  
  res.json({ data: media });
});
```

## Error Handling Patterns

### Application Error Classes
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super('ACCESS_DENIED', message, 403);
  }
}
```

### Global Error Handler
```typescript
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details })
      }
    });
  }

  // Handle validation errors (Joi, Zod, etc.)
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.details
      }
    });
  }

  // Default to 500 server error
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: configService.isProduction() 
        ? 'An unexpected error occurred' 
        : err.message
    }
  });
};
```

## Testing Patterns

### Test Organization
```typescript
describe('PlexService', () => {
  let plexService: PlexService;
  let mockUserRepository: jest.Mocked<typeof userRepository>;
  let mockRedisClient: jest.Mocked<typeof redisClient>;

  beforeEach(() => {
    // Setup mocks and test instances
    mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
    mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
    plexService = new PlexService();
  });

  describe('getServerInfo', () => {
    it('should return cached data when available', async () => {
      // Arrange
      const userId = 'test-user-id';
      const cachedData = { name: 'Test Server' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      // Act
      const result = await plexService.getServerInfo(userId);

      // Assert
      expect(result).toEqual(cachedData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('plex:server:test-user-id');
    });

    it('should fetch from Plex when cache miss', async () => {
      // Test implementation...
    });
  });
});
```

### Integration Test Pattern
```typescript
describe('Media API Integration', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp(testDb);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  it('should create and retrieve media', async () => {
    const mediaData = {
      title: 'Test Movie',
      type: 'movie',
      description: 'A test movie'
    };

    // Create media
    const createResponse = await request(app)
      .post('/api/v1/media')
      .send(mediaData)
      .expect(201);

    expect(createResponse.body).toMatchObject({
      data: {
        id: expect.any(String),
        title: mediaData.title,
        type: mediaData.type
      }
    });

    // Retrieve media
    const getResponse = await request(app)
      .get(`/api/v1/media/${createResponse.body.data.id}`)
      .expect(200);

    expect(getResponse.body.data).toMatchObject(createResponse.body.data);
  });
});
```

## Logging Patterns

### Structured Logging with Winston
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: configService.get('logging', 'LOG_LEVEL') || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'medianest-backend',
    version: process.env.APP_VERSION || 'unknown'
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Console logging for non-production
if (!configService.isProduction()) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export { logger };
```

## Security Patterns

### Input Validation
```typescript
import { z } from 'zod';

// Schema definitions
const CreateMediaSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).optional(),
  type: z.enum(['movie', 'tv', 'music', 'book']),
  metadata: z.record(z.unknown()).optional()
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid request data', error.errors);
      }
      throw error;
    }
  };
};

// Usage
router.post('/media', validate(CreateMediaSchema), createMedia);
```

### Authentication Middleware
```typescript
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      throw new AuthenticationError();
    }

    const decoded = await jwtService.verifyToken(token);
    const user = await userRepository.findById(decoded.userId);
    
    if (!user) {
      throw new AuthenticationError('Invalid token');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid token');
  }
};
```

## Performance Patterns

### Caching Strategy
```typescript
// Cache abstraction layer
export class CacheService {
  private readonly redis: Redis;
  private readonly defaultTTL = 3600; // 1 hour

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Cache decorator
export const cached = (ttl: number = 3600) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      let result = await cacheService.get(cacheKey);
      if (result === null) {
        result = await method.apply(this, args);
        await cacheService.set(cacheKey, result, ttl);
      }
      
      return result;
    };
  };
};
```

## Build and Development Patterns

### Package.json Script Organization
**MediaNest Established Pattern:**
```json
{
  "scripts": {
    "build": "./scripts/build-stabilizer.sh",
    "build:fast": "npm run build:backend && npm run build:frontend",
    "build:optimized": "node scripts/build-performance-enhancer.js optimize && npm run build",
    "build:clean": "npm run clean && npm run build",
    "build:docker": "docker build -f Dockerfile.optimized --target backend-production -t medianest-backend .",
    
    "start": "npm run start:backend",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "cd backend && npm run test:e2e",
    
    "lint": "eslint src --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint src --ext .ts,.tsx,.js,.jsx --fix",
    "typecheck": "npm run typecheck:backend && npm run typecheck:frontend"
  }
}
```

## Code Organization Patterns

### Feature-Based Structure
```
src/
├── auth/                   # Authentication feature
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.middleware.ts
│   ├── auth.types.ts
│   └── auth.validation.ts
├── media/                  # Media management feature
│   ├── media.controller.ts
│   ├── media.service.ts
│   ├── media.repository.ts
│   └── media.types.ts
├── shared/                 # Shared utilities
│   ├── types/             # Common types
│   ├── utils/             # Utility functions
│   ├── middleware/        # Global middleware
│   └── services/          # Global services
└── config/                # Configuration
    ├── database.ts
    ├── redis.ts
    └── env.ts
```

## Conclusion

These patterns provide:

1. **Type Safety**: Context7-validated TypeScript patterns
2. **Performance**: Optimized routing and caching strategies  
3. **Maintainability**: Consistent architecture and error handling
4. **Scalability**: Service-oriented design with proper separation
5. **Security**: Input validation and authentication patterns
6. **Testing**: Comprehensive testing strategies
7. **Development Experience**: Efficient build and development workflows

Follow these established MediaNest patterns for consistent, high-quality code across the entire application ecosystem.