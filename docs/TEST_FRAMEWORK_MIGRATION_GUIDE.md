# Test Framework Migration Guide
**MediaNest Test Framework Modernization**

## 🎯 Overview
This guide provides step-by-step instructions for migrating from the current chaotic test framework setup to a consolidated, modern testing architecture.

## 🔄 Phase 1: Jest Elimination (CRITICAL)

### Step 1: Create New Vitest Integration Configuration
Replace `/backend/tests/integration/jest.config.integration.js` with:

```typescript
// backend/tests/integration/vitest.config.integration.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'integration-tests',
    environment: 'node',
    setupFiles: ['./setup/vitest-integration-setup.ts'],
    globals: true,
    
    // Integration test optimizations
    testTimeout: 30000,  // 30 seconds for database operations
    hookTimeout: 10000,  // 10 seconds for setup/teardown
    threads: false,      // Sequential execution for database tests
    isolate: true,       // Isolate tests for clean database state
    
    // File patterns
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.spec.ts'
    ],
    
    // Environment variables
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_integration_test',
      REDIS_URL: 'redis://localhost:6380/1',
      JWT_SECRET: 'integration-test-jwt-secret',
      LOG_LEVEL: 'error',
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-reports/integration/coverage',
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 75,
        statements: 75
      }
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '..')
    }
  }
});
```

### Step 2: Convert Jest Setup to Vitest
Create `/backend/tests/integration/setup/vitest-integration-setup.ts`:

```typescript
// backend/tests/integration/setup/vitest-integration-setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Global test database setup
beforeAll(async () => {
  // Start test containers
  execSync('docker compose -f docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  
  // Run migrations
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_integration_test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  // Wait for services to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  // Cleanup test containers
  execSync('docker compose -f docker-compose.test.yml down -v', { stdio: 'inherit' });
});

// Individual test cleanup
beforeEach(async () => {
  // Clean database state between tests
  // Implementation depends on your database setup
});

afterEach(async () => {
  // Additional cleanup if needed
});
```

### Step 3: Update Package.json Scripts
Replace Jest integration scripts:

```json
{
  "scripts": {
    // OLD - Remove these
    // "test:integration": "npm run test:setup && npm test && npm run test:teardown",
    
    // NEW - Replace with these
    "test:integration": "vitest run --config tests/integration/vitest.config.integration.ts",
    "test:integration:watch": "vitest --config tests/integration/vitest.config.integration.ts",
    "test:integration:ui": "vitest --ui --config tests/integration/vitest.config.integration.ts"
  }
}
```

### Step 4: Remove Jest Dependencies
Update `package.json` to remove:

```json
// Remove these dependencies:
{
  "devDependencies": {
    // Remove all jest-related packages
    "@types/jest": "^29.5.0",
    "jest": "*",
    "ts-jest": "*",
    "jest-html-reporters": "*",
    "jest-junit": "*"
  }
}
```

## 🔄 Phase 2: E2E Framework Consolidation

### Option A: Choose Playwright (RECOMMENDED)

#### Benefits:
- Better performance and reliability
- Superior TypeScript support
- More comprehensive browser coverage
- Better CI/CD integration

#### Migration Steps:

1. **Audit Cypress Tests**
   ```bash
   find ./tests -name "*.cy.ts" -o -name "*.cy.js" | xargs wc -l
   ```

2. **Create Playwright Migration Map**
   ```typescript
   // Cypress → Playwright Command Mapping
   
   // Navigation
   cy.visit('/') → await page.goto('/')
   cy.go('back') → await page.goBack()
   
   // Element interaction
   cy.get('[data-cy="button"]') → page.locator('[data-cy="button"]')
   cy.click() → await element.click()
   cy.type('text') → await element.fill('text')
   
   // Assertions
   cy.should('be.visible') → await expect(element).toBeVisible()
   cy.should('contain', 'text') → await expect(element).toContainText('text')
   
   // Network
   cy.intercept() → await page.route()
   cy.wait('@alias') → await page.waitForResponse()
   ```

