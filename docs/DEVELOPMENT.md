# MediaNest Development Guide

**Version:** 1.0  
**Date:** January 2025  
**Status:** Active

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Structure](#project-structure)
4. [Configuration](#configuration)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Database Management](#database-management)
8. [External Service Integration](#external-service-integration)
9. [Debugging](#debugging)
10. [Contributing Guidelines](#contributing-guidelines)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: 20.x LTS (recommended: use nvm/volta for version management)
- **Docker**: 24.x or later with Docker Compose
- **Git**: Latest version
- **Operating System**: Linux, macOS, or Windows with WSL2

### Development Tools (Recommended)
- **IDE**: VS Code with recommended extensions
- **Database Client**: pgAdmin, TablePlus, or DBeaver
- **API Testing**: Postman, Insomnia, or REST Client (VS Code extension)
- **Redis Client**: RedisInsight or redis-cli

### VS Code Extensions
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-vscode-remote.remote-containers",
    "humao.rest-client"
  ]
}
```

## Development Environment Setup

### Option 1: Docker Development (Recommended)

The easiest way to get started is using Docker Compose for the full development stack:

```bash
# Clone the repository
git clone https://github.com/yourusername/medianest.git
cd medianest

# Copy environment template
cp .env.example .env

# Start development stack
docker compose -f docker-compose.dev.yml up -d

# Install dependencies (if not using devcontainer)
cd frontend && npm install
cd ../backend && npm install

# Run database migrations
cd backend && npm run db:migrate

# Start development servers
npm run dev:all
```

### Option 2: Local Development

For developers who prefer running services locally:

```bash
# Install Node.js dependencies
cd frontend && npm install
cd ../backend && npm install

# Start PostgreSQL and Redis (via Docker)
docker compose -f docker-compose.dev.yml up -d postgres redis

# Set up environment variables
cp .env.example .env
# Edit .env with local service URLs

# Run database migrations
cd backend && npm run db:migrate

# Start development servers in separate terminals
cd frontend && npm run dev    # Port 3000
cd backend && npm run dev     # Port 4000
```

### Dev Container Setup (VS Code)

For the most consistent development experience:

```bash
# Open in VS Code
code .

# Use Command Palette: "Remote-Containers: Reopen in Container"
# Or click "Reopen in Container" notification
```

The dev container includes all necessary tools and extensions pre-configured.

## Project Structure

```
medianest/
├── .devcontainer/          # VS Code dev container config
├── .github/                # GitHub workflows and templates
├── backend/                # Express.js API server
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Database models (Prisma)
│   │   ├── middleware/     # Express middleware
│   │   ├── integrations/   # External API clients
│   │   ├── jobs/           # Background job processors
│   │   └── utils/          # Helper functions
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # Next.js application
│   ├── app/                # Next.js 14 app directory
│   ├── components/         # React components
│   ├── lib/                # Utility functions and hooks
│   ├── services/           # API client functions
│   ├── styles/             # CSS and Tailwind config
│   └── package.json
├── docs/                   # Project documentation
├── infrastructure/         # Docker and deployment configs
├── scripts/                # Development and deployment scripts
└── docker-compose*.yml     # Docker orchestration files
```

## Configuration

### Environment Variables

Create `.env` file in the project root:

```bash
# Application
NODE_ENV=development
PORT=3000
API_PORT=4000

# Database
DATABASE_URL=postgresql://medianest:password@localhost:5432/medianest_dev
POSTGRES_DB=medianest_dev
POSTGRES_USER=medianest
POSTGRES_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# External Services (configure in admin UI after setup)
PLEX_URL=http://your-plex-server:32400
OVERSEERR_URL=http://your-overseerr:5055
OVERSEERR_API_KEY=your-overseerr-api-key
UPTIME_KUMA_URL=http://your-uptime-kuma:3001

# YouTube Downloads
YOUTUBE_DOWNLOAD_PATH=./youtube
YOUTUBE_RATE_LIMIT=5

# Admin Bootstrap (first run only)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

# Development
LOG_LEVEL=debug
ENABLE_QUERY_LOGGING=true
```

### Service Configuration

External services are configured through the admin UI after initial setup. For development, you can use test/mock endpoints:

1. **Plex Server**: Use a local Plex server or Plex test instance
2. **Overseerr**: Set up a local Overseerr instance for testing
3. **Uptime Kuma**: Optional for development (can be mocked)

## Development Workflow

### Daily Development Commands

```bash
# Start all services
npm run dev:all

# Individual services
cd frontend && npm run dev     # Next.js dev server
cd backend && npm run dev      # Express API server

# Database operations
cd backend && npm run db:studio    # Prisma Studio
cd backend && npm run db:migrate   # Run migrations
cd backend && npm run db:reset     # Reset database

# Testing
npm run test                   # Run all tests
npm run test:frontend         # Frontend tests only
npm run test:backend          # Backend tests only
npm run test:e2e              # End-to-end tests

# Code quality
npm run lint                  # Lint all code
npm run format                # Format with Prettier
npm run type-check            # TypeScript type checking
```

### Git Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-feature-name
   ```

2. **Make Changes**
   - Follow existing code conventions
   - Write/update tests
   - Update documentation if needed

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Pre-commit Checks**
   - Lint and format checks run automatically
   - Tests must pass
   - Type checking must pass

5. **Push and Create PR**
   ```bash
   git push origin feature/new-feature-name
   # Create PR on GitHub
   ```

### Code Style and Conventions

#### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer `const` over `let`
- Use async/await over Promises

#### React Components
```typescript
// Use function components with TypeScript
interface ComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function Component({ title, onSubmit }: ComponentProps) {
  // Component logic
  return <div>{title}</div>;
}
```

#### API Routes
```typescript
// Use consistent error handling
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await serviceMethod(data);
    return Response.json({ success: true, data: result });
  } catch (error) {
    logger.error('API error', { error, endpoint: '/api/example' });
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### Test Structure

```
tests/
├── unit/                   # Unit tests
├── integration/            # Integration tests
├── e2e/                    # End-to-end tests
├── fixtures/               # Test data
└── helpers/                # Test utilities
```

### Running Tests

```bash
# All tests (Vitest)
npm run test

# Unit tests only
npm test -- tests/unit/

# Integration tests only  
npm test -- tests/integration/

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Test UI for debugging
npm run test:ui

# Backend-specific test commands
cd backend
npm test                    # Run all backend tests
npm run test:coverage       # Generate coverage report
./run-tests.sh             # Automated test runner with database setup
```

### Writing Tests

#### Unit Test Example (Vitest)
```typescript
// backend/tests/unit/utils/jwt.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken } from '@/utils/jwt';

describe('JWT Utilities', () => {
  it('should generate and verify standard token', () => {
    const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
    const token = generateToken(payload, false);
    
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user123');
    expect(decoded.role).toBe('user');
  });

  it('should generate remember me token with 30 day expiry', () => {
    const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
    const token = generateToken(payload, true);
    
    // Should not throw when verifying
    expect(() => verifyToken(token)).not.toThrow();
  });
});
```

#### Integration Test Example (Supertest + Vitest)
```typescript
// backend/tests/integration/repositories/user.repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { UserRepository } from '@/repositories/user.repository';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';

describe('User Repository', () => {
  let prisma: ReturnType<typeof getTestPrismaClient>;
  let userRepository: UserRepository;

  beforeAll(async () => {
    prisma = getTestPrismaClient();
    userRepository = new UserRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should create a new user', async () => {
    const userData = {
      plexId: 'plex-123',
      plexUsername: 'testuser',
      email: 'test@example.com',
      role: 'user' as const
    };

    const user = await userRepository.create(userData);
    expect(user.id).toBeDefined();
    expect(user.plexId).toBe('plex-123');
    expect(user.email).toBe('test@example.com');
  });
});
```

#### Test Environment Setup
The test suite uses:
- **Vitest**: Modern test framework with TypeScript support
- **MSW (Mock Service Worker)**: For mocking external Plex API calls
- **Supertest**: For HTTP endpoint testing
- **Test Database**: Separate PostgreSQL instance on port 5433
- **Test Redis**: Separate Redis instance on port 6380

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run database migrations for tests
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate deploy
```

## Database Management

### Prisma Commands

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Create new migration
npm run db:migrate:dev --name migration-name

# Reset database (WARNING: deletes data)
npm run db:reset

# Seed database with test data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

### Database Schema Changes

1. **Modify Schema**
   ```prisma
   // backend/prisma/schema.prisma
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
   }
   ```

2. **Create Migration**
   ```bash
   npm run db:migrate:dev --name add-user-name
   ```

3. **Update Types**
   ```bash
   npm run db:generate
   ```

### Seeding Data

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  await prisma.user.create({
    data: {
      email: 'admin@medianest.local',
      name: 'Admin User',
      role: 'admin'
    }
  });
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

## External Service Integration

### Development Service Setup

#### Plex Server
```bash
# Use Docker for development Plex server
docker run -d \
  --name plex-dev \
  -p 32400:32400/tcp \
  -e PLEX_CLAIM="claim-token-from-plex.tv" \
  -v ./dev-data/plex:/config \
  plexinc/pms-docker
```

#### Overseerr
```bash
# Development Overseerr instance
docker run -d \
  --name overseerr-dev \
  -p 5055:5055 \
  -v ./dev-data/overseerr:/app/config \
  fallenbagel/overseerr:latest
```

### Service Configuration in Development

1. **Start MediaNest in development mode**
2. **Login as admin** (admin/admin)
3. **Navigate to Admin → Service Configuration**
4. **Configure service URLs**:
   - Plex: `http://localhost:32400`
   - Overseerr: `http://localhost:5055`
   - Uptime Kuma: `http://localhost:3001` (optional)

### Mock Services for Testing

```typescript
// backend/tests/mocks/plexMock.ts
export class PlexMockServer {
  static start() {
    // Mock Plex API responses
    nock('http://localhost:32400')
      .get('/library/sections')
      .reply(200, mockLibrariesResponse);
  }
}
```

## Debugging

### VS Code Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "envFile": "${workspaceFolder}/.env",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"]
    }
  ]
}
```

### Logging

```typescript
// Use structured logging
import { logger } from '../utils/logger';

