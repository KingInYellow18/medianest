# MediaNest Backend Implementation Guide

**Version:** 1.0  
**Date:** January 2025  
**Status:** Final

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Core Components](#3-core-components)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [API Design & Implementation](#5-api-design--implementation)
6. [Database Layer](#6-database-layer)
7. [External Service Integration](#7-external-service-integration)
8. [Real-time Communication](#8-real-time-communication)
9. [Background Job Processing](#9-background-job-processing)
10. [Error Handling & Logging](#10-error-handling--logging)
11. [Security Implementation](#11-security-implementation)
12. [Testing Strategy](#12-testing-strategy)
13. [Deployment & Configuration](#13-deployment--configuration)
14. [Performance Optimization](#14-performance-optimization)
15. [Monitoring & Observability](#15-monitoring--observability)

## 1. Overview

The MediaNest backend is built with Node.js and Express.js, following a layered architecture pattern that promotes separation of concerns, testability, and maintainability. This guide provides detailed implementation instructions for each component of the backend system.

### 1.1 Technology Stack

- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js 4.x
- **TypeScript**: 5.x for type safety
- **Database**: PostgreSQL 15.x with Prisma ORM
- **Cache**: Redis 7.x for sessions and queue management
- **Queue**: Bull for background job processing
- **WebSocket**: Socket.io for real-time updates
- **Authentication**: Plex OAuth with JWT tokens

### 1.2 Architecture Principles

- **Layered Architecture**: Controllers → Services → Repositories → Database
- **Dependency Injection**: Loose coupling between components
- **Error Propagation**: Centralized error handling
- **Circuit Breakers**: Resilient external service integration
- **Type Safety**: Full TypeScript coverage

## 2. Project Structure

```
backend/
├── src/
│   ├── server.ts                 # Application entry point
│   ├── app.ts                    # Express application setup
│   ├── config/                   # Configuration management
│   │   ├── index.ts             # Main config loader
│   │   ├── database.ts          # Database configuration
│   │   ├── redis.ts             # Redis configuration
│   │   └── services.ts          # External service configs
│   ├── controllers/              # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── media.controller.ts
│   │   ├── youtube.controller.ts
│   │   └── admin.controller.ts
│   ├── services/                 # Business logic
│   │   ├── auth.service.ts
│   │   ├── media.service.ts
│   │   ├── youtube.service.ts
│   │   └── user.service.ts
│   ├── repositories/             # Data access layer
│   │   ├── user.repository.ts
│   │   ├── media.repository.ts
│   │   └── youtube.repository.ts
│   ├── integrations/            # External service clients
│   │   ├── plex/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── overseerr/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   └── uptime-kuma/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── middleware/              # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── logging.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── validation.middleware.ts
│   ├── routes/                  # Route definitions
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── media.routes.ts
│   │   ├── youtube.routes.ts
│   │   └── admin.routes.ts
│   ├── jobs/                    # Background job processors
│   │   ├── youtube-download.job.ts
│   │   ├── status-check.job.ts
│   │   └── cleanup.job.ts
│   ├── websocket/               # WebSocket handlers
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   └── handlers/
│   ├── utils/                   # Utility functions
│   │   ├── logger.ts
│   │   ├── crypto.ts
│   │   ├── validation.ts
│   │   └── errors.ts
│   ├── types/                   # TypeScript type definitions
│   │   ├── express.d.ts
│   │   ├── models.ts
│   │   └── api.ts
│   └── constants/               # Application constants
│       ├── errors.ts
│       └── config.ts
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── tests/                       # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                     # Utility scripts
├── package.json
├── tsconfig.json
├── .env.example
└── nodemon.json
```

## 3. Core Components

### 3.1 Application Entry Point

```typescript
// src/server.ts
import { createApp } from './app';
import { logger } from './utils/logger';
import { config } from './config';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import { initializeQueues } from './config/queues';
import { initializeWebSocket } from './websocket';

async function startServer() {
  try {
    // Initialize dependencies
    await initializeDatabase();
    await initializeRedis();
    await initializeQueues();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket
    const io = initializeWebSocket(server);

    // Start server
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Cleanup connections
      await cleanup();
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
```

### 3.2 Express Application Setup

```typescript
// src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { requestLogger } from './middleware/logging.middleware';
import { errorHandler } from './middleware/error.middleware';
import { setupRoutes } from './routes';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Compression
  app.use(compression());

  // Logging
  app.use(requestLogger);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', setupRoutes());

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
```

## 4. Authentication & Authorization

### 4.1 Plex OAuth Implementation

```typescript
// src/services/auth.service.ts
import { PlexClient } from '../integrations/plex/client';
import { UserRepository } from '../repositories/user.repository';
import { generateJWT, verifyJWT } from '../utils/jwt';
import { encrypt, decrypt } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { redis } from '../config/redis';

export class AuthService {
  constructor(private plexClient: PlexClient, private userRepository: UserRepository) {}

  async generatePlexPin(): Promise<{ id: string; code: string }> {
    const pinData = await this.plexClient.generatePin();

    // Store pin data in Redis for polling
    await redis.setex(
      `plex:pin:${pinData.id}`,
      300, // 5 minutes TTL
      JSON.stringify(pinData)
    );

    return {
      id: pinData.id,
      code: pinData.code,
    };
  }

  async pollPlexAuth(pinId: string): Promise<{ token?: string; status: string }> {
    const pinData = await redis.get(`plex:pin:${pinId}`);
    if (!pinData) {
      throw new AppError('Pin expired', 400);
    }

    const status = await this.plexClient.checkPin(pinId);

    if (status.authToken) {
      // User authorized
      const plexUser = await this.plexClient.getUser(status.authToken);
      const user = await this.authenticateUser(plexUser, status.authToken);

      // Generate JWT
      const token = generateJWT({
        userId: user.id,
        role: user.role,
        plexId: user.plexId,
      });

      // Cleanup Redis
      await redis.del(`plex:pin:${pinId}`);

      return { token, status: 'authorized' };
    }

    return { status: 'waiting' };
  }

  private async authenticateUser(plexUser: any, plexToken: string) {
    // Encrypt Plex token for storage
    const encryptedToken = encrypt(plexToken);

    // Find or create user
    let user = await this.userRepository.findByPlexId(plexUser.id);

    if (!user) {
      // First user becomes admin
      const userCount = await this.userRepository.count();
      const role = userCount === 0 ? 'admin' : 'user';

      user = await this.userRepository.create({
        plexId: plexUser.id,
        plexUsername: plexUser.username,
        email: plexUser.email,
        role,
        plexToken: encryptedToken,
      });
    } else {
      // Update token and last login
      user = await this.userRepository.update(user.id, {
        plexToken: encryptedToken,
        lastLoginAt: new Date(),
      });
    }

    return user;
  }

  async validateSession(token: string) {
    try {
      const payload = verifyJWT(token);

      // Check if user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || user.status !== 'active') {
        throw new AppError('User not found or inactive', 401);
      }

      return { user, payload };
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  }
}
```

### 4.2 JWT Implementation

```typescript
// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JWTPayload {
  userId: string;
  role: string;
  plexId: string;
}

export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiry,
    algorithm: 'HS256',
  });
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, config.auth.jwtSecret, {
    algorithms: ['HS256'],
  }) as JWTPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

### 4.3 Authentication Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        plexId: string;
      };
    }
  }
}

export function authenticate(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req);
      if (!token) {
        throw new AppError('No token provided', 401);
      }

      const { user, payload } = await authService.validateSession(token);
      req.user = {
        id: user.id,
        role: user.role,
        plexId: user.plexId,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}
```

## 5. API Design & Implementation

### 5.1 Route Structure

```typescript
// src/routes/index.ts
import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { mediaRoutes } from './media.routes';
import { youtubeRoutes } from './youtube.routes';
import { adminRoutes } from './admin.routes';
import { dashboardRoutes } from './dashboard.routes';
import { plexRoutes } from './plex.routes';
import { authenticate } from '../middleware/auth.middleware';
import { container } from '../container'; // DI container

export function setupRoutes(): Router {
  const router = Router();
  const authService = container.get('authService');

  // Public routes
  router.use('/auth', authRoutes);

  // Protected routes
  router.use(authenticate(authService));
  router.use('/dashboard', dashboardRoutes);
  router.use('/media', mediaRoutes);
  router.use('/youtube', youtubeRoutes);
  router.use('/plex', plexRoutes);

  // Admin routes
  router.use('/admin', adminRoutes);

  return router;
}
```

### 5.2 Controller Implementation

```typescript
// src/controllers/media.controller.ts
import { Request, Response, NextFunction } from 'express';
import { MediaService } from '../services/media.service';
import { validateRequest } from '../utils/validation';
import { mediaRequestSchema } from '../schemas/media.schema';

export class MediaController {
  constructor(private mediaService: MediaService) {}

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, type } = req.query;
      const results = await this.mediaService.search(query as string, type as 'movie' | 'tv');

      res.json({
        success: true,
        data: results,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  createRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = validateRequest(mediaRequestSchema, req.body);
      const request = await this.mediaService.createRequest(req.user!.id, validatedData);

      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const requests = await this.mediaService.getUserRequests(req.user!.id, {
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: requests.items,
        meta: {
          pagination: {
            page: requests.page,
            limit: requests.limit,
            total: requests.total,
            totalPages: requests.totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### 5.3 Service Layer Implementation

```typescript
// src/services/media.service.ts
import { MediaRepository } from '../repositories/media.repository';
import { OverseerrClient } from '../integrations/overseerr/client';
import { EventEmitter } from '../utils/events';
import { AppError } from '../utils/errors';
import { redis } from '../config/redis';

export class MediaService {
  constructor(
    private mediaRepository: MediaRepository,
    private overseerrClient: OverseerrClient,
    private eventEmitter: EventEmitter
  ) {}

  async search(query: string, type?: 'movie' | 'tv') {
    // Check cache first
    const cacheKey = `search:${type}:${query}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const results = await this.overseerrClient.search(query, type);

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(results));

      return results;
    } catch (error) {
      // Graceful degradation
      if (error.code === 'SERVICE_UNAVAILABLE') {
        throw new AppError('Media search service is currently unavailable', 503);
      }
      throw error;
    }
  }

  async createRequest(userId: string, data: any) {
    // Check rate limit
    const rateLimitKey = `rate:request:${userId}`;
    const requests = await redis.incr(rateLimitKey);

    if (requests === 1) {
      await redis.expire(rateLimitKey, 3600); // 1 hour
    }

    if (requests > 20) {
      throw new AppError('Request limit exceeded. Try again later.', 429);
    }

    // Submit to Overseerr
    const overseerrRequest = await this.overseerrClient.createRequest({
      mediaType: data.mediaType,
      mediaId: data.tmdbId,
      seasons: data.seasons,
      userId,
    });

    // Store in database
    const request = await this.mediaRepository.create({
      userId,
      title: data.title,
      mediaType: data.mediaType,
      tmdbId: data.tmdbId,
      overseerrId: overseerrRequest.id,
      status: 'pending',
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('media:request:created', {
      userId,
      request,
    });

    return request;
  }

  async getUserRequests(userId: string, pagination: any) {
    return this.mediaRepository.findByUser(userId, pagination);
  }
}
```

## 6. Database Layer

### 6.1 Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  plexId        String    @unique
  plexUsername  String
  email         String?
  role          Role      @default(USER)
  plexToken     String    @db.Text
  createdAt     DateTime  @default(now())
  lastLoginAt   DateTime?
  status        UserStatus @default(ACTIVE)

  mediaRequests MediaRequest[]
  youtubeDownloads YoutubeDownload[]
  sessions      SessionToken[]

  @@index([plexId])
  @@index([status])
}

model MediaRequest {
  id            String    @id @default(uuid())
  userId        String
  title         String
  mediaType     MediaType
  tmdbId        String?
  status        RequestStatus @default(PENDING)
  overseerrId   String?
  createdAt     DateTime  @default(now())
  completedAt   DateTime?

  user          User      @relation(fields: [userId], references: [id])

  @@index([userId, status])
  @@index([createdAt])
}

model YoutubeDownload {
  id              String    @id @default(uuid())
  userId          String
  playlistUrl     String    @db.Text
  playlistTitle   String?
  status          DownloadStatus @default(QUEUED)
  filePaths       Json?
  plexCollectionId String?
  createdAt       DateTime  @default(now())
  completedAt     DateTime?

  user            User      @relation(fields: [userId], references: [id])

  @@index([userId, status])
  @@index([createdAt])
}

model ServiceStatus {
  id              Int       @id @default(autoincrement())
  serviceName     String    @unique
  status          String?
  responseTimeMs  Int?
  lastCheckAt     DateTime?
  uptimePercentage Decimal?  @db.Decimal(5, 2)

  @@index([serviceName])
}

model ServiceConfig {
  id              Int       @id @default(autoincrement())
  serviceName     String    @unique
  serviceUrl      String    @db.Text
  apiKey          String?   @db.Text
  enabled         Boolean   @default(true)
  configData      Json?
  updatedAt       DateTime  @default(now()) @updatedAt
  updatedBy       String?

  @@index([serviceName])
}

model SessionToken {
  id              String    @id @default(uuid())
  userId          String
  tokenHash       String    @unique
  expiresAt       DateTime
  createdAt       DateTime  @default(now())
  lastUsedAt      DateTime?

  user            User      @relation(fields: [userId], references: [id])

  @@index([tokenHash])
  @@index([userId])
}

enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

enum MediaType {
  MOVIE
  TV
}

enum RequestStatus {
  PENDING
  APPROVED
  AVAILABLE
  FAILED
}

enum DownloadStatus {
  QUEUED
  DOWNLOADING
  COMPLETED
  FAILED
}
```

### 6.2 Repository Pattern

```typescript
// src/repositories/base.repository.ts
import { PrismaClient } from '@prisma/client';

export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}

  protected handleDatabaseError(error: any): never {
    if (error.code === 'P2002') {
      throw new AppError('Duplicate entry', 409);
    }
    if (error.code === 'P2025') {
      throw new AppError('Record not found', 404);
    }
    throw error;
  }
}

// src/repositories/user.repository.ts
import { BaseRepository } from './base.repository';
import { User } from '@prisma/client';

export class UserRepository extends BaseRepository<User> {
  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findByPlexId(plexId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { plexId },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async create(data: any): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async update(id: string, data: any): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}
```

## 7. External Service Integration

### 7.1 Circuit Breaker Pattern

```typescript
// src/utils/circuit-breaker.ts
import CircuitBreaker from 'opossum';
import { logger } from './logger';

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

export function createCircuitBreaker<T>(
  fn: (...args: any[]) => Promise<T>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<any[], T> {
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout || 3000,
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,
    rollingCountTimeout: options.rollingCountTimeout || 10000,
    rollingCountBuckets: options.rollingCountBuckets || 10,
  });

  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened for ${fn.name}`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open for ${fn.name}`);
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker closed for ${fn.name}`);
  });

  return breaker;
}
```

### 7.2 Plex Integration

```typescript
// src/integrations/plex/client.ts
import axios, { AxiosInstance } from 'axios';
import { createCircuitBreaker } from '../../utils/circuit-breaker';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export class PlexClient {
  private axios: AxiosInstance;
  private libraryBreaker: CircuitBreaker;
  private pinBreaker: CircuitBreaker;

  constructor() {
    this.axios = axios.create({
      baseURL: 'https://plex.tv/api/v2',
      timeout: 10000,
      headers: {
        'X-Plex-Client-Identifier': config.plex.clientId,
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
      },
    });

    // Circuit breakers for different operations
    this.libraryBreaker = createCircuitBreaker(this.fetchLibraries.bind(this), { timeout: 5000 });

    this.pinBreaker = createCircuitBreaker(this.generatePinInternal.bind(this), { timeout: 3000 });
  }

  async generatePin(): Promise<{ id: string; code: string }> {
    return this.pinBreaker.fire();
  }

  private async generatePinInternal() {
    const response = await this.axios.post('/pins', {
      strong: true,
    });

    return {
      id: response.data.id,
      code: response.data.code,
    };
  }

  async checkPin(pinId: string): Promise<{ authToken?: string }> {
    try {
      const response = await this.axios.get(`/pins/${pinId}`);

      if (response.data.authToken) {
        return { authToken: response.data.authToken };
      }

      return {};
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError('Pin not found or expired', 404);
      }
      throw error;
    }
  }

  async getUser(token: string) {
    const response = await this.axios.get('/user', {
      headers: {
        'X-Plex-Token': token,
      },
    });

    return response.data;
  }

  async getLibraries(serverUrl: string, token: string) {
    return this.libraryBreaker.fire(serverUrl, token);
  }

  private async fetchLibraries(serverUrl: string, token: string) {
    const response = await axios.get(`${serverUrl}/library/sections`, {
      headers: {
        'X-Plex-Token': token,
      },
    });

    return response.data.MediaContainer.Directory;
  }
}
```

### 7.3 Overseerr Integration

```typescript
// src/integrations/overseerr/client.ts
import axios, { AxiosInstance } from 'axios';
import { createCircuitBreaker } from '../../utils/circuit-breaker';
import { AppError } from '../../utils/errors';
import { redis } from '../../config/redis';

export class OverseerrClient {
  private axios: AxiosInstance;
  private searchBreaker: CircuitBreaker;
  private requestBreaker: CircuitBreaker;

  constructor(private config: { url: string; apiKey: string }) {
    this.axios = axios.create({
      baseURL: `${config.url}/api/v1`,
      timeout: 10000,
      headers: {
        'X-Api-Key': config.apiKey,
      },
    });

    this.searchBreaker = createCircuitBreaker(this.searchInternal.bind(this), {
      timeout: 5000,
      fallback: this.searchFallback.bind(this),
    });

    this.requestBreaker = createCircuitBreaker(this.createRequestInternal.bind(this));
  }

  async search(query: string, type?: 'movie' | 'tv') {
    return this.searchBreaker.fire(query, type);
  }

  private async searchInternal(query: string, type?: 'movie' | 'tv') {
    const endpoint = type === 'movie' ? '/search/movie' : '/search/multi';
    const response = await this.axios.get(endpoint, {
      params: { query },
    });

    return response.data.results;
  }

  private async searchFallback(query: string, type?: 'movie' | 'tv') {
    // Return cached data if available
    const cacheKey = `overseerr:search:fallback:${type}:${query}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    throw new AppError('Search service unavailable', 503);
  }

  async createRequest(data: any) {
    return this.requestBreaker.fire(data);
  }

  private async createRequestInternal(data: any) {
    const response = await this.axios.post('/request', {
      mediaType: data.mediaType,
      mediaId: data.mediaId,
      seasons: data.seasons,
    });

    return response.data;
  }

  async getRequestStatus(requestId: string) {
    const response = await this.axios.get(`/request/${requestId}`);
    return response.data;
  }
}
```

## 8. Real-time Communication

### 8.1 Socket.io Setup

```typescript
// src/websocket/index.ts
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyJWT } from '../utils/jwt';
import { logger } from '../utils/logger';
import { setupHandlers } from './handlers';

export function initializeWebSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyJWT(token);
      socket.data.user = payload;

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    logger.info(`User ${socket.data.user.userId} connected`);

    // Join user-specific room
    socket.join(`user:${socket.data.user.userId}`);

    // Setup event handlers
    setupHandlers(io, socket);

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${socket.data.user.userId} disconnected`);
    });
  });

  return io;
}
```

### 8.2 WebSocket Event Handlers

```typescript
// src/websocket/handlers/status.handler.ts
import { Server, Socket } from 'socket.io';
import { UptimeKumaClient } from '../../integrations/uptime-kuma/client';

export function setupStatusHandlers(io: Server, socket: Socket, uptimeKuma: UptimeKumaClient) {
  // Subscribe to status updates
  socket.on('subscribe:status', async () => {
    socket.join('status-updates');

    // Send current status
    const status = await uptimeKuma.getAllMonitors();
    socket.emit('status:current', status);
  });

  // Unsubscribe from status updates
  socket.on('unsubscribe:status', () => {
    socket.leave('status-updates');
  });

  // Handle status updates from Uptime Kuma
  uptimeKuma.on('status:update', (data) => {
    io.to('status-updates').emit('status:update', data);
  });
}

// src/websocket/handlers/youtube.handler.ts
export function setupYoutubeHandlers(io: Server, socket: Socket) {
  // Subscribe to download progress
  socket.on('subscribe:download', (downloadId: string) => {
    // Verify user owns this download
    if (socket.data.user.role !== 'admin') {
      // Check ownership in database
      // For now, join the room
    }

    socket.join(`download:${downloadId}`);
  });

  // Emit progress updates from job processor
  socket.on('unsubscribe:download', (downloadId: string) => {
    socket.leave(`download:${downloadId}`);
  });
}
```

## 9. Background Job Processing

### 9.1 Queue Configuration

```typescript
// src/config/queues.ts
import Queue from 'bull';
import { redis } from './redis';
import { logger } from '../utils/logger';

export const youtubeQueue = new Queue('youtube-downloads', {
  redis: {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const statusQueue = new Queue('status-checks', {
  redis: redis.options,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },
});

export async function initializeQueues() {
  // Setup queue event listeners
  youtubeQueue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed`, { result });
  });

  youtubeQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed`, { error: err.message });
  });

  // Import and register job processors
  const { processYoutubeDownload } = await import('../jobs/youtube-download.job');
  const { processStatusCheck } = await import('../jobs/status-check.job');

  youtubeQueue.process(5, processYoutubeDownload);
  statusQueue.process(1, processStatusCheck);

  // Schedule recurring jobs
  statusQueue.add(
    'check-all-services',
    {},
    {
      repeat: {
        cron: '*/5 * * * *', // Every 5 minutes
      },
    }
  );

  logger.info('Queues initialized');
}
```

### 9.2 YouTube Download Job

```typescript
// src/jobs/youtube-download.job.ts
import { Job } from 'bull';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { YoutubeRepository } from '../repositories/youtube.repository';
import { PlexClient } from '../integrations/plex/client';
import { io } from '../websocket';
import { logger } from '../utils/logger';

interface DownloadJobData {
  downloadId: string;
  userId: string;
  playlistUrl: string;
}

export async function processYoutubeDownload(job: Job<DownloadJobData>) {
  const { downloadId, userId, playlistUrl } = job.data;
  const repository = new YoutubeRepository();

  try {
    // Update status to downloading
    await repository.updateStatus(downloadId, 'DOWNLOADING');

    // Create user directory
    const userDir = path.join(process.env.YOUTUBE_DOWNLOAD_PATH!, userId);
    await fs.mkdir(userDir, { recursive: true });

    // Download with yt-dlp
    const files = await downloadPlaylist(playlistUrl, userDir, (progress) => {
      // Update job progress
      job.progress(progress);

      // Emit progress to WebSocket
      io.to(`download:${downloadId}`).emit('download:progress', {
        downloadId,
        progress,
      });
    });

    // Update database with file paths
    await repository.update(downloadId, {
      status: 'COMPLETED',
      filePaths: files,
      completedAt: new Date(),
    });

    // Create Plex collection (optional)
    if (process.env.PLEX_AUTO_COLLECTION === 'true') {
      await createPlexCollection(userId, downloadId, files);
    }

    // Notify user
    io.to(`user:${userId}`).emit('download:completed', {
      downloadId,
      files: files.length,
    });

    return { success: true, files: files.length };
  } catch (error) {
    // Update status to failed
    await repository.updateStatus(downloadId, 'FAILED');

    // Notify user
    io.to(`user:${userId}`).emit('download:failed', {
      downloadId,
      error: error.message,
    });

    throw error;
  }
}

async function downloadPlaylist(
  url: string,
  outputDir: string,
  onProgress: (progress: number) => void
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const files: string[] = [];
    let lastProgress = 0;

    const ytdlp = spawn('yt-dlp', [
      url,
      '-o',
      path.join(outputDir, '%(playlist_title)s/%(title)s.%(ext)s'),
      '--newline',
      '--no-warnings',
      '--print',
      'after_move:filepath',
    ]);

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();

      // Parse progress
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        if (progress !== lastProgress) {
          lastProgress = progress;
          onProgress(progress);
        }
      }

      // Collect file paths
      if (output.includes('/')) {
        files.push(output.trim());
      }
    });

    ytdlp.stderr.on('data', (data) => {
      logger.warn(`yt-dlp stderr: ${data}`);
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        resolve(files);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    ytdlp.on('error', reject);
  });
}
```

## 10. Error Handling & Logging

### 10.1 Centralized Error Handling

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error with context
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.details,
      },
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid authentication token',
      },
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

### 10.2 Logging Configuration

```typescript
// src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, errors, printf } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: { service: 'medianest-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? json() : combine(timestamp(), consoleFormat),
    }),

    // File transport with rotation
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),

    // Error file transport
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
});

// Create child logger for specific contexts
export function createLogger(context: string) {
  return logger.child({ context });
}
```

## 11. Security Implementation

### 11.1 Rate Limiting

```typescript
// src/middleware/rate-limit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.user?.id || req.ip,
    skipSuccessfulRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate:${keyGenerator(req)}`;

    try {
      // Lua script for atomic increment and expiry
      const luaScript = `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current = redis.call('GET', key)
        
        if current and tonumber(current) >= limit then
          return redis.call('TTL', key)
        else
          current = redis.call('INCR', key)
          if current == 1 then
            redis.call('EXPIRE', key, window)
          end
          return 0
        end
      `;

      const ttl = await redis.eval(luaScript, 1, key, max, Math.ceil(windowMs / 1000));

      if (ttl > 0) {
        res.setHeader('Retry-After', ttl);
        throw new AppError('Too many requests', 429, {
          retryAfter: ttl,
        });
      }

      // Store original end function
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        if (skipSuccessfulRequests && res.statusCode < 400) {
          // Decrement counter for successful requests
          redis.decr(key);
        }
        originalEnd.apply(res, args);
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        // Redis error - allow request but log
        logger.error('Rate limit check failed', { error });
        next();
      }
    }
  };
}

