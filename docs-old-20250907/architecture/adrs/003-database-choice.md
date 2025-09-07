# ADR-003: Database Choice - PostgreSQL with Prisma ORM

## Status

Accepted

## Context

MediaNest requires a robust database solution to handle:

- User authentication and session management
- Media request tracking and history
- Service configuration and status monitoring
- Error logging and audit trails
- Integration with external services (Plex, Overseerr)

Requirements:

- ACID compliance for data integrity
- JSON support for flexible configuration storage
- Strong typing and migration support
- Performance for concurrent user access
- Scalability for future growth

Options considered:

1. **PostgreSQL + Prisma ORM**
2. **MySQL + TypeORM**
3. **MongoDB + Mongoose**
4. **SQLite + Prisma** (for simplicity)

## Decision

We choose **PostgreSQL 15** as the primary database with **Prisma ORM** for data access:

**Database: PostgreSQL 15-Alpine**

- Production-ready relational database
- Excellent JSON/JSONB support for flexible schemas
- Strong consistency and ACID compliance
- Proven scalability and performance
- Rich indexing capabilities
- Alpine Linux image for smaller Docker footprint

**ORM: Prisma 6.15.0**

- Type-safe database client generation
- Declarative schema definition
- Automatic migration generation and management
- Excellent TypeScript integration
- Built-in connection pooling
- Query optimization and performance monitoring

**Schema Design Principles:**

- Normalized core entities (User, MediaRequest, ServiceConfig)
- JSON columns for flexible configuration data
- Strategic indexing for query performance
- Foreign key constraints for referential integrity
- UUID primary keys for security and distributed scalability

## Consequences

### Positive

- **Type Safety**: Compile-time type checking for database operations
- **Developer Experience**: Excellent tooling with Prisma Studio and introspection
- **Migration Management**: Automatic schema migration generation and deployment
- **Performance**: Built-in query optimization and connection pooling
- **Flexibility**: JSON columns for configuration data while maintaining relational integrity
- **Scalability**: PostgreSQL's proven scalability for future growth
- **Reliability**: ACID compliance ensures data consistency
- **Monitoring**: Built-in query analysis and performance metrics

### Negative

- **Learning Curve**: Team needs to learn Prisma-specific patterns
- **Lock-in**: Prisma generates database-specific client code
- **Resource Usage**: PostgreSQL requires more resources than SQLite
- **Complexity**: More complex than simple file-based storage
- **Migration Risk**: Schema changes require careful migration planning

### Implementation Details

```typescript
// Example: Type-safe database operations
const mediaRequest = await prisma.mediaRequest.create({
  data: {
    userId: user.id,
    title: 'Movie Title',
    mediaType: 'movie',
    tmdbId: '12345',
  },
  include: {
    user: {
      select: { name: true, email: true },
    },
  },
});

// Automatic type inference
type MediaRequestWithUser = typeof mediaRequest;
```

**Database Configuration:**

- Connection pooling: 20 connections with 30s timeout
- Connection string with explicit pool settings for Docker
- Health checks for container orchestration
- Automated backups with point-in-time recovery

### Mitigations

- Comprehensive Prisma training and documentation
- Database performance monitoring and query analysis
- Backup and disaster recovery procedures
- Migration testing in staging environments
- Connection pool optimization for high concurrency
