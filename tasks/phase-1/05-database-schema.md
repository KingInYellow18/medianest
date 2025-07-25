# Task: Database Schema and Prisma Setup

**Task ID:** PHASE1-05  
**Priority:** Critical  
**Estimated Time:** 3 hours  
**Dependencies:** PHASE1-03 (Backend Initialization)

## Objective
Set up PostgreSQL database schema using Prisma ORM with all necessary tables, relationships, and constraints for the MediaNest application.

## Acceptance Criteria
- [ ] Prisma schema defined with all required models
- [ ] Database migrations created and applied
- [ ] Seed data for initial admin user
- [ ] Indexes optimized for common queries
- [ ] Type-safe database client generated
- [ ] Database connection pool configured

## Detailed Steps

### 1. Initialize Prisma
```bash
cd backend
npx prisma init
```

### 2. Configure Prisma Schema
Update `backend/prisma/schema.prisma`:

```prisma
// This is your Prisma schema file
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum UserRole {
  user
  admin
}

enum UserStatus {
  active
  suspended
}

enum RequestStatus {
  pending
  approved
  available
  failed
}

enum DownloadStatus {
  queued
  downloading
  completed
  failed
}

enum ServiceStatus {
  up
  down
  degraded
}

// Models
model User {
  id            String   @id @default(uuid())
  plexId        String   @unique
  plexUsername  String
  email         String?
  role          UserRole @default(user)
  plexToken     String?  // Encrypted
  createdAt     DateTime @default(now())
  lastLoginAt   DateTime?
  status        UserStatus @default(active)
  
  // Relations
  mediaRequests     MediaRequest[]
  youtubeDownloads  YouTubeDownload[]
  sessionTokens     SessionToken[]
  rateLimits        RateLimit[]
  activityLogs      ActivityLog[]
  
  @@index([email])
  @@index([status])
  @@map("users")
}

model MediaRequest {
  id            String   @id @default(uuid())
  userId        String
  title         String   @db.VarChar(500)
  mediaType     String   @db.VarChar(50)
  tmdbId        String?  @db.VarChar(100)
  imdbId        String?  @db.VarChar(100)
  status        RequestStatus @default(pending)
  overseerrId   String?  @db.VarChar(255)
  requestData   Json?    // Store additional metadata
  createdAt     DateTime @default(now())
  completedAt   DateTime?
  
  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  statusUpdates MediaRequestStatusUpdate[]
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("media_requests")
}

model MediaRequestStatusUpdate {
  id            String   @id @default(uuid())
  requestId     String
  status        RequestStatus
  message       String?
  createdAt     DateTime @default(now())
  
  // Relations
  request       MediaRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  @@index([requestId])
  @@map("media_request_status_updates")
}

model YouTubeDownload {
  id              String   @id @default(uuid())
  userId          String
  playlistUrl     String   @db.Text
  playlistTitle   String?  @db.VarChar(500)
  status          DownloadStatus @default(queued)
  filePaths       Json?    // Array of file paths
  plexCollectionId String? @db.VarChar(255)
  progress        Int      @default(0)
  errorMessage    String?
  metadata        Json?    // Additional download metadata
  createdAt       DateTime @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("youtube_downloads")
}

model Service {
  id              Int      @id @default(autoincrement())
  name            String   @unique @db.VarChar(100)
  displayName     String   @db.VarChar(100)
  url             String?  @db.Text
  apiKey          String?  @db.Text // Encrypted
  enabled         Boolean  @default(true)
  configData      Json?    // Service-specific configuration
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  statusHistory   ServiceStatusHistory[]
  
  @@map("services")
}

model ServiceStatusHistory {
  id              String   @id @default(uuid())
  serviceId       Int
  status          ServiceStatus
  responseTimeMs  Int?
  errorMessage    String?
  checkedAt       DateTime @default(now())
  
  // Relations
  service         Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  
  @@index([serviceId, checkedAt])
  @@map("service_status_history")
}

model SessionToken {
  id              String   @id @default(uuid())
  userId          String
  tokenHash       String   @unique @db.VarChar(255)
  deviceFingerprint String? @db.VarChar(255)
  ipAddress       String?  @db.VarChar(45)
  userAgent       String?  @db.Text
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([expiresAt])
  @@map("session_tokens")
}

model RateLimit {
  id              String   @id @default(uuid())
  userId          String?
  ipAddress       String?  @db.VarChar(45)
  endpoint        String   @db.VarChar(255)
  requestCount    Int      @default(0)
  windowStart     DateTime @default(now())
  
  // Relations
  user            User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, endpoint, windowStart])
  @@index([windowStart])
  @@map("rate_limits")
}

model ActivityLog {
  id              String   @id @default(uuid())
  userId          String?
  action          String   @db.VarChar(100)
  entityType      String?  @db.VarChar(50)
  entityId        String?  @db.VarChar(255)
  metadata        Json?
  ipAddress       String?  @db.VarChar(45)
  userAgent       String?  @db.Text
  createdAt       DateTime @default(now())
  
  // Relations
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("activity_logs")
}

model SystemConfig {
  id              Int      @id @default(autoincrement())
  key             String   @unique @db.VarChar(100)
  value           Json
  description     String?  @db.Text
  updatedAt       DateTime @updatedAt
  updatedBy       String?
  
  @@map("system_config")
}
```

### 3. Create Migration
```bash
npx prisma migrate dev --name initial_schema
```

