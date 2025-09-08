# MediaNest API Design Standards

## Overview
This document establishes RESTful API design standards for MediaNest, based on Express.js patterns validated with Context7 and discovered from the existing codebase.

## Express.js Framework Standards (v4.21.0+)

### Router Organization Pattern
Following the **Context7-validated pattern** from our codebase:

```typescript
// Context7 Pattern: Optimized Router with Performance Considerations
const router = Router();

// Public routes (no authentication middleware overhead) - optimized order by frequency
router.use('/health', healthRoutes); // Most frequent - health checks
router.use('/simple-health', simpleHealthRouter); // Docker health checks
router.use('/auth', authRoutes); // High frequency - authentication endpoints
router.use('/webhooks', webhookRoutes); // Medium frequency - external webhooks

// Protected routes with single authentication point
const protectedRouter = Router();
protectedRouter.use(authenticate);

// Protected routes ordered by frequency and resource intensity
protectedRouter.use('/dashboard', dashboardRoutes); // Most frequent user endpoint
protectedRouter.use('/media', mediaRoutes); // High frequency media operations
protectedRouter.use('/services', servicesRoutes); // Service status checks
protectedRouter.use('/admin', adminRoutes); // Admin operations (typically heavier)
```

### Authentication Middleware Pattern

**Established MediaNest Pattern:**
```typescript
// Context7 Pattern: Pre-authentication middleware for performance metrics
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
```

## RESTful API Design Principles

### 1. Resource-Based URL Structure
```
/api/v1/{resource}              # Collection operations
/api/v1/{resource}/{id}         # Resource operations
/api/v1/{resource}/{id}/{sub}   # Sub-resource operations
```

### 2. HTTP Methods Mapping
- **GET** `/api/v1/media` - Retrieve media collection
- **POST** `/api/v1/media` - Create new media
- **GET** `/api/v1/media/{id}` - Retrieve specific media
- **PUT** `/api/v1/media/{id}` - Update entire media resource
- **PATCH** `/api/v1/media/{id}` - Partial update media resource
- **DELETE** `/api/v1/media/{id}` - Remove media resource

### 3. Status Code Standards
```typescript
// Success Responses
200 OK          // Successful GET, PUT, PATCH
201 Created     // Successful POST
204 No Content  // Successful DELETE

// Client Error Responses
400 Bad Request     // Invalid request syntax
401 Unauthorized    // Authentication required
403 Forbidden       // Access denied
404 Not Found       // Resource doesn't exist
422 Unprocessable Entity // Validation errors

// Server Error Responses
500 Internal Server Error // Unexpected server error
503 Service Unavailable   // Service temporarily unavailable
```

## TypeScript Type Safety Patterns

### Branded Types for API Safety
Based on Context7 validation and MediaNest patterns:

```typescript
// Context7 Pattern: Branded types for type safety
type UserId = Brand<string, 'UserId'>;
type PlexUserId = Brand<string, 'PlexUserId'>;
type CacheKey = Brand<string, 'CacheKey'>;

// Result pattern for error handling
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

async function getUser(userId: UserId): Promise<Result<User, AppError>> {
  try {
    const user = await userRepository.findById(userId);
    return success(user);
  } catch (error) {
    return failure(new AppError('USER_NOT_FOUND', 'User not found', 404));
  }
}
```

### Template Literal Types for API Patterns
```typescript
// API endpoint pattern validation
type APIEndpoint = `/api/v1/${string}`;
type HealthEndpoint = `/health` | `/simple-health`;

// String pattern validation
type MediaType = `media/${string}`;
type ServiceName = `${string}Service`;
```

## Configuration Management Pattern

### Centralized Configuration Service
**MediaNest Standard:**
```typescript
export class ConfigService {
  private readonly config: AppConfig;

  // Type-safe configuration access
  get<T extends keyof AppConfig>(category: T): AppConfig[T];
  get<T extends keyof AppConfig, K extends keyof AppConfig[T]>(
    category: T,
    key: K
  ): AppConfig[T][K];

  // Environment-specific methods
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;

  // Masked config for logging (security)
  getMaskedConfig(): Partial<AppConfig>;
}
```

## Service Layer Patterns

