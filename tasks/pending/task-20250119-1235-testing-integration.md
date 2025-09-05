# Task: Comprehensive Testing for Monitor Visibility Feature

## Task ID

task-20250119-1235-testing-integration

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Develop comprehensive testing suite for the monitor visibility feature, including unit tests, integration tests, E2E tests, and security testing. This ensures the feature works correctly across all components, maintains security standards, and provides reliable functionality for both admin and regular users.

## Acceptance Criteria

### Test Coverage

- [ ] 80%+ code coverage for all monitor visibility components
- [ ] Unit tests for all services, repositories, and components
- [ ] Integration tests for API endpoints and database operations
- [ ] E2E tests for complete user workflows
- [ ] Security tests for authorization and data protection

### Test Categories

- [ ] Database operations and migrations
- [ ] Backend service logic and API endpoints
- [ ] Frontend components and user interactions
- [ ] WebSocket event filtering and real-time updates
- [ ] Role-based access control and security
- [ ] Performance and load testing

### Quality Assurance

- [ ] All tests pass consistently in CI/CD pipeline
- [ ] Tests run in isolated environments
- [ ] Proper test data setup and cleanup
- [ ] Mock external dependencies appropriately
- [ ] Test edge cases and error conditions

### Documentation

- [ ] Test documentation for running and maintaining tests
- [ ] Test data setup instructions
- [ ] Integration test environment configuration
- [ ] Security testing procedures and results

## Technical Requirements

### Database Testing

#### Migration Tests

```typescript
// backend/src/__tests__/migrations/monitor-visibility.test.ts
describe('Monitor Visibility Migration', () => {
  let testDb: PrismaClient;

  beforeEach(async () => {
    // Set up clean test database
    testDb = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
    });
  });

  afterEach(async () => {
    await testDb.$disconnect();
  });

  describe('Schema Creation', () => {
    it('should create monitor_visibility table with correct structure');
    it('should create proper indexes for performance');
    it('should enforce unique constraints on monitor_id');
    it('should set up foreign key relationships correctly');
  });

  describe('Data Migration', () => {
    it('should populate existing monitors as admin-only');
    it('should handle empty database correctly');
    it('should maintain data integrity during migration');
    it('should be reversible without data loss');
  });

  describe('Constraints and Validation', () => {
    it('should enforce NOT NULL constraints');
    it('should validate monitor_id format');
    it('should handle cascade deletions properly');
    it('should update timestamps automatically');
  });
});
```

#### Repository Tests

```typescript
// backend/src/repositories/__tests__/monitor-visibility.repository.test.ts
describe('MonitorVisibilityRepository', () => {
  let repository: MonitorVisibilityRepository;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    repository = new MonitorVisibilityRepository(prisma);
    await cleanupTestData();
  });

  describe('CRUD Operations', () => {
    it('should create monitor visibility record');
    it('should find monitors by visibility status');
    it('should update monitor visibility');
    it('should delete monitor records');
    it('should handle bulk operations efficiently');
  });

  describe('Query Performance', () => {
    it('should efficiently query with filters');
    it('should perform well with large datasets');
    it('should use indexes effectively');
  });

  describe('Data Integrity', () => {
    it('should prevent duplicate monitor entries');
    it('should handle invalid monitor IDs gracefully');
    it('should maintain referential integrity');
  });
});
```

### Service Layer Testing

#### Monitor Visibility Service Tests

```typescript
// backend/src/services/__tests__/monitor-visibility.service.test.ts
describe('MonitorVisibilityService', () => {
  let service: MonitorVisibilityService;
  let mockRepository: jest.Mocked<MonitorVisibilityRepository>;
  let mockUptimeKumaService: jest.Mocked<UptimeKumaService>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockUptimeKumaService = createMockUptimeKumaService();
    service = new MonitorVisibilityService(mockRepository, mockUptimeKumaService, mockLogger);
  });

  describe('Role-based Filtering', () => {
    it('should return all monitors for admin users');
    it('should return only public monitors for regular users');
    it('should handle empty monitor lists');
    it('should filter correctly with mixed visibility');
  });

  describe('Visibility Management', () => {
    it('should update monitor visibility successfully');
    it('should handle bulk visibility updates');
    it('should validate monitor existence before updates');
    it('should track who made visibility changes');
  });

  describe('Monitor Synchronization', () => {
    it('should discover new monitors from Uptime Kuma');
    it('should update existing monitor metadata');
    it('should remove monitors that no longer exist');
    it('should handle Uptime Kuma connection failures');
  });

  describe('Error Handling', () => {
    it('should handle database connection errors');
    it('should handle invalid monitor IDs');
    it('should handle concurrent modification conflicts');
    it('should provide meaningful error messages');
  });
});
```

