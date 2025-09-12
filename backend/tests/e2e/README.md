# MediaNest E2E Test Suite

Comprehensive end-to-end testing for MediaNest media request workflows.

## Overview

This E2E test suite provides complete workflow testing for MediaNest, covering all user interactions from media search to request fulfillment. The tests simulate real user behavior and validate the entire application stack.

## Test Structure

```
tests/e2e/
├── README.md                          # This documentation
├── media-request.spec.ts              # Main E2E test suite
├── fixtures/
│   └── media-data.ts                  # Test data and mock fixtures
├── utils/
│   └── e2e-helpers.ts                 # Testing utilities and helpers
└── workflows/
    ├── search-and-browse.e2e.test.ts  # Media search and browsing tests
    ├── request-creation.e2e.test.ts   # Request creation workflow tests
    ├── request-management.e2e.test.ts # Request management and status tests
    ├── plex-integration.e2e.test.ts   # Plex library integration tests
    ├── user-isolation.e2e.test.ts     # User data isolation and security tests
    └── admin-workflows.e2e.test.ts    # Admin management workflow tests
```

## Test Coverage

### 🎬 Core Workflows

- **Search and Browse**: Media discovery, pagination, filtering, sorting
- **Request Creation**: Form validation, duplicate handling, error scenarios
- **Request Management**: Status tracking, filtering, cancellation
- **Admin Operations**: Approval/denial, bulk actions, user management

### 🔒 Security Testing

- **User Isolation**: Data access controls, request ownership
- **Authentication**: Token validation, session management
- **Authorization**: Role-based access, privilege escalation prevention
- **Data Protection**: Sensitive data exposure, input sanitization

### 🎯 Integration Testing

- **Plex Integration**: Library browsing, content search, availability status
- **External APIs**: TMDB integration, metadata retrieval
- **Database Operations**: CRUD operations, transaction integrity
- **Real-time Features**: Status updates, notifications

### 📱 Cross-Platform Testing

- **Responsive Design**: Mobile, tablet, desktop viewports
- **Visual Regression**: API response structure consistency
- **Performance**: Load testing, concurrent operations
- **Error Handling**: Graceful degradation, error recovery

## Running Tests

### Prerequisites

1. **Test Database**: Ensure test database is configured
2. **Environment Variables**: Set up test environment configuration
3. **Dependencies**: Install all project dependencies

```bash
npm install
```

### Run All E2E Tests

```bash
# Run complete E2E test suite
npm run test tests/e2e/

# Run with coverage
npm run test:coverage tests/e2e/

# Run in watch mode for development
npm run test:watch tests/e2e/
```

### Run Specific Test Categories

```bash
# Main comprehensive test
npm run test tests/e2e/media-request.spec.ts

# Individual workflow tests
npm run test tests/e2e/workflows/search-and-browse.e2e.test.ts
npm run test tests/e2e/workflows/request-creation.e2e.test.ts
npm run test tests/e2e/workflows/request-management.e2e.test.ts
npm run test tests/e2e/workflows/plex-integration.e2e.test.ts
npm run test tests/e2e/workflows/user-isolation.e2e.test.ts
npm run test tests/e2e/workflows/admin-workflows.e2e.test.ts
```

## Test Configuration

### Environment Setup

The tests use a dedicated test environment that:

- Creates isolated test users (regular user, admin user)
- Sets up clean database state before each test suite
- Provides authentication tokens for API requests
- Cleans up test data after completion

### Mock Services

Tests include mocked responses for:

- **TMDB API**: Movie and TV show metadata
- **Plex Server**: Library content and availability
- **External Services**: Overseerr, notification services

### Performance Thresholds

Tests enforce performance expectations:

- **Search Operations**: < 2 seconds
- **Request Creation**: < 3 seconds
- **Admin Operations**: < 4 seconds
- **Bulk Operations**: < 5 seconds

## Key Features

- ✅ **Complete User Journey Testing**: From search to request fulfillment
- ✅ **User Isolation Validation**: Ensures users only see their own data
- ✅ **Admin Workflow Testing**: Comprehensive admin functionality validation
- ✅ **Performance Testing**: Load testing and concurrent operation validation
- ✅ **Visual Regression Testing**: API response structure consistency
- ✅ **Responsive Behavior Testing**: Cross-viewport compatibility
- ✅ **Error Handling Validation**: Comprehensive error scenario testing
- ✅ **Security Testing**: Authentication, authorization, and data protection

## Best Practices

1. **Test Independence**: Each test works in isolation
2. **Clean State**: Proper test data cleanup
3. **Realistic Data**: Representative test scenarios
4. **Error Coverage**: Both success and failure cases
5. **Performance Awareness**: Monitoring execution times
6. **Documentation**: Self-documenting test descriptions

## Contributing

When adding new E2E tests:

1. Follow existing patterns and conventions
2. Include both positive and negative test cases
3. Add performance expectations where appropriate
4. Update documentation for new test coverage
5. Ensure tests are reliable and not flaky
