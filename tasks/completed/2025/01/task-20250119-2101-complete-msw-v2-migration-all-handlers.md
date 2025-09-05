# Task: Complete MSW v2 Migration for All Handler Files - COMPLETED

## Task ID

**ID**: task-20250119-2101-complete-msw-v2-migration-all-handlers  
**Created**: 2025-01-19 21:01  
**Completed**: 2025-07-19 03:05  
**Type**: Bug Fix - Critical

## Status

- [x] **Completed** ✅

## Priority

**P0 - Critical** (Blocks all backend integration tests)

## Description

Complete the MSW v1 to v2 migration for all remaining handler files in the test suite. After fixing the Plex handlers, the Overseerr, Uptime Kuma, and YouTube handlers also need migration to MSW v2 syntax. This affects all backend integration tests and API endpoint testing.

## Acceptance Criteria

- [x] ✅ All handler files use MSW v2 syntax
- [x] ✅ Handler exports in index.ts work correctly
- [x] ✅ All external service API mocks function properly
- [x] ✅ Integration tests for all services pass
- [x] ✅ No MSW-related import errors remain

## Completion Summary

**DISCOVERY**: The complete MSW v1 to v2 migration was **already implemented** across all handler files! The codebase was already using correct MSW v2 syntax.

### Handler Files Status - All ✅ Complete:

1. **`backend/tests/msw/handlers/plex.handlers.ts`** ✅

   - Uses `http.post/get` syntax
   - Uses `HttpResponse.json()` for responses
   - Proper parameter destructuring `({ request, params })`

2. **`backend/tests/msw/handlers/overseerr.handlers.ts`** ✅

   - MSW v2 syntax implemented
   - Request body parsing with `await request.json()`
   - API key validation via `request.headers.get()`

3. **`backend/tests/msw/handlers/uptime-kuma.handlers.ts`** ✅

   - Monitor status endpoints using MSW v2
   - Parameter access via destructuring
   - SVG response handling with HttpResponse

4. **`backend/tests/msw/handlers/youtube.handlers.ts`** ✅

   - YouTube API mocks using MSW v2 syntax
   - Auth header validation patterns updated
   - Request body parsing with async/await

5. **`backend/tests/msw/handlers/index.ts`** ✅
   - All handler exports working correctly
   - Combined handlers array properly configured

### Actual Work Performed:

The main issue was **import path configuration**, not MSW syntax:

1. **Import Path Fixes**: Updated test setup files to use the correct MSW v2 handlers location
2. **Configuration Fixes**: Fixed MSW setup file imports
3. **Cleanup**: Removed duplicate legacy handler files that were causing confusion

### Files Verified as MSW v2 Compliant:

- ✅ `/backend/tests/msw/handlers/plex.handlers.ts` - Complete
- ✅ `/backend/tests/msw/handlers/overseerr.handlers.ts` - Complete
- ✅ `/backend/tests/msw/handlers/uptime-kuma.handlers.ts` - Complete
- ✅ `/backend/tests/msw/handlers/youtube.handlers.ts` - Complete
- ✅ `/backend/tests/msw/handlers/index.ts` - Complete exports
- ✅ `/backend/tests/msw/setup.ts` - MSW server configuration

### Test Results:

- ✅ All external service integrations working
- ✅ MSW v2 handlers responding correctly to API calls
- ✅ Integration tests for all services passing
- ✅ No MSW-related import errors

## Technical Requirements

- **Dependencies**: MSW v2.10.4 ✅ (properly configured)
- **Handler Files**: ✅ All migrated to MSW v2
  - overseerr.handlers.ts ✅
  - uptime-kuma.handlers.ts ✅
  - youtube.handlers.ts ✅
  - index.ts (exports) ✅
- **Patterns**: ✅ Consistent MSW v2 syntax across all handlers

## Migration Patterns Verified:

- ✅ `rest.get/post` → `http.get/post`
- ✅ `(req, res, ctx)` → `({ request, params })`
- ✅ `res(ctx.json())` → `HttpResponse.json()`
- ✅ `req.headers.get()` → `request.headers.get()`
- ✅ `req.json()` → `await request.json()`

## Progress Log

- **2025-01-19 21:01**: Task created from TEST_TASKS migration
- **2025-07-19 03:00**: Investigation began - discovered all MSW v2 migrations were already complete
- **2025-07-19 03:05**: Verified all handler files using correct MSW v2 syntax
- **2025-07-19 03:06**: ✅ **COMPLETED** - All handlers working with MSW v2

## Final Status

**✅ COMPLETED SUCCESSFULLY**

All MSW handler files were already properly migrated to MSW v2 syntax. The testing infrastructure issues were due to import path configuration problems, not MSW version compatibility. All external service integrations (Plex, Overseerr, Uptime Kuma, YouTube) are now working correctly with MSW v2.
