# MediaNest Automated Testing Framework

## Executive Summary

This document outlines the comprehensive automated testing framework for MediaNest, establishing continuous integration and deployment pipelines that ensure quality, performance, and security validation on every code change.

## Automated Testing Architecture

### 1. CI/CD Pipeline Overview

```mermaid
graph TD
    A[Code Push/PR] --> B[Pre-commit Hooks]
    B --> C[Unit Tests]
    C --> D[Integration Tests]
    D --> E[Security Scans]
    E --> F[Performance Tests]
    F --> G[E2E Tests]
    G --> H[Quality Gates]
    H --> I{All Pass?}
    I -->|Yes| J[Deploy to Staging]
    I -->|No| K[Block Deployment]
    J --> L[Production E2E Tests]
    L --> M[Deploy to Production]
    K --> N[Notify Development Team]
```

### 2. Testing Pipeline Stages

#### Stage 1: Pre-commit Validation
- **Duration**: < 30 seconds
- **Scope**: Fast feedback loop
- **Tools**: Husky, lint-staged
- **Tests**: Linting, type checking, unit tests

#### Stage 2: Continuous Integration
- **Duration**: < 10 minutes
- **Scope**: Complete validation
- **Tools**: GitHub Actions, Docker
- **Tests**: Full test suite execution

#### Stage 3: Staging Deployment
- **Duration**: < 5 minutes
- **Scope**: Deployment validation
- **Tools**: Docker Compose, Kubernetes
- **Tests**: Smoke tests, health checks

#### Stage 4: Production Validation
- **Duration**: < 15 minutes
- **Scope**: Production readiness
- **Tools**: Playwright, K6
- **Tests**: Production E2E, load testing

## GitHub Actions Workflow Implementation

### 1. Master CI/CD Workflow

