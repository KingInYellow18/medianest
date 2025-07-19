# Task: Complete MSW v2 Migration for All Handler Files

## Task ID

**ID**: task-20250119-2101-complete-msw-v2-migration-all-handlers  
**Created**: 2025-01-19 21:01  
**Type**: Bug Fix - Critical

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

**P0 - Critical** (Blocks all backend integration tests)

## Description

Complete the MSW v1 to v2 migration for all remaining handler files in the test suite. After fixing the Plex handlers, the Overseerr, Uptime Kuma, and YouTube handlers also need migration to MSW v2 syntax. This affects all backend integration tests and API endpoint testing.

## Acceptance Criteria

- [ ] All handler files use MSW v2 syntax
- [ ] Handler exports in index.ts work correctly
- [ ] All external service API mocks function properly
- [ ] Integration tests for all services pass
- [ ] No MSW-related import errors remain

## Technical Requirements

- **Dependencies**: MSW v2.10.4 (already installed)
- **Handler Files**:
  - overseerr.handlers.ts
  - uptime-kuma.handlers.ts
  - youtube.handlers.ts
  - index.ts (exports)
- **Patterns**: Consistent MSW v2 syntax across all handlers

## Files to Modify/Create

- **Modify**: `backend/tests/msw/handlers/overseerr.handlers.ts`

  - Update to http/HttpResponse syntax
  - Fix request body parsing with `await request.json()`
  - Update parameter access patterns

- **Modify**: `backend/tests/msw/handlers/uptime-kuma.handlers.ts`

  - Migrate to MSW v2 syntax
  - Ensure monitor status mocks work correctly
  - Fix parameter destructuring

- **Modify**: `backend/tests/msw/handlers/youtube.handlers.ts`

  - Update YouTube API mocks to v2 syntax
  - Fix auth header validation patterns
  - Update request body parsing

- **Modify**: `backend/tests/msw/handlers/index.ts`
  - Ensure all handler exports work
  - Verify combined handlers array

## Testing Strategy

1. **Per-Service Testing**:

   - Test Overseerr integration endpoints
   - Verify Uptime Kuma monitoring endpoints
   - Check YouTube download API mocks

2. **Integration Testing**:

   - Run full backend test suite
   - Verify all external service integrations
   - Check that MSW setup initializes correctly

3. **Verification Steps**:
   ```bash
   cd backend && npm test tests/msw/
   cd backend && npm test -- --grep "overseerr|uptime|youtube"
   cd backend && npm test
   ```

## Progress Log

- **2025-01-19 21:01**: Task created from TEST_TASKS migration
- **Status**: Pending - Dependent on Plex handlers completion

## Related Tasks

- **Depends On**: task-20250119-2100-migrate-msw-v1-to-v2-plex-handlers
- **Blocks**: All backend integration testing
- **Blocks**: CI/CD pipeline test execution

## Implementation Notes

- **Migration Patterns**:

  - `rest.get/post` → `http.get/post`
  - `(req, res, ctx)` → `({ request, params })`
  - `res(ctx.json())` → `HttpResponse.json()`
  - `req.headers.get()` → `request.headers.get()`
  - `req.json()` → `await request.json()`

- **Service-Specific Notes**:

  - **Overseerr**: Search and request endpoints need body parsing
  - **Uptime Kuma**: Monitor status and heartbeat data mocks
  - **YouTube**: Download queue and metadata extraction mocks

- **Testing Focus**: Ensure all service integration tests pass after migration
