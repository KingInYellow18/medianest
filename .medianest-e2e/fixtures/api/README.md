# MediaNest API Mocking Framework

A comprehensive API mocking and edge case testing framework with HIVE-MIND coordination for the MediaNest project.

## 🚀 Features

- **Comprehensive API Endpoint Mocking**: Complete coverage of all MediaNest API routes
- **Edge Case Scenario Simulation**: Advanced failure simulation and stress testing
- **HIVE-MIND Coordination**: Intelligent state sharing and coordination between test agents
- **Performance Testing**: Load testing under various conditions with detailed metrics
- **Service Integration Mocking**: Plex, Overseerr, and UptimeKuma service simulation
- **Real-time Data Generation**: Realistic test fixtures and seed data
- **Seamless Playwright Integration**: Direct integration with existing Page Object Models
- **Intelligent Failure Selection**: AI-driven scenario selection based on historical patterns

## 📦 Installation & Setup

```typescript
import { setupApiTesting, DEFAULT_SCENARIOS, SCENARIO_GROUPS } from '../fixtures/api';

// Basic setup in your test
const mockIntegration = await setupApiTesting(page, {
  scenarios: SCENARIO_GROUPS.NETWORK_ISSUES,
  performanceTesting: true,
  edgeCaseTesting: true,
});
```

## 🎯 Quick Start

### 1. Basic API Mocking

```typescript
import { createMockServer } from '../fixtures/api';

// Create and start mock server
const mockServer = createMockServer({
  mode: 'testing',
  baseUrl: 'http://localhost:3001',
  enableHiveMind: true,
  scenarios: ['network.timeout', 'server.internal-error'],
});

await mockServer.start();
```

### 2. Enhanced Page Objects

```typescript
import { EnhancedPageBase } from '../fixtures/api';

class LoginPage extends EnhancedPageBase {
  constructor(page: Page) {
    super(page, {
      enableMocking: true,
      scenarios: ['auth.token-expired', 'auth.invalid-credentials'],
      performanceMonitoring: true,
    });
  }

  async login(email: string, password: string) {
    await this.initializeApiTesting();

    // Fill login form with API validation
    await this.fillFormWithApiValidation(
      { email, password },
      {
        submitButton: this.page.locator('[data-testid="login-submit"]'),
        validationEndpoint: '/api/v1/auth/login',
      },
    );

    // Wait for authentication response
    await this.waitForApiResponse('/api/v1/auth/login', {
      expectedStatus: 200,
      maxResponseTime: 3000,
    });
  }
}
```

### 3. Edge Case Testing

```typescript
import { test } from '@playwright/test';
import { setupApiTesting, SCENARIO_GROUPS } from '../fixtures/api';

test('Login handles network failures gracefully', async ({ page }) => {
  const mockIntegration = await setupApiTesting(page, {
    scenarios: SCENARIO_GROUPS.NETWORK_ISSUES,
    edgeCaseTesting: true,
  });

  // Apply specific failure scenarios
  await mockIntegration.applyScenarios(['network.timeout', 'network.connection-drop']);

  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // Test login with network failures
  await loginPage.login('user@test.com', 'password123');

  // Assert error handling
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
});
```

### 4. Performance Testing

```typescript
import { test } from '@playwright/test';
import { createMockIntegration } from '../fixtures/api';

test('API performance under load', async ({ page }) => {
  const mockIntegration = createMockIntegration({
    performanceTesting: true,
  });

  await mockIntegration.initializeForPage(page);

  // Run comprehensive performance test suite
  const results = await mockIntegration.runPerformanceTests();

  console.log('Performance Results:', {
    baseline: results.baseline,
    loadTests: results.loadTests,
    recommendations: results.recommendations,
  });

  // Assert performance expectations
  expect(results.baseline.responseTime.avg).toBeLessThan(1000);
  expect(results.loadTests['heavy-load'].errors.rate).toBeLessThan(0.05);
});
```

## 🎭 Available Scenarios

### Network Issues

- `network.timeout` - Network timeout simulation
- `network.connection-drop` - Connection drop mid-request
- `network.slow-connection` - Slow network conditions
- `network.intermittent.failure` - Intermittent connectivity issues

### Server Errors

- `server.internal-error` - 500 internal server errors
- `server.service-unavailable` - 503 service unavailable
- `server.bad-gateway` - 502 bad gateway errors

### Authentication Issues

- `auth.token-expired` - Expired authentication tokens
- `auth.invalid-credentials` - Invalid login credentials
- `rate-limit.too-many-requests` - Rate limiting responses

### Data Issues

- `data.corruption` - Corrupted or malformed responses
- `data.empty-response` - Empty or null responses

### Service-Specific Issues

- `plex.server-offline` - Plex server unavailability
- `plex.library-scan-in-progress` - Performance impact during library scanning
- `overseerr.quota-exceeded` - Request quota limitations
- `overseerr.service-maintenance` - Maintenance mode simulation

## 📊 Performance Testing Presets

```typescript
import { PERFORMANCE_TEST_PRESETS } from '../fixtures/api';

// Available presets:
PERFORMANCE_TEST_PRESETS.LIGHT_LOAD; // 25 users, 2 minutes
PERFORMANCE_TEST_PRESETS.MODERATE_LOAD; // 75 users, 3 minutes
PERFORMANCE_TEST_PRESETS.HEAVY_LOAD; // 150 users, 5 minutes
PERFORMANCE_TEST_PRESETS.STRESS_TEST; // 500 users, 3 minutes
```

## 🧠 HIVE-MIND Coordination

The framework includes intelligent coordination between test agents:

