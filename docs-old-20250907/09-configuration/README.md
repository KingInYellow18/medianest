# Configuration Management

Complete configuration guide for MediaNest across all environments.

## Overview

This section covers all aspects of configuring MediaNest, from environment variables to application settings and external service integrations.

## Configuration Documentation

### Environment Configuration

- [Environment Variables](./environment.md) - Complete environment variable reference
- [Configuration Files](./configuration-files.md) - Application configuration files
- [Docker Configuration](./docker-configuration.md) - Container-specific settings
- [Development Configuration](./development.md) - Development environment setup

### Application Settings

- [Database Configuration](./database.md) - PostgreSQL and Redis configuration
- [Authentication Settings](./authentication.md) - Auth provider configuration
- [API Configuration](./api-configuration.md) - API server settings
- [Frontend Configuration](./frontend.md) - React application settings

### External Integrations

- [Plex Integration](./plex-integration.md) - Plex Media Server configuration
- [SMTP Configuration](./smtp.md) - Email service setup
- [Third-party APIs](./third-party-apis.md) - External API configurations
- [Webhook Configuration](./webhooks.md) - Webhook endpoints setup

### Security Configuration

- [SSL/TLS Configuration](./ssl-tls.md) - Certificate and encryption setup
- [CORS Configuration](./cors.md) - Cross-origin resource sharing
- [Rate Limiting](./rate-limiting.md) - API rate limiting configuration
- [Security Headers](./security-headers.md) - HTTP security headers

## Configuration Templates

### Production Environment

```bash
# .env.production
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/medianest
REDIS_URL=redis://redis:6379

# JWT Configuration
JWT_SECRET=your-super-secure-secret-here
JWT_EXPIRES_IN=30d

# Plex Integration
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_NAME=MediaNest

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### Development Environment

```bash
# .env.development
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/medianest_dev
REDIS_URL=redis://localhost:6379

# JWT Configuration (less secure for development)
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d

# Development Features
DEBUG=medianest:*
ENABLE_SWAGGER=true
HOT_RELOAD=true

# Less restrictive CORS for development
CORS_ORIGIN=http://localhost:3000
```

## Configuration Validation

### Required Variables

All required environment variables are validated on startup:

```typescript
const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'PLEX_CLIENT_ID'] as const;

// Validation happens in src/config/index.ts
```

### Configuration Schema

```typescript
// Configuration validation with Zod
const ConfigSchema = z.object({
  database: z.object({
    url: z.string().url(),
  }),
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string(),
  }),
  plex: z.object({
    clientId: z.string().min(1),
  }),
});
```

## Environment-Specific Configurations

### Local Development

- Hot reloading enabled
- Debug logging active
- Development database
- Permissive CORS

### Testing

- In-memory database
- Mock external services
- Test-specific configurations
- Isolated test environment

### Staging

- Production-like setup
- Limited external access
- Real database with test data
- Monitoring enabled

### Production

- Optimized for performance
- Strict security settings
- Full monitoring enabled
- Backup and recovery configured

## Related Documentation

- [Getting Started](../01-getting-started/README.md) - Initial configuration setup
- [Deployment Guide](../06-deployment/README.md) - Production configuration
- [Security Guide](../07-security/README.md) - Security configuration best practices
- [Troubleshooting](../10-troubleshooting/README.md) - Configuration troubleshooting
