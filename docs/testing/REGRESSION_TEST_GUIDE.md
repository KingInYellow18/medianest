# MediaNest Regression Testing Guide

**Version**: 2.0  
**Last Updated**: September 10, 2025  
**Scope**: Complete application regression testing strategy

## Executive Summary

This guide provides comprehensive instructions for regression testing MediaNest, ensuring that new changes don't break existing functionality. It covers critical test scenarios, automated regression suites, and manual validation procedures.

## What is Regression Testing?

Regression testing validates that recent changes haven't adversely affected existing features. For MediaNest, this includes:

- **Feature Regression**: Existing functionality continues to work
- **Security Regression**: Security measures remain intact  
- **Performance Regression**: System performance hasn't degraded
- **Integration Regression**: External service integrations remain stable

## Critical Test Scenarios

### 1. Authentication & Authorization Flows

#### Primary Authentication Scenarios
```typescript
// Test Scenario: Complete Plex OAuth Flow
describe('Plex OAuth Regression', () => {
  const testSteps = [
    'Generate Plex PIN request',
    'User authenticates with Plex',  
    'Verify PIN and create session',
    'Access protected resources',
    'Session expiration handling',
    'Token refresh workflow'
  ];
});
```

**Critical Points to Validate**:
- PIN generation returns valid 4-digit code
- OAuth redirect handles Plex server responses
- JWT tokens are properly formatted and signed
- Session persistence across browser refreshes
- Multi-device session management
- Graceful handling of expired tokens

#### Role-Based Access Control (RBAC)
```typescript
// Test Scenario: Admin vs User Permissions
const testRBAC = async () => {
  // Admin-only endpoints
  await testAdminAccess('/api/v1/admin/users');
  await testAdminAccess('/api/v1/admin/services');
  await testAdminAccess('/api/v1/admin/stats');
  
  // User endpoints should be accessible
  await testUserAccess('/api/v1/media/search');
  await testUserAccess('/api/v1/media/requests');
};
```

**Validation Points**:
- Admin users can access all admin endpoints
- Regular users receive 403 for admin endpoints
- User role changes take effect immediately
- Session maintains correct permissions

### 2. Media Management Workflows

#### Media Search & Discovery
```typescript
// Test Scenario: Search Functionality
describe('Media Search Regression', () => {
  const searchScenarios = [
    { query: 'Inception', expectedResults: true },
    { query: 'NonexistentMovie2024', expectedResults: false },
    { query: '', expectedValidation: 'Query required' },
    { query: '<script>alert("xss")</script>', expectedSanitized: true }
  ];
});
```

**Critical Validations**:
- Search returns accurate results from TMDB
- Empty/invalid queries are handled gracefully
- XSS attempts are properly sanitized
- Pagination works correctly for large result sets
- Response times remain under 2 seconds

#### Media Request Lifecycle  
```typescript
// Test Scenario: Complete Request Workflow
describe('Media Request Lifecycle', () => {
  const workflow = [
    'User searches for media',
    'User submits media request', 
    'Request appears in user dashboard',
    'Admin sees request in admin panel',
    'Request status updates propagate',
    'User receives status notifications'
  ];
});
```

**Key Checkpoints**:
- Duplicate request prevention works
- Request status updates correctly
- Email notifications are sent
- Request can be cancelled by user
- Admin can approve/reject requests

### 3. External Service Integrations

#### Plex Media Server Integration
```typescript
// Test Scenario: Plex Server Communication
describe('Plex Integration Regression', () => {
  const plexFeatures = [
    'Server connection and authentication',
    'Library discovery and enumeration',
    'Media search across libraries',
    'Recently added content retrieval',
    'Collection management',
    'Metadata synchronization'
  ];
});
```

**Integration Points**:
- Plex server connectivity and authentication
- Library access permissions
- Metadata retrieval accuracy
- Error handling for Plex server downtime
- Rate limiting compliance with Plex API

#### YouTube Download Integration
```typescript
// Test Scenario: YouTube Download Process  
describe('YouTube Download Regression', () => {
  const downloadWorkflow = [
    'User submits YouTube URL',
    'System validates URL format',
    'Metadata extraction via yt-dlp',
    'Download process initiation',
    'Progress tracking and updates',
    'Completion notification'
  ];
});
```

**Critical Validations**:
- URL validation prevents malicious inputs
- yt-dlp integration handles format changes
- Download progress reporting works
- File storage and cleanup functions
- Rate limiting prevents abuse (5 downloads/hour)

### 4. Security Critical Paths