// Log levels: error, warn, info, debug
logger.info('User logged in', { userId, email });
logger.error('Database connection failed', { error: error.message });
```

### Database Debugging

```bash
# Connect to development database
docker exec -it medianest-postgres-1 psql -U medianest -d medianest_dev

# Monitor queries (if enabled)
tail -f backend/logs/queries.log
```

### Network Debugging

```bash
# Check service connectivity
curl -v http://localhost:4000/api/health
curl -v http://localhost:3000/api/auth/session

# Check external services
curl -v http://localhost:32400/status/sessions
```

## Contributing Guidelines

### Before Contributing

1. **Read the documentation**:
   - [ARCHITECTURE.md](./ARCHITECTURE.md)
   - [MediaNest.PRD](../MediaNest.PRD)
   - This development guide

2. **Set up development environment**
3. **Create an issue** for new features or bugs
4. **Follow coding standards**

### Pull Request Process

1. **Fork and clone** the repository
2. **Create feature branch** from `main`
3. **Make changes** following project conventions
4. **Add/update tests** for new functionality
5. **Update documentation** if needed
6. **Ensure all tests pass** locally
7. **Submit pull request** with clear description

### Commit Message Format

Use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add Plex OAuth integration
fix(api): resolve rate limiting edge case
docs(readme): update installation instructions
```

