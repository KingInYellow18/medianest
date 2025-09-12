# Task: Implement Placeholder Frontend Tests or Add Skip Markers

## Task ID

**ID**: task-20250119-2104-implement-placeholder-frontend-tests  
**Created**: 2025-01-19 21:04  
**Type**: Testing - Placeholder Implementation

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

**P2 - Medium** (Improves test coverage and CI confidence)

## Description

Multiple frontend test files exist but contain no actual test cases, causing test runner warnings and reducing confidence in the test suite. These empty test files should either be implemented with basic smoke tests or marked as skipped with TODO comments to indicate future implementation plans.

## Acceptance Criteria

- [ ] All empty test files have at least one test case or skip marker
- [ ] Critical components have basic smoke tests (render without crashing)
- [ ] Less critical components have descriptive skip markers with TODOs
- [ ] Test runner no longer shows warnings about empty test suites
- [ ] Test coverage reporting is more accurate

## Technical Requirements

- **Testing Framework**: Vitest with React Testing Library
- **Test Types**: Smoke tests, basic prop testing, skip markers
- **Patterns**: Follow existing test patterns in the codebase

## Files to Modify/Create

- **Test Files to Address** (11 files):
  - `src/components/youtube/__tests__/DownloadQueue.test.tsx`
  - `src/components/plex/__tests__/PlexSearch.test.tsx`
  - `src/lib/api/__tests__/requests.test.ts`
  - `src/components/youtube/__tests__/CollectionProgress.test.tsx`
  - `src/hooks/__tests__/useMediaRequest.test.ts`
  - `src/components/plex/__tests__/PlexBrowser.test.tsx`
  - `src/lib/__tests__/socket.test.ts`
  - `src/hooks/__tests__/useRequestStatus.test.ts`
  - `src/hooks/__tests__/useServiceStatus.test.tsx`
  - `src/components/dashboard/__tests__/DashboardLayout.test.tsx`
  - `src/hooks/__tests__/useMediaSearch.test.ts`

## Testing Strategy

1. **Critical Components** (implement basic tests):
   - DownloadQueue: Basic rendering and empty state
   - DashboardLayout: Layout structure and loading states
   - useServiceStatus: Hook initialization and state

2. **Future Implementation** (skip with TODOs):
   - PlexSearch/PlexBrowser: Complex search functionality
   - Media-related hooks: Integration-heavy features
   - Socket utilities: Real-time functionality

3. **Verification Steps**:
   ```bash
   cd frontend && npm test --reporter=verbose
   cd frontend && npm run test:coverage
   ```

## Progress Log

- **2025-01-19 21:04**: Task created from TEST_TASKS migration
- **Status**: Pending - Test file cleanup and basic implementation

## Related Tasks

- **Depends On**: task-20250119-2103-implement-missing-frontend-components
- **Improves**: Overall test suite health and CI/CD reliability

## Implementation Strategy

### Option 1: Basic Smoke Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DownloadQueue } from '../DownloadQueue';

describe('DownloadQueue', () => {
  it('renders without crashing', () => {
    const { container } = render(<DownloadQueue downloads={[]} />);
    expect(container).toBeInTheDocument();
  });
});
```

### Option 2: Skip with TODO

```typescript
import { describe, it, expect } from 'vitest';

describe.skip('PlexSearch - TODO: Implement when component is stable', () => {
  it('should search Plex library', () => {
    // TODO: Implement after Plex integration is finalized
    expect(true).toBe(true);
  });
});
```

### Option 3: Hook Testing

```typescript
import { renderHook } from '@testing-library/react';
import { useServiceStatus } from '../useServiceStatus';

describe('useServiceStatus', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useServiceStatus());
    expect(result.current.services).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
```

## Quality Guidelines

- **Test Naming**: Clear, descriptive test names
- **Assertions**: Meaningful expectations, not just `expect(true).toBe(true)`
- **Mocking**: Use MSW for API calls, vi.mock for modules
- **Coverage**: Focus on critical paths and user interactions
- **Maintenance**: Keep tests simple and maintainable