// Specific rate limiters
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => req.ip,
});

export const youtubeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.user!.id,
});
```

### 11.2 Input Validation

```typescript
// src/utils/validation.ts
import Joi from 'joi';
import { AppError } from './errors';

export function validateRequest<T>(schema: Joi.Schema, data: any): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.reduce((acc, detail) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {} as Record<string, string>);

    throw new AppError('Validation failed', 400, { details });
  }

  return value as T;
}

// src/schemas/media.schema.ts
export const mediaRequestSchema = Joi.object({
  title: Joi.string().required().max(500),
  mediaType: Joi.string().valid('movie', 'tv').required(),
  tmdbId: Joi.string().required(),
  seasons: Joi.when('mediaType', {
    is: 'tv',
    then: Joi.array().items(
      Joi.object({
        seasonNumber: Joi.number().integer().min(0).required(),
        episodes: Joi.array().items(Joi.number().integer().min(1)),
      })
    ),
  }),
});

// src/schemas/youtube.schema.ts
export const youtubeDownloadSchema = Joi.object({
  playlistUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .pattern(/^https?:\/\/(www\.)?youtube\.com\//)
    .required()
    .messages({
      'string.pattern.base': 'Must be a valid YouTube URL',
    }),
});
```

### 11.3 Encryption Utilities

```typescript
// src/utils/crypto.ts
import crypto from 'crypto';
import { config } from '../config';

const algorithm = 'aes-256-gcm';
const keyDerivation = (password: string) => crypto.scryptSync(password, 'salt', 32);

export function encrypt(text: string): string {
  const key = keyDerivation(config.encryption.key);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const key = keyDerivation(config.encryption.key);

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

## 12. Testing Strategy

### 12.1 Unit Testing

```typescript
// tests/unit/services/auth.service.test.ts
import { AuthService } from '../../../src/services/auth.service';
import { PlexClient } from '../../../src/integrations/plex/client';
import { UserRepository } from '../../../src/repositories/user.repository';
import { redis } from '../../../src/config/redis';

jest.mock('../../../src/integrations/plex/client');
jest.mock('../../../src/repositories/user.repository');
jest.mock('../../../src/config/redis');

describe('AuthService', () => {
  let authService: AuthService;
  let plexClient: jest.Mocked<PlexClient>;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    plexClient = new PlexClient() as jest.Mocked<PlexClient>;
    userRepository = new UserRepository(null) as jest.Mocked<UserRepository>;
    authService = new AuthService(plexClient, userRepository);
  });

  describe('generatePlexPin', () => {
    it('should generate and store PIN in Redis', async () => {
      const pinData = { id: '123', code: 'ABCD' };
      plexClient.generatePin.mockResolvedValue(pinData);

      const result = await authService.generatePlexPin();

      expect(result).toEqual(pinData);
      expect(redis.setex).toHaveBeenCalledWith('plex:pin:123', 300, JSON.stringify(pinData));
    });
  });

  describe('pollPlexAuth', () => {
    it('should return waiting status when not authorized', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ id: '123' }));
      plexClient.checkPin.mockResolvedValue({});

      const result = await authService.pollPlexAuth('123');

      expect(result).toEqual({ status: 'waiting' });
    });

    it('should authenticate user when authorized', async () => {
      const pinData = { id: '123' };
      const plexUser = { id: 'plex123', username: 'testuser' };

      redis.get.mockResolvedValue(JSON.stringify(pinData));
      plexClient.checkPin.mockResolvedValue({ authToken: 'token123' });
      plexClient.getUser.mockResolvedValue(plexUser);
      userRepository.findByPlexId.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(0);
      userRepository.create.mockResolvedValue({
        id: 'user123',
        role: 'admin',
        plexId: 'plex123',
      });

      const result = await authService.pollPlexAuth('123');

      expect(result.status).toBe('authorized');
      expect(result.token).toBeDefined();
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin', // First user is admin
        })
      );
    });
  });
});
```

### 12.2 Integration Testing

```typescript
// tests/integration/api/auth.test.ts
import request from 'supertest';
import { createApp } from '../../../src/app';
import { initializeDatabase } from '../../../src/config/database';
import { initializeRedis } from '../../../src/config/redis';

describe('Auth API Integration', () => {
  let app: Application;

  beforeAll(async () => {
    await initializeDatabase();
    await initializeRedis();
    app = createApp();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/auth/plex/pin', () => {
    it('should generate a Plex PIN', async () => {
      const response = await request(app).post('/api/auth/plex/pin').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          code: expect.stringMatching(/^[A-Z0-9]{4}$/),
        },
      });
    });
  });

  describe('GET /api/auth/plex/poll/:pinId', () => {
    it('should poll for authorization status', async () => {
      // First generate a PIN
      const pinResponse = await request(app).post('/api/auth/plex/pin').expect(200);

      const pinId = pinResponse.body.data.id;

      // Poll for status
      const response = await request(app).get(`/api/auth/plex/poll/${pinId}`).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'waiting',
        },
      });
    });
  });
});
```

## 13. Deployment & Configuration

### 13.1 Environment Configuration

```bash
# .env.example
# Application
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/medianest?connection_limit=20&pool_timeout=30

# Redis
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-secure-jwt-secret-min-64-chars
JWT_EXPIRY=30d
ENCRYPTION_KEY=your-32-byte-encryption-key

# Plex
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret

# External Services (configured via admin UI)
# These are fallback values if not configured in database
OVERSEERR_URL=http://overseerr:5055
OVERSEERR_API_KEY=your-overseerr-api-key
UPTIME_KUMA_URL=http://uptime-kuma:3001
UPTIME_KUMA_TOKEN=your-uptime-kuma-token

# YouTube Downloads
YOUTUBE_DOWNLOAD_PATH=/app/youtube
YOUTUBE_RATE_LIMIT=5
PLEX_AUTO_COLLECTION=false

# Admin Bootstrap
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
```

### 13.2 Docker Configuration

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npm install -g prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip install yt-dlp

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

CMD ["node", "dist/server.js"]
```

### 13.3 Database Migrations

```typescript
// scripts/migrate.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

async function migrate() {
  const prisma = new PrismaClient();

  try {
    logger.info('Running database migrations...');

    // Run Prisma migrations
    await prisma.$executeRawUnsafe(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Apply migrations
    await prisma.$migrate.deploy();

    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
```

## 14. Performance Optimization

### 14.1 Database Query Optimization

```typescript
// src/repositories/media.repository.ts
export class MediaRepository extends BaseRepository<MediaRequest> {
  async findByUser(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<MediaRequest>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Use Prisma's select to minimize data transfer
    const [items, total] = await Promise.all([
      this.prisma.mediaRequest.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          mediaType: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mediaRequest.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async bulkUpdateStatus(requestIds: string[], status: RequestStatus): Promise<number> {
    // Use raw query for bulk updates
    const result = await this.prisma.$executeRaw`
      UPDATE "MediaRequest"
      SET status = ${status}, "completedAt" = ${new Date()}
      WHERE id = ANY(${requestIds}::uuid[])
    `;

    return result.count;
  }
}
```

### 14.2 Caching Strategy

```typescript
// src/utils/cache.ts
import { redis } from '../config/redis';
import { logger } from './logger';

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export class CacheService {
  constructor(private options: CacheOptions = {}) {
    this.options.ttl = options.ttl || 300; // 5 minutes default
    this.options.prefix = options.prefix || 'cache';
  }

  private getKey(key: string): string {
    return `${this.options.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(this.getKey(key));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await redis.setex(this.getKey(key), ttl || this.options.ttl!, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(`${this.options.prefix}:${pattern}`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache invalidate error', { pattern, error });
    }
  }

  // Decorator for method caching
  cache(keyGenerator: (...args: any[]) => string, ttl?: number) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = keyGenerator(...args);

        // Try cache first
        const cached = await this.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // Execute method and cache result
        const result = await originalMethod.apply(this, args);
        await this.set(cacheKey, result, ttl);

        return result;
      };

      return descriptor;
    };
  }
}

// Usage example
class MediaService {
  private cache = new CacheService({ prefix: 'media' });

  @cache((query, type) => `search:${type}:${query}`, 300)
  async search(query: string, type?: string) {
    // This method's results will be automatically cached
    return this.overseerrClient.search(query, type);
  }
}
```

### 14.3 Connection Pooling

```typescript
// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export async function initializeDatabase(): Promise<PrismaClient> {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Query', {
          query: e.query,
          duration: e.duration,
        });
      });
    }

    // Log slow queries
    prisma.$on('query', (e) => {
      if (e.duration > 1000) {
        logger.warn('Slow query detected', {
          query: e.query,
          duration: e.duration,
        });
      }
    });

    // Test connection
    await prisma.$connect();
    logger.info('Database connected');
  }

  return prisma;
}

export { prisma };
```

## 15. Monitoring & Observability

### 15.1 Application Metrics

```typescript
// src/utils/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Business metrics
export const mediaRequestsTotal = new Counter({
  name: 'media_requests_total',
  help: 'Total number of media requests',
  labelNames: ['type', 'status'],
});

export const youtubeDownloadsTotal = new Counter({
  name: 'youtube_downloads_total',
  help: 'Total number of YouTube downloads',
  labelNames: ['status'],
});

export const activeUsersGauge = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
});

// Queue metrics
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue'],
  buckets: [1, 5, 10, 30, 60, 300],
});

// Metrics endpoint
export function setupMetrics(app: Application) {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

// Middleware to track HTTP metrics
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || 'unknown';
      const labels = {
        method: req.method,
        route,
        status: res.statusCode.toString(),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, duration);
    });

    next();
  };
}
```

### 15.2 Health Checks

```typescript
// src/utils/health.ts
import { PrismaClient } from '@prisma/client';
import { redis } from '../config/redis';
import { PlexClient } from '../integrations/plex/client';
import { OverseerrClient } from '../integrations/overseerr/client';

interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
}

export class HealthChecker {
  private checks: HealthCheck[] = [];

  constructor(
    private prisma: PrismaClient,
    private plexClient: PlexClient,
    private overseerrClient: OverseerrClient
  ) {
    this.setupChecks();
  }

  private setupChecks() {
    // Database check
    this.addCheck('database', async () => {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    });

    // Redis check
    this.addCheck('redis', async () => {
      try {
        await redis.ping();
        return true;
      } catch {
        return false;
      }
    });

    // External services (non-critical)
    this.addCheck('plex', async () => {
      try {
        await this.plexClient.health();
        return true;
      } catch {
        return false;
      }
    });
  }

  addCheck(name: string, check: () => Promise<boolean>) {
    this.checks.push({ name, check });
  }

  async checkAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      this.checks.map(async ({ name, check }) => {
        try {
          results[name] = await check();
        } catch {
          results[name] = false;
        }
      })
    );

    return results;
  }

  async isHealthy(): Promise<boolean> {
    const results = await this.checkAll();
    // Only database and redis are critical
    return results.database && results.redis;
  }
}

// Health endpoint
export function setupHealthCheck(app: Application, checker: HealthChecker) {
  app.get('/health', async (req, res) => {
    const results = await checker.checkAll();
    const healthy = await checker.isHealthy();

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: results,
    });
  });
}
```

## Conclusion

This implementation guide provides a comprehensive blueprint for building the MediaNest backend. Key considerations:

1. **Security First**: Authentication, authorization, rate limiting, and encryption are built into every layer
2. **Resilience**: Circuit breakers, graceful degradation, and error handling ensure system stability
3. **Performance**: Caching, connection pooling, and query optimization for responsive user experience
4. **Observability**: Comprehensive logging, metrics, and health checks for operational excellence
5. **Maintainability**: Clear separation of concerns, TypeScript for type safety, and thorough testing

The architecture is designed to scale from 10-20 users to 50+ without major changes, while maintaining simplicity for a single-developer team.

## Current Implementation Status

_Last updated: January 2025_

### ✅ Phase 1: Core Infrastructure (COMPLETED)

- ✅ Express server setup with TypeScript
- ✅ Prisma database schema and migrations
- ✅ JWT authentication middleware with role-based access control
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Winston logging system with correlation IDs
- ✅ Repository pattern with full CRUD operations
- ✅ Rate limiting with Redis Lua scripts (100 req/min API, 5/hr YouTube)
- ✅ Basic monitoring and metrics collection
- ✅ Complete test suite (30 tests, 60-70% coverage achieved)

### ✅ Phase 1+: Authentication & User Management (COMPLETED)

- ✅ Plex OAuth PIN flow implementation
- ✅ JWT token generation/validation (30-day remember me)
- ✅ User repository with encryption for Plex tokens
- ✅ RBAC middleware with admin/user roles
- ✅ Session management and validation
- ✅ First user becomes admin automatically

### 🚧 Phase 2: External Service Integration (NEXT)

- [ ] Plex API client with circuit breakers
- [ ] Overseerr integration with graceful fallbacks
- [ ] Uptime Kuma WebSocket connection
- [ ] Service status monitoring and caching
- [ ] Service configuration management

### 📋 Phase 3: Features & WebSocket (PLANNED)

- [ ] Media request management through Overseerr
- [ ] YouTube download system with yt-dlp
- [ ] Real-time notifications via Socket.io
- [ ] Background job processing with BullMQ
- [ ] Admin dashboard APIs

### Infrastructure Achievements

- **Database**: PostgreSQL with Prisma ORM, proper migrations
- **Cache/Queue**: Redis integration with connection pooling
- **Security**: Input validation, SQL injection prevention, rate limiting
- **Testing**: Vitest with MSW for external API mocking
- **Error Handling**: Structured errors with correlation tracking
- **Logging**: Rotating logs with different levels and contexts

### Test Coverage Summary

- **Total Tests**: 30 passing
- **Coverage**: 60-70% overall, 80%+ for auth/security
- **Test Types**: Unit tests (JWT, middleware), Integration tests (repositories, auth flow)
- **Test Infrastructure**: Vitest, MSW, Supertest, ioredis-mock
- **Execution Time**: <5 minutes (target achieved)

### Implemented Components

| Component              | Status      | Coverage            | Notes                                   |
| ---------------------- | ----------- | ------------------- | --------------------------------------- |
| JWT Authentication     | ✅ Complete | 72%                 | 30-day remember me, security focused    |
| Plex OAuth PIN Flow    | ✅ Complete | Tests written       | PIN generation/verification             |
| User Repository        | ✅ Complete | 76%                 | CRUD, pagination, encryption            |
| Rate Limiting          | ✅ Complete | Tests written       | Redis Lua scripts, atomic operations    |
| Error Handling         | ✅ Complete | 81%                 | User-friendly messages, correlation IDs |
| Correlation Middleware | ✅ Complete | 100%                | Request tracking across services        |
| Database Layer         | ✅ Complete | Schema + migrations | Prisma ORM with proper relations        |

## Next Steps

1. **Phase 2 Implementation**: External service integration (Plex, Overseerr, Uptime Kuma)
2. **API Documentation**: OpenAPI/Swagger specifications
3. **CI/CD Pipeline**: Automated testing and deployment
4. **Monitoring Dashboards**: Grafana for operational metrics
5. **End-to-End Tests**: Critical user flow validation
6. **Performance Benchmarks**: API endpoint optimization