3. **Consolidated Playwright Configuration**
   ```typescript
   // playwright.config.ts (single config)
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 4 : undefined,
     
     reporter: [
       ['html', { outputFolder: 'test-results/playwright' }],
       ['junit', { outputFile: 'test-results/playwright-results.xml' }],
       ['allure-playwright']
     ],
     
     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
       video: 'retain-on-failure'
     },
     
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] }},
       { name: 'firefox', use: { ...devices['Desktop Firefox'] }},
       { name: 'webkit', use: { ...devices['Desktop Safari'] }},
       { name: 'mobile', use: { ...devices['Pixel 5'] }},
     ],
     
     webServer: {
       command: 'npm run dev',
       port: 3000,
       reuseExistingServer: !process.env.CI
     }
   });
   ```

### Option B: Keep Cypress (If team prefers)

#### Consolidation Steps:
1. Remove duplicate Playwright configurations
2. Standardize on single Cypress config
3. Optimize Cypress configuration for performance

## 🔄 Phase 3: Configuration Consolidation

### Target Structure:
```
vitest.config.ts              # Root workspace config
backend/vitest.config.ts       # Backend API tests  
frontend/vitest.config.ts      # React component tests
shared/vitest.config.ts        # Utility function tests (optional)
playwright.config.ts           # E2E tests (single config)
```

### Root Workspace Configuration:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global settings
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/global-setup.ts']
  },
  
  // Workspace configuration
  workspace: [
    './backend',
    './frontend', 
    './shared'
  ]
});
```

## 🧪 Testing Strategy

### Test Categories:
1. **Unit Tests** (Vitest) - Fast, isolated function testing
2. **Integration Tests** (Vitest) - API endpoints, database operations
3. **Component Tests** (Vitest + @testing-library) - React components
4. **E2E Tests** (Playwright) - Full user workflows

### Performance Targets:
- **Unit Tests:** < 30 seconds
- **Integration Tests:** < 2 minutes  
- **Component Tests:** < 1 minute
- **E2E Tests:** < 10 minutes

## 📋 Migration Checklist

### Phase 1 - Jest Elimination ✅
- [ ] Create Vitest integration config
- [ ] Migrate Jest setup files
- [ ] Update package.json scripts
- [ ] Remove Jest dependencies
- [ ] Test integration suite passes
- [ ] Update CI/CD pipeline

### Phase 2 - E2E Consolidation ✅
- [ ] Choose Playwright vs Cypress
- [ ] Audit existing E2E test coverage
- [ ] Migrate critical tests to chosen framework
- [ ] Remove unused E2E framework
- [ ] Verify test coverage maintained

### Phase 3 - Config Consolidation ✅
- [ ] Design workspace structure
- [ ] Consolidate Vitest configurations
- [ ] Update package.json scripts
- [ ] Remove redundant config files
- [ ] Update documentation

## 🚨 Common Migration Issues

### Jest → Vitest Issues:
1. **Global teardown** - Use afterAll() instead of globalTeardown
2. **Custom matchers** - Use expect.extend() in setup files
3. **Module mocking** - Use vi.mock() instead of jest.mock()

### Cypress → Playwright Issues:
1. **Element waiting** - Playwright auto-waits, remove manual waits
2. **Custom commands** - Convert to Playwright fixtures
3. **Network stubbing** - Use route() instead of intercept()

## 🎉 Success Validation

### Automated Checks:
```bash
# Verify no Jest references remain
grep -r "jest" --include="*.json" --include="*.js" --include="*.ts" . | grep -v node_modules

# Verify all tests pass
npm run test:all

# Check dependency count reduction
npm list --depth=0 | grep -E "(jest|vitest|playwright|cypress)"
```

### Manual Validation:
1. All existing test coverage maintained
2. CI/CD pipeline runs successfully
3. Test execution time improved
4. Developer experience enhanced

---

**Implementation Priority:** Start with Phase 1 (Jest Elimination) as it resolves the most critical conflicts.