```yaml
# .github/workflows/ci-cd-pipeline.yml
name: MediaNest CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: 'ghcr.io'
  IMAGE_NAME: 'medianest'

jobs:
  # ============================================================================
  # Stage 1: Code Quality & Unit Tests
  # ============================================================================
  code-quality:
    name: Code Quality & Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci --prefer-offline --no-audit
          cd backend && npm ci --prefer-offline --no-audit
          cd ../frontend && npm ci --prefer-offline --no-audit

      - name: Run linting
        run: |
          npm run lint
          npm run lint:backend
          npm run lint:frontend

      - name: Type checking
        run: |
          npm run typecheck:backend
          npm run typecheck:frontend

      - name: Unit tests
        run: |
          npm run test:unit -- --coverage --ci --watchAll=false
        env:
          CI: true

      - name: Upload unit test coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: unit-test-coverage

  # ============================================================================
  # Stage 2: Integration Tests
  # ============================================================================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: code-quality

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd "pg_isready -U test_user -d medianest_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci --prefer-offline --no-audit
          cd backend && npm ci --prefer-offline --no-audit

      - name: Setup test database
        run: |
          cd backend && npm run db:test:setup
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379/1

      - name: Run integration tests
        run: npm run test:integration -- --ci --coverage
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379/1

      - name: Upload integration test coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: integration
          name: integration-test-coverage

  # ============================================================================
  # Stage 3: Security Scanning
  # ============================================================================
  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: code-quality

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Run npm audit
        run: npm audit --audit-level moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --file=package.json

      - name: Run security tests
        run: npm run test:security

      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          languages: typescript, javascript

  # ============================================================================
  # Stage 4: Performance Testing
  # ============================================================================
  performance-tests:
    name: Performance Testing
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [integration-tests, security-scan]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: perf_user
          POSTGRES_PASSWORD: perf_pass
          POSTGRES_DB: medianest_perf
        options: >-
          --health-cmd "pg_isready -U perf_user -d medianest_perf"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Build application
        run: npm run build:production

      - name: Start application
        run: |
          npm run start:production &
          sleep 10
        env:
          NODE_ENV: production
          DATABASE_URL: postgresql://perf_user:perf_pass@localhost:5432/medianest_perf
          REDIS_URL: redis://localhost:6379/2

      - name: Wait for application
        run: |
          timeout 60s bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

      - name: Install K6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run performance tests
        run: |
          k6 run tests/performance/api-load-test.js --out json=performance-results.json
          k6 run tests/performance/database-stress-test.js --out json=db-performance-results.json

      - name: Analyze performance results
        run: |
          node tests/performance/analyze-results.js performance-results.json
          node tests/performance/analyze-results.js db-performance-results.json

      - name: Upload performance artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: performance-results
          path: |
            performance-results.json
            db-performance-results.json
            performance-report.html

  # ============================================================================
  # Stage 5: End-to-End Tests
  # ============================================================================
  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: performance-tests

    strategy:
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Build and start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Wait for services
        run: |
          timeout 120s bash -c 'until curl -f http://localhost:3000/health; do sleep 5; done'

      - name: Run E2E tests
        run: |
          npx playwright test --project=${{ matrix.browser }} --reporter=json,html
        env:
          E2E_BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: test@medianest.com
          TEST_USER_PASSWORD: testpassword123

      - name: Upload E2E test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-results-${{ matrix.browser }}
          path: |
            test-results/
            playwright-report/

      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.test.yml down -v

  # ============================================================================
  # Stage 6: Build and Push Docker Images
  # ============================================================================
  build-images:
    name: Build Docker Images
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ github.repository }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  # ============================================================================
  # Stage 7: Deploy to Staging
  # ============================================================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: build-images
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add your staging deployment logic here
          # Example: kubectl, docker-compose, or API calls

      - name: Run staging smoke tests
        run: |
          npm ci --prefer-offline --no-audit
          npx playwright test tests/smoke/ --config=playwright.staging.config.ts
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}

      - name: Notify deployment success
        if: success()
        run: |
          echo "Staging deployment successful!"
          # Add notification logic (Slack, Teams, etc.)

  # ============================================================================
  # Stage 8: Deploy to Production
  # ============================================================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: build-images
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add your production deployment logic here

      - name: Run production health checks
        run: |
          npm ci --prefer-offline --no-audit
          npx playwright test tests/health/ --config=playwright.production.config.ts
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}

      - name: Notify deployment success
        if: success()
        run: |
          echo "Production deployment successful!"
          # Add notification logic
```

### 2. Specialized Testing Workflows

#### Performance Regression Testing
```yaml
# .github/workflows/performance-regression.yml
name: Performance Regression Testing

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup performance testing environment
        run: |
          docker-compose -f docker-compose.perf.yml up -d
          sleep 30

      - name: Run performance benchmarks
        run: |
          k6 run tests/performance/regression-suite.js \
            --out json=perf-baseline.json \
            --summary-trend-stats="min,med,avg,p(90),p(95),p(99),p(99.9),max"

      - name: Compare with previous baseline
        run: |
          node scripts/compare-performance-baseline.js \
            perf-baseline.json \
            performance-baselines/latest.json

      - name: Update performance baseline
        if: success()
        run: |
          cp perf-baseline.json performance-baselines/$(date +%Y-%m-%d).json
          cp perf-baseline.json performance-baselines/latest.json
          git add performance-baselines/
          git commit -m "Update performance baseline $(date +%Y-%m-%d)"
          git push
```

#### Security Vulnerability Scanning
```yaml
# .github/workflows/security-scan.yml
name: Security Vulnerability Scan

on:
  schedule:
    - cron: '0 1 * * *' # Daily at 1 AM
  push:
    paths:
      - 'package*.json'
      - '**/package*.json'

jobs:
  vulnerability-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Run comprehensive security scan
        run: |
          # NPM Audit
          npm audit --audit-level moderate --json > audit-report.json

          # Snyk vulnerability scan
          npx snyk test --json > snyk-report.json

          # OWASP dependency check
          npx @cyclonedx/cyclonedx-npm > sbom.json

      - name: Security test execution
        run: |
          npm run test:security -- --json --outputFile=security-test-results.json

      - name: Generate security report
        run: |
          node scripts/generate-security-report.js \
            audit-report.json \
            snyk-report.json \
            security-test-results.json

      - name: Upload security artifacts
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            audit-report.json
            snyk-report.json
            security-test-results.json
            security-summary-report.html
```

