# Task: Establish Test Coverage Baseline and Reporting

## Task ID

task-20250119-2000

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

P1 - Important for maintaining quality and tracking improvements

## Description

Set up comprehensive test coverage measurement, establish baseline metrics, and create automated coverage reporting. This will help us track progress toward our coverage goals (60-70% overall, 80% for auth/security).

## Acceptance Criteria

- [ ] Configure coverage collection for all workspaces (frontend, backend, shared)
- [ ] Generate initial coverage reports and document baseline metrics
- [ ] Set up coverage thresholds in vitest configs based on current state
- [ ] Create coverage dashboard script to view all workspace coverage at once
- [ ] Document coverage gaps and create follow-up tasks for critical areas
- [ ] Add coverage badges to README or documentation
- [ ] Configure coverage reporting in test output

## Technical Requirements

- Vitest v8 coverage provider (already configured)
- Coverage report formats: html, lcov, json-summary
- Coverage thresholds per workspace
- Script to aggregate coverage across workspaces

## Files to Modify/Create

- `vitest.workspace.ts` - Add coverage thresholds
- `frontend/vitest.config.mts` - Configure coverage thresholds
- `backend/vitest.config.ts` - Configure coverage thresholds
- `shared/vitest.config.ts` - Configure coverage thresholds
- `scripts/coverage-report.sh` - Create unified coverage dashboard
- `docs/TEST_COVERAGE.md` - Document baseline and gaps

## Testing Strategy

- Run `./run-all-tests.sh --coverage` to generate reports
- Verify HTML reports generate correctly
- Test threshold enforcement works
- Ensure CI-friendly output formats

## Dependencies

- None - infrastructure already in place

## Related Tasks

- Follows: Recent test fixes (completed)
- Blocks: Component test implementation tasks

## Progress Log

- 2025-01-19 20:00 - Task created based on test suite review

## Notes

Current coverage is not being consistently measured. We need baseline metrics to track improvement and identify critical gaps. Focus on establishing realistic thresholds based on actual coverage, not aspirational goals.
