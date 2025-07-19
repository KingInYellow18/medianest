# Task: Migrate MSW v1 to v2 for Plex API Handlers

## Task ID

**ID**: task-20250119-2100-migrate-msw-v1-to-v2-plex-handlers  
**Created**: 2025-01-19 21:00  
**Type**: Bug Fix - Critical

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

**P0 - Critical** (Blocks all backend tests)

## Description

The Plex API handlers in the MSW test setup are using MSW v1 syntax, but the project has MSW v2 (^2.10.4) installed. This causes module loading failures that prevent all backend tests from running. The `rest` namespace was replaced with `http` in MSW v2, requiring a complete migration of the handler syntax.

## Acceptance Criteria

- [ ] Plex handlers file uses MSW v2 syntax (http, HttpResponse)
- [ ] All existing Plex API mock endpoints still work correctly
- [ ] Backend tests can run without import errors
- [ ] All Plex-related test cases continue to pass
- [ ] No regression in test coverage

## Technical Requirements

- **Dependencies**: MSW v2.10.4 (already installed)
- **API Changes**:
  - `rest.post/get` → `http.post/get`
  - `(req, res, ctx) => res(ctx.json())` → `() => HttpResponse.json()`
  - Parameter access via destructuring: `({ params, request })`
- **Response Types**: XML responses need `new HttpResponse()` with headers

## Files to Modify/Create

- **Modify**: `backend/tests/msw/handlers/plex.handlers.ts`
  - Update import from `rest` to `http, HttpResponse`
  - Convert all handler functions to new syntax
  - Update parameter access patterns
  - Fix XML response creation for library/search endpoints

## Testing Strategy

1. **Unit Testing**:

   - Run specific MSW handler tests if they exist
   - Verify import statements resolve correctly

2. **Integration Testing**:

   - Run backend tests that use Plex API mocks
   - Verify authentication flow tests pass
   - Check library browsing tests function correctly

3. **Verification Steps**:
   ```bash
   cd backend && npm test tests/msw/handlers/plex.handlers.ts
   cd backend && npm test -- --grep "plex"
   cd backend && npm test
   ```

## Progress Log

- **2025-01-19 21:00**: Task created from TEST_TASKS migration
- **Status**: Pending - Critical blocker for all backend testing

## Related Tasks

- **Blocks**: task-20250119-2101-complete-msw-v2-migration-all-handlers
- **Blocks**: All backend testing and CI/CD pipeline
- **Related**: MSW v2 migration project-wide

## Error Details

```
TypeError: Cannot read properties of undefined (reading 'post')
❯ tests/msw/handlers/plex.handlers.ts:7:8
     5| export const plexHandlers = [
     6|   // PIN generation
     7|   rest.post(`${PLEX_API_BASE}/pins`, (req, res, ctx) => {
      |        ^
     8|     return res(
     9|       ctx.json({
```

## Implementation Notes

- **Key Changes**:
  - Import: `import { http, HttpResponse } from 'msw'`
  - Handlers: `http.post('/path', ({ request, params }) => HttpResponse.json({}))`
  - XML Responses: `new HttpResponse(xmlString, { headers: { 'Content-Type': 'application/xml' } })`
- **Handler Patterns**: Follow MSW v2 patterns for request/response handling
- **Authentication**: Ensure X-Plex-Token header validation still works
