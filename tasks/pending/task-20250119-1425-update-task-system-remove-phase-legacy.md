# Update Task System to Remove Phase-Based Organization Legacy Files

## Task ID

task-20250119-1425-update-task-system-remove-phase-legacy

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Code Review
- [ ] Testing
- [ ] Documentation
- [x] Ready to Start

## Priority

P3 - Low (Code Organization)

## Description

Clean up task system documentation and references to remove legacy phase-based organization files after they have been archived. Update task documentation to reflect the current MCP-based workflow as the primary system and remove references to obsolete phase directories.

## Acceptance Criteria

- [ ] Update `tasks/README.md` to remove references to phase directories
- [ ] Update `tasks/TASK_INDEX.md` to reflect archived phase tasks
- [ ] Remove or update `tasks/PHASE_TASK_REORGANIZATION_PLAN.md` (may be obsolete)
- [ ] Verify MCP workflow documentation is current and complete
- [ ] Ensure task templates and examples reflect current organization
- [ ] Update any remaining references to phase-based organization

## Technical Requirements

- Review and update task system documentation
- Remove obsolete organizational references
- Ensure MCP workflow documentation is comprehensive
- Verify task management tools and scripts work with current organization
- Maintain clear documentation for new contributors

## Files to Modify/Create

- Update: `tasks/README.md`
- Update: `tasks/TASK_INDEX.md`
- Review: `tasks/PHASE_TASK_REORGANIZATION_PLAN.md` (potentially remove)
- Review: `tasks/MCP_WORKFLOW_README.md` (ensure completeness)
- Update: Any other files referencing phase organization

## Testing Strategy

- Verify task documentation accurately reflects current system
- Test that task management workflow still functions properly
- Ensure new contributors can understand the current system
- Check that no broken references to archived phase directories exist
- Validate task creation and management processes

## Dependencies

- Requires: task-20250119-1423-archive-completed-phase-task-directories (phase directories must be archived first)

## Related Tasks

- Depends on: Archive completed phase task directories
- Related: Overall documentation cleanup tasks

## Estimated Effort

25 minutes

## Progress Log

- 2025-01-19 14:25: Task created based on CLEANUP_RECOMMENDATIONS.md analysis

## Notes

This task completes the transition from the legacy phase-based task organization to the current MCP-based workflow. It's marked as P3 because the system functions well currently, but cleaning up the documentation will improve clarity for future development and onboarding.