### Code Review Guidelines

#### For Authors
- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Respond to feedback promptly
- Update tests and documentation

#### For Reviewers
- Review for functionality, security, and performance
- Check test coverage
- Verify documentation updates
- Be constructive in feedback

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Reset database
cd backend && npm run db:reset
```

#### Redis Connection Issues
```bash
# Check Redis status
docker exec -it medianest-redis-1 redis-cli ping

# Clear Redis cache
docker exec -it medianest-redis-1 redis-cli FLUSHALL
```

#### External Service Integration
```bash
# Test Plex connection
curl -H "X-Plex-Token: your-token" http://localhost:32400/status/sessions

# Test Overseerr API
curl -H "Authorization: Bearer your-api-key" http://localhost:5055/api/v1/status
```

#### Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
cd frontend && rm -rf .next
```

### Performance Issues

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
ORDER BY idx_scan;
```

#### Application Performance
```bash
# Profile API endpoints
cd backend && npm run profile

# Analyze bundle size
cd frontend && npm run analyze
```

### Getting Help

1. **Check existing documentation** in `/docs`
2. **Search GitHub issues** for similar problems
3. **Create detailed issue** with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Relevant logs
4. **Join community discussions** (if applicable)

### Debugging Checklists

#### New Developer Setup
- [ ] Node.js 20.x installed
- [ ] Docker and Docker Compose working
- [ ] Repository cloned and dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Development servers start without errors
- [ ] Can login with admin credentials
- [ ] External services configured (if available)

#### Before Pull Request
- [ ] All tests pass (`npm run test`)
- [ ] Code linting passes (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run type-check`)
- [ ] Database migrations work correctly
- [ ] Documentation updated for changes
- [ ] Manual testing completed
- [ ] Commit messages follow conventions

