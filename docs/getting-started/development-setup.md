# Development Environment Setup

This comprehensive guide walks you through setting up a complete MediaNest development environment. Perfect for contributors who want to dive deep into the codebase.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Tools Setup](#development-tools-setup)
- [Project Setup](#project-setup)
- [Database Configuration](#database-configuration)
- [External Services Setup](#external-services-setup)
- [IDE Configuration](#ide-configuration)
- [Development Workflow](#development-workflow)
- [Testing Setup](#testing-setup)
- [Debugging Guide](#debugging-guide)
- [Performance Optimization](#performance-optimization)

## Prerequisites

### Required Software

#### Node.js 20.x LTS
```bash
# Check current version
node --version

# Install via Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20
```

#### Docker & Docker Compose V2
```bash
# Install Docker Desktop (recommended for beginners)
# Download from: https://www.docker.com/products/docker-desktop

# Or install Docker Engine on Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify installation
docker --version          # Should be 24.x+
docker compose version    # Should be v2.x+
```

#### Git with LFS (Large File Support)
```bash
# Install Git LFS for handling large files
git lfs install

# Verify
git lfs version
```

### Optional but Recommended

#### PostgreSQL Client Tools
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

#### Redis CLI
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt install redis-tools

# Windows
# Download from: https://github.com/tporadowski/redis/releases
```

## Development Tools Setup

### VS Code Configuration

Install recommended extensions:

```bash
# Install VS Code extensions via command line
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension prisma.prisma
code --install-extension ms-vscode.vscode-json
code --install-extension ms-vscode-remote.remote-containers
```

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "typescript",
    "typescriptreact": "typescriptreact"
  },
  "files.associations": {
    "*.env*": "dotenv"
  },
  "search.exclude": {
    "node_modules": true,
    ".next": true,
    "dist": true,
    "coverage": true
  }
}
```

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/frontend/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/frontend",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Terminal Setup

Add useful aliases to your shell configuration:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
alias mn-dev="npm run dev"
alias mn-test="npm run test"
alias mn-build="npm run build"
alias mn-logs="docker compose -f docker-compose.dev.yml logs -f"
alias mn-reset="docker compose -f docker-compose.dev.yml down -v && npm run db:migrate"

# Docker shortcuts
alias dcu="docker compose -f docker-compose.dev.yml up -d"
alias dcd="docker compose -f docker-compose.dev.yml down"
alias dcl="docker compose -f docker-compose.dev.yml logs -f"
alias dcr="docker compose -f docker-compose.dev.yml restart"

# Git shortcuts for MediaNest workflow
alias gst="git status"
alias gco="git checkout"
alias gcb="git checkout -b"
alias gp="git pull origin"
alias gph="git push origin HEAD"
```

## Project Setup

### 1. Repository Setup

```bash
# Fork the repository on GitHub first
# Clone your fork
git clone https://github.com/YOUR_USERNAME/medianest.git
cd medianest

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/medianest.git

# Verify remotes
git remote -v
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# This installs:
# - Root project dependencies
# - Frontend dependencies (Next.js, React, etc.)
# - Backend dependencies (Express, Prisma, etc.)
# - Development tools (ESLint, Prettier, etc.)

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
npm run generate-secrets

# The script generates:
# - NEXTAUTH_SECRET (32-byte random)
# - ENCRYPTION_KEY (32-byte random)
# - JWT_SECRET (32-byte random)

# Edit .env for your environment
nano .env
```

Key environment variables to configure:

```bash
# Database (automatically configured for development)
DATABASE_URL="postgresql://postgres:password@localhost:5432/medianest"
REDIS_URL="redis://localhost:6379"

# Application URLs
NEXTAUTH_URL="http://localhost:3000"
BACKEND_URL="http://localhost:4000"

# Plex Configuration (get from plex.tv)
PLEX_CLIENT_ID="your-plex-client-id"
PLEX_CLIENT_SECRET="your-plex-client-secret"

# Admin Bootstrap (first time only)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-me-immediately"

# Development Features
NODE_ENV="development"
DEBUG="medianest:*"
LOG_LEVEL="debug"

# Optional: External Services
OVERSEERR_URL="http://your-overseerr-instance"
UPTIME_KUMA_URL="http://your-uptime-kuma-instance"
```

## Database Configuration

### 1. Start Database Services

```bash
# Start PostgreSQL and Redis
docker compose -f docker-compose.dev.yml up -d

# Verify services are running
docker compose -f docker-compose.dev.yml ps

# Check logs if there are issues
docker compose -f docker-compose.dev.yml logs postgres
docker compose -f docker-compose.dev.yml logs redis
```

### 2. Database Schema Setup

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Optional: Seed with test data
npm run db:seed

# Open Prisma Studio to view data
npm run db:studio
```

### 3. Database Management Commands

```bash
# Reset database (development only)
npm run db:reset

# Create new migration
cd backend
npx prisma migrate dev --name your_migration_name

# View database with Prisma Studio
npm run db:studio

# Backup database
npm run db:backup

# Validate database connection
npm run db:validate
```

## External Services Setup

### Plex Media Server Integration

1. **Get Plex OAuth Credentials**:
   - Visit [Plex.tv App Management](https://plex.tv/link)
   - Create a new app with these settings:
     - App Name: MediaNest Development
     - Redirect URI: `http://localhost:3000/api/auth/callback/plex`

2. **Configure Plex Settings**:
   ```bash
   # Add to .env
   PLEX_CLIENT_ID="your-client-id"
   PLEX_CLIENT_SECRET="your-client-secret"
   PLEX_REDIRECT_URI="http://localhost:3000/api/auth/callback/plex"
   ```

3. **Test Plex Connection**:
   ```bash
   # Start development server
   npm run dev

   # Test Plex authentication
   curl -X POST http://localhost:4000/api/auth/plex/test
   ```

### Overseerr Integration (Optional)

1. **Setup Overseerr Instance**:
   - Install Overseerr following their [documentation](https://docs.overseerr.dev/)
   - Generate an API key in Overseerr settings

2. **Configure MediaNest**:
   ```bash
   # Add to .env
   OVERSEERR_URL="http://your-overseerr-instance:5055"
   OVERSEERR_API_KEY="your-api-key"
   ```

3. **Test Integration**:
   ```bash
   # Test connection
   curl -H "X-Api-Key: your-api-key" http://localhost:4000/api/media/search?query=test
   ```

### Uptime Kuma Integration (Optional)

1. **Setup Uptime Kuma**:
   - Install following [Uptime Kuma documentation](https://github.com/louislam/uptime-kuma)
   - Create monitoring dashboard

2. **Configure Connection**:
   ```bash
   # Add to .env
   UPTIME_KUMA_URL="http://your-uptime-kuma:3001"
   UPTIME_KUMA_TOKEN="your-socket-token"
   ```

## IDE Configuration

### TypeScript Configuration

The project includes comprehensive TypeScript configurations:

- `tsconfig.json` - Root TypeScript configuration
- `tsconfig.base.json` - Shared base configuration
- `frontend/tsconfig.json` - Frontend-specific settings
- `backend/tsconfig.json` - Backend-specific settings

### ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@next/next/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

## Development Workflow

### 1. Start Development Environment

```bash
# Start all services
npm run dev

# This starts:
# - PostgreSQL & Redis (Docker)
# - Backend server (http://localhost:4000)
# - Frontend server (http://localhost:3000)
# - WebSocket connection between frontend and backend
```

### 2. Development Server Details

#### Frontend (Next.js)
- **Port**: 3000
- **Hot Reload**: Automatic on file changes
- **Custom Server**: Integrated with Socket.io
- **Build Output**: `.next/` directory

#### Backend (Express)
- **Port**: 4000
- **Auto Restart**: via nodemon
- **TypeScript Compilation**: On-the-fly with ts-node
- **Build Output**: `dist/` directory

### 3. File Watching and Auto-Reload

The development setup includes:
- **Frontend**: Next.js fast refresh for React components
- **Backend**: Nodemon restart on `.ts` file changes
- **Database**: Prisma Client regeneration on schema changes
- **Styles**: Tailwind CSS hot reload

### 4. Environment-Specific Configurations

```bash
# Development environment
NODE_ENV=development
DEBUG=medianest:*
LOG_LEVEL=debug

# Different configurations available:
# - docker-compose.dev.yml (development)
# - docker-compose.test.yml (testing)
# - docker-compose.yml (production)
```

## Testing Setup

### 1. Unit Testing with Vitest

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run tests for specific workspace
cd backend && npm test
cd frontend && npm test
```

### 2. Integration Testing

```bash
# Start test database
npm run test:setup

# Run integration tests
npm run test:integration

# Clean up test environment
npm run test:teardown
```

### 3. End-to-End Testing with Playwright

```bash
# Install Playwright browsers
cd backend
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### 4. Test Configuration

#### Vitest Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared/src')
    }
  }
});
```

## Debugging Guide

### 1. Backend Debugging

#### VS Code Debugging
1. Set breakpoints in TypeScript files
2. Press F5 or use "Debug Backend" configuration
3. Debug directly in source code

#### Manual Debugging
```bash
# Start with Node.js inspector
cd backend
npx tsx --inspect src/server.ts

# Connect Chrome DevTools
# Go to chrome://inspect
```

### 2. Frontend Debugging

#### Browser DevTools
- React Developer Tools extension
- Next.js development panel
- Network tab for API calls
- WebSocket inspection

#### VS Code Debugging
```json
{
  "name": "Debug Next.js",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/frontend/node_modules/.bin/next",
  "args": ["dev"],
  "cwd": "${workspaceFolder}/frontend",
  "runtimeArgs": ["--inspect"]
}
```

### 3. Database Debugging

#### SQL Query Logging
```bash
# Enable Prisma query logging in development
DEBUG="prisma:query" npm run dev
```

#### Database Connection Issues
```bash
# Test database connectivity
cd backend
npx tsx scripts/test-database-connection.ts

# Check PostgreSQL logs
docker compose -f docker-compose.dev.yml logs postgres
```

### 4. WebSocket Debugging

#### Server-Side WebSocket Logs
```typescript
// Enable Socket.io debugging
DEBUG="socket.io:*" npm run dev
```

#### Client-Side WebSocket Testing
```javascript
// Browser console
const socket = io('http://localhost:4000');
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
```

## Performance Optimization

### 1. Development Performance

#### Build Performance
```bash
# Use SWC compiler for faster builds
# Already configured in Next.js config

# TypeScript incremental compilation
# Enabled in tsconfig.json

# Parallel processing
npm config set script-shell "bash"
```

#### Database Performance
```bash
# Enable query optimization in development
DATABASE_URL="${DATABASE_URL}?connection_limit=5&pool_timeout=30"
```

### 2. Hot Reload Optimization

#### Next.js Fast Refresh
- Preserve component state during edits
- Automatic error recovery
- Optimized for TypeScript

#### Backend Auto-Restart
```json
// nodemon.json
{
  "watch": ["src"],
  "ext": "ts,js,json",
  "ignore": ["src/**/*.test.ts", "src/**/*.spec.ts"],
  "exec": "tsx src/server.ts"
}
```

### 3. Memory Usage Optimization

```bash
# Monitor memory usage
npm run dev:memory

# Analyze bundle size
npm run analyze

# Check for memory leaks
node --inspect --trace-warnings src/server.ts
```

## Troubleshooting Development Issues

### Common Issues and Solutions

#### TypeScript Compilation Errors
```bash
# Clear TypeScript cache
npx tsc --build --clean

# Regenerate Prisma client
npm run db:generate

# Restart TypeScript service in VS Code
# Command Palette: "TypeScript: Restart TS Server"
```

#### Port Conflicts
```bash
# Find and kill processes using ports
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9

# Use different ports
PORT=3001 npm run dev:frontend
BACKEND_PORT=4001 npm run dev:backend
```

#### Docker Issues
```bash
# Reset Docker environment
docker compose -f docker-compose.dev.yml down -v
docker system prune -f

# Rebuild containers
docker compose -f docker-compose.dev.yml up --build -d
```

#### Database Connection Issues
```bash
# Check database status
docker compose -f docker-compose.dev.yml ps postgres

# Restart database
docker compose -f docker-compose.dev.yml restart postgres

# Reset database completely
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d postgres
npm run db:migrate
```

### Performance Issues

#### Slow Hot Reload
```bash
# Disable source maps in development (faster compilation)
# Edit next.config.js:
const nextConfig = {
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = 'eval-cheap-module-source-map';
    }
    return config;
  }
};
```

#### High Memory Usage
```bash
# Monitor memory usage
node --max-old-space-size=4096 node_modules/.bin/next dev

# Profile memory usage
node --inspect --max-old-space-size=4096 backend/src/server.ts
```

## Next Steps

You now have a complete development environment! Here's what to do next:

### 1. Explore the Codebase
- Read the [Architecture Documentation](../ARCHITECTURE.md)
- Understand the [API Structure](../api/README.md)
- Review existing components and services

### 2. Make Your First Contribution
- Find a [good first issue](https://github.com/repo/medianest/labels/good%20first%20issue)
- Read the [Contributing Guidelines](../developers/contributing.md)
- Follow the [Development Workflow](../developers/workflow.md)

### 3. Join the Community
- Participate in discussions
- Help other developers
- Share your improvements

**Need Help?** Check the [Troubleshooting Guide](../troubleshooting/common-issues.md) or ask in our community discussions.