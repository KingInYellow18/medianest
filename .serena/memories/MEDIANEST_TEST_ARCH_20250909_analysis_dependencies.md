# MediaNest Test Dependencies Analysis

## TESTING FRAMEWORK DEPENDENCIES

### Primary Testing Stack

#### Core Test Framework: **Vitest v2.x**
```json
"vitest": "^2.0.0"
```

**Advantages:**
- Native Vite integration
- Fast HMR during test development  
- Modern ES modules support
- TypeScript out-of-the-box
- Compatible with Jest API

**Configuration Files:**
- `vitest.config.ts` (root)
- `vitest.workspace.ts` (multi-package orchestration)
- `backend/vitest.config.ts`
- `frontend/vitest.config.ts`
- `shared/vitest.config.ts`

#### End-to-End Testing: **Playwright**
```json
"@playwright/test": "^1.40.0"
```

**Configuration:**
- `backend/tests/e2e/playwright.config.ts`
- Docker integration support
- Cross-browser testing capabilities

#### Testing Libraries

**React Testing:**
```json
"@testing-library/react": "^14.0.0",
"@testing-library/jest-dom": "^6.0.0",
"@testing-library/user-event": "^14.0.0"
```

**Mock Service Worker:**
```json
"msw": "^2.0.0"
```
- API mocking capabilities
- Browser and Node.js support
- Setup: `backend/tests/msw/setup.ts`

### Framework Conflicts & Issues

#### DUPLICATE FRAMEWORK PROBLEM:
**Both Jest and Vitest configured:**

1. **Jest Configuration:**
   - `backend/tests/integration/jest.config.integration.js`
   - `@types/jest: ^29.5.0`

2. **Vitest Configuration:**
   - Multiple vitest.config.ts files
   - Workspace-based setup

**RECOMMENDATION:** Standardize on Vitest, remove Jest

#### Version Compatibility Issues:

**TypeScript Support:**
```json
"typescript": "^5.2.0"
"@types/node": "^20.8.0"
```

**Test Type Definitions:**
- `vitest/globals` configured globally
- `@testing-library/jest-dom` for DOM assertions

### Mock & Stub Dependencies

#### Service Mocking:
- **MSW (Mock Service Worker)**: API response mocking
- **vi.mock()**: Vitest native mocking
- Custom mocks in `backend/tests/mocks/`

#### Database Mocking:
- Prisma mock setup
- Redis mock infrastructure
- SQLite in-memory for tests

### Test Utility Dependencies

#### Assertion Libraries:
- Native Vitest assertions
- `@testing-library/jest-dom` matchers
- Custom assertion helpers

#### Test Data Management:
- Factories in `backend/tests/shared/factories/`
- Fixtures in `backend/tests/fixtures/`
- Builder pattern implementations

### CI/CD Integration Dependencies

#### Available but Unused:
```json
"cypress": "^15.1.0"
```
- Installed but no configuration found
- Potential removal candidate

#### Docker Test Integration:
- `docker-compose.test.yml`
- Test environment containerization
- E2E test infrastructure

### Performance & Coverage Tools

#### Coverage Analysis:
- Vitest built-in coverage via `v8`
- Configuration in workspace files

#### Performance Testing:
- Custom load testing implementations
- No external performance test dependencies

### Security Testing Dependencies

#### Security Test Framework:
- Custom security test runners
- Integration with main test suite
- Security-specific assertions

### DEPENDENCY RECOMMENDATIONS

#### REMOVE:
1. **Jest dependencies** (migrate to Vitest fully)
2. **Cypress** (unused, 15MB+ package)
3. **Duplicate @types packages**

#### CONSOLIDATE:
1. **Single vitest version** across workspace
2. **Unified test setup** strategy
3. **Consistent mock approaches**

#### ADD:
1. **@vitest/ui** for better test debugging
2. **Test data generators** for better fixtures
3. **Contract testing** tools for API validation