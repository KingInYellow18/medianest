# Backend Test Suite

Comprehensive test suite for the MediaNest backend API with 0% → 80%+ coverage target.

## Test Structure

```
tests/
├── setup.ts                 # Global test configuration and utilities
├── mocks/                   # Mock implementations for external dependencies
│   ├── axios.mock.ts        # HTTP client mocks (Plex, YouTube, Overseerr APIs)
│   ├── prisma.mock.ts       # Database mocks and transactions
│   ├── redis.mock.ts        # Cache and session mocks
│   ├── plex.mock.ts         # Plex Media Server integration mocks
│   ├── youtube.mock.ts      # YouTube download service mocks
│   └── encryption.mock.ts   # Encryption and JWT service mocks
├── helpers/                 # Test utilities and setup helpers
│   ├── test-server.ts       # Test server lifecycle management
│   ├── database.ts          # Test database setup and seeding
│   ├── redis.ts             # Test Redis setup and utilities
│   └── index.ts             # Helper exports
├── unit/                    # Unit tests for individual components
│   ├── controllers/         # API controller tests
│   ├── services/            # Business logic service tests
│   ├── middleware/          # Middleware function tests
│   ├── repositories/        # Data access layer tests
│   ├── utils/               # Utility function tests
│   └── validations/         # Schema validation tests
├── integration/             # Integration tests for API endpoints
│   ├── api/                 # Full API workflow tests
│   └── services/            # Service integration tests
└── e2e/                     # End-to-end tests
    ├── health.e2e.test.ts   # Health check endpoints
    └── auth.e2e.test.ts     # Authentication workflows
```

## Test Categories

### Unit Tests (`tests/unit/`)
Test individual components in isolation with mocked dependencies:

- **Controllers**: API request/response handling, validation, error handling
- **Services**: Business logic, external API integration, data transformation
- **Middleware**: Authentication, rate limiting, error handling, request validation
- **Repositories**: Database queries, data encryption/decryption, CRUD operations
- **Utils**: Helper functions, formatters, validators

### Integration Tests (`tests/integration/`)
Test component interactions and API endpoints:

- **API Endpoints**: Full request/response cycles with middleware chain
- **Service Integration**: Service-to-service communication
- **Database Integration**: Real database queries with test data

### End-to-End Tests (`tests/e2e/`)
Test complete user workflows:

- **Authentication**: PIN generation, verification, token refresh, logout
- **Health Checks**: System monitoring, service status, performance metrics
- **Media Management**: Request creation, approval workflows, status updates

## Key Test Features

### Comprehensive Mocking
- **External APIs**: Plex Media Server, YouTube-DL, Overseerr
- **Database**: Prisma client with transaction support
- **Cache**: Redis operations and rate limiting
- **Encryption**: JWT tokens and sensitive data encryption

### Test Data Factories
- User profiles with different roles and statuses
- Media requests across various types and states
- YouTube download jobs with progress tracking
- Health check responses for all services

### Performance Testing
- Response time validation for critical endpoints
- Concurrent request handling
- Resource usage monitoring
- Rate limiting enforcement

### Security Testing
- Authentication and authorization flows
- Input validation and sanitization
- Error message information disclosure
- CORS and security header validation

## Running Tests

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Test Configuration

### Environment Variables
Tests use separate test databases and Redis instances:

```bash
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_medianest
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-jwt-secret-key-for-testing-only
ENCRYPTION_KEY=test-encryption-key-32-chars-long!
```

### Coverage Thresholds
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Mock Strategy

### Database Mocking
Uses `vitest-mock-extended` for type-safe Prisma mocks:
- Transaction support
- Error simulation
- Data factory patterns
- Relationship handling

### External Service Mocking
Comprehensive API response mocking:
- Plex authentication and library access
- YouTube video information and download progress
- Overseerr request management
- Network error simulation

### Cache and Session Mocking
Redis operation simulation:
- Key-value operations
- Rate limiting counters
- Session management
- Health monitoring

## Test Utilities

### Request/Response Mocking
```typescript
const mockReq = createMockRequest({
  body: { pinId: '12345' },
  user: { id: 'test-user', role: 'admin' }
});

const mockRes = createMockResponse();
const mockNext = createMockNext();
```

### Test Data Creation
```typescript
const testUser = createTestUser({
  role: 'admin',
  status: 'active'
});

const testRequest = createTestMediaRequest({
  type: 'movie',
  status: 'pending'
});
```

### Health Check Simulation
```typescript
const healthMocks = createHealthCheckMocks();
healthMocks.database.mockResolvedValue({
  status: 'healthy',
  responseTime: 10
});
```

## Best Practices

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Descriptive Names**: Test names clearly describe the scenario
3. **AAA Pattern**: Arrange, Act, Assert structure in all tests
4. **Error Coverage**: Test both success and failure scenarios
5. **Performance**: Validate response times and resource usage
6. **Security**: Test authentication, authorization, and input validation
7. **Documentation**: Clear comments for complex test scenarios

## Coverage Goals

Target backend test coverage from 0% to 80%+:

- ✅ Controllers: 17 files, 95% coverage target
- ✅ Services: 10 files, 90% coverage target  
- ✅ Middleware: 12 files, 85% coverage target
- ✅ Repositories: 8 files, 90% coverage target
- ✅ Utilities: 10 files, 80% coverage target
- ✅ Routes: All endpoint combinations tested
- ✅ Error handling: All error paths covered
- ✅ Integration: Critical user workflows tested

## Troubleshooting

### Common Issues

**Database Connection**: Ensure PostgreSQL test database exists and is accessible
**Redis Connection**: Verify Redis is running and test DB is separate from development
**Port Conflicts**: Test server uses port 3001 by default
**Mock Persistence**: Mocks are reset between tests automatically

### Debug Mode
```bash
# Run with debug output
DEBUG=test:* npm test

# Run specific test file
npm test -- auth.controller.test.ts

# Run with verbose output
npm test -- --reporter=verbose
```