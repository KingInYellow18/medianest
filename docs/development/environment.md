# Development Environment Setup

Complete guide for setting up your MediaNest development environment based on our consolidated production-ready architecture.

!!! info "Environment Health: 78%"
    Our validation framework has established quality gates and continuous monitoring for optimal development experience.

## 🎯 Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **Node.js** | 20+ | Runtime environment | [nodejs.org](https://nodejs.org/) |
| **npm** | 10+ | Package manager | Included with Node.js |
| **Git** | 2.40+ | Version control | [git-scm.com](https://git-scm.com/) |
| **Docker** | 20+ | Containerization | [docker.com](https://docker.com/) |
| **Docker Compose** | 2.20+ | Multi-container orchestration | [docs.docker.com](https://docs.docker.com/compose/) |

### Development Tools (Recommended)

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **VS Code** | Primary IDE | See [VS Code Setup](#vs-code-setup) |
| **PostgreSQL** | Database (if not using Docker) | [postgresql.org](https://postgresql.org/) |
| **Redis** | Cache (if not using Docker) | [redis.io](https://redis.io/) |
| **Postman** | API testing | [postman.com](https://postman.com/) |

## 🚀 Quick Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/medianest/medianest.git
cd medianest

# Install dependencies for all workspaces
npm install
```

### 2. Environment Configuration

```bash
# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Create shared environment (optional)
cp .env.example .env
```

### 3. Start Development Services

```bash
# Option A: Start all services with Docker
docker-compose -f docker-compose.dev.yml up -d

# Option B: Start only databases with Docker
docker-compose up -d postgres redis

# Option C: Use local services (requires manual setup)
# Ensure PostgreSQL and Redis are running locally
```

### 4. Database Setup

```bash
# Navigate to backend and setup database
cd backend

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Optional: Seed with sample data
npm run db:seed
```

### 5. Start Development Servers

```bash
# Terminal 1: Start backend development server
cd backend
npm run dev

# Terminal 2: Start frontend development server
cd frontend
npm run dev

# Terminal 3: Start shared package in watch mode (optional)
cd shared
npm run dev
```

## 🏗️ Project Structure

MediaNest uses a monorepo structure with npm workspaces:

```
medianest/
├── 📁 backend/              # Node.js Express API server
│   ├── src/
│   │   ├── middleware/       # Express middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helper functions
│   │   └── server.ts        # Application entry point
│   ├── tests/               # Backend tests
│   ├── prisma/              # Database schema and migrations
│   └── package.json         # Backend dependencies
│
├── 📁 frontend/             # Next.js React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Frontend utilities
│   │   ├── pages/           # Next.js pages
│   │   └── styles/          # CSS and styling
│   ├── public/              # Static assets
│   └── package.json         # Frontend dependencies
│
├── 📁 shared/               # Shared types and utilities
│   ├── src/
│   │   ├── types/           # TypeScript interfaces
│   │   ├── schemas/         # Zod validation schemas
│   │   └── utils/           # Shared utilities
│   └── package.json         # Shared dependencies
│
├── 📁 tests/                # Cross-workspace test utilities
│   ├── accessibility/       # A11y testing helpers
│   ├── performance/         # Performance testing
│   └── utils/               # Test utilities
│
├── 📁 docs/                 # Documentation (MkDocs)
├── docker-compose.yml       # Production Docker setup
├── docker-compose.dev.yml   # Development Docker setup
└── package.json             # Root workspace configuration
```

## ⚙️ Environment Configuration

### Backend Environment (`.env`)

```bash
# Database Configuration
DATABASE_URL="postgresql://medianest:medianest@localhost:5432/medianest_dev"
REDIS_URL="redis://localhost:6379/0"

# Authentication
JWT_SECRET="development-jwt-secret-change-in-production"
JWT_EXPIRES_IN="7d"

# Plex Integration (Required)
PLEX_CLIENT_ID="your-plex-client-id"
PLEX_CLIENT_SECRET="your-plex-client-secret"
PLEX_REDIRECT_URI="http://localhost:8000/auth/plex/callback"

# External Services (Optional)
OVERSEERR_URL="http://localhost:5055"
OVERSEERR_API_KEY="your-overseerr-api-key"

# Development Settings
NODE_ENV="development"
PORT=8000
CORS_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL="debug"
LOG_FILE="logs/development.log"

# Development Security (Relaxed)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### Frontend Environment (`.env.local`)

```bash
# Next.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-nextauth-secret-change-in-production"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_WS_URL="ws://localhost:8000"

# Plex Configuration
NEXT_PUBLIC_PLEX_CLIENT_ID="your-plex-client-id"

# Development Settings
NODE_ENV="development"
NEXT_PUBLIC_ENV="development"

# Feature Flags (Development)
NEXT_PUBLIC_FEATURE_QUEUE_MANAGEMENT=true
NEXT_PUBLIC_FEATURE_ADVANCED_MONITORING=true
```

## 🐳 Docker Development Setup

### Development Compose Configuration

The `docker-compose.dev.yml` provides a complete development environment:

```yaml
# Key features of development setup:
# - Volume mounting for hot reloading
# - Development-optimized configuration
# - Exposed ports for debugging
# - Simplified logging
```

### Development Commands

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down

# Rebuild services
docker-compose -f docker-compose.dev.yml build --no-cache

# Access database
docker-compose exec postgres psql -U medianest -d medianest_dev

# Access Redis CLI
docker-compose exec redis redis-cli
```

## 🔧 Development Tools Configuration

### VS Code Setup

#### Recommended Extensions

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "prisma.prisma",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-docker"
  ]
}
```

#### Workspace Settings

Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

#### Debug Configuration

Create `.vscode/launch.json`:
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
      "envFile": "${workspaceFolder}/backend/.env",
      "runtimeArgs": ["-r", "tsx/cjs"]
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/frontend/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/frontend"
    }
  ]
}
```

### Git Hooks Setup

```bash
# Install pre-commit hooks
npm install --save-dev husky lint-staged

# Setup husky
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"

# Configure lint-staged in package.json
```

## 🧪 Testing Environment

### Test Database Setup

```bash
# Create test database
createdb medianest_test

# Run test migrations
cd backend
NODE_ENV=test npm run db:migrate
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Configuration

Each workspace has optimized test configuration:

- **Backend**: Vitest with 80% coverage thresholds
- **Frontend**: Jest + React Testing Library
- **Shared**: Vitest for utility testing
- **E2E**: Playwright for integration testing

## 📊 Development Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Frontend health
curl http://localhost:3000/api/health

# Database connection
npm run db:status
```

### Logging

Development logs are configured for optimal debugging:

```bash
# View backend logs
tail -f backend/logs/development.log

# View frontend logs (Next.js)
# Available in terminal running npm run dev

# View Docker logs
docker-compose logs -f medianest
```

### Performance Monitoring

```bash
# Check development metrics
curl http://localhost:8000/metrics

# Monitor database queries
npm run db:monitor

# Monitor API response times
npm run perf:monitor
```

## 🔄 Development Workflow

### 1. **Feature Development**

```bash
# Create feature branch
git checkout -b feature/media-request-enhancement

# Make changes
# ... development work ...

# Run quality checks
npm run lint
npm run typecheck
npm run test

# Commit changes
git commit -m "feat: enhance media request flow"
```

### 2. **Database Changes**

```bash
# Create migration
cd backend
npx prisma migrate dev --name add_user_preferences

# Generate updated client
npm run db:generate

# Test migration
npm run test:integration
```

### 3. **API Development**

```bash
# Start backend in development mode
cd backend && npm run dev

# Test API endpoints
curl -X GET http://localhost:8000/api/health

# View API documentation
open http://localhost:8000/api-docs
```

### 4. **Frontend Development**

```bash
# Start frontend development server
cd frontend && npm run dev

# Access development site
open http://localhost:3000

# Run component tests
npm run test:components
```

## 🔧 Troubleshooting

### Common Development Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or change ports in environment files
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Restart PostgreSQL (macOS)
brew services restart postgresql

# Restart PostgreSQL (Linux)
sudo systemctl restart postgresql
```

#### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Restart Redis (macOS)
brew services restart redis

# Restart Redis (Linux)
sudo systemctl restart redis
```

#### Node Modules Issues
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# Rebuild native modules
npm rebuild
```

### Performance Issues

#### Slow Development Server
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable filesystem watching optimization
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf

# Restart development servers
```

#### Database Performance
```bash
# Analyze slow queries
npm run db:analyze

# Rebuild indexes
npm run db:reindex

# Update database statistics
npm run db:analyze-tables
```

## 🎯 Development Best Practices

### Code Quality
- Use TypeScript for all code
- Follow ESLint rules
- Write tests for new features
- Use Prettier for formatting
- Follow conventional commit messages

### Performance
- Use React DevTools Profiler
- Monitor bundle sizes
- Optimize database queries
- Implement proper caching

### Security
- Never commit sensitive data
- Use environment variables
- Validate all inputs
- Follow OWASP guidelines

### Collaboration
- Create detailed PR descriptions
- Request code reviews
- Update documentation
- Communicate changes in team chat

---

**Next**: [Project Structure](structure.md) →