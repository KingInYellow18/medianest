# Task: Fix Database Schema in Test Environment

**Task ID**: task-20250119-2121-fix-database-schema-test-environment  
**Created**: 2025-01-19 21:21  
**Updated**: 2025-01-19 21:21

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Complete

**Priority**: P0 (Critical) - Database tests are failing

## Description

Fix database schema issues in the test environment where tables like `sessions` and `youtube_downloads` don't exist, causing Prisma queries to fail in test cases.

## Acceptance Criteria

- [ ] Test database properly created with all required tables
- [ ] All Prisma migrations applied to test database
- [ ] Database cleanup works in test setup/teardown
- [ ] Critical path tests pass without database errors
- [ ] Test database isolation working correctly

## Technical Requirements

### Files to Modify

- `backend/tests/integration/critical-paths/*.test.ts` - Fix database cleanup
- `backend/run-tests.sh` - Ensure proper test database setup
- Database migration scripts for test environment

### Database Tables Required

- `users` - User account information
- `sessions` - JWT session tracking
- `youtube_downloads` - Download queue and status
- `media_requests` - Media request tracking
- `service_configs` - External service configurations

## Testing Strategy

- [ ] Run `npm run db:migrate` for test database
- [ ] Verify all tables exist in test environment
- [ ] Test database cleanup/setup scripts
- [ ] Run critical path tests to verify fixes
- [ ] Ensure test isolation between test runs

## Progress Log

**2025-01-19 21:21** - Task created based on Prisma database errors in tests

## Related Tasks

- **Blocks**: All database-dependent tests
- **Blocked by**: None
- **Related**: Critical path testing tasks

## Notes

Tests are failing with "table does not exist" errors, indicating the test database schema is not properly initialized. This is preventing all integration tests from running.
