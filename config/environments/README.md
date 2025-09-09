# MediaNest Environment Configuration System

A comprehensive environment configuration system that handles secure loading, validation, and management of environment variables across development, test, and production environments.

## 🎨 Architecture Overview

```
config/environments/
├── .env.template          # Template with all variables
├── .env.development      # Development configuration
├── .env.test            # Test configuration
├── .env.production      # Production configuration (no secrets)
├── .env.local           # Local overrides (not committed)
├── env-validator.ts     # Zod-based validation schemas
├── secret-manager.ts    # Secure secret management
├── env-loader.ts        # Environment loading logic
└── index.ts            # Main exports
```

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { setupEnvironment } from './config/environments';

// Load and validate environment
const config = await setupEnvironment({
  environment: 'development',
  debug: true,
  displayInfo: true,
});
```

### 2. Manual Loading

```typescript
import { loadEnvironment } from './config/environments';

const config = await loadEnvironment({
  environment: 'production',
  secretsEnabled: true,
  debug: false,
});
```

### 3. Validation Only

```typescript
import { validateEnvironment } from './config/environments';

try {
  const config = validateEnvironment(process.env);
  console.log('Environment valid!');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## 📜 Environment Files

### Loading Priority (highest to lowest)

1. **Process environment variables** - Runtime environment
2. **`.env.local`** - Local overrides (never committed)
3. **`.env.{environment}`** - Environment-specific settings
4. **`.env`** - Base configuration (if exists)

### File Descriptions

#### `.env.template`
Complete template with all possible variables and documentation. Use as reference when creating other environment files.

#### `.env.development`
- Safe development defaults
- Weak secrets (clearly marked as dev-only)
- Debug tools enabled
- Local database/Redis connections
- Relaxed security settings

#### `.env.test`
- Test-optimized configuration
- Separate test databases (different ports/names)
- Deterministic secrets for consistent tests
- Minimal logging
- Fast bcrypt rounds
- Mock external services

#### `.env.production`
- Production-safe configuration
- **NO ACTUAL SECRETS** (use secret management)
- Strict security settings
- SSL/HTTPS enforced
- Comprehensive monitoring
- Performance optimizations

#### `.env.local` (auto-created)
- Local developer overrides
- **NEVER COMMITTED** to version control
- Automatically added to .gitignore
- Use for personal development settings

## 🔒 Secret Management

### Development Secrets
```bash
# Safe for development (clearly marked)
JWT_SECRET=dev-jwt-secret-not-for-production-use-only
SESSION_SECRET=dev-session-secret-not-for-production-use-only
```

### Production Secrets
Production secrets must be provided via:
- Environment variables
- Docker secrets (`/run/secrets/SECRET_NAME`)
- Kubernetes secrets
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

### Secret Provider Configuration
```bash
# Enable specific secret provider
SECRET_PROVIDER=aws  # aws | k8s | vault
```

### Required Production Secrets
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET` (64+ characters)
- `SESSION_SECRET` (64+ characters)
- `EMAIL_API_KEY` (if using email service)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (if using S3)

## ⚙️ Configuration Categories

### Server Configuration
```bash
MEDIANEST_BACKEND_PORT=4000
MEDIANEST_FRONTEND_PORT=3000
BACKEND_API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:3000
```

### Database Configuration
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest_dev
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SSL=false  # true in production
```

### Redis Configuration
```bash
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=medianest:dev:
REDIS_TTL=3600
```

### Security Configuration
```bash
JWT_SECRET=your-secret-key
JWT_EXPIRE_IN=24h
SECURITY_RATE_LIMIT_ENABLED=true
BCRYPT_ROUNDS=12
```

### External Services
```bash
EMAIL_PROVIDER=sendgrid
STORAGE_PROVIDER=local  # local | s3 | gcs
AWS_REGION=us-east-1
```

### Logging & Monitoring
```bash
LOG_LEVEL=info
LOG_FORMAT=json
METRICS_ENABLED=true
APM_ENABLED=true
```

## 📊 Environment-Specific Differences

| Setting | Development | Test | Production |
|---------|-------------|------|-----------|
| Ports | 4000/3000 | 4001/3001 | 4000/3000 |
| Database | `medianest_dev` | `medianest_test` | `medianest_prod` |
| Redis DB | 0 | 1 | 0 |
| SSL | Disabled | Disabled | Required |
| BCrypt Rounds | 8 | 4 | 12 |
| Rate Limiting | Disabled | Disabled | Enabled |
| Debug Logging | Enabled | Disabled | Disabled |
| Secret Length | 10+ chars | Any | 64+ chars |
| External APIs | Mock | Mock | Real |

## 🛠️ Development Tools

### Create Environment Files
```typescript
import { createEnvironmentFiles } from './config/environments';

// Creates .env.local and updates .gitignore
await createEnvironmentFiles('development');
```

### Display Current Configuration
```typescript
import { displayEnvironmentInfo } from './config/environments';

displayEnvironmentInfo(); // Shows formatted config summary
```

### Validate Environment Setup
```typescript
import { validateEnvironmentSetup } from './config/environments';

const result = await validateEnvironmentSetup('production');
if (!result.valid) {
  console.error('Issues found:', result.errors);
  console.warn('Recommendations:', result.recommendations);
}
```

### Check File Availability
```typescript
import { checkEnvironmentFiles } from './config/environments';

const status = checkEnvironmentFiles('development');
console.log('Available files:', status.available);
console.log('Missing files:', status.missing);
```

## 🎧 Docker Integration

### Environment Variables in Docker
```yaml
# docker-compose.yml
services:
  backend:
    env_file:
      - ./config/environments/.env.development
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
```

### Docker Secrets
```yaml
# Production docker-compose
services:
  backend:
    secrets:
      - jwt_secret
      - database_url
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - DATABASE_URL_FILE=/run/secrets/database_url

secrets:
  jwt_secret:
    external: true
  database_url:
    external: true
```

## 🔍 Validation & Type Safety

### Zod Schema Validation
- Automatic type conversion (`z.coerce.number()`)
- Format validation (URLs, email, regex patterns)
- Environment-specific requirements
- Descriptive error messages
- TypeScript type generation

### Custom Validation Rules
```typescript
// Example: JWT secret length validation
JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters')

// Environment-specific validation
productionSchema.extend({
  JWT_SECRET: z.string().min(64, 'Production requires 64+ char secrets'),
  SESSION_SECURE: z.literal(true), // Must be true in production
});
```

### TypeScript Integration
```typescript
import type { EnvironmentConfig, ProductionConfig } from './config/environments';

// Full environment config
const config: EnvironmentConfig = await loadEnvironment();

// Production-specific config
if (config.NODE_ENV === 'production') {
  const prodConfig = config as ProductionConfig;
  // TypeScript knows this has production-specific fields
}
```

## ⚠️ Security Best Practices

### ✅ DO
- Use `.env.local` for personal development settings
- Provide production secrets via secure secret management
- Use strong secrets (64+ characters) in production
- Enable SSL/HTTPS in production
- Use separate databases for each environment
- Enable rate limiting and security headers in production
- Validate all environment variables
- Use deterministic test secrets for consistent testing

### ❌ DON'T
- Commit `.env.local` to version control
- Put real secrets in environment files
- Use weak secrets in production
- Use production databases for development/testing
- Skip environment validation
- Hardcode secrets in source code
- Use development settings in production
- Share production secrets in chat/email

## 📄 File Management

### Git Configuration
```gitignore
# Environment files
.env.local
.env.*.local

# Keep committed
!.env.template
!.env.development
!.env.test
!.env.production
```

### Backup & Recovery
- Environment files (except .env.local) are in version control
- Production secrets should be backed up in secure secret management
- Document secret rotation procedures
- Test environment restoration regularly

## 🐛 Troubleshooting

### Common Issues

**"Environment validation failed"**
- Check required variables are set
- Verify value formats (URLs, numbers, etc.)
- Ensure production secrets are provided securely

**"No environment files found"**
- Check file paths and permissions
- Ensure files exist in `config/environments/`
- Use absolute paths if needed

**"Failed to initialize secrets"**
- Check secret provider configuration
- Verify secret management system access
- Ensure required secrets exist

**Database connection failures**
- Verify DATABASE_URL format
- Check database server availability
- Confirm credentials and permissions

### Debug Mode
```typescript
// Enable detailed logging
const config = await loadEnvironment({
  debug: true,
  displayInfo: true,
});
```

### Environment Health Check
```typescript
import { validateEnvironmentSetup } from './config/environments';

const health = await validateEnvironmentSetup('production');
console.log('Environment health:', health);
```

## 🔗 Integration Examples

### Express.js Integration
```typescript
import express from 'express';
import { setupEnvironment } from './config/environments';

// Load environment first
const config = await setupEnvironment();

const app = express();
app.listen(config.MEDIANEST_BACKEND_PORT, () => {
  console.log(`Server running on port ${config.MEDIANEST_BACKEND_PORT}`);
});
```

### Database Connection
```typescript
import { Pool } from 'pg';
import { setupEnvironment } from './config/environments';

const config = await setupEnvironment();

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DB_SSL,
  min: config.DB_POOL_MIN,
  max: config.DB_POOL_MAX,
});
```

### Testing Setup
```typescript
// test-setup.ts
import { setupEnvironment } from '../config/environments';

beforeAll(async () => {
  await setupEnvironment({
    environment: 'test',
    debug: false,
  });
});
```

This environment system provides a robust, secure, and developer-friendly way to manage configuration across all environments while maintaining security best practices and type safety.
