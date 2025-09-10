# Constructor Export Analysis - MediaNest Shared Package

## Issue Overview
The @medianest/shared package has constructor export issues causing 30+ test failures. Tests are failing because constructors are not properly accessible.

## Root Cause Analysis

### 1. **Missing Error Class Exports**
- `AuthenticationError` and other error classes are exported from shared/src/errors/index.ts
- But tests are importing from local backend/src/utils/errors.ts instead
- This creates instance mismatch issues - shared package exports vs local backend copies

### 2. **Build Configuration Issues** 
- Shared package excludes test-utils from compilation
- tsconfig.json line 36: excludes `"src/test-utils/**/*"`
- ErrorTestFactory and other test utilities are not available in built package

### 3. **Module Export Structure**
- Main index.ts properly exports error classes with `export * from './errors';`
- Error classes are correctly defined and exported from errors/index.ts
- Issue is with compilation/build excluding test utilities

### 4. **Import Path Conflicts**
- Tests importing from `'../../src/utils/errors'` (local backend)
- Should import from `'@medianest/shared'` (shared package)
- Constructor identity mismatches in instanceof checks

## Specific Issues Found

### Authentication Error Usage
```typescript
// Current (WRONG) - creates constructor mismatch
import { AuthenticationError } from '../../src/utils/errors';

// Should be (CORRECT)
import { AuthenticationError } from '@medianest/shared';
```

### Test Utilities Not Available
- ErrorTestFactory, MockErrorLogger, ErrorAssertions not in built package
- These are needed for comprehensive error testing
- Currently excluded by tsconfig build settings

## Solutions Required

### 1. **Fix tsconfig.json Build Configuration**
- Include test-utils in build output for shared consumption
- OR create separate test utilities export

### 2. **Update Test Imports**
- Change all error imports from local backend paths to shared package
- Ensure consistent constructor identity across modules

### 3. **Verify Export Structure**
- Ensure all error classes are properly exported from main index
- Test utilities should be accessible via separate export path

## Files Requiring Changes

### Immediate Fixes
1. `shared/tsconfig.json` - Fix build exclusions
2. `backend/tests/auth/authentication-facade.test.ts` - Fix import paths
3. Multiple test files - Update import statements

### Validation Required
1. Verify all error constructors are accessible post-build
2. Test instanceof checks work correctly across modules  
3. Ensure test utilities are available for shared consumption

## Memory Namespace
Using `medianest-constructor-fixes` for tracking progress.