## Development Roadmap

### ✅ Completed (Phase 1)
- ✅ Complete initial project setup
- ✅ Implement Plex OAuth authentication with PIN flow
- ✅ JWT authentication and RBAC middleware
- ✅ Database schema with Prisma ORM
- ✅ Repository pattern implementation
- ✅ Comprehensive error handling and logging
- ✅ Rate limiting with Redis
- ✅ Complete testing suite (30 tests, 60-70% coverage)

### 🚧 Current Goals (Phase 2 - External Service Integration)
- [ ] Plex API client with circuit breakers
- [ ] Overseerr integration for media requests
- [ ] Uptime Kuma WebSocket connection
- [ ] Service status monitoring and caching
- [ ] Service configuration management through admin UI

### Short-term Goals (Phase 3 - Next 2-4 weeks)
- [ ] Media request functionality through Overseerr
- [ ] YouTube download management with yt-dlp
- [ ] Real-time notifications via Socket.io
- [ ] Background job processing with BullMQ
- [ ] Admin dashboard with service status

### Medium-term Goals (Next 1-3 months)
- [ ] Advanced analytics dashboard
- [ ] Performance optimization and monitoring
- [ ] API documentation with OpenAPI/Swagger
- [ ] CI/CD pipeline implementation

### Long-term Goals (3+ months)
- [ ] Mobile app considerations
- [ ] Multi-server support exploration
- [ ] Advanced user permissions and groups

---

## Additional Resources

- **Architecture Documentation**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Documentation**: [API.md](./API.md)
- **Error Handling Guide**: [ERROR_HANDLING_LOGGING_STRATEGY.md](./ERROR_HANDLING_LOGGING_STRATEGY.md)
- **Security Guide**: [SECURITY_ARCHITECTURE_STRATEGY.md](./SECURITY_ARCHITECTURE_STRATEGY.md)
- **Frontend Guide**: [FRONTEND_ARCHITECTURE_GUIDE.md](./FRONTEND_ARCHITECTURE_GUIDE.md)
- **Backend Guide**: [BACKEND_IMPLEMENTATION_GUIDE.md](./BACKEND_IMPLEMENTATION_GUIDE.md)

---

**Last Updated**: January 2025  
**Next Review**: February 2025

For questions or improvements to this guide, please create an issue or submit a pull request.