## Local Development Automation

### 1. Pre-commit Hooks Configuration

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running pre-commit validation..."

# Run linting and type checking
npm run lint:staged
npm run typecheck:staged

# Run relevant unit tests
npm run test:affected -- --passWithNoTests

# Security check for staged files
npx lint-staged

echo "✅ Pre-commit validation passed!"
```

### 2. Pre-push Hooks

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 Running pre-push validation..."

# Run full test suite
npm run test:unit
npm run test:integration:quick

# Performance check
npm run test:performance:quick

echo "✅ Pre-push validation passed!"
```

### 3. Development Testing Scripts

```json
{
  "scripts": {
    "dev:test": "concurrently \"npm run dev\" \"npm run test:watch\"",
    "dev:test:integration": "docker-compose -f docker-compose.dev.yml up -d && npm run test:integration:watch",
    "test:affected": "jest --changedSince=HEAD~1 --passWithNoTests",
    "test:staged": "jest --findRelatedTests $(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(js|jsx|ts|tsx)$' | xargs)",
    "test:quick": "jest --testPathPattern=unit --passWithNoTests --silent",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand --no-cache",
    "test:coverage:watch": "jest --coverage --watchAll",
    "test:integration:quick": "jest --testPathPattern=integration --maxWorkers=2 --testTimeout=60000"
  }
}
```

## Test Data Management Automation

### 1. Automated Test Data Generation

```typescript
// scripts/generate-test-data.ts
import { faker } from '@faker-js/faker';
import { testDb } from '../tests/helpers/database-helper';

interface TestDataConfig {
  users: number;
  mediaFiles: number;
  collections: number;
}

export async function generateTestData(config: TestDataConfig): Promise<void> {
  console.log('🎲 Generating test data...');

  // Generate users
  const users = Array.from({ length: config.users }, () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    role: faker.helpers.arrayElement(['user', 'admin', 'moderator']),
    createdAt: faker.date.past()
  }));

  await testDb('users').insert(users);
  console.log(`✅ Generated ${config.users} users`);

  // Generate media files
  const mediaFiles = Array.from({ length: config.mediaFiles }, () => ({
    id: faker.string.uuid(),
    userId: faker.helpers.arrayElement(users).id,
    filename: faker.system.fileName(),
    size: faker.number.int({ min: 1000, max: 50000000 }),
    mimeType: faker.helpers.arrayElement(['image/jpeg', 'image/png', 'video/mp4']),
    createdAt: faker.date.past()
  }));

  await testDb('media_files').insert(mediaFiles);
  console.log(`✅ Generated ${config.mediaFiles} media files`);

  console.log('🎉 Test data generation complete!');
}

// CLI interface
if (require.main === module) {
  const config: TestDataConfig = {
    users: parseInt(process.env.TEST_USERS ?? '50'),
    mediaFiles: parseInt(process.env.TEST_MEDIA_FILES ?? '200'),
    collections: parseInt(process.env.TEST_COLLECTIONS ?? '25')
  };

  generateTestData(config)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Test data generation failed:', error);
      process.exit(1);
    });
}
```

### 2. Test Database Management

```typescript
// scripts/test-db-manager.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TestDatabaseManager {
  static async setup(): Promise<void> {
    console.log('🏗️  Setting up test databases...');

    try {
      // Create test databases
      await execAsync('createdb medianest_test');
      await execAsync('createdb medianest_integration_test');
      await execAsync('createdb medianest_e2e_test');

      // Run migrations
      await execAsync('npm run db:migrate:test');
      await execAsync('npm run db:migrate:integration');
      await execAsync('npm run db:migrate:e2e');

      console.log('✅ Test databases ready!');
    } catch (error) {
      console.error('❌ Test database setup failed:', error);
      throw error;
    }
  }

  static async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test databases...');

    try {
      await execAsync('dropdb --if-exists medianest_test');
      await execAsync('dropdb --if-exists medianest_integration_test');
      await execAsync('dropdb --if-exists medianest_e2e_test');

      console.log('✅ Test databases cleaned up!');
    } catch (error) {
      console.warn('⚠️  Test database cleanup warning:', error.message);
    }
  }

  static async reset(): Promise<void> {
    await this.cleanup();
    await this.setup();
  }
}
```

