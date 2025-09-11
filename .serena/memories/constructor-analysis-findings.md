# Constructor Export Analysis - MediaNest Constructor Identity Failures

## Critical Issue Identified: AppError Constructor Identity Mismatch

### Root Cause

The MediaNest project has **duplicate AppError class definitions** causing constructor identity mismatches that lead to 30+ test failures.

### Duplicate Error Class Locations

#### 1. **Shared Package** (Canonical Source)

**File:** `/home/kinginyellow/projects/medianest/shared/src/errors/index.ts`

```typescript
export class AppError extends AppError {
  constructor(code: string, message: string, statusCode: number, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}
export class AuthenticationError extends AppError { ... }
export class NotFoundError extends AppError { ... }
// + other error classes
```

#### 2. **Backend Local Copy** (Problematic Duplicate)

**File:** `/home/kinginyellow/projects/medianest/backend/src/utils/errors.ts`

```typescript
export class AppError extends Error {
  constructor(code: string, message: string, statusCode: number = 500, details: any = {}) {
    // Different constructor signature than shared!
  }
}
export class AuthenticationError extends AppError { ... }
// Different implementation than shared!
```

### Test Import Analysis

#### Tests Using Wrong Import Paths (Causing Failures)

```typescript
// ❌ WRONG - Imports from local backend copy
import { AppError } from '../../../src/utils/errors';

// Files affected:
- backend/tests/unit/controllers/admin.controller.test.ts (line 5)
- backend/tests/unit/controllers/media.controller.test.ts (line 6)
- backend/tests/auth/jwt-facade.test.ts (line 3)
- backend/tests/auth/authentication-facade.test.ts (line 7)
- backend/tests/auth/auth-middleware.test.ts (line 7)
```

#### Controllers Using Correct Import Paths

```typescript
// ✅ CORRECT - Controllers properly import from shared
import { AppError } from '@medianest/shared';

// Files working correctly:
- backend/src/controllers/admin.controller.ts (line 5)
- backend/src/controllers/media.controller.ts (line 5)
```

### Constructor Identity Issue Explanation

When tests run:

1. **Controller creates error:** `throw new AppError()` using shared package constructor
2. **Test expects error:** `instanceof AppError` using local backend constructor
3. **instanceof fails:** Different constructor functions, even though class names match

### Test Failure Pattern

```typescript
// Test expectation (using local backend AppError)
expect(error).toBeInstanceOf(AppError); // ❌ FAILS

// Controller throws (using shared package AppError)
throw new AppError('VALIDATION_ERROR', 'message', 400); // Different constructor!
```

### Test Utilities Build Exclusion Impact

**File:** `shared/tsconfig.json` line 36:

```json
"exclude": ["src/test-utils/**/*"]
```

**Impact:** Test utilities like `ErrorTestFactory` and `MockErrorLogger` are excluded from the shared package build, making them unavailable for consumption by backend tests.

### Specific Test Failures (Sample)

#### MediaController Test Failures

- ❌ "should throw validation error for missing query" - `instanceof AppError` fails
- ❌ "should throw validation error for invalid mediaType" - `instanceof AppError` fails
- ❌ "should handle service errors" - `instanceof AppError` fails
- ❌ "should re-throw AppError without modification" - constructor mismatch

#### AdminController Test Failures

- ❌ "should handle database errors" - `instanceof AppError` fails

### Controllers NOT Exported from Shared Package

**Analysis Result:** Controllers (AdminController, HealthController, MediaController) are **NOT exported** from the shared package. They exist only in the backend and are correctly imported in tests from local backend paths.

The issue is **NOT with controller exports** but with **error class constructor identity mismatches**.

## Solutions Required

### 1. **Immediate Fix: Update Test Import Paths**

```typescript
// Change all test files from:
import { AppError } from '../../../src/utils/errors';
// To:
import { AppError } from '@medianest/shared';
```

### 2. **Remove Duplicate Backend Error Classes**

Delete or deprecate `backend/src/utils/errors.ts` to eliminate constructor conflicts.

### 3. **Fix Test Utilities Build**

Update `shared/tsconfig.json` to include test utilities in build:

```json
"include": ["src/**/*"],
"exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
// Remove: "src/test-utils/**/*"
```

### 4. **Verify Constructor Compatibility**

Ensure shared package AppError constructor signature matches usage patterns in controllers.

## Files Requiring Changes

### High Priority (Test Import Fixes)

1. `backend/tests/unit/controllers/admin.controller.test.ts` - Line 5
2. `backend/tests/unit/controllers/media.controller.test.ts` - Line 6
3. `backend/tests/unit/controllers/health.controller.test.ts` - Line ? (need to check)
4. `backend/tests/auth/jwt-facade.test.ts` - Line 3
5. `backend/tests/auth/authentication-facade.test.ts` - Line 7
6. `backend/tests/auth/auth-middleware.test.ts` - Line 7

### Medium Priority (Configuration)

1. `shared/tsconfig.json` - Line 36 (build exclusions)
2. `backend/src/utils/errors.ts` - Remove duplicate (deprecate)

### Validation Required

1. Verify all error instanceof checks pass after import fixes
2. Test that shared package exports include all needed error classes
3. Confirm test utilities become available after tsconfig fix

## Expected Resolution

After implementing these fixes:

- **30+ failing tests should pass** due to correct constructor identity
- **Error instanceof checks will work** consistently
- **Test utilities will be available** from shared package
- **Single source of truth** for error classes established

## Memory Key

`constructor-analysis-findings` - MediaNest constructor identity analysis complete
