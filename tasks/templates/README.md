# Task Templates

This directory contains standardized task templates for the MediaNest project. Use these templates to ensure consistent task documentation and tracking.

## Available Templates

### Core Development Templates

- **`quick-start-template.md`** - For rapid task creation during development sessions. Minimal sections for quick, straightforward tasks.
- **`feature-template.md`** - Comprehensive template for new feature development with user stories, technical requirements, and implementation phases.
- **`bug-fix-template.md`** - Detailed template for debugging with reproduction steps, root cause analysis, and solution approach.
- **`refactor-template.md`** - Structured template for code refactoring with current state analysis, risks, and rollback plans.

### Specialized Development Templates

- **`testing-template.md`** - For test implementation tasks including coverage analysis, test scenarios, and success criteria.
- **`integration-template.md`** - For external service integrations with API analysis, authentication, and error handling strategies.
- **`performance-template.md`** - For performance optimization tasks with baseline measurements, optimization strategies, and monitoring.
- **`security-template.md`** - For security implementations and audits with threat assessment, controls, and compliance requirements.

### Operations & Documentation Templates

- **`deployment-template.md`** - For infrastructure and deployment tasks with environment setup, security configuration, and rollback plans.
- **`documentation-template.md`** - For creating user and technical documentation with audience targeting and content requirements.
- **`investigation-template.md`** - For research and analysis tasks with methodology, data collection, and findings documentation.

## Template Selection Guide

### When to Use Each Template:

| Task Type                  | Template                    | Best For                             |
| -------------------------- | --------------------------- | ------------------------------------ |
| Quick fixes, minor updates | `quick-start-template.md`   | Tasks < 2 hours                      |
| New functionality          | `feature-template.md`       | Major features, user-facing changes  |
| Bug resolution             | `bug-fix-template.md`       | Production issues, error fixes       |
| Code improvements          | `refactor-template.md`      | Technical debt, architecture changes |
| Test implementation        | `testing-template.md`       | Unit, integration, E2E tests         |
| External APIs              | `integration-template.md`   | Plex, Overseerr, Uptime Kuma         |
| Speed optimizations        | `performance-template.md`   | Load times, resource usage           |
| Security work              | `security-template.md`      | Auth, encryption, audits             |
| Infrastructure             | `deployment-template.md`    | Docker, CI/CD, production setup      |
| User guides                | `documentation-template.md` | READMEs, API docs, user manuals      |
| Research tasks             | `investigation-template.md` | Analysis, feasibility studies        |

## Usage Instructions

1. **Copy the appropriate template** to the target directory (usually `pending/`)
2. **Rename the file** using the naming convention: `task-YYYYMMDD-HHmm-brief-description.md`
3. **Fill in all sections** with specific details for your task
4. **Update task status** as you progress through the work
5. **Move between directories** as the task status changes

### Naming Convention Examples:

- `task-20250119-1400-fix-auth-bug.md`
- `task-20250119-1500-implement-caching.md`
- `task-20250119-1600-performance-optimization.md`

## Customization

### Common Sections Across All Templates:

- Task ID with timestamp
- Status checkboxes
- Priority classification (P0-P3)
- Progress log with timestamps
- Related tasks (dependencies/blockers)
- Notes & context

### Template-Specific Sections:

Each template includes specialized sections relevant to its task type. Refer to individual templates for detailed guidance.

## Best Practices

1. **Be specific** in task descriptions and acceptance criteria
2. **Update progress logs** with timestamps for each significant change
3. **Link related tasks** to maintain task relationships
4. **Use appropriate priority levels** based on production impact
5. **Keep one task active** at a time per developer
6. **Archive completed tasks** to `completed/YYYY/MM/` directory

## Contributing

When adding new templates:

1. Follow the existing structure and naming convention
2. Include all common sections (status, priority, progress log, etc.)
3. Add template-specific sections that provide value
4. Update this README with the new template description
5. Test the template with a real task to ensure completeness