### 4. Create Seed Script
Create `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default services
  const services = [
    {
      name: 'plex',
      displayName: 'Plex Media Server',
      enabled: true,
    },
    {
      name: 'overseerr',
      displayName: 'Overseerr',
      enabled: true,
    },
    {
      name: 'uptime-kuma',
      displayName: 'Uptime Kuma',
      enabled: true,
    },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: {},
      create: service,
    })
    console.log(`✅ Created service: ${service.displayName}`)
  }

  // Create system configuration defaults
  const configs = [
    {
      key: 'rate_limit.api.default',
      value: { limit: 100, window: 60 },
      description: 'Default API rate limit per minute',
    },
    {
      key: 'rate_limit.youtube.download',
      value: { limit: 5, window: 3600 },
      description: 'YouTube download rate limit per hour',
    },
    {
      key: 'rate_limit.media.request',
      value: { limit: 20, window: 3600 },
      description: 'Media request rate limit per hour',
    },
    {
      key: 'youtube.concurrent_downloads',
      value: { max: 3 },
      description: 'Maximum concurrent YouTube downloads',
    },
    {
      key: 'session.remember_me_days',
      value: { days: 90 },
      description: 'Remember me token validity in days',
    },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    })
    console.log(`✅ Created config: ${config.key}`)
  }

  // Note: Admin user will be created on first run via bootstrap
  console.log(`
📝 Note: Admin user will be created on first application startup
   using the bootstrap credentials (admin/admin).
   
   Make sure to change the admin password after first login!
  `)

  console.log('✅ Database seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### 5. Update Package.json
Add to `backend/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --transpile-only prisma/seed.ts"
  },
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:prod": "prisma migrate deploy",
    "prisma:seed": "prisma db seed",
    "prisma:studio": "prisma studio",
    "prisma:reset": "prisma migrate reset --force"
  }
}
```

### 6. Create Database Utilities
Create `backend/src/utils/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

// Singleton pattern for Prisma Client
declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Log database events
prisma.$on('query', (e) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Database query:', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    })
  }
})

prisma.$on('error', (e) => {
  logger.error('Database error:', e)
})

// Connection management utilities
export async function connectDatabase() {
  try {
    await prisma.$connect()
    logger.info('Database connected successfully')
  } catch (error) {
    logger.error('Failed to connect to database:', error)
    throw error
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    logger.info('Database disconnected successfully')
  } catch (error) {
    logger.error('Failed to disconnect from database:', error)
    throw error
  }
}

// Transaction helper
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx as PrismaClient)
  })
}
```

### 7. Create Database Migration Scripts
Create `backend/scripts/migrate-prod.sh`:

```bash
#!/bin/bash

echo "Running production database migrations..."

# Load environment variables
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
fi

# Run migrations
npx prisma migrate deploy

# Check if successful
if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
```

Create `backend/scripts/reset-dev-db.sh`:

```bash
#!/bin/bash

echo "⚠️  WARNING: This will reset your development database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Reset database
npx prisma migrate reset --force

# Seed database
npx prisma db seed

echo "✅ Development database reset complete"
```

### 8. Create Type Exports
Create `backend/src/types/database.ts`:

```typescript
export * from '@prisma/client'

// Custom type helpers
export type UserWithoutSecrets = Omit<User, 'plexToken'>

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### 9. Create Database Repository Base
Create `backend/src/repositories/base.repository.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { PaginationParams, PaginatedResult } from '@/types/database'

export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}

  protected async paginate(
    model: any,
    params: PaginationParams,
    where?: any
  ): Promise<PaginatedResult<T>> {
    const { page, limit, sortBy, sortOrder = 'desc' } = params
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : undefined,
      }),
      model.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
```

### 10. Create Database Health Check
Update `backend/src/config/database.ts`:

```typescript
import { prisma } from '@/utils/database'
import { logger } from '@/utils/logger'

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    logger.error('Database health check failed:', error)
    return false
  }
}

export async function getDatabaseStats() {
  try {
    const [userCount, requestCount, downloadCount] = await Promise.all([
      prisma.user.count(),
      prisma.mediaRequest.count(),
      prisma.youTubeDownload.count(),
    ])

    return {
      users: userCount,
      mediaRequests: requestCount,
      youtubeDownloads: downloadCount,
    }
  } catch (error) {
    logger.error('Failed to get database stats:', error)
    return null
  }
}
```

## Verification Steps
1. Run migrations: `npm run prisma:migrate`
2. Seed database: `npm run prisma:seed`
3. Open Prisma Studio: `npm run prisma:studio`
4. Verify all tables are created with correct relationships
5. Check that seed data is present
6. Test database connection in the application
7. Run `npm run prisma:generate` to ensure types are generated

## Testing Requirements
- [ ] Unit tests for database utility functions (withTransaction, connection management)
- [ ] Unit tests for base repository pagination logic
- [ ] Integration tests for Prisma schema with Testcontainers
- [ ] Test database migrations run successfully
- [ ] Test seed script idempotency
- [ ] Test cascade deletes work correctly
- [ ] Test unique constraints are enforced
- [ ] Test enum values are validated
- [ ] Performance tests for indexed queries
- [ ] Test database health check functions
- [ ] Test coverage should exceed 80% for repository layer
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Migration fails**: Check DATABASE_URL format and PostgreSQL is running
- **Seed fails**: Ensure migrations are run first
- **Type errors**: Run `prisma generate` after schema changes
- **Connection pool exhausted**: Check for missing `await` statements

## Notes
- Indexes are added for common query patterns
- Soft deletes not implemented - using cascade deletes
- JSON fields used for flexible metadata storage
- UUID primary keys for better distribution

## Related Documentation
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Schema Design](/ARCHITECTURE.md#5-data-architecture)