#### Status Service Integration Tests

```typescript
// backend/src/services/__tests__/status.service.integration.test.ts
describe('StatusService with Monitor Visibility', () => {
  let statusService: StatusService;
  let monitorVisibilityService: MonitorVisibilityService;
  let testDb: PrismaClient;

  beforeEach(async () => {
    testDb = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    // Set up services with real database
    monitorVisibilityService = new MonitorVisibilityService(
      new MonitorVisibilityRepository(testDb),
      mockUptimeKumaService,
      mockLogger,
    );
    statusService = new StatusService(/* dependencies */);
    await seedTestMonitors();
  });

  describe('Filtered Status Retrieval', () => {
    it('should return filtered statuses for regular users');
    it('should return all statuses for admin users');
    it('should handle service-to-monitor mapping correctly');
    it('should maintain performance with large monitor lists');
  });

  describe('Real-time Updates', () => {
    it('should broadcast updates based on visibility');
    it('should handle visibility changes in real-time');
    it('should maintain consistency across WebSocket and HTTP');
  });
});
```

### API Endpoint Testing

#### Admin Controller Tests

```typescript
// backend/src/controllers/__tests__/admin.controller.monitor-visibility.test.ts
describe('AdminController Monitor Visibility Endpoints', () => {
  let app: Express;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    app = createTestApp();
    adminToken = await createTestAdminToken();
    userToken = await createTestUserToken();
    await seedTestData();
  });

  describe('GET /api/admin/monitors', () => {
    it('should return paginated monitors for admin', async () => {
      const response = await request(app)
        .get('/api/admin/monitors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/monitors')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should support search and filtering', async () => {
      const response = await request(app)
        .get('/api/admin/monitors?search=plex&visibility=public')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/admin/monitors/:id/visibility', () => {
    it('should update monitor visibility successfully');
    it('should validate request body');
    it('should return 404 for non-existent monitors');
    it('should track who made the change');
  });

  describe('PATCH /api/admin/monitors/bulk-visibility', () => {
    it('should update multiple monitors successfully');
    it('should handle partial failures gracefully');
    it('should validate bulk operation limits');
    it('should return detailed results');
  });

  describe('POST /api/admin/monitors/sync', () => {
    it('should trigger monitor synchronization');
    it('should return sync statistics');
    it('should handle Uptime Kuma connectivity issues');
  });
});
```

#### Dashboard Controller Tests

```typescript
// backend/src/controllers/__tests__/dashboard.controller.filtering.test.ts
describe('DashboardController with Filtering', () => {
  describe('GET /api/dashboard/status', () => {
    it('should return all statuses for admin users');
    it('should return filtered statuses for regular users');
    it('should include filtering metadata in response');
    it('should handle empty monitor lists');
  });

  describe('GET /api/dashboard/status/:service', () => {
    it('should return service status if user has access');
    it('should deny access to hidden services');
    it('should return 404 for non-existent services');
  });
});
```

### Frontend Component Testing

#### Admin Interface Tests

```typescript
// frontend/__tests__/components/admin/MonitorVisibilityManagement.test.tsx
describe('MonitorVisibilityManagement', () => {
  beforeEach(() => {
    mockAPI();
    mockWebSocket();
  });

  describe('Monitor List Display', () => {
    it('should render monitor list correctly');
    it('should display visibility status for each monitor');
    it('should handle loading states');
    it('should handle empty monitor lists');
  });

  describe('Visibility Toggle', () => {
    it('should toggle monitor visibility optimistically');
    it('should revert on API failure');
    it('should show success notifications');
    it('should handle concurrent modifications');
  });

  describe('Bulk Operations', () => {
    it('should allow selecting multiple monitors');
    it('should perform bulk visibility changes');
    it('should show confirmation dialogs');
    it('should handle partial failures');
  });

  describe('Search and Filtering', () => {
    it('should filter monitors by search query');
    it('should filter by visibility status');
    it('should debounce search input');
    it('should maintain selection across filters');
  });

  describe('Real-time Updates', () => {
    it('should update monitor list when new monitors discovered');
    it('should reflect visibility changes from other admins');
    it('should handle WebSocket connection issues');
  });
});
```

#### Dashboard Filtering Tests

```typescript
// frontend/__tests__/hooks/useServiceStatus.filtering.test.ts
describe('useServiceStatus with Filtering', () => {
  describe('Role-based Filtering', () => {
    it('should fetch all services for admin users');
    it('should fetch only public services for regular users');
    it('should update when user role changes');
  });

  describe('Real-time Updates', () => {
    it('should handle filtered WebSocket events');
    it('should ignore events for hidden services');
    it('should update when visibility changes');
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully');
    it('should handle WebSocket disconnections');
    it('should retry failed requests');
  });
});
```