### Repository Pattern Implementation
```typescript
export class BaseRepository<T> {
  protected abstract tableName: string;

  async findById(id: string): Promise<T | null> {
    // Standard implementation
  }

  async create(data: Partial<T>): Promise<T> {
    // Standard implementation with validation
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    // Standard implementation
  }

  async delete(id: string): Promise<void> {
    // Standard implementation
  }
}
```

### Service Layer with Caching
**MediaNest Plex Service Pattern:**
```typescript
export class PlexService {
  private readonly clients = new Map<PlexUserId, PlexClient>();
  private readonly cachePrefix = 'plex:' as const;
  
  private readonly cacheTTL = {
    serverInfo: 3600,    // 1 hour
    libraries: 3600,     // 1 hour
    search: 300,         // 5 minutes
    recentlyAdded: 1800, // 30 minutes
  } as const;

  async getServerInfo(userId: string) {
    const cacheKey = `${this.cachePrefix}server:${userId}`;
    
    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from source
    const result = await this.fetchFromSource(userId);
    
    // Cache result
    await redisClient.setex(cacheKey, this.cacheTTL.serverInfo, JSON.stringify(result));
    
    return result;
  }
}
```

## Error Handling Standards

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
  }
}

// Usage in controllers
async function handleRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getData(req.params.id);
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }
    next(error);
  }
}
```

## Validation Standards

### Request Validation with Joi/Zod
```typescript
import { z } from 'zod';

// Schema definition
const CreateMediaSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['movie', 'tv', 'music', 'book']),
  metadata: z.record(z.any()).optional()
});

// Middleware integration
export const validateCreateMedia = (req: Request, res: Response, next: NextFunction) => {
  try {
    CreateMediaSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors
      }
    });
  }
};
```

## Performance Standards

### Response Time Headers
**Standard Practice:**
```typescript
// Add performance metrics to all responses
app.use((req, res, next) => {
  const startTime = Number(process.hrtime.bigint());
  
  res.on('finish', () => {
    const duration = (Number(process.hrtime.bigint()) - startTime) / 1e6;
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  
  next();
});
```

### Caching Strategy
1. **Memory Cache**: For frequently accessed small data
2. **Redis Cache**: For session data and computed results
3. **HTTP Caching**: For static resources and public data
4. **Database Query Optimization**: Use proper indexes and query patterns

## Security Standards

### Authentication Headers
```typescript
// Required security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
```

### Rate Limiting
```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP'
    }
  }
});

app.use('/api/', rateLimiter);
```

## Testing Standards

### API Contract Testing
```typescript
describe('Media API', () => {
  it('should create media with valid data', async () => {
    const mediaData = {
      title: 'Test Movie',
      type: 'movie',
      description: 'A test movie'
    };

    const response = await request(app)
      .post('/api/v1/media')
      .send(mediaData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: mediaData.title,
      type: mediaData.type,
      createdAt: expect.any(String)
    });
  });
});
```

## Documentation Standards

### OpenAPI/Swagger Integration
```typescript
/**
 * @swagger
 * /api/v1/media:
 *   get:
 *     summary: Retrieve media collection
 *     tags: [Media]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Media collection retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
```

## Deployment API Standards

### Health Check Endpoints
```typescript
// Simple health check (used by Docker)
app.get('/simple-health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      external: await checkExternalServicesHealth()
    }
  };
  
  const allHealthy = Object.values(health.services).every(service => service.status === 'ok');
  res.status(allHealthy ? 200 : 503).json(health);
});
```

## Version Control Standards

### API Versioning Strategy
1. **URL Versioning**: `/api/v1/`, `/api/v2/`
2. **Backward Compatibility**: Maintain previous versions for 6 months
3. **Deprecation Headers**: Include deprecation warnings
4. **Migration Guides**: Document breaking changes

### Response Format Standards
```typescript
// Success Response
{
  "data": { /* resource data */ },
  "meta": {
    "version": "1.0",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}

// Error Response
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": { /* additional context */ }
  },
  "meta": {
    "version": "1.0",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## Conclusion

These standards ensure:
- **Type Safety**: Using TypeScript patterns validated with Context7
- **Performance**: Optimized routing and caching strategies
- **Security**: Proper authentication, authorization, and input validation
- **Maintainability**: Consistent patterns and error handling
- **Scalability**: Service-oriented architecture with proper separation of concerns

Follow these patterns consistently across all MediaNest API development to maintain code quality and system reliability.