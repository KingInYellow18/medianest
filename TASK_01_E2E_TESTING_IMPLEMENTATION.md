# Task 01: E2E Testing Implementation

**Priority:** 🔥 Critical  
**Effort:** 2-3 days  
**Dependencies:** Playwright infrastructure (already exists)  
**Status:** Not Started  

## Overview

Implement end-to-end testing using Playwright to validate complete user journeys. The E2E infrastructure exists but no actual tests have been implemented. This is a critical gap identified in the test suite audit.

## Scope

### ✅ What Already Exists
- Playwright dependency installed (`@playwright/test": "^1.41.0`)
- Basic directory structure (`tests/e2e/`)
- Infrastructure setup ready

### ❌ What's Missing (This Task)
- Playwright configuration file
- Core E2E test scenarios
- CI/CD integration
- Page object models

## Implementation Plan

### Phase 1: Setup (4 hours)
1. **Create Playwright Configuration**
   ```typescript
   // playwright.config.ts
   import { defineConfig } from '@playwright/test'
   
   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: [
       ['html'],
       ['junit', { outputFile: 'test-results/e2e-results.xml' }]
     ],
     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure'
     },
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
     ],
     webServer: {
       command: 'npm run dev',
       port: 3000,
       reuseExistingServer: !process.env.CI
     }
   })
   ```

2. **Create Test Helper Utilities**
   ```typescript
   // tests/e2e/helpers/auth.ts
   export class AuthHelper {
     async loginWithPlex(page: Page, pinCode: string) {
       // Implementation for Plex OAuth flow
     }
   }
   ```

### Phase 2: Critical User Journeys (8 hours)
1. **Authentication Flow Test**
   - User can access login page
   - Plex OAuth PIN flow works end-to-end
   - Successful login redirects to dashboard
   - Invalid PIN shows appropriate error

2. **Media Request Flow Test**  
   - User can search for media
   - Request submission works
   - Request appears in user's queue
   - Status updates reflect correctly

3. **Service Status Monitoring Test**
   - Dashboard shows service status
   - Real-time updates work via WebSocket
   - Service outage gracefully handled

### Phase 3: Page Object Models (4 hours)
```typescript
// tests/e2e/pages/DashboardPage.ts
export class DashboardPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/dashboard')
  }
  
  async getServiceStatus(serviceName: string) {
    return await this.page.locator(`[data-testid="${serviceName}-status"]`).textContent()
  }
}
```

### Phase 4: CI/CD Integration (2 hours)
- Update GitHub Actions workflow
- Add E2E test step after unit/integration tests
- Ensure proper environment setup

## Test Scenarios to Implement

### 1. Authentication Flow (High Priority)
```typescript
test('complete Plex OAuth flow', async ({ page }) => {
  await page.goto('/auth/login')
  await page.click('[data-testid="plex-login-button"]')
  // Mock Plex PIN flow
  await page.fill('[data-testid="pin-input"]', '1234')
  await page.click('[data-testid="verify-pin"]')
  await expect(page).toHaveURL('/dashboard')
})
```

### 2. Media Request Flow (High Priority)
```typescript
test('user can request new media', async ({ page }) => {
  // Login first
  await loginHelper.loginWithPlex(page, '1234')
  
  // Navigate to search
  await page.click('[data-testid="media-search-nav"]')
  await page.fill('[data-testid="search-input"]', 'The Matrix')
  await page.click('[data-testid="search-button"]')
  
  // Submit request
  await page.click('[data-testid="request-button-603"]')
  await page.click('[data-testid="confirm-request"]')
  
  // Verify success
  await expect(page.locator('[data-testid="success-message"]'))
    .toContainText('Request submitted successfully')
})
```

### 3. Service Status Monitoring (Medium Priority)
```typescript
test('real-time service status updates', async ({ page }) => {
  await page.goto('/dashboard')
  
  // Initial status
  await expect(page.locator('[data-testid="plex-status"]'))
    .toHaveClass(/status-up/)
  
  // Simulate status change via WebSocket
  await page.evaluate(() => {
    window.socket.emit('service:status', {
      service: 'plex',
      status: 'down',
      timestamp: Date.now()
    })
  })
  
  // Verify update
  await expect(page.locator('[data-testid="plex-status"]'))
    .toHaveClass(/status-down/)
})
```

## Acceptance Criteria

### ✅ Done When:
- [ ] Playwright configuration created and working
- [ ] 3-5 critical user journeys have E2E tests
- [ ] Tests pass consistently (non-flaky)
- [ ] CI/CD pipeline includes E2E tests
- [ ] Page object models implemented for reusability
- [ ] Tests run in under 5 minutes total

### ✅ Quality Gates:
- All E2E tests must pass 100% consistently
- Tests must use data-testid attributes (not CSS selectors)
- Clear error messages when tests fail
- Screenshots captured on failure

## Dependencies

### Technical Dependencies:
- Frontend application must be running (port 3000)
- Backend application must be running (port 4000)
- Test databases available (PostgreSQL:5433, Redis:6380)

### Testing Dependencies:
- MSW mocking for external APIs
- Data-testid attributes in components (may need to add)
- Stable test environment

## Risk Mitigation

### Potential Issues:
1. **Flaky Tests**: Use proper waits and stable selectors
2. **Slow Execution**: Keep tests focused and minimal
3. **Environment Setup**: Ensure consistent test environment

### Mitigation Strategies:
- Use Playwright's auto-waiting features
- Implement retry logic for network-dependent tests
- Mock external services properly
- Use docker-compose for consistent environment

## Success Metrics

- **Coverage**: 3-5 critical user flows covered
- **Reliability**: 100% pass rate over 10 consecutive runs
- **Speed**: Total E2E suite completes in <5 minutes
- **Value**: Catches integration issues unit tests can't

## Next Steps After Completion

1. Expand E2E coverage based on usage patterns
2. Add visual regression testing if needed
3. Consider mobile browser testing
4. Integrate with monitoring/alerting

---

**Estimated Total Effort: 18-20 hours (2-3 days)**  
**Assigned To:** _TBD_  
**Start Date:** _TBD_  
**Target Completion:** _TBD_