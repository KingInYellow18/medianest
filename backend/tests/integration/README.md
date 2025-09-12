# Service Integration Contract Tests

This directory contains comprehensive integration tests for MediaNest's external service integrations. These tests validate API contracts, error handling, circuit breaker functionality, service degradation scenarios, and real-time WebSocket communications.

## Test Structure

### 🏗️ Architecture

```
tests/integration/
├── integrations/           # API client contract tests
│   ├── plex-api-client.test.ts
│   ├── overseerr-api-client.test.ts
│   └── uptime-kuma-client.test.ts
├── services/              # Service layer integration tests
│   ├── integration.service.test.ts
│   └── service-degradation.test.ts
├── utils/                 # Utility integration tests
│   └── circuit-breaker.test.ts
├── websocket/             # WebSocket and real-time tests
│   └── websocket-events.test.ts
└── mocks/                 # Enhanced MSW handlers
    ├── handlers.ts
    └── server.ts
```

## Test Categories

### 🎬 Plex API Client Tests (`integrations/plex-api-client.test.ts`)

**Purpose**: Validate Plex API integration contract compliance and error handling

**Key Test Areas**:

- **Authentication & User Data**: Token validation, user data retrieval, OAuth flows
- **Server Discovery**: Server enumeration, library discovery, connection management
- **Media Content**: Library browsing, search functionality, metadata retrieval
- **Error Handling**: Network failures, timeouts, malformed responses
- **Circuit Breaker**: State transitions, failure thresholds, recovery scenarios
- **Health Checks**: Service monitoring, response time tracking
- **Contract Validation**: API response structure validation, type safety

**Critical Scenarios**:

- Invalid/expired token handling
- Service unavailable responses (503)
- Request timeout simulation (6+ seconds)
- Concurrent request handling
- Circuit breaker state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)

### 📺 Overseerr API Client Tests (`integrations/overseerr-api-client.test.ts`)

**Purpose**: Ensure Overseerr media request system integration reliability

**Key Test Areas**:

- **Service Configuration**: Status checking, settings validation, API key authentication
- **Media Request Management**: CRUD operations, approval workflows, pagination
- **User Request Tracking**: Per-user request history, permission validation
- **Media Search**: TMDB integration, result filtering, content discovery
- **Error Resilience**: Authentication failures, rate limiting, service outages
- **Circuit Breaker**: Failure counting, timeout handling, recovery validation
- **Contract Validation**: Response structure validation, data type checking

**Critical Scenarios**:

- Invalid API key handling
- Non-existent request operations (404 errors)
- Service degradation simulation
- Large dataset handling (100+ requests)
- Concurrent request processing

### 📊 Uptime Kuma Client Tests (`integrations/uptime-kuma-client.test.ts`)

**Purpose**: Validate WebSocket-based real-time monitoring integration

**Key Test Areas**:

- **Connection Management**: WebSocket establishment, authentication, disconnection
- **Monitor Management**: Monitor list parsing, status tracking, configuration updates
- **Real-time Updates**: Heartbeat processing, status changes, statistics calculation
- **Connection Resilience**: Ping/pong handling, timeout detection, reconnection logic
- **Event Processing**: Message parsing, event emission, error handling
- **Performance**: High-frequency events, memory management, concurrent operations

**Critical Scenarios**:

- WebSocket connection failures and timeouts
- Malformed message handling
- Rapid monitor status changes
- Large monitor datasets (100+ monitors)
- Connection loss and recovery scenarios

### ⚡ Circuit Breaker Tests (`utils/circuit-breaker.test.ts`)

**Purpose**: Ensure circuit breaker pattern implementation correctness

**Key Test Areas**:

- **State Transitions**: CLOSED → OPEN → HALF_OPEN → CLOSED flows
- **Error Classification**: Expected vs unexpected error handling
- **Failure Counting**: Threshold tracking, success reset logic
- **Timing Management**: Reset timeout behavior, state transition timing
- **Manual Control**: Manual reset, force open/close operations
- **Concurrency**: Thread safety, concurrent operation handling

**Critical Scenarios**:

- Threshold boundary testing (exactly at failure limit)
- Mixed success/failure patterns
- Rapid successive operations
- Timeout and recovery scenarios
- Edge cases with null/undefined errors

### 🔄 Service Degradation Tests (`services/service-degradation.test.ts`)

**Purpose**: Validate graceful degradation and fallback mechanisms

**Key Test Areas**:

- **Partial Service Failures**: Single service outages, system health calculation
- **Fallback Mechanisms**: Cached data usage, graceful error responses
- **Recovery Scenarios**: Service restoration, health status updates
- **Circuit Breaker Integration**: State reflection in health status
- **Resource Management**: Redis failures, memory pressure handling
- **Event Handling**: Health change notifications, recovery events

**Critical Scenarios**:

- All services failing simultaneously
- Intermittent network failures
- Authentication/configuration errors
- Redis connection loss
- Concurrent health check failures

### 🌐 WebSocket Event Tests (`websocket/websocket-events.test.ts`)

**Purpose**: Ensure real-time event processing and WebSocket reliability

**Key Test Areas**:

- **Real-time Updates**: Monitor status changes, heartbeat processing
- **Dynamic Management**: Monitor addition/removal, configuration changes
- **Event Performance**: High-frequency events, memory management
- **Connection Events**: Connect/disconnect handling, error processing
- **Concurrent Operations**: Multiple simultaneous events, data consistency

