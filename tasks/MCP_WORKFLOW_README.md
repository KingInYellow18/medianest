# MCP Workflow Task Management System

This directory now supports two task organization systems:

## 1. Phase-Based Organization (Original)

The `phase0/` through `phase5/` directories contain the original MediaNest implementation roadmap organized by development phases.

## 2. MCP Workflow Organization (New)

Following the CLAUDE_CUSTOM.md workflow, tasks are now also organized by status:

### Directory Structure

```
tasks/
├── active/           # Currently in progress tasks
├── pending/          # Waiting to be started
├── completed/        # Finished tasks organized by year/month
│   └── 2025/
│       └── 01/
├── blocked/          # Tasks waiting on external dependencies
├── templates/        # Task templates for consistent formatting
│   ├── bug-fix-template.md
│   ├── feature-template.md
│   └── refactor-template.md
└── backlog/          # Future tasks and ideas
```

### Task Naming Convention

Format: `task-YYYYMMDD-HHmm-brief-description.md`

Examples:

- `task-20250119-1045-fix-auth-bug.md`
- `task-20250119-1100-implement-caching.md`

### Workflow Process

1. **Creating Tasks**: Copy appropriate template from `templates/` and customize
2. **Starting Work**: Move task from `pending/` to `active/`
3. **Completing Work**: Move task to `completed/YYYY/MM/`
4. **Blocked Tasks**: Move to `blocked/` with explanation

### Task Status Tracking

Each task file contains checkboxes for status:

- [ ] Not Started
- [x] In Progress
- [ ] Code Review
- [ ] Testing
- [ ] Completed
- [ ] Blocked

### Integration with MCP Servers

Tasks should reference:

- Context7 documentation lookups
- OpenMemory patterns and solutions
- Knowledge Graph entities and relationships
- Perplexity research findings

### Quick Commands

```bash
# List active tasks
ls tasks/active/

# Search for tasks
grep -r "search-term" tasks/

# Move task to active
mv tasks/pending/task-file.md tasks/active/

# Archive completed task
mv tasks/active/task-file.md tasks/completed/2025/01/
```