### WebSocket Testing

#### Event Filtering Tests

```typescript
// backend/src/socket/__tests__/filtering.integration.test.ts
describe('WebSocket Event Filtering', () => {
  let io: Server;
  let adminSocket: Socket;
  let userSocket: Socket;

  beforeEach(async () => {
    io = createTestSocketServer();
    adminSocket = await createAdminSocket();
    userSocket = await createUserSocket();
  });

  describe('Room Management', () => {
    it('should assign users to correct rooms based on role');
    it('should handle role changes dynamically');
    it('should clean up rooms on disconnect');
  });

  describe('Event Broadcasting', () => {
    it('should broadcast public monitor events to all users');
    it('should broadcast admin-only events to admin room only');
    it('should handle visibility changes correctly');
    it('should filter bulk status updates');
  });

  describe('Security', () => {
    it('should prevent unauthorized access to admin events');
    it('should validate user permissions before room joins');
    it('should handle authentication failures');
  });
});
```

### E2E Testing

#### Complete User Workflows

```typescript
// frontend/e2e/monitor-visibility/admin-workflow.spec.ts
describe('Admin Monitor Visibility Workflow', () => {
  test('should manage monitor visibility end-to-end', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);

    // Navigate to monitor management
    await page.goto('/admin/monitors');

    // Verify monitor list loads
    await expect(page.locator('[data-testid="monitor-list"]')).toBeVisible();

    // Toggle monitor visibility
    const firstMonitor = page.locator('[data-testid="monitor-row"]').first();
    await firstMonitor.locator('[data-testid="visibility-toggle"]').click();

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();

    // Perform bulk operation
    await page.locator('[data-testid="select-all"]').click();
    await page.locator('[data-testid="bulk-make-public"]').click();

    // Confirm bulk operation
    await page.locator('[data-testid="confirm-bulk-action"]').click();

    // Verify bulk success
    await expect(page.locator('[data-testid="bulk-success"]')).toBeVisible();

    // Test sync functionality
    await page.locator('[data-testid="sync-monitors"]').click();
    await expect(page.locator('[data-testid="sync-success"]')).toBeVisible();
  });
});

// frontend/e2e/monitor-visibility/user-experience.spec.ts
describe('User Dashboard Filtering', () => {
  test('should show different content based on user role', async ({ browser }) => {
    const adminPage = await browser.newPage();
    const userPage = await browser.newPage();

    // Login with different roles
    await loginAsAdmin(adminPage);
    await loginAsUser(userPage);

    // Navigate to dashboard
    await adminPage.goto('/dashboard');
    await userPage.goto('/dashboard');

    // Admin should see all monitors
    const adminServices = await adminPage.locator('[data-testid="service-card"]').count();

    // User should see fewer monitors
    const userServices = await userPage.locator('[data-testid="service-card"]').count();

    expect(adminServices).toBeGreaterThan(userServices);

    // Test real-time updates
    await adminPage.goto('/admin/monitors');
    await adminPage
      .locator('[data-testid="monitor-row"]')
      .first()
      .locator('[data-testid="visibility-toggle"]')
      .click();

    // User dashboard should update
    await userPage.waitForTimeout(1000); // Wait for WebSocket update
    const updatedUserServices = await userPage.locator('[data-testid="service-card"]').count();

    expect(updatedUserServices).not.toBe(userServices);
  });
});
```

### Performance Testing

#### Load Testing

```typescript
// backend/src/__tests__/performance/monitor-visibility.load.test.ts
describe('Monitor Visibility Performance', () => {
  describe('API Performance', () => {
    it('should handle concurrent visibility updates', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        updateMonitorVisibility(`monitor-${i}`, Math.random() > 0.5),
      );

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 5 seconds for 100 concurrent updates
    });

    it('should efficiently filter large monitor lists', async () => {
      await seedLargeMonitorDataset(1000);

      const start = Date.now();
      const result = await monitorVisibilityService.getAllMonitors('USER');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // 200ms for filtering 1000 monitors
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle many concurrent connections', async () => {
      const connections = await Promise.all(Array.from({ length: 100 }, () => createTestSocket()));

      // Broadcast status update
      await statusService.broadcastStatusUpdate(mockStatus);

      // Verify all connections received appropriate updates
      const adminConnections = connections.filter((c) => c.user.role === 'ADMIN');
      const userConnections = connections.filter((c) => c.user.role === 'USER');

      expect(adminConnections.every((c) => c.receivedUpdate)).toBe(true);
      // Users should receive update only if monitor is public
    });
  });
});
```

### Security Testing

#### Authorization Tests