**Critical Scenarios**:

- 1000+ rapid events processing
- Concurrent monitor updates
- WebSocket connection instability
- Large-scale monitor management (100+ monitors)
- Memory leak prevention

## Enhanced MSW Handlers

The test suite includes comprehensive MSW (Mock Service Worker) handlers that simulate realistic external service behaviors:

### 🎭 Mock Features

**Plex API Mocking**:

- Complete OAuth PIN flow simulation
- User authentication with multiple token scenarios
- Server discovery and library enumeration
- Media search and metadata retrieval
- Error simulation (503, 401, timeouts)

**Overseerr API Mocking**:

- Status and settings endpoints
- Request lifecycle management
- Media search with TMDB-like responses
- Authentication and error scenarios
- Pagination and filtering support

**Network Condition Simulation**:

- Timeout scenarios (6+ second delays)
- Service unavailable conditions
- Rate limiting responses
- Connection errors
- Malformed response handling

### 🎛️ Mock State Control

```typescript
// Control mock behavior during tests
mockState.plexDown = true; // Simulate Plex outage
mockState.overseerrSlowResponse = true; // Simulate slow responses
mockState.resetFailures(); // Reset failure counters
```

## Running Tests

### 🚀 Quick Start

```bash
# Run all service integration tests
npm run test:service-integration

# Or using the test runner script
./tests/integration/run-service-integration-tests.sh
```

### 🎯 Targeted Testing

```bash
# Run specific test categories
./tests/integration/run-service-integration-tests.sh plex
./tests/integration/run-service-integration-tests.sh overseerr
./tests/integration/run-service-integration-tests.sh circuit-breaker
./tests/integration/run-service-integration-tests.sh degradation
./tests/integration/run-service-integration-tests.sh websocket

# Run with coverage
./tests/integration/run-service-integration-tests.sh --coverage
```

### 📊 Test Execution Examples

```bash
# Individual test suites
npx vitest run tests/integration/integrations/plex-api-client.test.ts
npx vitest run tests/integration/services/service-degradation.test.ts

# Watch mode for development
npx vitest watch tests/integration/integrations/

# Coverage reporting
npx vitest run tests/integration/ --coverage
```

## Test Validation Areas

### ✅ API Contract Compliance

- **Request/Response Structure**: Validate exact API response formats
- **Data Type Validation**: Ensure correct typing of all fields
- **Required Field Presence**: Verify mandatory fields exist
- **Relationship Integrity**: Check data consistency across related objects

### ✅ Error Handling Robustness

- **HTTP Error Codes**: 401, 403, 404, 429, 500, 503 handling
- **Network Conditions**: Timeouts, connection failures, DNS issues
- **Malformed Data**: Invalid JSON, missing fields, wrong types
- **Authentication Issues**: Expired tokens, invalid credentials

### ✅ Circuit Breaker Functionality

- **State Transitions**: Proper CLOSED → OPEN → HALF_OPEN flows
- **Failure Thresholds**: Accurate counting and threshold enforcement
- **Recovery Logic**: Successful transition back to CLOSED state
- **Manual Control**: Reset, force open/close operations

### ✅ Service Degradation Handling

- **Graceful Failures**: System continues with reduced functionality
- **Fallback Mechanisms**: Cached data usage, default responses
- **Health Monitoring**: Accurate service status reporting
- **Recovery Detection**: Automatic service restoration recognition

### ✅ Real-time Event Processing

- **WebSocket Reliability**: Connection management, reconnection logic
- **Event Ordering**: Proper sequence handling of rapid events
- **Performance**: Efficient processing of high-frequency updates
- **Memory Management**: No memory leaks with continuous events

## Performance Benchmarks

The tests include performance validations to ensure efficiency:

- **Concurrent Requests**: Handle 5+ simultaneous API calls
- **High-frequency Events**: Process 1000+ WebSocket events efficiently
- **Large Datasets**: Manage 100+ monitors/requests without degradation
- **Response Times**: API calls complete within timeout thresholds
- **Memory Usage**: No memory leaks with continuous operation

## Integration with CI/CD

These tests are designed for continuous integration environments:

- **Isolated Execution**: No external service dependencies
- **Deterministic Results**: Consistent outcomes across environments
- **Fast Execution**: Complete test suite runs in under 5 minutes
- **Clear Reporting**: Detailed failure information and coverage data

## Maintenance Guidelines

### 🔧 Adding New Tests

1. **Follow Naming Conventions**: `service-name-client.test.ts`
2. **Use Consistent Structure**: Authentication → Core Features → Error Handling
3. **Mock Realistic Scenarios**: Base mocks on actual API documentation
4. **Include Performance Tests**: Validate efficiency and resource usage
5. **Document Critical Scenarios**: Explain important test cases

### 🔄 Updating Tests

1. **API Changes**: Update mocks and expected responses
2. **New Error Conditions**: Add realistic error scenarios
3. **Performance Thresholds**: Adjust based on production metrics
4. **Contract Evolution**: Maintain backward compatibility testing

### 📈 Monitoring Test Health

1. **Execution Time**: Watch for test suite slowdown
2. **Flaky Tests**: Address intermittent failures immediately
3. **Coverage Metrics**: Maintain 80%+ coverage for critical paths
4. **Mock Accuracy**: Keep mocks synchronized with real APIs

This comprehensive test suite ensures MediaNest's service integrations are robust, reliable, and maintainable across all deployment scenarios.
