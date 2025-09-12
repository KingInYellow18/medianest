# Security Test Suite

This directory contains comprehensive security tests for MediaNest's authentication, authorization, and data protection systems.

## Test Categories

### 1. User Data Isolation (`user-data-isolation.test.ts`)

- **Purpose**: Validates that users cannot access each other's data
- **Coverage**:
  - Media request isolation between users
  - User profile data protection
  - Cross-user session isolation
  - Administrative access controls
  - Database query injection prevention
  - Data leakage prevention in pagination and errors
  - Concurrent access security

### 2. Authentication Bypass Prevention (`authentication-bypass.test.ts`)

- **Purpose**: Tests against various authentication bypass attempts
- **Coverage**:
  - Token tampering prevention (signature, payload, secret)
  - Session token validation
  - Authorization header bypass attempts
  - Cookie-based auth security
  - Protected endpoint access controls
  - Role escalation prevention
  - Timing attack prevention
  - Request forgery prevention
  - Error information disclosure prevention

### 3. Session Management Security (`session-management.test.ts`)

- **Purpose**: Validates secure session handling and lifecycle
- **Coverage**:
  - Session creation and validation security
  - Session hijacking prevention
  - Session fixation prevention
  - Concurrent session management
  - Redis session security
  - Session logout security
  - Session security headers
  - Session cleanup and maintenance

### 4. Authorization & RBAC (`authorization-rbac.test.ts`)

- **Purpose**: Tests role-based access control and authorization
- **Coverage**:
  - Admin-only endpoint protection
  - Moderator-level access controls
  - User-level endpoint access
  - Resource-level authorization
  - Privilege escalation prevention
  - Context-based authorization
  - Cross-tenant security
  - Dynamic authorization
  - Error handling security
  - Authorization middleware chain
  - Concurrent authorization

### 5. Input Validation & Injection Prevention (`input-validation-injection.test.ts`)

- **Purpose**: Comprehensive injection attack prevention testing
- **Coverage**:
  - SQL injection prevention (parameters, queries, filters, sorting)
  - NoSQL injection prevention
  - XSS prevention in text fields and responses
  - Command injection prevention
  - Path traversal prevention
  - Header injection (CRLF) prevention
  - JSON injection and prototype pollution prevention
  - LDAP injection prevention
  - XML/XXE prevention
  - Mass assignment prevention
  - Regular expression DoS (ReDoS) prevention
  - Buffer overflow prevention
  - Input sanitization and encoding

### 6. Rate Limiting & Bypass Prevention (`rate-limiting-bypass.test.ts`)

- **Purpose**: Tests rate limiting enforcement and bypass prevention
- **Coverage**:
  - API rate limiting (general, per-user, IP-based)
  - Authentication endpoint rate limiting
  - YouTube download rate limiting
  - Media request rate limiting
  - Rate limit bypass prevention (user agents, headers, session rotation)
  - Rate limit error handling
  - Redis operations for rate limiting
  - Rate limit window behavior
  - Rate limit monitoring and logging
  - Administrative rate limit controls

## Security Testing Principles

### 1. Real Environment Testing

- Tests use actual database and Redis connections
- No mocking of security-critical components
- Realistic data and user scenarios

### 2. Negative Testing

- Tests that should fail when security is violated
- Validation that attacks are properly blocked
- Error handling doesn't leak information

### 3. Concurrent Access Testing

- Multi-user scenarios
- Race condition prevention
- Session isolation under load

### 4. Comprehensive Attack Vectors

- Common injection techniques
- Authentication bypass methods
- Authorization escalation attempts
- Rate limit circumvention techniques

## Running Security Tests

### Run All Security Tests

```bash
npm test tests/integration/security/
```

### Run Individual Test Suites

```bash
# User data isolation
npm test tests/integration/security/user-data-isolation.test.ts

# Authentication bypass prevention
npm test tests/integration/security/authentication-bypass.test.ts

# Session management security
npm test tests/integration/security/session-management.test.ts

# Authorization and RBAC
npm test tests/integration/security/authorization-rbac.test.ts

# Input validation and injection prevention
npm test tests/integration/security/input-validation-injection.test.ts

# Rate limiting and bypass prevention
npm test tests/integration/security/rate-limiting-bypass.test.ts
```

### Run with Coverage

```bash
npm run test:coverage -- tests/integration/security/
```

## Test Data and Setup

Each test suite:

1. Clears the database before each test
2. Creates fresh test users with different roles
3. Generates valid authentication tokens
4. Cleans up Redis rate limit counters
5. Closes database connections after completion

## Security Test Expectations

### What Should Pass

- Legitimate user operations within their scope
- Proper error messages without information leakage
- Rate limiting within configured bounds
- Secure session management
- Proper data isolation

### What Should Fail

- Cross-user data access attempts
- Authentication bypass attempts
- Injection attacks (SQL, NoSQL, XSS, etc.)
- Rate limit bypass attempts
- Privilege escalation attempts

## Monitoring and Alerts

These tests serve as:

1. **Regression Prevention**: Ensure security features remain intact
2. **Attack Detection**: Validate that attacks are properly blocked
3. **Compliance Verification**: Ensure security requirements are met
4. **Performance Validation**: Security doesn't break legitimate usage

## Adding New Security Tests

When adding new security tests:

1. Follow the existing pattern:
   - Clear database before each test
   - Create necessary test users and data
   - Test both positive and negative cases
   - Clean up after tests

2. Cover these aspects:
   - **Authentication**: Who can access?
   - **Authorization**: What can they access?
   - **Data Isolation**: Can they access others' data?
   - **Input Validation**: Are malicious inputs blocked?
   - **Rate Limiting**: Are abuse attempts prevented?

3. Test realistic scenarios:
   - Use actual payloads that attackers would try
   - Test with multiple users and concurrent access
   - Validate error responses don't leak information

## Critical Security Metrics

The security test suite validates these key metrics:

- **Zero Cross-User Data Leaks**: No user should access another user's data
- **Authentication Integrity**: All bypass attempts should fail
- **Authorization Enforcement**: Role-based access should be strictly enforced
- **Injection Prevention**: All injection attempts should be blocked
- **Rate Limit Effectiveness**: Abuse should be prevented while allowing legitimate use
- **Session Security**: Session management should prevent hijacking and fixation

## Compliance and Standards

These tests help ensure compliance with:

- OWASP Top 10 security risks
- Authentication best practices
- Data protection principles
- Rate limiting standards
- Session management security guidelines
