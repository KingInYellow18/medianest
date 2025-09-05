# CLAUDE CUSTOM MCP SERVER WORKFLOW INSTRUCTIONS

## 1. CRITICAL MCP SERVER WORKFLOW SEQUENCE

**You MUST follow this MCP server usage and reference order every time:**

### 1. Context Retrieval (Context7 MCP – ALWAYS FIRST)

- **ALWAYS use the Context7 MCP server BEFORE generating any code or making decisions.**
- Query Context7 for ALL relevant, up-to-date documentation, code references, and library version notes for the current task.
- If Context7 is unavailable, announce this and request alternatives or mitigations.

### 2. Memory Management (OpenMemory & Knowledge Graph MCPs)

- Query OpenMemory for all project and cross-project historical context, patterns, and prior solutions.
- Query the Knowledge Graph memory server for all current project entities, relationships, configurations, and dependency mappings.
- Adhere to these storage patterns:
  - **OpenMemory:** Store coding patterns, troubleshooting notes, generalizable solutions, best practices, and learnings.
  - **Knowledge Graph:** Create entities for every infrastructure element, service, or microservice; track all relationships and dependencies; log atomic observations and critical config data.

### 3. Research and Discovery (Perplexity MCP)

- Use Perplexity MCP for:
  - Emerging research, best practices, and architectural alternatives.
  - Technical clarifications, up-to-date API compatibility, security advisories, and performance tips.
- Summarize findings and store in OpenMemory or Knowledge Graph as appropriate.

### 4. Local Task Management (tasks/ Directory System)

- **ALWAYS check the tasks/ directory for current task status and priorities**
- Follow this standardized task file organization structure:
  ```
  tasks/
  ├── active/           # Currently in progress tasks
  │   ├── task-YYYYMMDD-HHmm-brief-description.md
  │   └── task-YYYYMMDD-HHmm-brief-description.md
  ├── pending/          # Waiting to be started
  │   ├── task-YYYYMMDD-HHmm-brief-description.md
  │   └── task-YYYYMMDD-HHmm-brief-description.md
  ├── completed/        # Finished tasks for reference
  │   ├── YYYY/
  │   │   ├── MM/
  │   │   │   └── task-YYYYMMDD-HHmm-brief-description.md
  ├── blocked/          # Tasks waiting on external dependencies
  │   └── task-YYYYMMDD-HHmm-brief-description.md
  ├── templates/        # Task templates for consistent formatting
  │   ├── bug-fix-template.md
  │   ├── feature-template.md
  │   └── refactor-template.md
  └── backlog/          # Future tasks and ideas
      └── task-YYYYMMDD-HHmm-brief-description.md
  ```

---

## 2. TASK FILE MANAGEMENT BEST PRACTICES

### Task File Naming Convention

- **Format**: `task-YYYYMMDD-HHmm-brief-description.md`
- **Examples**:
  - `task-20250718-1430-fix-user-auth-bug.md`
  - `task-20250718-0900-implement-api-rate-limiting.md`
  - `task-20250718-1600-refactor-database-queries.md`

### Standard Task File Structure

Task: [Brief Description]
Task ID
task-YYYYMMDD-HHmm-brief-description

Status
Not Started

In Progress

Code Review

Testing

Completed

Blocked

Priority
Critical (P0) - Production issues, security vulnerabilities

High (P1) - Major features, significant bugs

Medium (P2) - Minor features, improvements

Low (P3) - Nice-to-have, technical debt

Description
[Detailed description of what needs to be done]

Acceptance Criteria
Criterion 1

Criterion 2

Criterion 3

Technical Requirements
APIs/Libraries needed:

Dependencies:

Environment considerations:

Files to Modify/Create
file1.py - Description of changes

file2.js - Description of changes

file3.md - Description of changes

Testing Strategy
Unit tests

Integration tests

Manual testing steps

Notes & Context
[Any additional context, links to documentation, related issues, etc.]

Progress Log
YYYY-MM-DD HH:mm - Started task

YYYY-MM-DD HH:mm - Completed API research

YYYY-MM-DD HH:mm - Implemented core functionality

YYYY-MM-DD HH:mm - Added tests

YYYY-MM-DD HH:mm - Task completed

Related Tasks
Depends on: [task-ids]

Blocks: [task-ids]

Related to: [task-ids]

### Task Management Workflow

