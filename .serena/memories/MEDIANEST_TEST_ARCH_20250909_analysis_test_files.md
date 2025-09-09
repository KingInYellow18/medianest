# MediaNest Test Files Catalog

## COMPLETE TEST FILE INVENTORY

### Backend Test Files (31 files)

#### Authentication Tests:
- `backend/tests/auth/jwt-facade.test.ts`
- `backend/tests/auth/authentication-facade.test.ts`  
- `backend/tests/auth/auth-middleware.test.ts`

#### End-to-End Tests (Playwright):
- `backend/tests/e2e/auth/authorization.spec.ts`
- `backend/tests/e2e/auth/test-id-coverage.spec.ts`
- `backend/tests/e2e/auth/admin-bootstrap.spec.ts`
- `backend/tests/e2e/auth/session-management.spec.ts`
- `backend/tests/e2e/auth/plex-oauth-flow.spec.ts`
- `backend/tests/e2e/auth.spec.ts`
- `backend/tests/e2e/media/error-handling.spec.ts`
- `backend/tests/e2e/media/responsive-performance.spec.ts`
- `backend/tests/e2e/media/security-isolation.spec.ts`
- `backend/tests/e2e/media/media-request-workflow.spec.ts`
- `backend/tests/e2e/media/health-check.spec.ts`
- `backend/tests/e2e/media-request.spec.ts`
- `backend/tests/e2e/end-to-end-workflows.test.ts`

#### Integration Tests:
- `backend/tests/integration/service-integration.test.ts`
- `backend/tests/integration/third-party-integration.test.ts`
- `backend/tests/integration/api-endpoints-comprehensive.test.ts`
- `backend/tests/integration/frontend-backend-integration.test.ts`
- `backend/tests/integration/api-integration.test.ts`
- `backend/tests/integration/database-transaction-tests.test.ts`
- `backend/tests/integration/external-api-integration.test.ts`
- `backend/tests/integration/comprehensive-api-integration.test.ts`

#### Unit Tests:
- `backend/tests/unit/core-business-logic.test.ts`
- `backend/tests/unit/controllers-validation.test.ts`

#### Performance Tests:
- `backend/tests/performance/load-testing.test.ts`
- `backend/tests/performance/load-testing-enhanced.test.ts`

#### Security Tests:
- `backend/tests/security/security-penetration.test.ts`
- `backend/tests/security/security-integration.test.ts`

#### Comprehensive Tests:
- `backend/tests/emergency-core-tests.test.ts`
- `backend/tests/comprehensive-coverage-report.test.ts`

### Root-Level Test Files (10 files)

#### Authentication:
- `tests/auth/auth-middleware-fixed.test.ts`

#### Monitoring:
- `tests/monitoring/prometheus-metrics.test.ts`

#### Unit Tests by Category:
- `tests/unit/middleware/error.middleware.test.ts`
- `tests/unit/repositories/user.repository.test.ts`
- `tests/unit/services/user.service.test.ts`
- `tests/unit/controllers/auth.controller.test.ts`
- `tests/unit/utils/validation.test.ts`

#### Security & Integration:
- `tests/security/auth-bypass-prevention.test.ts`
- `tests/integration/test-infrastructure.integration.test.ts`
- `tests/integration/api/auth.integration.test.ts`

#### End-to-End:
- `tests/e2e/master-e2e-orchestrator.spec.ts`

### Shared Package Tests (1 file)
- `shared/src/__tests__/example.test.ts` - **MINIMAL COVERAGE**

### Configuration Files Identified

#### Test Environment Files:
- `.env.test.example`
- `frontend/tsconfig.test.json`
- `backend/tsconfig.test.json`
- `docker-compose.test.yml`
- `backend/docker-compose.test.yml`

#### Setup Files:
- `backend/src/__tests__/setup.ts`
- `backend/tests/setup.ts` 
- `frontend/tests/setup.ts`
- `tests/setup.ts`
- `backend/tests/msw/setup.ts`

### Missing/Referenced But Non-Existent Files

Based on configuration analysis, these files are referenced but missing:
- `frontend/src/__tests__/setup.ts` (referenced in vitest.config)
- Multiple frontend component tests (dead code references)
- Frontend hook tests (configuration expects them)