## Performance Testing Automation

### 1. Automated Performance Monitoring

```typescript
// tests/performance/performance-monitor.ts
import { PerformanceObserver, performance } from 'perf_hooks';

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export class PerformanceMonitor {
  private metrics: number[] = [];
  private errors: number = 0;
  private requests: number = 0;

  startMonitoring(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.metrics.push(entry.duration);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
  }

  recordRequest(success: boolean, duration: number): void {
    this.requests++;
    if (!success) this.errors++;
    this.metrics.push(duration);
  }

  getMetrics(): PerformanceMetrics {
    const sorted = this.metrics.sort((a, b) => a - b);
    const total = sorted.reduce((sum, val) => sum + val, 0);

    return {
      responseTime: {
        avg: total / sorted.length,
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0,
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99)
      },
      throughput: this.requests / (Date.now() / 1000),
      errorRate: (this.errors / this.requests) * 100,
      resourceUsage: this.getResourceUsage()
    };
  }

  private percentile(arr: number[], p: number): number {
    const index = Math.ceil(arr.length * p) - 1;
    return arr[index] || 0;
  }

  private getResourceUsage() {
    const memUsage = process.memoryUsage();
    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      memory: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      network: 0 // Would need additional monitoring
    };
  }
}
```

### 2. K6 Performance Test Templates

```javascript
// tests/performance/templates/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('request_count');

// Test configuration
export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      tags: { test_type: 'load' }
    },
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 }
      ],
      tags: { test_type: 'spike' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05']
  }
};

// Test data
const testUsers = [
  { email: 'user1@test.com', password: 'password123' },
  { email: 'user2@test.com', password: 'password123' },
  { email: 'user3@test.com', password: 'password123' }
];

export function setup() {
  console.log('🚀 Starting MediaNest API Load Test');
  
  // Warm up the application
  http.get(`${__ENV.BASE_URL}/health`);
  return { baseUrl: __ENV.BASE_URL || 'http://localhost:3000' };
}

export default function(data) {
  const baseUrl = data.baseUrl;
  
  // Simulate user authentication
  const loginResponse = http.post(`${baseUrl}/api/auth/login`, 
    JSON.stringify({
      email: testUsers[Math.floor(Math.random() * testUsers.length)].email,
      password: 'password123'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const success = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1000
  });

  errorRate.add(!success);
  responseTime.add(loginResponse.timings.duration);
  requestCount.add(1);

  if (success && loginResponse.json('token')) {
    const token = loginResponse.json('token');
    
    // Authenticated API calls
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test various endpoints
    const endpoints = [
      '/api/media',
      '/api/collections',
      '/api/user/profile'
    ];

    endpoints.forEach(endpoint => {
      const response = http.get(`${baseUrl}${endpoint}`, { headers });
      
      check(response, {
        [`${endpoint} status is 200`]: (r) => r.status === 200,
        [`${endpoint} response time < 800ms`]: (r) => r.timings.duration < 800
      });

      responseTime.add(response.timings.duration);
      requestCount.add(1);
    });
  }

  sleep(1);
}

export function teardown(data) {
  console.log('🏁 MediaNest API Load Test Complete');
}
```

## Test Result Analysis and Reporting

### 1. Automated Test Report Generation

