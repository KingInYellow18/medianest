# Task 02: Shared Package Testing Implementation

**Priority:** 🔥 Critical  
**Effort:** 1 day  
**Dependencies:** Shared package utilities identification  
**Status:** Not Started  

## Overview

Implement comprehensive testing for the `/shared` workspace package. The audit revealed that the shared package has zero test coverage, creating a risk of runtime errors in shared utilities and types used across frontend and backend.

## Scope

### ❌ Current State
- **0 test files** in the shared package
- Shared utilities and types not validated
- Potential runtime errors in shared code
- No coverage reporting for shared workspace

### ✅ Target State
- Comprehensive test coverage for shared utilities
- Type validation for shared interfaces
- Integration with monorepo test pipeline
- 60% minimum coverage aligned with other workspaces

## Investigation Phase (2 hours)

### 1. Audit Shared Package Contents
First, identify what needs testing in the shared package:

```bash
# Investigate shared package structure
ls -la shared/src/
find shared/src -name "*.ts" -type f
cat shared/package.json
```

**Expected shared utilities to test:**
- Type definitions and interfaces
- Utility functions (validation, formatting, etc.)
- Constants and configuration
- Error classes and enums

### 2. Analyze Cross-Workspace Dependencies
```bash
# Find usages of shared package in frontend/backend
grep -r "from '@shared" frontend/src/
grep -r "from '@shared" backend/src/
```

## Implementation Plan

### Phase 1: Test Infrastructure Setup (2 hours)

1. **Create Vitest Configuration for Shared Package**
   ```typescript
   // shared/vitest.config.ts
   import { defineConfig } from 'vitest/config'
   import path from 'path'
   
   export default defineConfig({
     test: {
       environment: 'node',
       setupFiles: ['./tests/setup.ts'],
       globals: true,
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         exclude: [
           'node_modules/',
           'tests/',
           '**/*.d.ts',
           '**/*.config.*'
         ],
         thresholds: {
           branches: 60,
           functions: 60,
           lines: 60,
           statements: 60
         }
       }
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
         '@shared': path.resolve(__dirname, './src')
       }
     }
   })
   ```

2. **Create Test Setup**
   ```typescript
   // shared/tests/setup.ts
   import { vi } from 'vitest'
   
   // Global test setup for shared package
   // Mock any external dependencies if needed
   ```

3. **Update Package.json Scripts**
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

### Phase 2: Type Definition Testing (2 hours)

Test shared TypeScript interfaces and types:

```typescript
// shared/tests/types/user.test.ts
import { describe, it, expect } from 'vitest'
import type { User, MediaRequest, ServiceStatus } from '@/types'

describe('User Type', () => {
  it('should have required properties', () => {
    const user: User = {
      id: '123',
      plexId: 'plex-456', 
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    expect(user.id).toBeDefined()
    expect(user.plexId).toBeDefined()
    expect(user.role).toMatch(/^(user|admin)$/)
  })
})

describe('MediaRequest Type', () => {
  it('should validate media request structure', () => {
    const request: MediaRequest = {
      id: '123',
      userId: 'user-456',
      title: 'The Matrix',
      mediaType: 'movie',
      tmdbId: '603',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    expect(request.mediaType).toMatch(/^(movie|tv)$/)
    expect(request.status).toMatch(/^(pending|approved|available|failed)$/)
  })
})
```

### Phase 3: Utility Function Testing (3 hours)

Test shared utility functions:

```typescript
// shared/tests/utils/validation.test.ts
import { describe, it, expect } from 'vitest'
import { isValidEmail, isValidPlexId, validateMediaType } from '@/utils/validation'

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true)
    })
    
    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })
  
  describe('isValidPlexId', () => {
    it('should validate Plex ID format', () => {
      expect(isValidPlexId('12345')).toBe(true)
      expect(isValidPlexId('plex-67890')).toBe(true)
    })
    
    it('should reject invalid Plex IDs', () => {
      expect(isValidPlexId('')).toBe(false)
      expect(isValidPlexId('invalid')).toBe(false)
    })
  })
})

// shared/tests/utils/formatting.test.ts
import { describe, it, expect } from 'vitest'
import { formatFileSize, formatDuration, sanitizeTitle } from '@/utils/formatting'

describe('Formatting Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1048576)).toBe('1.0 MB')
      expect(formatFileSize(1073741824)).toBe('1.0 GB')
    })
  })
  
  describe('formatDuration', () => {
    it('should format seconds to readable time', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s')
      expect(formatDuration(120)).toBe('2m 0s')
    })
  })
  
  describe('sanitizeTitle', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeTitle('The Matrix: Reloaded')).toBe('The Matrix Reloaded')
      expect(sanitizeTitle('Movie/Title')).toBe('Movie Title')
    })
  })
})
```

