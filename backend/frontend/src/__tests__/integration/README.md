# MediaNest Frontend Integration Tests

This directory contains comprehensive integration tests for the MediaNest frontend application, focusing on real user workflows, API integration, authentication flow, data fetching hooks, and state management.

## Overview

These integration tests use **MSW (Mock Service Worker)** for API mocking and provide end-to-end testing of user interactions with the application. The tests cover:

- ✅ **Authentication Flow** - Login, logout, token refresh, session management
- ✅ **API Integration** - Service management, error handling, retry logic
- ✅ **Data Fetching Hooks** - Custom hooks, caching, async operations
- ✅ **State Management** - Global state, context providers, optimized state
- ✅ **WebSocket Integration** - Real-time connections, message handling, reconnection

## Test Files

### `auth-flow.integration.test.tsx`
Tests complete authentication workflows including:
- Initial authentication state
- Login with valid/invalid credentials
- Logout functionality
- Token refresh mechanisms
- Session management and expiry
- Authentication error boundaries

### `api-integration.integration.test.tsx`
Tests API interactions and error handling:
- Services API (CRUD operations)
- Filtering and pagination
- Authentication headers
- Error handling (401, 404, 500, timeouts)
- Retry logic and network errors
- Concurrent requests
- Rate limiting scenarios

### `data-fetching-hooks.integration.test.tsx`
Tests custom hooks for data management:
- `useServices` hook with filtering
- `useService` hook for individual items
- Caching mechanisms
- Async state management
- Error recovery patterns
- Performance optimizations

### `state-management.integration.test.tsx`
Tests global state management:
- App context providers
- Granular state selectors
- Optimized state hooks
- State persistence
- Performance optimizations
- Concurrent state updates

### `websocket.integration.test.tsx`
Tests WebSocket real-time features:
- Connection management
- Message sending/receiving
- Typed message handlers
- Reconnection logic
- Error handling
- Resource cleanup

## Running the Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Ensure MSW is properly installed
npm list msw
```

### Integration Test Commands

```bash
# Run integration tests in watch mode
npm run test:integration

# Run integration tests once
npm run test:integration:run

# Run with coverage report
npm run test:integration:coverage

# Run with UI interface
npm run test:integration:ui

# Run all tests (unit + integration)
npm run test:all

# Run all tests with coverage
npm run test:all:coverage
```

### Individual Test Files

```bash
# Run specific integration test file
npx vitest run --config vitest.integration.config.ts src/__tests__/integration/auth-flow.integration.test.tsx