#### Input Validation & Sanitization
```typescript
// Test Scenario: Security Input Handling
describe('Security Regression Tests', () => {
  const securityTests = [
    {
      input: '<script>alert("xss")</script>',
      expected: 'XSS_PREVENTED'
    },
    {
      input: "1; DROP TABLE users--",  
      expected: 'SQL_INJECTION_PREVENTED'
    },
    {
      input: '../../../etc/passwd',
      expected: 'PATH_TRAVERSAL_PREVENTED' 
    }
  ];
});
```

#### Authentication Security
```typescript
// Test Scenario: Authentication Security  
describe('Auth Security Regression', () => {
  const securityChecks = [
    'JWT signature validation',
    'Token expiration enforcement', 
    'CSRF token validation',
    'Rate limiting on auth endpoints',
    'Session fixation prevention',
    'Concurrent session handling'
  ];
});
```

### 5. Performance Critical Paths

#### API Response Time Validation
```typescript
// Test Scenario: Performance Regression
describe('Performance Benchmarks', () => {
  const benchmarks = [
    { endpoint: '/api/v1/health', maxTime: 500 },
    { endpoint: '/api/v1/media/search', maxTime: 2000 },
    { endpoint: '/api/v1/dashboard/stats', maxTime: 1500 },
    { endpoint: '/api/v1/plex/libraries', maxTime: 3000 }
  ];
});
```

#### Database Performance  
```typescript
// Test Scenario: Database Query Performance
describe('Database Performance Regression', () => {
  const dbTests = [
    'User lookup queries < 100ms',
    'Media search queries < 500ms', 
    'Admin stats queries < 1000ms',
    'Request creation < 200ms'
  ];
});
```

## Automated Regression Test Execution

### Running Complete Regression Suite

#### Command Line Execution
```bash
# Complete regression test suite
npm run test:regression

# Individual regression categories  
npm run test:regression:auth      # Authentication flows
npm run test:regression:media     # Media management
npm run test:regression:security  # Security validations
npm run test:regression:perf      # Performance benchmarks

# Integration regression tests
npm run test:integration:regression

# End-to-end regression scenarios
npm run test:e2e:regression
```

#### Continuous Integration Regression
```yaml
# .github/workflows/regression.yml
name: Regression Testing
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  regression:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite: [auth, media, security, performance]
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: npm run db:test:setup
        
      - name: Run regression suite
        run: npm run test:regression:${{ matrix.test-suite }}
        
      - name: Performance baseline check
        if: matrix.test-suite == 'performance'
        run: npm run test:perf:compare-baseline
```

### Test Execution Schedule

#### Development Workflow
- **Pre-commit**: Core regression tests (5 minutes)
- **Pull Request**: Full regression suite (15 minutes)
- **Daily**: Complete regression with performance baselines
- **Release**: Comprehensive regression including manual validation

#### Regression Test Timing
```bash
# Quick regression (pre-commit)
npm run test:regression:quick     # ~5 minutes

# Standard regression (PR validation)  
npm run test:regression:standard  # ~15 minutes

# Full regression (nightly/release)
npm run test:regression:full      # ~45 minutes
```

## Manual Regression Testing

### Pre-Release Manual Validation

#### User Experience Workflows
1. **New User Registration & Setup**
   - First-time user Plex OAuth flow
   - Dashboard initial state validation
   - Tutorial/onboarding experience

2. **Power User Workflows**  
   - Bulk media request submission
   - Advanced search with filters
   - Admin panel operations
   - Download management

3. **Error Recovery Scenarios**
   - Network connectivity issues
   - Plex server unavailability  
   - Database connection failures
   - File system space exhaustion

#### Cross-Browser Testing Matrix
```
Desktop Browsers:
├── Chrome (Latest)     ✅ Primary target
├── Firefox (Latest)   ✅ Secondary target  
├── Safari (Latest)    ⚠️  Limited testing
└── Edge (Latest)      ⚠️  Limited testing

Mobile Browsers:
├── Chrome Mobile      ⚠️  Responsive testing
├── Safari Mobile      ⚠️  iOS compatibility
└── Firefox Mobile     ❌ Not tested
```

#### Device & Resolution Testing
- Desktop: 1920x1080, 1366x768, 2560x1440
- Tablet: 1024x768, 768x1024
- Mobile: 375x667, 414x896, 360x640

### Critical Path Manual Validation

#### Authentication Flow (5-10 minutes)
```
Manual Test Steps:
1. Navigate to application root
2. Click "Login with Plex" 
3. Complete Plex OAuth flow
4. Verify dashboard loads correctly
5. Test protected route access
6. Verify logout functionality
7. Confirm session persistence
```

#### Media Request Flow (10-15 minutes)
```
Manual Test Steps:
1. Search for popular movie
2. Select from search results
3. Submit media request
4. Verify request appears in dashboard
5. Check admin panel shows request
6. Test request status updates
7. Verify email notifications
```

