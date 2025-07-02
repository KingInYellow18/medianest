# Phase 1 Testing Checklist

This checklist ensures all Phase 1 components are properly tested according to the test architecture strategy.

## Overall Requirements
- [ ] All tests run in < 3 minutes
- [ ] Overall code coverage > 80%
- [ ] Critical path coverage > 95%
- [ ] No flaky tests (failure rate < 2%)
- [ ] All tests pass in CI/CD pipeline

## Testing Setup (Task 11)
- [ ] Vitest configured for backend
- [ ] Vitest configured for frontend
- [ ] Test containers working
- [ ] MSW configured for API mocking
- [ ] Coverage reporting enabled
- [ ] CI/CD pipeline includes tests

## Unit Tests

### Backend Components
- [ ] **Configuration** (config/index.ts)
  - Environment validation
  - Default values
  - Missing required values

- [ ] **Database Utilities** (utils/database.ts)
  - Connection management
  - Transaction helpers
  - Error handling

- [ ] **Logger** (utils/logger.ts)
  - Log formatting
  - Performance timer
  - Different log levels

- [ ] **Crypto Utilities** (utils/crypto.ts)
  - Encryption/decryption
  - Token hashing
  - Key generation

- [ ] **Auth Service** (services/auth.service.ts)
  - Plex PIN creation
  - PIN verification
  - Admin login
  - Token generation
  - Remember me tokens

- [ ] **JWT Middleware** (middleware/auth.ts)
  - Token extraction
  - Token validation
  - Role checking
  - Error responses

- [ ] **Rate Limiter** (middleware/rate-limiter.ts)
  - Request counting
  - Time windows
  - Admin bypass
  - Headers

- [ ] **Error Handler** (middleware/errorHandler.ts)
  - Error formatting
  - User-friendly messages
  - Correlation IDs
  - Stack traces (dev only)

### Frontend Components
- [ ] **Theme Toggle** (components/theme-toggle.tsx)
  - Theme switching
  - Persistence
  - SSR safety

- [ ] **Auth Guard** (components/auth-guard.tsx)
  - Authentication check
  - Role verification
  - Redirect logic

- [ ] **Login Page** (app/auth/login/page.tsx)
  - Plex login flow
  - Admin login form
  - Error display
  - Loading states

- [ ] **useAuth Hook** (hooks/useAuth.ts)
  - Login methods
  - Session checking
  - Token storage
  - Logout

## Integration Tests

### API Endpoints
- [ ] **POST /api/auth/plex/pin**
  - Success response
  - External service failure

- [ ] **POST /api/auth/plex/check**
  - Authorized PIN
  - Unauthorized PIN
  - Invalid PIN ID

- [ ] **POST /api/auth/admin**
  - Valid credentials
  - Invalid credentials
  - Rate limiting

- [ ] **POST /api/auth/logout**
  - Session cleanup
  - Cookie clearing

- [ ] **GET /api/health**
  - Basic health check
  - Detailed health with service status

### Database Operations
- [ ] User creation/update
- [ ] Session management
- [ ] Activity logging
- [ ] Transaction rollback

### Redis Operations
- [ ] Session storage/retrieval
- [ ] Rate limit tracking
- [ ] Cache operations
- [ ] Queue functionality

### External Service Integration
- [ ] Plex API mocking
- [ ] Circuit breaker behavior
- [ ] Timeout handling
- [ ] Error responses

## Security Tests
- [ ] **Authentication**
  - No token rejection
  - Invalid token rejection
  - Expired token handling
  - Suspended user blocking

- [ ] **Authorization**
  - Admin-only endpoints
  - User data isolation
  - Role verification

- [ ] **Input Validation**
  - XSS prevention
  - SQL injection prevention
  - Type validation
  - Size limits

- [ ] **Rate Limiting**
  - Request limits enforced
  - Time windows reset
  - Headers accurate
  - 429 responses

- [ ] **Security Headers**
  - CORS configuration
  - XSS protection
  - Content type options
  - Frame options

## E2E Tests (Critical Flows Only)
- [ ] **Plex Authentication Flow**
  - PIN generation
  - Code display
  - Authorization polling
  - Dashboard redirect

- [ ] **Admin Login Flow**
  - Form submission
  - Password change prompt
  - Dashboard access

- [ ] **Protected Route Access**
  - Unauthorized redirect
  - Authorized access
  - Token refresh

- [ ] **Rate Limit Enforcement**
  - Multiple failed attempts
  - Lockout behavior
  - Retry after period

## Performance Tests
- [ ] API response time < 1s (p95)
- [ ] Database queries < 100ms
- [ ] Redis operations < 10ms
- [ ] Frontend bundle size reasonable
- [ ] Memory usage stable

## Test Quality Metrics
- [ ] Tests follow AAA pattern
- [ ] No hardcoded values
- [ ] Proper async handling
- [ ] Meaningful assertions
- [ ] Clear test descriptions
- [ ] No test interdependencies

## Documentation
- [ ] Test setup documented
- [ ] Common issues documented
- [ ] Coverage reports available
- [ ] CI/CD status visible

## Before Marking Phase 1 Complete
1. Run full test suite: `npm test`
2. Check coverage: `npm run test:coverage`
3. Run E2E tests: `npm run test:e2e`
4. Verify CI pipeline green
5. Review coverage reports
6. Fix any flaky tests
7. Update documentation

## Notes
- Focus on behavior, not implementation
- Mock external services consistently
- Use test fixtures for common data
- Keep tests simple and focused
- Prioritize critical path testing