```typescript
// backend/src/__tests__/security/monitor-visibility.security.test.ts
describe('Monitor Visibility Security', () => {
  describe('Access Control', () => {
    it('should prevent unauthorized access to admin endpoints');
    it('should validate JWT tokens on all requests');
    it('should handle token expiration gracefully');
    it('should prevent privilege escalation');
  });

  describe('Data Protection', () => {
    it('should not expose hidden monitor data in API responses');
    it('should filter WebSocket events based on permissions');
    it('should prevent information leakage through error messages');
    it('should audit admin actions properly');
  });

  describe('Input Validation', () => {
    it('should sanitize all user inputs');
    it('should prevent SQL injection attacks');
    it('should validate monitor ID formats');
    it('should handle malformed requests safely');
  });
});
```

## Files to Create

### Test Configuration

- `backend/src/__tests__/setup/monitor-visibility.setup.ts` - Test environment setup
- `backend/src/__tests__/fixtures/monitor-visibility.fixtures.ts` - Test data fixtures
- `backend/src/__tests__/utils/monitor-visibility.test-utils.ts` - Testing utilities

### Unit Test Files

- `backend/src/repositories/__tests__/monitor-visibility.repository.test.ts`
- `backend/src/services/__tests__/monitor-visibility.service.test.ts`
- `backend/src/controllers/__tests__/admin.controller.monitor-visibility.test.ts`
- `frontend/__tests__/components/admin/MonitorVisibilityManagement.test.tsx`
- `frontend/__tests__/hooks/useMonitorVisibility.test.ts`

### Integration Test Files

- `backend/src/__tests__/integration/monitor-visibility.api.test.ts`
- `backend/src/__tests__/integration/monitor-visibility.websocket.test.ts`
- `frontend/__tests__/integration/monitor-visibility.integration.test.tsx`

### E2E Test Files

- `frontend/e2e/monitor-visibility/admin-workflow.spec.ts`
- `frontend/e2e/monitor-visibility/user-filtering.spec.ts`
- `frontend/e2e/monitor-visibility/real-time-updates.spec.ts`

### Performance Test Files

- `backend/src/__tests__/performance/monitor-visibility.load.test.ts`
- `frontend/__tests__/performance/monitor-visibility.performance.test.ts`

## Testing Infrastructure

### Test Database Setup

```bash
# backend/scripts/setup-test-db.sh
#!/bin/bash
set -e

echo "Setting up test database..."

# Create test database
createdb medianest_test

# Run migrations
DATABASE_URL="postgresql://user:pass@localhost:5432/medianest_test" \
  npx prisma migrate deploy

# Seed test data
DATABASE_URL="postgresql://user:pass@localhost:5432/medianest_test" \
  npx prisma db seed

echo "Test database setup complete"
```

### CI/CD Integration

```yaml
# .github/workflows/monitor-visibility-tests.yml
name: Monitor Visibility Tests

on:
  pull_request:
    paths:
      - 'backend/src/**/*monitor-visibility*'
      - 'frontend/src/**/*monitor*'
      - 'backend/prisma/**'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: npm run test:db:setup

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Success Metrics

### Coverage Targets

- **Unit Tests**: 85% code coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: All user workflows covered
- **Security Tests**: All authorization paths tested

### Performance Benchmarks

- API response times under 200ms for filtering operations
- WebSocket event delivery under 100ms
- Bulk operations complete within 5 seconds
- UI renders with filtered data under 1 second

### Quality Gates

- All tests pass in CI/CD pipeline
- No critical security vulnerabilities
- Performance benchmarks met
- Accessibility standards maintained

## Progress Log

### 2025-01-19 12:35 - Task Created

- Designed comprehensive testing strategy covering all components
- Created test specifications for unit, integration, and E2E testing
- Planned performance and security testing approaches
- Defined success metrics and quality gates

## Related Tasks

- Depends on: All previous monitor visibility implementation tasks
- Blocks: Production deployment and feature completion
- Related: Documentation and user training tasks

## Notes

### Testing Philosophy

- **Security First**: Extensive security testing for authorization and data protection
- **Real-world Scenarios**: Test with realistic data volumes and user patterns
- **Performance Focused**: Ensure feature scales with large monitor lists
- **User Experience**: Verify seamless experience across all user roles

### Test Data Strategy

- Use realistic Uptime Kuma monitor configurations
- Test with various user role combinations
- Include edge cases and error scenarios
- Maintain test data consistency across environments

### Continuous Integration

- Run tests on every pull request
- Fail fast on security or performance regressions
- Generate detailed test reports and coverage metrics
- Automate test environment setup and teardown

### Future Testing Considerations

- Chaos engineering for resilience testing
- Accessibility testing automation
- Cross-browser compatibility testing
- Mobile device testing for admin interface