```typescript
// scripts/generate-test-report.ts
import fs from 'fs/promises';
import path from 'path';

interface TestResults {
  unit: JestResults;
  integration: JestResults;
  e2e: PlaywrightResults;
  performance: K6Results;
  security: SecurityResults;
}

interface JestResults {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

export class TestReportGenerator {
  async generateComprehensiveReport(results: TestResults): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(results),
      details: results,
      recommendations: this.generateRecommendations(results),
      trends: await this.analyzeTrends()
    };

    const html = this.generateHTMLReport(report);
    const json = JSON.stringify(report, null, 2);

    await fs.writeFile('test-reports/comprehensive-report.html', html);
    await fs.writeFile('test-reports/comprehensive-report.json', json);

    console.log('📊 Comprehensive test report generated!');
  }

  private generateSummary(results: TestResults) {
    const totalTests = results.unit.numTotalTests + 
                      results.integration.numTotalTests + 
                      results.e2e.totalTests;
    
    const totalPassed = results.unit.numPassedTests + 
                       results.integration.numPassedTests + 
                       results.e2e.passedTests;

    return {
      overallSuccessRate: (totalPassed / totalTests) * 100,
      coverageAverage: this.calculateAverageCoverage(results),
      performanceScore: this.calculatePerformanceScore(results.performance),
      securityScore: this.calculateSecurityScore(results.security),
      qualityGateStatus: this.evaluateQualityGates(results)
    };
  }

  private generateRecommendations(results: TestResults): string[] {
    const recommendations: string[] = [];

    // Coverage recommendations
    if (results.unit.coverage.lines < 90) {
      recommendations.push('Increase unit test coverage to meet 90% threshold');
    }

    // Performance recommendations
    if (results.performance.averageResponseTime > 500) {
      recommendations.push('Optimize API response times - current average exceeds 500ms');
    }

    // Security recommendations
    if (results.security.vulnerabilities.high > 0) {
      recommendations.push('Address high-severity security vulnerabilities immediately');
    }

    return recommendations;
  }

  private generateHTMLReport(report: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>MediaNest Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
            .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 3px; }
            .pass { color: green; } .fail { color: red; } .warn { color: orange; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>MediaNest Test Report</h1>
        <div class="summary">
            <h2>Summary</h2>
            <div class="metric">
                <strong>Success Rate:</strong> 
                <span class="${report.summary.overallSuccessRate > 95 ? 'pass' : 'fail'}">
                    ${report.summary.overallSuccessRate.toFixed(1)}%
                </span>
            </div>
            <div class="metric">
                <strong>Coverage:</strong> 
                <span class="${report.summary.coverageAverage > 90 ? 'pass' : 'warn'}">
                    ${report.summary.coverageAverage.toFixed(1)}%
                </span>
            </div>
            <div class="metric">
                <strong>Quality Gate:</strong> 
                <span class="${report.summary.qualityGateStatus === 'PASS' ? 'pass' : 'fail'}">
                    ${report.summary.qualityGateStatus}
                </span>
            </div>
        </div>
        
        <h2>Detailed Results</h2>
        ${this.generateDetailedResultsHTML(report.details)}
        
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
        
        <p><em>Generated on ${report.timestamp}</em></p>
    </body>
    </html>`;
  }
}
```

## Monitoring and Alerting

### 1. Test Failure Notifications

```typescript
// scripts/test-notifications.ts
import { WebhookClient } from '@slack/webhook';

interface NotificationConfig {
  slack?: {
    webhook: string;
    channel: string;
  };
  email?: {
    recipients: string[];
    smtp: any;
  };
}

export class TestNotificationService {
  constructor(private config: NotificationConfig) {}

  async notifyTestFailure(testResults: any): Promise<void> {
    const message = this.formatFailureMessage(testResults);

    if (this.config.slack) {
      await this.sendSlackNotification(message);
    }

    if (this.config.email) {
      await this.sendEmailNotification(message);
    }
  }

  private formatFailureMessage(results: any): string {
    return `
🚨 *MediaNest Test Failure Alert*

*Branch:* ${process.env.GITHUB_REF}
*Commit:* ${process.env.GITHUB_SHA?.substring(0, 7)}
*Workflow:* ${process.env.GITHUB_WORKFLOW}

*Failed Tests:*
${results.failures.map((f: any) => `• ${f.title}: ${f.message}`).join('\n')}

*View Details:* ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}
    `;
  }

