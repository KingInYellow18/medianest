# Test Suite Documentation

## Overview
This document provides comprehensive documentation for the MediaNest test suite, covering architecture, execution procedures, writing standards, maintenance, and troubleshooting.

## Table of Contents
1. [Test Architecture](#test-architecture)
2. [Running Tests](#running-tests)
3. [Writing Tests](#writing-tests)
4. [Test Maintenance](#test-maintenance)
5. [Troubleshooting](#troubleshooting)
6. [Performance Optimization](#performance-optimization)
7. [Coverage Monitoring](#coverage-monitoring)

## Test Architecture

### Technology Stack
- **Test Framework**: Vitest (v2.1.9+ backend, v3.2.4 shared)
- **E2E Testing**: Playwright (v1.55.0)
- **Frontend Testing**: React Testing Library with jsdom environment
- **Backend Testing**: Node environment with comprehensive mocking
- **Coverage**: V8 provider with HTML, JSON, and text reporting

### Workspace Structure
The project uses a Vitest workspace configuration (`vitest.workspace.ts`) with three main test environments:

```
medianest/
├── backend/tests/          # Backend unit/integration tests
├── frontend/tests/         # Frontend component/unit tests  
├── shared/tests/           # Shared library tests
├── tests/                  # Root level integration tests
└── tests/edge-cases/       # Edge case testing framework
```

### Test Categories

#### 1. Unit Tests
- **Location**: `*/src/**/*.test.ts`, `*/tests/unit/`
- **Purpose**: Test individual functions, classes, and components
- **Environment**: Isolated with comprehensive mocking
- **Coverage Target**: 70%+ (backend), 60%+ (frontend/shared)

#### 2. Integration Tests  
- **Location**: `backend/tests/integration/`, `tests/`
- **Purpose**: Test service interactions, API endpoints, database operations
- **Environment**: Dockerized test databases (PostgreSQL, Redis)
- **Coverage**: Critical path validation

#### 3. End-to-End Tests
- **Location**: `backend/tests/e2e/`
- **Framework**: Playwright
- **Purpose**: Full user workflow validation
- **Environment**: Complete application stack

#### 4. Security Tests
- **Location**: `backend/tests/security/`
- **Purpose**: Authentication, authorization, input validation
- **Tools**: Custom security test runners
- **Scope**: Penetration testing, vulnerability scanning

#### 5. Performance Tests
- **Location**: `backend/tests/performance/`
- **Purpose**: Load testing, response time validation
- **Tools**: Custom load testing framework
- **Metrics**: Response time, throughput, resource usage

#### 6. Edge Case Tests
- **Location**: `tests/edge-cases/`
- **Purpose**: Boundary conditions, error scenarios
- **Framework**: Custom edge case testing framework
- **Coverage**: Error handling, edge conditions

## Configuration Files

### Backend (`backend/vitest.config.ts`)
```typescript
- Environment: Node.js
- Setup: ./tests/setup.ts
- Coverage: 70% thresholds
- Timeout: 30 seconds
- Pool: Forks with isolation
- Test DBs: PostgreSQL (port 5433), Redis (port 6380)
```

### Frontend (`frontend/vitest.config.mts`)
```typescript  
- Environment: jsdom
- Setup: ./tests/setup.ts
- Coverage: 60% thresholds
- Pool: Threads (single thread)
- Framework: React Testing Library
```

### Shared (`shared/vitest.config.ts`)
```typescript
- Environment: Node.js
- Coverage: 60% thresholds
- Purpose: Utility and common library testing
```

## Test Infrastructure

### Database Testing
- **Test Database**: `medianest_test` (PostgreSQL)
- **Connection**: Isolated test connection pool
- **Migrations**: Automated setup/teardown
- **Data**: Fixture-based test data management

### Redis Testing  
- **Test Instance**: Redis DB 15 (isolated)
- **Mocking**: Comprehensive Redis mock for unit tests
- **Integration**: Real Redis instance for integration tests

### Authentication Testing
- **JWT**: Test-specific secrets and configuration
- **Sessions**: Isolated session management
- **Permissions**: Role-based access testing

### External Service Mocking
- **Plex API**: MSW-based request interceptors
- **HTTP Clients**: Axios and fetch mocking
- **WebSocket**: Socket.io mock implementations

## Next Steps
This documentation continues with detailed sections on running tests, writing standards, maintenance procedures, troubleshooting guides, performance optimization, and coverage monitoring. Each section provides practical, actionable guidance for developers working with the test suite.