# MediaNest E2E Page Object Models

A comprehensive set of Page Object Models (POMs) for MediaNest application testing, built with Playwright and designed for HIVE-MIND coordination patterns.

## 🏗️ Architecture

### Base Structure

```
.medianest-e2e/
├── pages/
│   ├── auth/           # Authentication pages
│   ├── plex/           # Plex-related pages
│   ├── media/          # Media management pages
│   ├── BasePage.ts     # Base class with shared functionality
│   └── index.ts        # Centralized exports
├── types/
│   └── index.ts        # TypeScript type definitions
└── README.md
```

## 📄 Available Page Objects

### Core Pages

#### `BasePage`

Base class providing shared functionality:

- Common selectors and wait strategies
- Error handling and accessibility helpers
- Performance monitoring utilities
- Screenshot and debugging capabilities

#### Authentication Pages

- **`SignInPage`** - Handles Plex auth and admin setup
- **`ChangePasswordPage`** - Password change workflows

#### Dashboard

- **`DashboardPage`** - Service status cards and quick actions

#### Plex Integration

- **`PlexBrowserPage`** - Library browsing and media selection
- **`PlexSearchPage`** - Advanced search with filters
- **`PlexCollectionsPage`** - Collection management

#### Media Management

- **`MediaRequestPage`** - Request submission and validation
- **`RequestsListPage`** - Request status monitoring and management

#### YouTube Downloader

- **`YouTubeDownloaderPage`** - Download queue and settings

## 🚀 Usage Examples

### Basic Usage

```typescript
import { SignInPage, DashboardPage } from '.medianest-e2e/pages';
import { test, expect } from '@playwright/test';

test('User login workflow', async ({ page }) => {
  const signIn = new SignInPage(page);
  const dashboard = new DashboardPage(page);

  await signIn.navigate();
  await signIn.adminLogin('admin', 'password');
  await dashboard.verifyPageElements();
});
```

### Using Page Factory

```typescript
import { createPageFactory } from '.medianest-e2e/pages';

test('Complete workflow with factory', async ({ page }) => {
  const { pages, workflows } = createPageFactory(page);

  // Authenticate user
  await workflows.authenticateUser();

  // Browse Plex library
  await workflows.browsePlexLibrary('Movies');

  // Request media
  const requestId = await workflows.requestMedia('Matrix', 'The Matrix');

  // Verify request in list
  await pages.requestsList.navigate();
  const requests = await pages.requestsList.getRequests();
  expect(requests.some((r) => r.id === requestId)).toBe(true);
});
```

### Advanced Search Example

```typescript
test('Advanced Plex search', async ({ page }) => {
  const plexSearch = new PlexSearchPage(page);

  await plexSearch.navigate();
  await plexSearch.applyAdvancedSearch({
    contentType: 'movies',
    genre: 'Action',
    yearFrom: 2020,
    yearTo: 2023,
    ratingMin: 7.0,
  });

  const results = await plexSearch.getSearchResults();
  expect(results.length).toBeGreaterThan(0);
});
```

## 🔧 Key Features

### Robust Wait Strategies

- Automatic loading state detection
- Network idle waiting
- Element visibility verification
- Retry logic for flaky elements

### Error Handling

```typescript
// Built-in error checking
const error = await signInPage.getAuthenticationError();
if (error) {
  console.log(`Authentication failed: ${error}`);
}

// Accessibility validation
await dashboardPage.verifyAccessibility();
```

### Performance Monitoring

```typescript
// Measure page load performance
const loadTime = await plexBrowserPage.measurePageLoadTime();
console.log(`Page loaded in ${loadTime}ms`);

// Monitor service load times
const metrics = await dashboardPage.measureServiceLoadTimes();
```

### Accessibility Testing

```typescript
// Comprehensive accessibility checks
await signInPage.testAccessibility();

// Keyboard navigation testing
await plexBrowserPage.testKeyboardNavigation();
```

## 🎯 Selector Strategy

### Data-testid Pattern

```typescript
// Primary selector strategy
private readonly selectors = {
  submitButton: '[data-testid="submit-button"]',
  errorMessage: '[data-testid="error-message"]',
  loadingSpinner: '[data-testid="loading-spinner"]'
};
```

### Fallback Selectors

```typescript
// Semantic fallbacks when data-testid unavailable
pageTitle: 'h1:has-text("Dashboard")',
submitButton: '[type="submit"]',
closeButton: '[aria-label="Close"]'
```

## 🧪 Testing Patterns

### Complete Workflows

```typescript
test('End-to-end media request', async ({ page }) => {
  const { workflows } = createPageFactory(page);

  // Authenticate
  await workflows.authenticateUser();

  // Request media
  const requestId = await workflows.requestMedia('Inception', 'Inception', {
    quality: '4K',
    priority: 'high',
  });

  // Verify system health
  const isHealthy = await workflows.verifySystemHealth();
  expect(isHealthy).toBe(true);
});
```

### Error Scenarios

```typescript
test('Handle authentication errors', async ({ page }) => {
  const signIn = new SignInPage(page);

  await signIn.navigate();
  await signIn.adminLogin('admin', 'wrongpassword');

  const error = await signIn.getAuthenticationError();
  expect(error).toContain('Invalid credentials');
});
```

### Service Integration Testing

```typescript
test('Verify all services operational', async ({ page }) => {
  const dashboard = new DashboardPage(page);

  await dashboard.navigate();
  const statuses = await dashboard.getAllServiceStatuses();

  expect(statuses.plex).toBe('online');
  expect(statuses.overseerr).toBe('online');
  expect(statuses.uptimeKuma).toBe('online');
});
```

## 🔄 HIVE-MIND Integration

### Coordination Hooks

Each page object supports HIVE-MIND coordination:

```typescript
// Example coordination pattern
await page.evaluate(() => {
  window.postMessage(
    {
      type: 'hive-sync',
      action: 'page-loaded',
      data: { page: 'dashboard', timestamp: Date.now() },
    },
    '*',
  );
});
```

### Shared State Management

```typescript
// Cross-page state sharing
const mediaTitle = await plexBrowser.getSelectedMediaTitle();
await mediaRequest.submitUrl(mediaTitle);
```

## 📊 Type Safety

Comprehensive TypeScript definitions:

```typescript
interface MediaRequest {
  id: string;
  title: string;
  type: RequestType;
  status: RequestStatus;
  priority: RequestPriority;
  // ... additional properties
}
```

## 🐛 Debugging

### Screenshot Capture

```typescript
// Automatic screenshot on failure
await pageObject.takeScreenshot('error-state');
```

### Performance Debugging

```typescript
// Monitor network requests
const response = await pageObject.waitForApiResponse('/api/media');
console.log('API response time:', response.timing);
```

## 📈 Best Practices

1. **Always use data-testid selectors** for reliable element targeting
2. **Implement proper wait strategies** to handle async operations
3. **Include accessibility checks** in critical user flows
4. **Handle error states gracefully** with meaningful feedback
5. **Use page factory pattern** for complex test scenarios
6. **Implement retry logic** for flaky operations
7. **Monitor performance metrics** during test execution

## 🔧 Configuration

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### Environment Setup

```bash
# Install dependencies
npm install @playwright/test

# Setup browsers
npx playwright install

# Run tests
npx playwright test
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Page Object Model Best Practices](https://playwright.dev/docs/pom)
- [HIVE-MIND Coordination Patterns](../docs/hive-mind-patterns.md)
- [Accessibility Testing Guide](../docs/accessibility-testing.md)

---

This POM framework provides a robust foundation for MediaNest E2E testing with built-in reliability, accessibility, and performance monitoring capabilities.