### Phase 4: Constants and Configuration Testing (1 hour)

```typescript
// shared/tests/constants/index.test.ts  
import { describe, it, expect } from 'vitest'
import { 
  MEDIA_TYPES, 
  REQUEST_STATUSES, 
  USER_ROLES,
  API_ENDPOINTS,
  RATE_LIMITS 
} from '@/constants'

describe('Constants', () => {
  it('should have correct media types', () => {
    expect(MEDIA_TYPES).toContain('movie')
    expect(MEDIA_TYPES).toContain('tv')
    expect(MEDIA_TYPES).toHaveLength(2)
  })
  
  it('should have valid request statuses', () => {
    expect(REQUEST_STATUSES).toContain('pending')
    expect(REQUEST_STATUSES).toContain('approved')
    expect(REQUEST_STATUSES).toContain('available')
    expect(REQUEST_STATUSES).toContain('failed')
  })
  
  it('should have correct rate limits', () => {
    expect(RATE_LIMITS.API_GENERAL).toBe(100)
    expect(RATE_LIMITS.YOUTUBE_DOWNLOADS).toBe(5)
    expect(RATE_LIMITS.MEDIA_REQUESTS).toBe(20)
  })
})
```

### Phase 5: Error Handling Testing (1 hour)

```typescript
// shared/tests/errors/custom-errors.test.ts
import { describe, it, expect } from 'vitest'
import { 
  PlexAuthError, 
  MediaRequestError, 
  ServiceUnavailableError 
} from '@/errors'

describe('Custom Error Classes', () => {
  describe('PlexAuthError', () => {
    it('should create error with correct message and code', () => {
      const error = new PlexAuthError('Invalid PIN', 'INVALID_PIN')
      
      expect(error.message).toBe('Invalid PIN')
      expect(error.code).toBe('INVALID_PIN')
      expect(error.name).toBe('PlexAuthError')
      expect(error instanceof Error).toBe(true)
    })
  })
  
  describe('MediaRequestError', () => {
    it('should handle media already requested', () => {
      const error = new MediaRequestError('Media already requested', 'DUPLICATE_REQUEST')
      
      expect(error.code).toBe('DUPLICATE_REQUEST')
      expect(error.retryable).toBe(false)
    })
  })
})
```

## Integration with Monorepo

### Update Root Package.json
```json
{
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "test:shared": "npm run test -w shared",
    "test:coverage": "npm run test:coverage --workspaces --if-present"
  }
}
```

### CI/CD Integration
Update GitHub Actions workflow to include shared package tests:

```yaml
# .github/workflows/test.yml
- name: Test Shared Package
  run: npm run test:shared
  
- name: Test All Workspaces
  run: npm test
```

## Acceptance Criteria

### ✅ Done When:
- [ ] Shared package has comprehensive test coverage (60%+ minimum)
- [ ] All shared utilities and types are tested
- [ ] Tests integrated with monorepo test pipeline
- [ ] CI/CD pipeline includes shared package tests
- [ ] Coverage reporting works for shared workspace

### ✅ Quality Gates:
- All shared package tests pass
- Coverage meets 60% minimum threshold
- No breaking changes to existing frontend/backend code
- Tests run quickly (< 30 seconds total)

## Risk Assessment

### High Risk:
- **Breaking Changes**: Testing may reveal bugs in shared utilities currently used by frontend/backend

### Medium Risk:
- **Performance Impact**: Additional tests in CI/CD pipeline
- **Maintenance Overhead**: More tests to maintain

### Mitigation:
- Test incrementally to identify issues early
- Focus on critical shared utilities first
- Use mocking for external dependencies

## Dependencies

### Technical Dependencies:
- Vitest configuration for shared workspace
- Path aliases for clean imports
- Coverage reporting integration

### Development Dependencies:
- Knowledge of shared utilities usage patterns
- Understanding of frontend/backend integration points

## Success Metrics

- **Coverage**: 60%+ test coverage for shared package
- **Quality**: Zero critical bugs found in shared utilities
- **Integration**: Seamless monorepo test execution
- **Speed**: Shared tests complete in <30 seconds

---

**Estimated Total Effort: 8 hours (1 day)**  
**Assigned To:** _TBD_  
**Start Date:** _TBD_  
**Target Completion:** _TBD_