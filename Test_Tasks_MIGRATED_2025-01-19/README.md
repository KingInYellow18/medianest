# Test Tasks Directory

This directory contains task files generated from test execution failures. Each file represents a specific issue that needs to be addressed to get the test suite passing.

## Current Task Files

1. **fix-msw-rest-import-issue.md** [CRITICAL]

   - MSW v1 to v2 migration for plex.handlers.ts
   - Blocks all backend tests

2. **fix-all-msw-handlers-migration.md** [CRITICAL]

   - Complete MSW v2 migration for all handler files
   - Affects overseerr, uptime-kuma, youtube handlers

3. **fix-shared-missing-files.md** [HIGH]

   - Create missing crypto.ts and validation.ts implementations
   - Required by both backend and frontend

4. **fix-frontend-missing-components.md** [HIGH]
   - Create missing DownloadCard component
   - Fix import paths for shared package

## Test Execution Summary

**Date**: January 19, 2025  
**Total Tests**: 52 files (35 failed, 17 passed)  
**Backend**: 22 files failed (MSW import issues)  
**Frontend**: Mixed results (missing components)  
**Shared**: 2 files failed (missing implementations)

## Priority Order

1. Fix MSW migration issues first (blocks all backend tests)
2. Implement shared package utilities (used by both frontend and backend)
3. Create missing frontend components
4. Re-run full test suite and generate coverage report

## How to Use These Tasks

Each task file contains:

- Detailed error analysis
- Root cause identification
- Specific code changes required
- Testing verification steps
- Additional context

Work through tasks in priority order for most efficient resolution.
