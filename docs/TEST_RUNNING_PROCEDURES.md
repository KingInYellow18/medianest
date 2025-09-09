# Test Running Procedures

## Quick Reference Commands

### Local Development
```bash
# Run all tests
npm test

# Run specific workspace tests
npm run test:backend
npm run test:frontend  
npm run test:shared

# Watch mode for development
npm run test:watch

# Coverage reports
npm run test:coverage

# UI mode for interactive testing
npm run test:ui
```

### Production Validation
```bash
# Comprehensive test suite
npm run test:comprehensive

# Performance and load testing
npm run test:performance

# Security validation
npm run security:scan

# Full validation pipeline
npm run validate:production
```

## Local Testing Environment Setup

### Prerequisites
1. **Node.js**: v18.0.0 or higher
2. **Docker**: For test databases
3. **Git**: For repository management

### Initial Setup
```bash
# Clone and install dependencies
git clone <repository>
cd medianest
npm install

# Setup test databases
npm run test:setup

# Verify installation
npm test
```

### Test Database Configuration

#### PostgreSQL Test Database
```bash
# Start test database
docker run -d \
  --name medianest-test-postgres \
  -e POSTGRES_DB=medianest_test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  postgres:15

# Run migrations
cd backend && npx prisma db push
```

#### Redis Test Instance
```bash
# Start test Redis
docker run -d \
  --name medianest-test-redis \
  -p 6380:6379 \
  redis:7-alpine

# Verify connection
redis-cli -p 6380 ping
```

#### Docker Compose Setup (Recommended)
```bash
# Use project test configuration
npm run test:setup

# This runs:
# docker compose -f docker-compose.test.yml up -d --wait
```

## Running Different Test Types

### Unit Tests
```bash
# Backend unit tests
cd backend && npm test

# Frontend unit tests  
cd frontend && npm test

# Shared library tests
cd shared && npm test

# Run specific test files
npx vitest run tests/unit/auth.test.ts
```

### Integration Tests
```bash
# Backend integration tests
cd backend && npm run test:integration

# Database integration
npm run test:backend -- --grep="database"

# API endpoint tests
npm run test:backend -- --grep="integration"
```

### End-to-End Tests  
```bash
# Full E2E suite
npm run test:e2e

# E2E with UI mode
npm run test:e2e:ui

# E2E debugging
npm run test:e2e:debug

# Specific E2E tests
cd backend && npx playwright test auth.spec.ts
```

### Security Tests
```bash
# Security test suite
npm run security:test

# Specific security categories
cd backend && ./scripts/run-security-tests.sh

# Manual security validation
npm run security:validate
```

### Performance Tests
```bash
# Load testing
npm run test:load

# Performance benchmarks
npm run benchmark

# Memory profiling
npm run profile
```

### Edge Case Tests
```bash
# Edge case framework
npm run test:edge-cases

# Boundary value testing  
npm run test:boundaries

# Security edge cases
npm run test:security-edges

# Concurrency testing
npm run test:concurrency
```

## Watch Mode and Development

### Interactive Development
```bash
# Watch mode with file watching
npm run test:watch

# UI mode for interactive debugging
npm run test:ui

# Frontend watch mode
cd frontend && npm run test -- --watch
```

### Debugging Tests
```bash
# Run single test with debugging
npx vitest run --reporter=verbose tests/auth.test.ts

# Debug with Node.js inspector
node --inspect-brk node_modules/.bin/vitest run

# Playwright debugging
cd backend && npx playwright test --debug
```

## CI/CD Pipeline Integration

### GitHub Actions Integration
The project includes automated testing in CI/CD pipelines:

```yaml
# .github/workflows/test.yml (example structure)
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:setup
      - run: npm run test:all
      - run: npm run test:e2e
```

### Pipeline Commands
```bash
# Full CI validation
npm run ci:full

# Production build validation  
npm run build:ci

# Zero-failure deployment validation
npm run deploy:zero-failure

# Pipeline rollback testing
npm run pipeline:rollback
```

## Environment Configuration

### Test Environment Variables
Create `.env.test` file:
```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5433/medianest_test
REDIS_URL=redis://localhost:6380/0
JWT_SECRET=test-jwt-secret-key-32-bytes-long
ENCRYPTION_KEY=test-encryption-key-32-bytes-long
LOG_LEVEL=silent
```

### Backend Test Configuration
```typescript
// backend/vitest.config.ts env section
env: {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
  REDIS_URL: 'redis://localhost:6380/0',
  JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
  // ... additional test configuration
}
```

## Test Data Management

### Fixtures and Factories
```bash
# Load test fixtures
cd backend && npm run db:seed

# Reset test database
cd backend && npm run db:reset

# Custom test data
npx tsx tests/fixtures/create-test-data.ts
```

### Database State Management
```bash
# Before integration tests
npm run test:setup

# After integration tests  
npm run test:teardown

# Clean slate for tests
npm run test:integration  # Includes setup/teardown
```

## Coverage Reporting

### Generate Coverage Reports
```bash
# Full coverage report
npm run test:coverage

# Backend coverage
cd backend && npm run test:coverage

# Frontend coverage
cd frontend && npm run test:coverage

# View HTML reports
open backend/coverage/index.html
open frontend/coverage/index.html
```

### Coverage Thresholds
- **Backend**: 70% (branches, functions, lines, statements)
- **Frontend**: 60% (branches, functions, lines, statements)  
- **Shared**: 60% (branches, functions, lines, statements)

## Parallel Test Execution

### Workspace Parallel Execution
```bash
# Run all workspaces in parallel
npm test  # Uses vitest workspace

# Manual parallel execution
npm run test:backend & npm run test:frontend & npm run test:shared
```

### Performance Considerations
- Backend uses fork pool for isolation
- Frontend uses single thread for stability
- Integration tests run sequentially for database consistency
- E2E tests run with limited parallelism

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Check database status
docker ps | grep postgres
docker logs medianest-test-postgres

# Reset database connection
npm run test:teardown && npm run test:setup
```

### Redis Connection Issues  
```bash
# Check Redis status
docker ps | grep redis
redis-cli -p 6380 ping

# Clear Redis test data
redis-cli -p 6380 FLUSHDB
```

### Port Conflicts
```bash
# Check port usage
lsof -i :5433  # PostgreSQL test port
lsof -i :6380  # Redis test port
lsof -i :3001  # Test server port

# Kill processes using ports
kill -9 $(lsof -t -i :5433)
```

### Mock and Setup Issues
```bash
# Clear Node.js cache
rm -rf node_modules/.cache

# Reset test infrastructure
npm run clean && npm install
npm run test:setup
```

This document provides comprehensive procedures for running tests in all environments. For specific troubleshooting scenarios, see the [TEST_TROUBLESHOOTING.md](./TEST_TROUBLESHOOTING.md) guide.