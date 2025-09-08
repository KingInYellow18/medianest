# Development Environment Setup

Complete guide for setting up MediaNest development environment with hot reloading, debugging, and testing capabilities.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Development Services](#development-services)
- [IDE Configuration](#ide-configuration)
- [Debugging](#debugging)
- [Testing](#testing)
- [Database Development](#database-development)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **OS**: macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 20GB free space
- **Node.js**: 18.17+ or 20.5+
- **Docker**: 24.0+ (optional but recommended)
- **Git**: Latest version

### Recommended Setup

- **RAM**: 16GB+
- **Storage**: SSD with 50GB+ free space
- **Docker Desktop**: Latest version
- **VSCode**: With recommended extensions

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd medianest
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3. Environment Setup

```bash
# Copy development environment
cp .env.example .env.development

# Edit development configuration
nano .env.development
```

**Development Environment Variables:**

```bash
# Node Environment
NODE_ENV=development

# Database (using Docker services)
DATABASE_URL=postgresql://medianest:medianest_password@localhost:5432/medianest
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medianest
DB_USER=medianest
DB_PASSWORD=medianest_password

# Redis (using Docker services)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Development URLs
BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# Development Secrets (less secure for dev)
JWT_SECRET=dev-jwt-secret-not-for-production
SESSION_SECRET=dev-session-secret-not-for-production
ENCRYPTION_KEY=dev-encryption-key-not-for-prod

# Development Features
LOG_LEVEL=debug
DEBUG=medianest:*
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

# Hot Reloading
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
```

### 4. Start Development Environment

#### Option A: Docker Development Services

```bash
# Start database and Redis services only
docker-compose -f docker-compose.dev.yml up -d

# Run applications natively for better development experience
cd backend
npm run dev

# In another terminal
cd frontend
npm run dev
```

#### Option B: Full Docker Development

```bash
# Start all services in development mode
docker-compose -f docker-compose.yml up -d

# Follow logs
docker-compose logs -f app frontend
```

#### Option C: Native Development

```bash
# Install and run PostgreSQL locally
brew install postgresql redis
brew services start postgresql redis

# Or use system package manager
sudo apt-get install postgresql redis-server

# Setup database
createdb medianest
psql medianest < database/init.sql

# Run applications
npm run dev:full  # Runs both backend and frontend concurrently
```

### 5. Verify Setup

```bash
# Check backend
curl http://localhost:4000/api/health

# Check frontend
curl http://localhost:3000/api/health

# Check database connection
cd backend && npm run db:test
```

## Development Services

### Service Overview

| Service    | Purpose             | Port | URL                   |
| ---------- | ------------------- | ---- | --------------------- |
| Frontend   | Next.js application | 3000 | http://localhost:3000 |
| Backend    | Node.js API         | 4000 | http://localhost:4000 |
| PostgreSQL | Primary database    | 5432 | localhost:5432        |
| Redis      | Cache & sessions    | 6379 | localhost:6379        |
| Mailhog    | Email testing       | 8025 | http://localhost:8025 |
| Adminer    | Database admin      | 8080 | http://localhost:8080 |

### Docker Development Compose

The `docker-compose.dev.yml` provides minimal services for development:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest
      POSTGRES_PASSWORD: medianest_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data
```

### Extended Development Services

```bash
# Start extended development services
docker-compose -f docker-compose.dev.yml -f docker-compose.dev.override.yml up -d
```

Additional services include:

- **Mailhog**: Email testing and debugging
- **Adminer**: Web-based database administration
- **Redis Insight**: Redis debugging and monitoring

## IDE Configuration

### VSCode Setup

**Recommended Extensions:**

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-jest",
    "ms-vscode-remote.remote-containers",
    "ms-vscode.vscode-docker",
    "humao.rest-client"
  ]
}
```

**Settings Configuration:**

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  },
  "files.associations": {
    "*.env*": "properties"
  }
}
```

**Launch Configuration:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "medianest:*"
      },
      "envFile": "${workspaceFolder}/.env.development",
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--inspect"]
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/frontend/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/frontend",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

### WebStorm Configuration

**Run Configurations:**

1. **Backend Development**

   - Type: Node.js
   - JavaScript file: `backend/src/server.js`
   - Environment variables: Load from `.env.development`
   - Working directory: `backend`

2. **Frontend Development**
   - Type: npm
   - Command: `run`
   - Scripts: `dev`
   - Working directory: `frontend`

## Debugging

### Backend Debugging

#### VSCode Debugging

```bash
# Start with debug flag
cd backend
npm run dev:debug

# Or with specific debug namespaces
DEBUG=medianest:db,medianest:auth npm run dev
```

#### Chrome DevTools

```bash
# Start with inspect flag
node --inspect=0.0.0.0:9229 src/server.js

# Open Chrome DevTools
# Go to: chrome://inspect
# Click "Open dedicated DevTools for Node"
```

#### Debug Configuration

```javascript
// backend/src/utils/debug.js
const debug = require('debug');

module.exports = {
  db: debug('medianest:db'),
  auth: debug('medianest:auth'),
  api: debug('medianest:api'),
  socket: debug('medianest:socket'),
  plex: debug('medianest:plex'),
};
```

### Frontend Debugging

#### Next.js Dev Tools

```bash
# Enable verbose logging
NEXT_DEBUG=true npm run dev

# Debug specific components
DEBUG=next:* npm run dev
```

#### React Developer Tools

Install browser extensions:

- React Developer Tools
- Redux DevTools (if using Redux)

#### Performance Debugging

```javascript
// Enable React Profiler
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
```

### Database Debugging

#### Query Logging

```bash
# Enable query logging
export DEBUG_SQL=true
cd backend && npm run dev
```

#### Database Tools

1. **Adminer** (Web-based)

   ```bash
   docker-compose -f docker-compose.dev.yml up adminer
   # Access: http://localhost:8080
   ```

2. **psql CLI**

   ```bash
   docker-compose exec postgres psql -U medianest -d medianest
   ```

3. **Database Migrations**
   ```bash
   cd backend
   npm run db:migrate
   npm run db:seed
   npm run db:reset  # Reset to clean state
   ```

## Testing

### Test Environment Setup

```bash
# Setup test database
createdb medianest_test
DATABASE_URL=postgresql://medianest:medianest_password@localhost:5432/medianest_test npm run db:migrate

# Run tests with proper environment
NODE_ENV=test npm test
```

### Backend Testing

```bash
cd backend

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# API tests
npm run test:api

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Frontend Testing

```bash
cd frontend

# Unit tests
npm run test

# E2E tests with Playwright
npm run test:e2e

# Component tests with Storybook
npm run storybook
npm run test:storybook

# Visual regression tests
npm run test:visual
```

### Test Configuration

**Jest Configuration (`jest.config.js`):**

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{js,ts}', '<rootDir>/tests/**/*.test.{js,ts}'],
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.test.{js,ts}', '!src/types/**/*'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

## Database Development

### Schema Management

```bash
# Create new migration
cd backend
npm run db:migration:create add_user_preferences

# Run migrations
npm run db:migrate

# Rollback migration
npm run db:migrate:rollback

# Reset database
npm run db:reset
```

### Seeding Data

```bash
# Run all seeds
npm run db:seed

# Run specific seed
npm run db:seed:run -- --name 20231201000000_users.js

# Fresh database with seeds
npm run db:fresh
```

### Database Schema

```sql
-- Example migration: Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## Frontend Development

### Hot Reloading

Next.js provides automatic hot reloading. For enhanced development:

```bash
# Enable fast refresh
FAST_REFRESH=true npm run dev

# Polling for file changes (useful in Docker/WSL)
WATCHPACK_POLLING=true npm run dev
```

### Component Development

#### Storybook Setup

```bash
cd frontend
npm run storybook
# Access: http://localhost:6006
```

#### Component Structure

```typescript
// components/MediaCard/MediaCard.tsx
import React from 'react';
import { MediaItem } from '@/types';

interface MediaCardProps {
  media: MediaItem;
  onSelect?: (media: MediaItem) => void;
  className?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onSelect, className }) => {
  // Component implementation
};

// Export with display name for debugging
MediaCard.displayName = 'MediaCard';
export default MediaCard;
```

### Styling Development

```bash
# Watch Tailwind classes
cd frontend
npm run tailwind:watch

# Build Tailwind CSS
npm run tailwind:build
```

## Backend Development

### API Development

#### Route Structure

```typescript
// backend/src/routes/api/v1/media.ts
import { Router } from 'express';
import { auth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { MediaController } from '@/controllers/MediaController';

const router = Router();

router.get('/', auth, MediaController.getAll);
router.get('/:id', auth, MediaController.getById);
router.post('/', auth, validate('createMedia'), MediaController.create);

export default router;
```

#### Controller Pattern

```typescript
// backend/src/controllers/MediaController.ts
export class MediaController {
  static async getAll(req: Request, res: Response) {
    try {
      const media = await MediaService.getAllMedia(req.user.id);
      res.json({ data: media });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

### Middleware Development

```typescript
// backend/src/middleware/auth.ts
import jwt from 'jsonwebtoken';

export const auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Troubleshooting

### Common Development Issues

#### Port Already in Use

```bash
# Find process using port
lsof -ti:3000
lsof -ti:4000

# Kill process
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 npm run dev
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
psql -h localhost -U medianest -d medianest

# Reset database
npm run db:reset
```

#### Node Modules Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or use npm ci for clean install
npm ci
```

#### Hot Reloading Not Working

```bash
# Increase file watcher limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Use polling (performance impact)
CHOKIDAR_USEPOLLING=true npm run dev
```

#### TypeScript Issues

```bash
# Clear TypeScript cache
npx tsc --build --clean

# Restart TypeScript service in VSCode
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Check TypeScript config
npx tsc --showConfig
```

### Performance Issues

#### Slow Database Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

# Monitor memory usage
node --expose-gc server.js
# Then manually trigger GC: global.gc()
```

#### Build Performance

```bash
# Use SWC instead of Babel (Next.js 12+)
# Enable in next.config.js
module.exports = {
  swcMinify: true,
  experimental: {
    swcLoader: true
  }
}

# Enable incremental builds
# TypeScript: Enable incremental in tsconfig.json
{
  "compilerOptions": {
    "incremental": true
  }
}
```

### Debugging Tools

#### Network Debugging

```bash
# Monitor API calls
npx http-server --proxy http://localhost:4000

# Use ngrok for external testing
npx ngrok http 3000
```

#### Performance Profiling

```bash
# Node.js profiling
node --prof src/server.js
node --prof-process isolate-* > profile.txt

# React profiling
# Use React DevTools Profiler tab
```

## Development Workflows

### Git Workflow

```bash
# Feature development
git checkout -b feature/user-authentication
git add .
git commit -m "feat: implement user authentication"
git push origin feature/user-authentication

# Code review and merge
# Open pull request on GitHub/GitLab
```

### Code Quality

```bash
# Run linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check

# All quality checks
npm run check-all
```

### Daily Development

1. **Start Development Session**

   ```bash
   git pull origin develop
   docker-compose -f docker-compose.dev.yml up -d
   npm run dev:full
   ```

2. **Before Committing**

   ```bash
   npm run test
   npm run lint
   npm run type-check
   git add .
   git commit -m "feat: your changes"
   ```

3. **End Development Session**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   git push origin feature-branch
   ```

For additional help, check the main documentation or create an issue in the project repository.