```typescript
import { HiveMindCoordinator } from '../fixtures/api';

const hiveMind = new HiveMindCoordinator({
  nodeId: 'test-agent-1',
  enablePersistence: true,
  coordinationType: 'distributed',
});

await hiveMind.initialize();

// Share state between test agents
await hiveMind.storeState('user.session', { token: 'abc123', userId: 'user1' });
const session = await hiveMind.getState('user.session');

// Cross-test persistence
await hiveMind.updateState('test.results', { passed: 15, failed: 2 });
```

## 🔧 Configuration Options

### Mock Server Configuration

```typescript
interface MockServerConfig {
  mode: 'development' | 'testing' | 'production';
  baseUrl: string;
  apiVersion: string;
  enableHiveMind: boolean;
  scenarios: string[];
  persistence: boolean;
  coordinationId?: string;
}
```

### Edge Case Configuration

```typescript
interface EdgeCaseConfig {
  networkFailures: {
    enabled: boolean;
    frequency: number; // 0.0 to 1.0
    types: ('timeout' | 'connection-drop' | 'slow-network')[];
  };
  serverErrors: {
    enabled: boolean;
    frequency: number;
    types: (500 | 502 | 503 | 504)[];
  };
  rateLimiting: {
    enabled: boolean;
    threshold: number;
    windowMs: number;
  };
  // ... more configuration options
}
```

## 📈 Test Data Generation

Generate realistic test data for various scenarios:

```typescript
import {
  generateTestUsers,
  generateTestMovies,
  generateTestTvShows,
  TestDataGenerator,
} from '../fixtures/api';

// Generate users
const users = generateTestUsers(50);

// Generate media content
const movies = generateTestMovies(100);
const tvShows = generateTestTvShows(50);

// Custom data generation
const generator = new TestDataGenerator();
const popularContent = generator.generatePopularContent();
```

## 🛠️ Advanced Usage

### Custom Scenario Creation

```typescript
import { createTestScenario } from '../fixtures/api';

const customScenario = createTestScenario('custom.slow-search', 'Slow Media Search', {
  probability: 0.2,
  delay: 5000,
  category: 'performance',
  severity: 'medium',
  tags: ['search', 'performance', 'media'],
});

mockServer.registerScenario(customScenario);
```

### Response Validation

```typescript
class MediaPage extends EnhancedPageBase {
  async searchMedia(query: string) {
    await this.performActionWithApiMonitoring(
      () => this.page.fill('[data-testid="search-input"]', query),
      [
        { url: '/api/v1/media/search', status: 200 },
        { url: '/api/v1/media/popular', status: 200 },
      ],
    );

    // Assert API response structure
    await this.assertApiResponse('/api/v1/media/search', {
      expectedStatus: 200,
      maxResponseTime: 3000,
      contentType: 'application/json',
    });
  }
}
```

### Performance Monitoring

```typescript
test('Media search performance monitoring', async ({ page }) => {
  const mockIntegration = await setupApiTesting(page, {
    performanceTesting: true,
  });

  const mediaPage = new MediaPage(page);

  // Test performance under various conditions
  const performanceResults = await mediaPage.testApiPerformance(
    () => mediaPage.searchMedia('action movies'),
    {
      iterations: 50,
      concurrency: 5,
      maxResponseTime: 2000,
    },
  );

  expect(performanceResults.averageResponseTime).toBeLessThan(1500);
  expect(performanceResults.errorCount).toBeLessThanOrEqual(2);
});
```

## 🔍 Debugging & Analysis

### Request History Analysis

```typescript
// Get detailed request history
const requestHistory = mockIntegration.getRequestHistory();

// Export test data for analysis
const testData = await mockIntegration.exportData();

// Get comprehensive statistics
const stats = await mockIntegration.getStatistics();
console.log('API Test Statistics:', stats);
```

### Screenshot with API Context

```typescript
// Take screenshot with API context
await page.takeScreenshotWithApiContext('login-error-state');
```

## 🧹 Cleanup

Always cleanup resources after tests:

```typescript
test.afterEach(async () => {
  await mockIntegration.cleanup();
});
```

## 📚 API Reference

### Core Classes

- `MediaNestMockServer` - Main mock server with MSW integration
- `MockScenarioManager` - Edge case scenario management
- `EdgeCaseSimulator` - Advanced failure simulation
- `PerformanceTester` - Load testing and performance monitoring
- `HiveMindCoordinator` - Distributed state coordination
- `MockIntegration` - Playwright integration layer
- `EnhancedPageBase` - Enhanced page object base class
- `TestDataGenerator` - Realistic test data generation

### Utility Functions

- `setupApiTesting()` - Quick setup for Playwright tests
- `createMockServer()` - Mock server factory function
- `createMockIntegration()` - Integration factory function
- `getRandomScenarios()` - Random scenario selection
- `validateMockServerConfig()` - Configuration validation

## 📊 Metrics & Reporting

The framework provides comprehensive metrics:

- Response time distributions (min, max, avg, p95, p99)
- Throughput measurements (requests/sec, bytes/sec)
- Error rates and categorization
- Memory and CPU usage tracking
- Network bandwidth utilization
- Scenario effectiveness analysis

## 🔒 Security Considerations

- All sensitive data is automatically sanitized
- Authentication tokens are properly mocked
- No real credentials are used in test environments
- Request/response data is encrypted when persisted

## 🤝 Contributing

1. Follow the existing code patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure HIVE-MIND compatibility

## 📄 License

MIT License - see LICENSE file for details

---

**MediaNest API Mocking Framework v1.0.0** - Comprehensive API testing with HIVE-MIND coordination