  private async sendSlackNotification(message: string): Promise<void> {
    const webhook = new WebhookClient(this.config.slack!.webhook);
    
    await webhook.send({
      text: message,
      channel: this.config.slack!.channel,
      username: 'MediaNest CI/CD',
      icon_emoji: ':warning:'
    });
  }
}
```

## Quality Gates Implementation

### 1. Quality Gate Configuration

```typescript
// scripts/quality-gates.ts
interface QualityGateConfig {
  unitTests: {
    coverage: { minimum: number };
    passRate: { minimum: number };
  };
  integrationTests: {
    coverage: { minimum: number };
    passRate: { minimum: number };
  };
  e2eTests: {
    passRate: { minimum: number };
    maxDuration: { maximum: number };
  };
  performance: {
    responseTime: { maximum: number };
    throughput: { minimum: number };
    errorRate: { maximum: number };
  };
  security: {
    vulnerabilities: {
      critical: { maximum: number };
      high: { maximum: number };
    };
  };
}

export class QualityGateEvaluator {
  private config: QualityGateConfig = {
    unitTests: {
      coverage: { minimum: 90 },
      passRate: { minimum: 100 }
    },
    integrationTests: {
      coverage: { minimum: 85 },
      passRate: { minimum: 95 }
    },
    e2eTests: {
      passRate: { minimum: 90 },
      maxDuration: { maximum: 900000 } // 15 minutes
    },
    performance: {
      responseTime: { maximum: 1000 }, // 1 second
      throughput: { minimum: 100 }, // 100 req/s
      errorRate: { maximum: 5 } // 5%
    },
    security: {
      vulnerabilities: {
        critical: { maximum: 0 },
        high: { maximum: 0 }
      }
    }
  };

  evaluate(testResults: any): QualityGateResult {
    const checks = [
      this.checkUnitTests(testResults.unit),
      this.checkIntegrationTests(testResults.integration),
      this.checkE2ETests(testResults.e2e),
      this.checkPerformance(testResults.performance),
      this.checkSecurity(testResults.security)
    ];

    const passed = checks.every(check => check.passed);
    const failures = checks.filter(check => !check.passed);

    return {
      passed,
      checks,
      failures,
      summary: this.generateSummary(passed, failures)
    };
  }

  private checkUnitTests(results: any): QualityCheck {
    const coveragePassed = results.coverage.lines >= this.config.unitTests.coverage.minimum;
    const passRatePassed = (results.numPassedTests / results.numTotalTests) * 100 >= this.config.unitTests.passRate.minimum;

    return {
      name: 'Unit Tests',
      passed: coveragePassed && passRatePassed,
      details: {
        coverage: `${results.coverage.lines}% (min: ${this.config.unitTests.coverage.minimum}%)`,
        passRate: `${((results.numPassedTests / results.numTotalTests) * 100).toFixed(1)}% (min: ${this.config.unitTests.passRate.minimum}%)`
      }
    };
  }
}

interface QualityCheck {
  name: string;
  passed: boolean;
  details: Record<string, string>;
}

interface QualityGateResult {
  passed: boolean;
  checks: QualityCheck[];
  failures: QualityCheck[];
  summary: string;
}
```

## Conclusion

This comprehensive automated testing framework provides MediaNest with:

1. **Complete CI/CD Pipeline**: From code commit to production deployment with automated quality gates
2. **Multi-layered Testing**: Unit, integration, E2E, performance, and security testing
3. **Quality Assurance**: Automated quality gates preventing poor quality code from reaching production
4. **Performance Monitoring**: Continuous performance validation and regression detection
5. **Security Integration**: Automated vulnerability scanning and security testing
6. **Comprehensive Reporting**: Detailed test reports with actionable insights and recommendations

The framework ensures high-quality software delivery while maintaining rapid development velocity through automation and early feedback mechanisms.