# Run with pattern matching
npx vitest run --config vitest.integration.config.ts -t "Authentication Flow"
```

## Test Architecture

### MSW Server Setup

The tests use a comprehensive MSW server (`msw-server.ts`) that mocks:

- **Authentication endpoints** (`/api/auth/*`)
- **Services endpoints** (`/api/services/*`)
- **Health check endpoints** (`/api/health`)
- **Error simulation endpoints** (`/api/error/*`)
- **WebSocket connections** (`ws://localhost:3000/ws`)

### Test Utilities

#### `integration-setup.ts`
- Configures MSW server lifecycle
- Sets up test environment with mocks
- Provides global test utilities

#### `integration-render.tsx`
- Custom render functions with providers
- Authentication helper functions
- Network condition simulation
- Test assertion helpers

### Mock Data

The MSW server provides realistic mock data including:

```typescript
// Mock users
const mockUsers = [
  {
    id: 'user-123',
    email: 'test@medianest.com',
    name: 'Test User',
    role: 'user',
  },
  // ... more users
];

// Mock services
const mockServices = [
  {
    id: 'service-1',
    name: 'Plex Server',
    type: 'plex',
    status: 'connected',
    // ... more properties
  },
  // ... more services
];
```

## Configuration

### Integration-Specific Vitest Config

The `vitest.integration.config.ts` provides:

- **Extended timeouts** (30s test, 10s hooks) for complex scenarios
- **Sequential execution** to avoid resource conflicts
- **Retry logic** (2 retries) for flaky tests
- **Separate coverage reporting** in `./coverage/integration`
- **Environment variables** for integration testing

### Environment Variables

```bash
NODE_ENV=test
VITE_APP_ENV=integration-test
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
VITEST_INTEGRATION_MODE=true
```

## Test Patterns

### Authentication Testing

```typescript
// Test authenticated scenarios
const { user } = renderWithAuth(<Component />);

// Test unauthenticated scenarios
const { user } = renderWithoutAuth(<Component />);

// Test with specific user role
const { user } = renderWithAuth(<Component />, 'admin');
```

### API Testing

```typescript
// Mock successful response
mswUtils.setAuthenticatedUser(mockUser);

// Mock error response
mswServer.use(
  http.get('/api/services', () => {
    return HttpResponse.json({ message: 'Error' }, { status: 500 });
  })
);
```

### State Testing

```typescript
// Test with initial state
renderWithAuth(<Component />, 'user', {
  initialAppState: {
    ui: { theme: 'dark' },
    user: { name: 'Custom User' }
  }
});
```

### WebSocket Testing

```typescript
// Mock WebSocket messages
const mockWs = (global.WebSocket as any).mockInstance;
mockWs.simulateMessage({
  type: 'service-update',
  payload: { serviceId: 'service-1', status: 'connected' }
});
```

## Best Practices

### 1. Test Real User Workflows

```typescript
it('should complete service configuration workflow', async () => {
  // 1. User logs in
  await simulateLogin(user, 'admin@medianest.com', 'password');
  
  // 2. User navigates to services
  await user.click(screen.getByText('Services'));
  
  // 3. User adds new service
  await user.click(screen.getByText('Add Service'));
  
  // 4. User fills form and submits
  await user.type(screen.getByLabelText('Service Name'), 'New Plex Server');
  await user.click(screen.getByText('Save'));
  
  // 5. Verify service was created
  expect(screen.getByText('New Plex Server')).toBeInTheDocument();
});
```

### 2. Test Error Scenarios

```typescript
it('should handle network errors gracefully', async () => {
  // Simulate network error
  mswServer.use(
    http.get('/api/services', () => {
      return HttpResponse.json({}, { status: 500 });
    })
  );
  
  renderWithAuth(<ServicesPage />);
  
  // Should show error message
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
  
  // Should show retry option
  expect(screen.getByText('Retry')).toBeInTheDocument();
});
```

### 3. Test Loading States

```typescript
it('should show loading states during async operations', async () => {
  const { user } = renderWithAuth(<ServiceDetail serviceId="service-1" />);
  
  // Should show loading initially
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  // Wait for data to load
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
  
  // Test action loading state
  await user.click(screen.getByText('Test Connection'));
  expect(screen.getByText('Testing...')).toBeInTheDocument();
});
```

### 4. Test State Persistence

```typescript
it('should maintain state across component re-renders', () => {
  const { rerender } = renderWithAuth(<Component />);
  
  // Make changes to state
  // ... user interactions
  
  // Re-render component
  rerender(<Component />);
  
  // State should be maintained
  expect(screen.getByTestId('user-name')).toHaveTextContent('Expected Value');
});
```

## Debugging Tests

### Run with Debug Mode

```bash
# Run with debugger
npm run test:debug -- --config vitest.integration.config.ts

# Run specific test in debug mode
npx vitest --inspect-brk --no-coverage --config vitest.integration.config.ts -t "specific test name"
```

### Console Logging

```typescript
// Enable console logs in tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockRestore();
  vi.spyOn(console, 'error').mockRestore();
});
```

### MSW Request Inspection

```typescript
// Log all MSW requests
mswServer.events.on('request:start', ({ request }) => {
  console.log('MSW Request:', request.method, request.url);
});
```

## Coverage Reports

Integration test coverage is generated in `./coverage/integration/` with:

- **HTML Report**: `./coverage/integration/index.html`
- **JSON Report**: `./coverage/integration/coverage-final.json`
- **Text Report**: Console output

### Coverage Thresholds

- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 80%
- **Statements**: 80%

## CI/CD Integration

These tests are designed to run in CI environments:

```yaml
# GitHub Actions example
- name: Run Integration Tests
  run: |
    npm ci
    npm run test:integration:run
    npm run test:integration:coverage
```

## Troubleshooting

### Common Issues

1. **MSW Server Not Starting**
   - Check that MSW is properly installed
   - Verify setup files are correctly imported

2. **WebSocket Tests Failing**
   - Ensure WebSocket mocks are properly configured
   - Check timer advancement in tests

3. **Authentication Tests Failing**
   - Verify mock user data is set correctly
   - Check token storage and retrieval

4. **Timeout Errors**
   - Increase test timeouts for complex scenarios
   - Use proper `waitFor` with adequate timeout values

### Getting Help

For issues with integration tests:

1. Check the console for detailed error messages
2. Run tests individually to isolate problems
3. Use the UI mode for visual debugging
4. Verify MSW request/response flow
5. Check that all dependencies are up to date

## Memory: MEDIANEST_TESTING_PHASE3_20250912

This comprehensive integration test suite provides:
- ✅ Complete API integration testing with MSW
- ✅ Authentication flow testing with real scenarios
- ✅ Data fetching hooks testing with caching
- ✅ State management testing with performance checks
- ✅ WebSocket integration testing with reconnection logic
- ✅ Error scenarios and edge cases coverage
- ✅ Loading states and success paths validation
- ✅ Real user workflow simulation