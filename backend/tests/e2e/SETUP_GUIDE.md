# E2E Testing Setup Guide

This guide walks you through setting up and running the comprehensive Playwright E2E testing suite.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm ci

# Install Playwright browsers
npm run e2e:install
# or
npx playwright install
```

### 2. Start Test Services

```bash
# Start Docker services for E2E testing
npm run e2e:setup
# or
docker-compose -f docker-compose.e2e.yml up -d
```

### 3. Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run in headed mode (show browser)
npm run test:e2e:headed
```

## 📋 Available Scripts

### Test Execution

- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:ui` - Run with Playwright UI
- `npm run test:e2e:debug` - Run in debug mode
- `npm run test:e2e:headed` - Run with visible browser
- `npm run test:e2e:ci` - Run with CI reporters

### Environment Management

- `npm run e2e:install` - Install Playwright browsers
- `npm run e2e:setup` - Start Docker test services
- `npm run e2e:teardown` - Stop and clean Docker services
- `npm run e2e:seed` - Seed test database
- `npm run e2e:cleanup` - Clean test data

### Reporting

- `npm run e2e:reports` - Open HTML test report
- `npm run e2e:allure` - Generate Allure report
- `npm run lighthouse` - Run Lighthouse performance tests

### Utility Scripts

- `./tests/e2e/scripts/run-e2e.sh` - Advanced test runner with options
- `./tests/e2e/scripts/debug-failed-tests.sh` - Debug failed test analysis

## 🐳 Docker Services

The E2E setup includes several Docker services:

| Service        | Port  | Purpose                |
| -------------- | ----- | ---------------------- |
| PostgreSQL     | 5434  | Test database          |
| Redis          | 6381  | Test cache             |
| Plex Mock      | 32400 | Mock Plex server       |
| Overseerr Mock | 5055  | Mock Overseerr service |
| Application    | 3001  | App under test         |

## 🧪 Test Categories

### Functional Tests

- **Authentication**: Login/logout flows, Plex OAuth
- **Media Management**: Request creation, approval workflows
- **Admin Features**: User management, system settings
- **API Integration**: REST endpoint testing

### Non-Functional Tests

- **Performance**: Core Web Vitals, load times
- **Security**: XSS protection, CSRF validation, rate limiting
- **Accessibility**: WCAG compliance, keyboard navigation
- **Responsiveness**: Mobile and desktop layouts

### Browser Matrix

- **Chromium**: Desktop + Mobile
- **Firefox**: Desktop only
- **WebKit/Safari**: Desktop + Mobile

## 📊 Reporting Features

### HTML Reports

- Interactive test results
- Screenshots on failure
- Video recordings
- Test timeline and duration

### Performance Monitoring

- Lighthouse CI integration
- Core Web Vitals tracking
- Performance regression detection
- Resource loading analysis

### CI/CD Integration

- JUnit XML output
- GitHub Actions integration
- Parallel test execution (4 shards per browser)
- Artifact collection

## 🔧 Configuration Files

| File                                  | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `playwright.config.ts`                | Main Playwright configuration |
| `docker-compose.e2e.yml`              | Test services orchestration   |
| `.env.e2e`                            | E2E environment variables     |
| `lighthouserc.js`                     | Performance testing config    |
| `tests/e2e/config/global-setup.ts`    | Test environment setup        |
| `tests/e2e/config/global-teardown.ts` | Test cleanup                  |

## 🎯 Page Object Pattern

Tests use the Page Object Model for maintainability:

```typescript
// Example: LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(username: string, password: string) {
    await this.page.getByTestId('username-input').fill(username);
    await this.page.getByTestId('password-input').fill(password);
    await this.page.getByTestId('login-button').click();
  }
}
```

## 📱 Writing New Tests

### 1. Create Test File

```bash
# Create new test spec
touch tests/e2e/specs/feature/new-feature.spec.ts
```

### 2. Use Page Objects

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';

test('should test new feature', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAsTestUser();

  // Test implementation
});
```

### 3. Follow Naming Conventions

- Use descriptive test names: `should allow admin to approve media request`
- Group related tests: `test.describe('Media Requests', () => {})`
- Use `data-testid` attributes for element selection

## 🔍 Debugging Failed Tests

### Quick Debug Commands

```bash
# Debug specific test
npx playwright test --debug tests/e2e/specs/auth/login.spec.ts

# Run failed tests analysis
./tests/e2e/scripts/debug-failed-tests.sh --verbose

# View trace files
npx playwright show-trace tests/e2e/test-results/*/trace.zip
```

### Common Issues & Solutions

**Timeout Errors**

- Increase timeout values in `playwright.config.ts`
- Add explicit waits: `await page.waitForSelector('[data-testid="element"]')`

**Element Not Found**

- Verify `data-testid` attributes exist in components
- Check element visibility: `await expect(element).toBeVisible()`

**Database Issues**

- Restart services: `npm run e2e:teardown && npm run e2e:setup`
- Re-seed data: `npm run e2e:seed`

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

The E2E tests run automatically on:

- Pull requests to `main`/`develop`
- Pushes to `main` branch
- Manual workflow dispatch

### Pipeline Features

- **Parallel Execution**: 4 shards × 3 browsers = 12 concurrent jobs
- **Service Health Checks**: Database and Redis readiness
- **Artifact Collection**: Screenshots, videos, reports
- **Performance Testing**: Lighthouse CI integration
- **Security Scanning**: npm audit checks

### Environment Variables Required

```env
DATABASE_URL=postgresql://e2e_user:e2e_password@localhost:5434/medianest_e2e
REDIS_URL=redis://localhost:6381
JWT_SECRET=e2e-jwt-secret-key-for-testing
ENCRYPTION_KEY=e2e-encryption-key-32-chars-long
PLEX_CLIENT_ID=e2e-test-client-id
PLEX_CLIENT_SECRET=e2e-test-client-secret
```

## 📚 Resources

- **Playwright Docs**: https://playwright.dev/docs
- **Testing Best Practices**: https://playwright.dev/docs/best-practices
- **Debugging Guide**: https://playwright.dev/docs/debug
- **CI/CD Integration**: https://playwright.dev/docs/ci

## ⚠️ Troubleshooting

### Services Won't Start

1. Check Docker is running
2. Verify ports 5434, 6381, 32400, 5055 are available
3. Run `docker-compose -f docker-compose.e2e.yml logs` for error details

### Tests Fail in CI but Pass Locally

1. Check environment variables match
2. Verify service startup timing
3. Review browser compatibility

### Memory Issues

1. Reduce parallel workers: `--workers=2`
2. Use `--project=chromium` to test single browser
3. Increase Docker memory limits

---

## 🎉 Getting Help

- **Documentation Issues**: Check this README and inline comments
- **Test Failures**: Use the debug script and review artifacts
- **New Features**: Follow the page object pattern and existing examples
- **Performance Issues**: Review Lighthouse reports and Core Web Vitals

Happy Testing! 🧪
