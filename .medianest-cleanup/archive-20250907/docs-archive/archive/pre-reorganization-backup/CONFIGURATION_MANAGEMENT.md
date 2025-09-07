# MediaNest Configuration Management

This document provides comprehensive guidance on MediaNest's centralized configuration management system, including setup, usage, validation, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Environment Variables](#environment-variables)
4. [Configuration Validation](#configuration-validation)
5. [Docker Secrets](#docker-secrets)
6. [Usage Examples](#usage-examples)
7. [Environment-Specific Setup](#environment-specific-setup)
8. [Migration Guide](#migration-guide)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

MediaNest uses a centralized configuration management system that provides:

- **Type-safe configuration** with Zod validation schemas
- **Environment-specific settings** for development, test, and production
- **Docker secrets support** for production deployments
- **Centralized validation** with clear error messages
- **Consistent API** across frontend and backend packages

### Key Benefits

- ✅ **Runtime validation** catches configuration errors early
- ✅ **Type safety** prevents configuration-related bugs
- ✅ **Security** through proper secrets management
- ✅ **Maintainability** with centralized configuration logic
- ✅ **Testability** with easy configuration mocking

## Architecture

```
medianest/
├── shared/src/config/           # Shared configuration schemas and utilities
│   ├── schemas.ts              # Zod validation schemas
│   ├── utils.ts                # Configuration loading utilities
│   └── index.ts                # Main exports
├── backend/src/config/         # Backend-specific configuration
│   └── index.ts                # Backend configuration loader
├── frontend/src/config/        # Frontend-specific configuration
│   └── index.ts                # Frontend configuration loader
├── .env.example                # Template for development
├── .env.test.example          # Template for testing
└── scripts/                   # Configuration scripts
    └── generate-docker-secrets.sh
```

### Configuration Flow

```mermaid
graph TD
    A[Environment Variables] --> B[Configuration Loader]
    C[Docker Secrets] --> B
    D[.env Files] --> B
    B --> E[Zod Validation]
    E --> F[Type-Safe Config Object]
    F --> G[Application Components]
```

## Environment Variables

### Development Environment

For local development, copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Required Variables

#### Core Application

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Authentication & Security

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-32-character-secret
JWT_SECRET=your-32-character-secret
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Plex OAuth

```bash
PLEX_CLIENT_ID=MediaNest
PLEX_CLIENT_SECRET=your-plex-client-secret
```

#### Frontend (NEXT*PUBLIC* variables)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### Variable Categories

| Category     | Description                  | Examples                                     |
| ------------ | ---------------------------- | -------------------------------------------- |
| **Core**     | Basic application settings   | `NODE_ENV`, `PORT`, `LOG_LEVEL`              |
| **Database** | Database connection settings | `DATABASE_URL`, `DATABASE_POOL_SIZE`         |
| **Redis**    | Cache and queue settings     | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| **Auth**     | Authentication configuration | `JWT_SECRET`, `NEXTAUTH_SECRET`              |
| **OAuth**    | External OAuth providers     | `PLEX_CLIENT_ID`, `PLEX_CLIENT_SECRET`       |
| **Services** | External service endpoints   | `OVERSEERR_URL`, `UPTIME_KUMA_URL`           |
| **Frontend** | Client-side configuration    | `NEXT_PUBLIC_*` variables                    |
| **Security** | Encryption and secrets       | `ENCRYPTION_KEY`, Docker secrets             |

## Configuration Validation

All configuration is validated using Zod schemas at application startup.

### Validation Features

- **Type coercion**: Automatically converts strings to numbers/booleans
- **Default values**: Provides sensible defaults for optional settings
- **Format validation**: Validates URLs, email addresses, etc.
- **Range validation**: Ensures numeric values are within acceptable ranges
- **Required field checking**: Ensures critical configuration is present

### Example Validation

```typescript
// This will fail validation
DATABASE_URL=invalid-url

// Error message:
Configuration validation failed:
DATABASE_URL: Invalid database URL
```

### Custom Validation

Add custom validation to schemas:

```typescript
export const CustomConfigSchema = z.object({
  API_TIMEOUT: z.coerce
    .number()
    .min(1000, 'API timeout must be at least 1 second')
    .max(60000, 'API timeout cannot exceed 60 seconds')
    .default(5000),

  ALLOWED_DOMAINS: z
    .string()
    .transform((str) => str.split(','))
    .pipe(z.array(z.string().url()))
    .optional(),
});
```

## Docker Secrets

For production deployments, use Docker secrets instead of environment variables for sensitive data.

### Generating Secrets

Use the provided script to generate production secrets:

```bash
./scripts/generate-docker-secrets.sh
```

This creates:

- Secure random secrets for JWT, NextAuth, and encryption
- Database and Redis credentials
- Docker Compose configuration with secrets

### Secret Structure

```
secrets/
├── database_url          # PostgreSQL connection string
├── postgres_password     # Database password
├── redis_url            # Redis connection string
├── redis_password       # Redis password
├── nextauth_secret      # NextAuth.js secret
├── jwt_secret           # JWT signing secret
├── encryption_key       # AES encryption key
├── plex_client_id       # Plex OAuth client ID
├── plex_client_secret   # Plex OAuth client secret
├── overseerr_api_key    # Overseerr API key
└── uptime_kuma_token    # Uptime Kuma token
```

### Production Deployment

```bash
# Generate secrets
./scripts/generate-docker-secrets.sh

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variable Override

Enable Docker secrets by setting:

```bash
USE_DOCKER_SECRETS=true
DOCKER_SECRETS_PATH=/run/secrets
```

## Usage Examples

### Backend Configuration

```typescript
import { config, getRedisConfig, getJWTConfig, validateRequiredConfig } from './config';

// Validate configuration at startup
validateRequiredConfig();

// Use specific configuration sections
const redisConfig = getRedisConfig();
const jwtConfig = getJWTConfig();

// Access full configuration
console.log('Database URL:', config.DATABASE_URL);
console.log('Port:', config.PORT);
```

### Frontend Configuration

```typescript
import { config, getApiConfig, getClientConfig, isProduction } from '@/config';

// Get API endpoints
const { baseUrl, backendUrl, wsUrl } = getApiConfig();

// Get client-safe configuration
const clientConfig = getClientConfig();

// Environment checks
if (isProduction()) {
  console.log('Running in production mode');
}
```

### Service Integration

```typescript
import { getPlexConfig, getServiceEndpointsConfig } from './config';

// Plex OAuth configuration
const plexConfig = getPlexConfig();
const plexClient = new PlexClient({
  clientId: plexConfig.clientId,
  clientSecret: plexConfig.clientSecret,
});

// External service endpoints
const services = getServiceEndpointsConfig();
if (services.overseerr.url) {
  const overseerr = new OverseerrClient(services.overseerr);
}
```

## Environment-Specific Setup

### Development

```bash
# Use .env file
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/medianest_dev
REDIS_HOST=localhost
LOG_LEVEL=debug
```

### Testing

```bash
# Use .env.test file
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5433/medianest_test
REDIS_PORT=6380
LOG_LEVEL=error
```

### Production

```bash
# Use Docker secrets
NODE_ENV=production
USE_DOCKER_SECRETS=true
DATABASE_URL_FILE=/run/secrets/database_url
LOG_LEVEL=info
```

### Configuration Loading Order

1. **Default values** from Zod schemas
2. **.env files** (development/test only)
3. **Docker secrets** (production)
4. **Environment variables** (highest priority)

## Migration Guide

### From Direct process.env Access

**Before:**

```typescript
const dbUrl = process.env.DATABASE_URL || 'default-url';
const port = parseInt(process.env.PORT || '4000');
```

**After:**

```typescript
import { config } from './config';

const dbUrl = config.DATABASE_URL;
const port = config.PORT;
```

### From Hardcoded Configuration

**Before:**

```typescript
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
};
```

**After:**

```typescript
import { getRateLimitConfig } from './config';

const rateLimitConfig = getRateLimitConfig();
const rateLimit = {
  windowMs: rateLimitConfig.api.window * 1000,
  max: rateLimitConfig.api.requests,
};
```

### Frontend Migration

**Before:**

```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
```

**After:**

```typescript
import { getApiConfig } from '@/config';

const { baseUrl: apiUrl } = getApiConfig();
```

## Troubleshooting

### Common Issues

#### Configuration Validation Errors

```
Error: Configuration validation failed:
DATABASE_URL: Invalid database URL
JWT_SECRET: String must contain at least 32 character(s)
```

**Solution:** Check your environment variables match the required format and length.

#### Missing Required Configuration

```
Error: Missing required configuration: JWT_SECRET, ENCRYPTION_KEY
```

**Solution:** Ensure all required environment variables are set.

#### Docker Secrets Not Loading

```
Error: Failed to read Docker secret jwt_secret
```

**Solution:**

1. Verify secrets files exist in `/run/secrets/`
2. Check file permissions (should be readable by container user)
3. Ensure `USE_DOCKER_SECRETS=true` is set

#### Frontend Configuration Not Available

```
Error: Cannot access server-side configuration on client
```

**Solution:** Use `getClientConfig()` for browser-safe configuration.

### Debugging

#### Validate Configuration

```typescript
import { validateRequiredConfig, logConfiguration } from './config';

try {
  validateRequiredConfig();
  logConfiguration();
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

#### Check Environment Loading

```typescript
import { environmentLoader } from '@medianest/shared/config';

// Clear cache and reload
environmentLoader.clearCache();
const env = environmentLoader.loadEnvironment();
console.log('Loaded environment:', Object.keys(env));
```

## Best Practices

### Security

1. **Never commit secrets** to version control
2. **Use Docker secrets** in production
3. **Rotate secrets regularly**
4. **Validate configuration** at startup
5. **Mask sensitive values** in logs

### Configuration Design

1. **Provide sensible defaults** for optional settings
2. **Use descriptive names** for environment variables
3. **Group related settings** in configuration objects
4. **Document all variables** in `.env.example`
5. **Validate types and formats** with Zod schemas

### Environment Management

1. **Use different configurations** for each environment
2. **Test configuration changes** before deployment
3. **Monitor configuration drift** between environments
4. **Backup production secrets** securely
5. **Use infrastructure as code** for consistent deployments

### Code Organization

1. **Centralize configuration access** through getter functions
2. **Type configuration objects** with TypeScript
3. **Separate public and private** configuration
4. **Cache configuration** to avoid repeated validation
5. **Provide configuration utilities** for common operations

---

## Quick Reference

### Configuration Functions

| Function            | Purpose                      | Returns                           |
| ------------------- | ---------------------------- | --------------------------------- |
| `config`            | Full validated configuration | `BackendConfig \| FrontendConfig` |
| `getRedisConfig()`  | Redis connection settings    | Redis configuration object        |
| `getJWTConfig()`    | JWT authentication settings  | JWT configuration object          |
| `getApiConfig()`    | API endpoint URLs            | API configuration object          |
| `getClientConfig()` | Browser-safe configuration   | Client configuration object       |
| `isDevelopment()`   | Environment check            | `boolean`                         |
| `isProduction()`    | Environment check            | `boolean`                         |
| `isTest()`          | Environment check            | `boolean`                         |

### Environment Variables

| Variable          | Type               | Description             | Required                |
| ----------------- | ------------------ | ----------------------- | ----------------------- |
| `NODE_ENV`        | string             | Application environment | Yes                     |
| `DATABASE_URL`    | string (URL)       | PostgreSQL connection   | Yes                     |
| `JWT_SECRET`      | string (32+ chars) | JWT signing secret      | Yes                     |
| `NEXTAUTH_SECRET` | string (32+ chars) | NextAuth.js secret      | Yes                     |
| `PLEX_CLIENT_ID`  | string             | Plex OAuth client ID    | Yes                     |
| `REDIS_HOST`      | string             | Redis server host       | No (default: localhost) |
| `LOG_LEVEL`       | enum               | Logging level           | No (default: info)      |

For a complete list, see [.env.example](./.env.example).

---

_This documentation is maintained as part of the MediaNest project. For questions or contributions, please refer to the main project documentation._