#### Admin Operations (15-20 minutes)
```
Manual Test Steps:  
1. Login as admin user
2. Access admin panel
3. View user management
4. Test role modifications
5. Check service health status
6. Verify system statistics
7. Test bulk operations
```

## Performance Regression Detection

### Baseline Performance Metrics

#### API Response Time Baselines
```json
{
  "performance_baselines": {
    "/api/v1/health": {
      "p50": 50,
      "p95": 150,
      "p99": 300
    },
    "/api/v1/media/search": {
      "p50": 800, 
      "p95": 1500,
      "p99": 2000
    },
    "/api/v1/dashboard/stats": {
      "p50": 600,
      "p95": 1200,
      "p99": 1800
    }
  }
}
```

#### Memory Usage Baselines
```bash
# Memory regression detection
npm run test:memory:baseline    # Establish baseline
npm run test:memory:compare     # Compare against baseline
```

#### Database Query Performance
```sql
-- Critical query performance monitoring
SELECT 
  query_type,
  avg_duration,
  baseline_duration,
  (avg_duration - baseline_duration) as regression
FROM performance_metrics 
WHERE regression > 0.2;  -- 20% regression threshold
```

### Performance Regression Alerts

#### Automated Performance Gates
```typescript
// Performance regression detection
describe('Performance Regression Detection', () => {
  it('should not exceed baseline response times', async () => {
    const baseline = await loadBaseline();
    const current = await measurePerformance();
    
    Object.keys(baseline).forEach(endpoint => {
      const regression = calculateRegression(
        baseline[endpoint], 
        current[endpoint]
      );
      
      expect(regression).toBeLessThan(0.2); // 20% threshold
    });
  });
});
```

## Regression Testing Scenarios by Component

### Database Regression Tests

#### Migration Regression
```bash
# Test database migration backwards compatibility
npm run db:migrate:rollback
npm run test:regression:db:rollback

# Test migration forwards
npm run db:migrate:latest  
npm run test:regression:db:forward
```

#### Data Integrity Regression  
```typescript
describe('Data Integrity Regression', () => {
  const tests = [
    'User data consistency across sessions',
    'Media request state transitions', 
    'Admin action audit trail accuracy',
    'Foreign key constraint validation',
    'Transaction rollback scenarios'
  ];
});
```

### Security Regression Tests

#### OWASP Top 10 Validation
```typescript  
describe('OWASP Security Regression', () => {
  const securityTests = [
    'A01_Broken_Access_Control',
    'A02_Cryptographic_Failures', 
    'A03_Injection_Attacks',
    'A04_Insecure_Design',
    'A05_Security_Misconfiguration',
    'A06_Vulnerable_Components',
    'A07_Authentication_Failures',
    'A08_Software_Integrity_Failures',
    'A09_Security_Logging_Failures',
    'A10_Server_Side_Request_Forgery'
  ];
});
```

### Integration Regression Tests

#### External Service Regression
```typescript
describe('External Service Regression', () => {
  const services = [
    {
      name: 'Plex API',
      endpoints: ['/server', '/libraries', '/search'],
      timeout: 5000
    },
    {
      name: 'TMDB API', 
      endpoints: ['/search/movie', '/movie/{id}'],
      rateLimit: true
    },
    {
      name: 'YouTube/yt-dlp',
      functionality: ['metadata', 'download', 'formats'],
      errorHandling: true
    }
  ];
});
```

## Regression Test Failure Analysis

### Failure Investigation Process

#### Step 1: Immediate Assessment
```bash
# Check if failure is environmental
npm run test:regression:env-check

# Verify test isolation  
npm run test:regression:isolation

# Compare against known good baseline
npm run test:regression:baseline-compare
```

#### Step 2: Root Cause Analysis
1. **Code Changes**: Compare with previous working commit
2. **Environment**: Check dependencies, configurations, external services
3. **Data**: Validate test data integrity and consistency  
4. **Timing**: Check for race conditions or timing-dependent failures

#### Step 3: Resolution & Prevention
1. **Fix Implementation**: Address root cause
2. **Test Enhancement**: Improve test robustness
3. **Documentation Update**: Record lessons learned
4. **Prevention Measures**: Add safeguards against similar issues

### Common Regression Patterns

#### Authentication Failures
- **Symptom**: JWT validation failing
- **Common Cause**: Secret key rotation, algorithm changes
- **Solution**: Environment variable validation, key versioning

#### Performance Regression
- **Symptom**: Response times exceeding baselines
- **Common Cause**: Database query changes, external API delays  
- **Solution**: Query optimization, caching implementation

#### Integration Failures
- **Symptom**: External service communication errors
- **Common Cause**: API changes, rate limiting, authentication
- **Solution**: API versioning, fallback mechanisms, better error handling

