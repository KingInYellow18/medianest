# Task: Expand Test Data Factories

## Task ID

task-20250119-2005

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

P3 - Nice to have for test maintainability

## Description

Expand the existing test data factories to provide more comprehensive and realistic test data generation. This will make tests more maintainable and reduce duplication across test files.

## Acceptance Criteria

- [ ] Create comprehensive user factory with different roles and states
- [ ] Create media item factories (movies, TV shows, seasons, episodes)
- [ ] Create service configuration factories
- [ ] Create YouTube download factories with various states
- [ ] Add factory utilities for relationships (user with requests, etc.)
- [ ] Document factory usage patterns
- [ ] Migrate existing tests to use factories where appropriate

## Technical Requirements

- TypeScript factories with type safety
- Faker.js for realistic data generation
- Builder pattern for flexible object creation
- Integration with Prisma types
- Utilities for database seeding

## Files to Modify/Create

- `shared/src/test-utils/factories/user.factory.ts` - User data factory
- `shared/src/test-utils/factories/media.factory.ts` - Media data factory
- `shared/src/test-utils/factories/service.factory.ts` - Service config factory
- `shared/src/test-utils/factories/youtube.factory.ts` - YouTube data factory
- `shared/src/test-utils/factories/index.ts` - Export all factories
- `backend/tests/helpers/db-seed.ts` - Database seeding utilities
- Update existing test files to use new factories

## Testing Strategy

- Unit test the factories themselves
- Ensure factories generate valid data
- Test factory relationships work correctly
- Verify performance of bulk data generation

## Dependencies

- Faker.js for data generation
- Understanding of all data models

## Related Tasks

- Supports: All other testing tasks
- Improves: Test maintainability

## Progress Log

- 2025-01-19 20:05 - Task created based on test suite review

## Notes

Current test data factories are minimal. Expanding them will reduce test setup boilerplate and make tests more readable. Focus on most commonly used entities first (users, media items, requests).