1. **Session Initialization**: Check `tasks/active/` for current work
2. **Task Selection**: Choose highest priority task from appropriate directory
3. **Task Activation**: Move from `pending/` to `active/` when starting
4. **Progress Updates**: Update progress log and status throughout work
5. **Task Completion**: Move to `completed/YYYY/MM/` with final status update
6. **Knowledge Capture**: Store insights in OpenMemory and update Knowledge Graph

---

## 3. SESSION INITIALIZATION & CONTEXT ASSEMBLY

1. **Check Local Tasks** - Review `tasks/active/` and `tasks/pending/` for current priorities
2. **Retrieve Memory Context** from OpenMemory for patterns and solutions
3. **Query Knowledge Graph** for project entities, relationships, and dependencies
4. **Fetch Documentation** from Context7 MCP for libraries and tools involved
5. **Research & Validate** using Perplexity MCP if implementation approach is unclear
6. **Update Task Status** in appropriate task file before proceeding
7. **Synthesize Information** and create implementation plan

---

## 4. BEST PRACTICES FOR CODE GENERATION

**BEFORE writing any code or proposing a solution:**

- **Confirm API syntax** and features via Context7 MCP
- **Check memory stores** (OpenMemory/Knowledge Graph) for similar implementations
- **Review current task file** for acceptance criteria and technical requirements
- **Validate approach** using Perplexity MCP for current best practices
- **Update task progress** in the task file before implementation
- **Code must include:**
  - Error handling and edge cases
  - Comments for non-obvious logic
  - Adherence to project style/config (per CLAUDE.md)
  - Test cases aligned with task requirements
  - Progress log updates in task file

---

## 5. LOCAL TASK ORCHESTRATION PROTOCOL

### Task Creation Process

1. **Use appropriate template** from `tasks/templates/`
2. **Generate unique task ID** with timestamp
3. **Define clear acceptance criteria** and technical requirements
4. **Estimate priority and dependencies**
5. **Place in correct directory** (usually `tasks/pending/`)
6. **Update related tasks** with dependency information

### Task Execution Process

1. **Move task** from `pending/` to `active/`
2. **Update status** to "In Progress"
3. **Log start time** in progress log
4. **Work iteratively** with regular progress updates
5. **Update related files list** as work progresses
6. **Document discoveries** in task notes
7. **Update Knowledge Graph** with new entities/relationships
8. **Store patterns** in OpenMemory for future reference

### Task Completion Process

1. **Verify all acceptance criteria** are met
2. **Complete testing strategy** items
3. **Update status** to "Completed"
4. **Log completion time** and final notes
5. **Move to** `tasks/completed/YYYY/MM/`
6. **Update dependent tasks** if any
7. **Archive learnings** in memory systems

---

## 6. MEMORY MANAGEMENT PROTOCOL

- **OpenMemory:**

  - Store every significant learning, pattern, solution, or troubleshooting procedure
  - Document task completion insights and effective implementation patterns
  - Review previous project patterns when starting related tasks
  - Link task outcomes to broader project context

- **Knowledge Graph:**

  - Create/maintain entities for all major services and infrastructure components
  - Map dependencies, relationships, and configuration details discovered during tasks
  - Update entity fields with changes, version updates, or discoveries from task work
  - Store atomic observations from task completions and implementation decisions
  - Create relationships between tasks and the components they affect

- **Cross-System Coordination:**
  - Reference task IDs in memory entries for traceability
  - Link Knowledge Graph entities to related task files
  - Maintain consistent terminology across tasks and memory systems
  - Use task outcomes to validate and update stored patterns

---

## 7. ERROR RECOVERY & MCP SERVER AVAILABILITY

- If any server (Context7, OpenMemory, Knowledge Graph, Perplexity) is unavailable:
  - Run `/mcp` to verify status
  - Announce which server is down and its impact
  - Continue with local task management and documentation
  - Use alternative approaches while maintaining task tracking
  - Log server issues in current task file and OpenMemory for audit trail
  - Update task status to "Blocked" if server unavailability prevents progress

---

## 8. ADVANCED PROJECT WORKFLOWS

### Complex Feature Development

1. **Break down** large features into multiple task files with dependencies
2. **Create task hierarchy** in `tasks/pending/` with clear dependency chains
3. **Use Knowledge Graph** to map feature components and relationships
4. **Document architectural decisions** in both task files and Knowledge Graph
5. **Store implementation patterns** in OpenMemory for future reference
6. **Track feature progress** across multiple related task files

### Homelab Infrastructure Management