## Test Data Management for Regression

### Test Data Strategy

#### Seed Data for Regression Tests
```typescript
// Regression test data setup
const regressionTestData = {
  users: [
    { role: 'admin', username: 'regression_admin' },
    { role: 'user', username: 'regression_user' }
  ],
  mediaRequests: [
    { status: 'pending', tmdbId: 12345 },
    { status: 'approved', tmdbId: 67890 },
    { status: 'completed', tmdbId: 54321 }
  ],
  plexLibraries: [
    { name: 'Movies', key: '1' },
    { name: 'TV Shows', key: '2' }
  ]
};
```

#### Data Cleanup and Isolation
```typescript
beforeEach(async () => {
  await setupRegressionTestData();
});

afterEach(async () => {
  await cleanupRegressionTestData();
  await validateDatabaseState();
});
```

### Regression Test Environment

#### Environment Configuration
```bash
# Regression test environment variables
REGRESSION_TEST_DB_URL="postgresql://test:test@localhost:5432/medianest_regression"
REGRESSION_PLEX_TOKEN="regression_test_token"  
REGRESSION_RATE_LIMIT_DISABLED=true
REGRESSION_EMAIL_MOCK=true
```

#### External Service Mocking for Regression
```typescript
// Consistent regression test mocks
const regressionMocks = {
  plex: setupPlexMock({
    consistent: true,
    responseTime: 100
  }),
  tmdb: setupTMDBMock({
    dataset: 'regression_baseline'
  }),
  email: setupEmailMock({
    deliverySuccessRate: 1.0
  })
};
```

## Reporting and Metrics

### Regression Test Reporting

#### Test Results Dashboard
```
Regression Test Summary:
├── Authentication Tests:     ✅ 45/45 passed
├── Media Management Tests:   ✅ 67/67 passed  
├── Security Tests:          ❌ 3/15 failed
├── Performance Tests:       ⚠️  2/8 degraded
├── Integration Tests:       ✅ 23/23 passed
└── E2E Scenarios:          ✅ 12/12 passed

Total: 152/155 passed (98.1% success rate)
Performance Regression: 2 scenarios degraded
Security Issues: 3 critical failures requiring attention
```

#### Trend Analysis
```json
{
  "regression_trends": {
    "success_rate_7d": [98.5, 97.8, 98.1, 97.9, 98.3, 98.0, 98.1],
    "performance_regression_count": [0, 1, 2, 1, 0, 1, 2],
    "security_failure_count": [0, 0, 3, 2, 1, 0, 3],
    "avg_execution_time": [12.5, 13.1, 14.2, 13.8, 12.9, 13.5, 14.1]
  }
}
```

### Regression KPIs

#### Quality Metrics
- **Success Rate**: ≥ 98% regression test pass rate
- **Performance Stability**: < 20% response time increase
- **Security Compliance**: 100% security test pass rate
- **Coverage Stability**: Coverage doesn't decrease with changes

#### Operational Metrics  
- **Execution Time**: Complete regression suite < 45 minutes
- **Detection Speed**: Critical regressions caught within 1 hour
- **Resolution Time**: Regression fixes deployed within 4 hours
- **Prevention Rate**: < 5% regression escape to production

## Best Practices

### Regression Test Design Principles

1. **Stability**: Tests should be deterministic and reliable
2. **Independence**: Tests shouldn't depend on execution order
3. **Speed**: Balance comprehensive coverage with execution time
4. **Maintainability**: Easy to update and modify tests
5. **Clarity**: Clear failure messages and debugging information

### Test Maintenance

1. **Regular Review**: Monthly regression test effectiveness review
2. **Baseline Updates**: Update performance baselines quarterly
3. **Test Pruning**: Remove obsolete or redundant regression tests
4. **Enhancement**: Continuously improve test robustness

### Collaboration

1. **Developer Handoff**: Include regression scenarios in feature specifications
2. **QA Coordination**: Align manual and automated regression testing
3. **DevOps Integration**: Ensure regression tests work in CI/CD pipelines
4. **Stakeholder Communication**: Regular regression test status reporting

## Conclusion

This regression testing guide provides comprehensive coverage of MediaNest's critical functionality. Regular execution of these regression tests ensures system stability, security, and performance as the application evolves.

### Key Takeaways

1. **Automated First**: Prioritize automated regression tests for consistent execution
2. **Critical Path Focus**: Ensure all user-critical workflows are covered
3. **Performance Monitoring**: Continuous baseline comparison prevents degradation
4. **Security Vigilance**: Regular security regression prevents vulnerabilities
5. **Maintenance Discipline**: Keep regression tests current and effective

**Remember**: Regression testing is not just about finding bugs—it's about maintaining confidence in system reliability throughout the development lifecycle.