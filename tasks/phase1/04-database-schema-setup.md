# Task: Database Schema Implementation with Prisma

**Priority:** Critical  
**Estimated Duration:** 2 days  
**Dependencies:** None (can start immediately)  
**Phase:** 1 (Week 3)

## Objective
Set up Prisma ORM with PostgreSQL, create complete database schema for users, media requests, YouTube downloads, service configuration, and implement data migration strategy.

## Background
The database is the foundation of the application. We need to establish a well-structured schema that supports user isolation, service configuration, and efficient querying while maintaining data integrity.

## Detailed Requirements

### 1. Prisma Setup and Configuration
- Initialize Prisma with PostgreSQL
- Configure connection pooling
- Set up development and test databases
- Create migration workflow

### 2. Complete Schema Implementation
All tables from ARCHITECTURE.md must be created with proper relationships, indexes, and constraints.

### 3. User Data Isolation
- Implement row-level security concepts
- Ensure YouTube downloads are user-scoped
- Add proper indexes for user-filtered queries

### 4. Migration Strategy
- Initial schema migration
- Seed data for development
- Migration rollback procedures

## Technical Implementation Details

### Prisma Configuration
```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                   String         @id @default(uuid())
  plexId               String         @unique @map("plex_id")
  plexUsername         String         @map("plex_username")
  email                String?
  role                 String         @default("user")
  plexToken            String?        @map("plex_token") // encrypted
  passwordHash         String?        @map("password_hash") // for bootstrap admin
  forcePasswordChange  Boolean        @default(false) @map("force_password_change")
  isBootstrapUser      Boolean        @default(false) @map("is_bootstrap_user")
  createdAt            DateTime       @default(now()) @map("created_at")
  lastLoginAt          DateTime?      @map("last_login_at")
  status               String         @default("active")
  
  // Relations
  mediaRequests        MediaRequest[]
  youtubeDownloads     YoutubeDownload[]
  sessionTokens        SessionToken[]
  rateLimits           RateLimit[]
  serviceConfigUpdates ServiceConfig[] @relation("UpdatedBy")
  
  @@map("users")
}

model MediaRequest {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  title        String    @db.VarChar(500)
  mediaType    String    @map("media_type")
  tmdbId       String?   @map("tmdb_id")
  status       String    @default("pending")
  overseerrId  String?   @map("overseerr_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  completedAt  DateTime? @map("completed_at")
  
  // Relations
  user         User      @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("media_requests")
}

model YoutubeDownload {
  id               String    @id @default(uuid())
  userId           String    @map("user_id")
  playlistUrl      String    @map("playlist_url") @db.Text
  playlistTitle    String?   @map("playlist_title") @db.VarChar(500)
  status           String    @default("queued")
  filePaths        Json?     @map("file_paths")
  plexCollectionId String?   @map("plex_collection_id")
  createdAt        DateTime  @default(now()) @map("created_at")
  completedAt      DateTime? @map("completed_at")
  
  // Relations
  user             User      @relation(fields: [userId], references: [id])
  
  // Ensure user isolation
  @@index([userId])
  @@index([status])
  @@map("youtube_downloads")
}

model ServiceStatus {
  id               Int       @id @default(autoincrement())
  serviceName      String    @unique @map("service_name")
  status           String?
  responseTimeMs   Int?      @map("response_time_ms")
  lastCheckAt      DateTime? @map("last_check_at")
  uptimePercentage Decimal?  @map("uptime_percentage") @db.Decimal(5, 2)
  
  @@map("service_status")
}

model RateLimit {
  id          Int      @id @default(autoincrement())
  userId      String   @map("user_id")
  endpoint    String
  requestCount Int     @default(0) @map("request_count")
  windowStart DateTime @default(now()) @map("window_start")
  
  // Relations
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId, endpoint])
  @@map("rate_limits")
}

model ServiceConfig {
  id          Int      @id @default(autoincrement())
  serviceName String   @unique @map("service_name")
  serviceUrl  String   @map("service_url") @db.Text
  apiKey      String?  @map("api_key") @db.Text // encrypted
  enabled     Boolean  @default(true)
  configData  Json?    @map("config_data")
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")
  updatedBy   String?  @map("updated_by")
  
  // Relations
  updatedByUser User?  @relation("UpdatedBy", fields: [updatedBy], references: [id])
  
  @@map("service_config")
}

model SessionToken {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  tokenHash  String   @unique @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  createdAt  DateTime @default(now()) @map("created_at")
  lastUsedAt DateTime? @map("last_used_at")
  
  // Relations
  user       User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([expiresAt])
  @@map("session_tokens")
}
```

### Database URL Configuration
```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/medianest?schema=public&connection_limit=20&pool_timeout=30"

# .env.test
DATABASE_URL="postgresql://test:test@localhost:5432/medianest_test?schema=public"
```

### Migration Commands Setup
```json
// package.json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:reset": "prisma migrate reset",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

### Seed Data
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default service configurations
  const services = [
    { serviceName: 'plex', serviceUrl: '', enabled: true },
    { serviceName: 'overseerr', serviceUrl: '', enabled: true },
    { serviceName: 'uptime-kuma', serviceUrl: '', enabled: true }
  ];
  
  for (const service of services) {
    await prisma.serviceConfig.upsert({
      where: { serviceName: service.serviceName },
      update: {},
      create: service
    });
  }
  
  console.log('Seed data created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Acceptance Criteria
1. ✅ Prisma configured with PostgreSQL connection
2. ✅ All tables created with proper relationships
3. ✅ Indexes added for performance
4. ✅ User isolation constraints working
5. ✅ Migration scripts tested and reversible
6. ✅ Seed data creates default service configs
7. ✅ Connection pooling configured correctly
8. ✅ Database can handle 20 concurrent connections

## Testing Requirements
1. **Schema Tests:**
   - All models can be created
   - Relationships work correctly
   - Constraints are enforced

2. **Performance Tests:**
   - Query performance with indexes
   - Connection pool behavior
   - Concurrent access handling

## Migration Strategy
1. **Development:**
   - Use `prisma migrate dev` for iterations
   - Reset database when needed

2. **Production:**
   - Use `prisma migrate deploy`
   - Always backup before migrations
   - Test migrations on staging first

## Error Handling
- Connection failures: Retry with exponential backoff
- Migration failures: Automatic rollback
- Constraint violations: User-friendly error messages
- Pool exhaustion: Queue requests

## Performance Considerations
- Add indexes for all foreign keys
- Index commonly queried fields
- Use partial indexes where appropriate
- Monitor slow queries

## Dependencies
- `@prisma/client` - ORM client
- `prisma` - CLI and migration tool

## References
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- Database schema from ARCHITECTURE.md