1. **Organize infrastructure tasks** by system/service in task descriptions
2. **Document service dependencies** in Knowledge Graph and task files
3. **Create deployment task templates** for consistent infrastructure changes
4. **Track configuration changes** in task progress logs
5. **Store troubleshooting procedures** in OpenMemory with task references
6. **Maintain security configurations** locally with appropriate task documentation

### Bug Investigation and Resolution

1. **Create investigation task** in `tasks/active/` for complex bugs
2. **Document symptoms and reproduction steps** in task file
3. **Use Knowledge Graph** to track affected components
4. **Log investigation progress** with timestamps
5. **Store solution patterns** in OpenMemory for similar future issues
6. **Update related tasks** if bug fix impacts other work

---

## 9. SESSION CONTINUITY & CONTEXT PRESERVATION

- **At session start:**

  - Review `tasks/active/` for current work
  - Load relevant context from OpenMemory and Knowledge Graph
  - Check task dependencies and blockers
  - Verify MCP server connectivity

- **During session:**

  - Regularly update task progress logs
  - Store new insights in memory systems as discovered
  - Update task status and notes throughout work
  - Document architectural decisions in Knowledge Graph
  - Maintain focus on current task acceptance criteria

- **At session end:**
  - Update all active task progress logs
  - Summarize session outcomes in task notes
  - Store important discoveries in OpenMemory
  - Update Knowledge Graph with new relationships
  - Set next session priorities in task files
  - Move completed tasks to appropriate completed directory

---

## 10. RESOURCE AND PERFORMANCE MANAGEMENT

- **Use targeted queries** to each MCP server – avoid broad/unstructured prompts
- **Batch related operations** when possible, especially memory storage
- **Monitor task complexity** and break down large tasks appropriately
- **Archive completed tasks** regularly to maintain directory performance
- **Clean up task directories** periodically, moving old completed tasks to deeper archives
- **Optimize task file size** by moving large logs to separate files when necessary

---

## 11. TASK MANAGEMENT COMMAND REFERENCE

### Directory Navigation Commands

- `ls tasks/active/` - List current active tasks
- `ls tasks/pending/` - List pending tasks by priority
- `find tasks/ -name "*keyword*"` - Search for tasks by content
- `grep -r "keyword" tasks/` - Search within task files

### Task File Operations

- Create new task: Copy from `tasks/templates/` and customize
- Move task: `mv tasks/pending/task-file.md tasks/active/`
- Archive completed: `mv tasks/active/task-file.md tasks/completed/YYYY/MM/`
- Search tasks: `grep -r "search-term" tasks/`

### Task Status Tracking

- Update checkboxes in task files for status changes
- Add timestamped entries to progress logs
- Use consistent status terminology across all task files
- Link related tasks with task-id references

---

## 12. GENERAL WORKFLOW SUMMARY

1. **Context7:** Start EVERY coding session here for documentation/context
2. **Local Tasks:** Check and update task status, select current work priorities
3. **OpenMemory + Knowledge Graph:** Retrieve and store persistent project knowledge
4. **Perplexity:** Research current best practices and validate technical approaches
5. **Task Execution:** Work systematically through task acceptance criteria
6. **Progress Tracking:** Maintain detailed task progress logs and status updates
7. **Knowledge Capture:** Store learnings in memory systems with task references
8. **Cross-System Integration:** Maintain consistency between tasks and memory systems
9. **Documentation:** Keep all task files, configs, and custom instructions version-controlled

---

## 13. TASK QUALITY ASSURANCE

### Task Definition Quality Checklist

- [ ] Clear, actionable acceptance criteria defined
- [ ] Technical requirements specified with Context7 documentation
- [ ] Testing strategy outlined with specific test cases
- [ ] Dependencies and related tasks identified
- [ ] Priority and timeline estimates provided
- [ ] Success metrics and validation criteria defined

### Implementation Quality Checklist

- [ ] Code follows project style guidelines (per CLAUDE.md)
- [ ] All acceptance criteria verified and checked off
- [ ] Test cases implemented and passing
- [ ] Documentation updated as required
- [ ] Knowledge Graph entities updated with changes
- [ ] OpenMemory updated with new patterns/solutions
- [ ] Task progress log completed with final summary

### Task Completion Validation

- [ ] All checkboxes in task file completed
- [ ] Related tasks updated with completion status
- [ ] Memory systems updated with new knowledge
- [ ] Files modified list matches actual changes
- [ ] Testing strategy items all completed
- [ ] Next steps or follow-up tasks identified

---
