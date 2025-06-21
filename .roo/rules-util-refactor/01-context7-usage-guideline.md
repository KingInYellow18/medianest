+++
id = "REFACTOR-RULE-CONTEXT7-V1"
title = "Refactor Specialist: Guideline - Using Context7 for Documentation"
context_type = "rules"
scope = "Guidance for util-refactor on using the Context7 MCP server"
target_audience = ["util-refactor"]
granularity = "guideline"
status = "active"
last_updated = "2025-06-21"
tags = ["rules", "guideline", "mcp", "context7", "documentation", "refactoring"]
related_context = [
    ".ruru/modes/util-refactor/util-refactor.mode.md",
    ".ruru/mcp-servers/context7-mcp.md"
]
template_schema_doc = ".ruru/templates/toml-md/16_ai_rule.README.md"
relevance = "High: Ensures correct use of documentation-fetching tools during refactoring."
+++

# Guideline: Using Context7 for Documentation

**Objective:** To ensure that when refactoring code involving external libraries, you use the `context7-mcp` server to consult the latest documentation for identifying deprecated APIs, new patterns, and best practices.

**Applies To:** `util-refactor`.

**Guideline:**

1.  **Identify Need for Documentation:** During the analysis phase of a refactoring task, if the code interacts with external libraries, it is crucial to check the latest documentation. This is especially important for identifying deprecated methods, understanding new APIs, or adopting modern best practices.

2.  **Workflow for Fetching Documentation:**
    *   **Step 1: Resolve Library ID:** Use the `resolve-library-id` tool from the `context7-mcp` server to get the precise, Context7-compatible ID for the library in question.
        *   **Tool:** `use_mcp_tool`
        *   **Server:** `github.com/upstash/context7-mcp`
        *   **Tool Name:** `resolve-library-id`
        *   **Argument:** `{"libraryName": "[name-of-library]"}`
    *   **Step 2: Get Documentation:** Once you have the compatible ID, use the `get-library-docs` tool to fetch the relevant documentation, focusing on topics like "API changes", "migration", "deprecation", or the specific feature you are refactoring.
        *   **Tool:** `use_mcp_tool`
        *   **Server:** `github.com/upstash/context7-mcp`
        *   **Tool Name:** `get-library-docs`
        *   **Arguments:** `{"context7CompatibleLibraryID": "[ID-from-step-1]", "topic": "[specific-topic-or-feature]"}`

3.  **Apply to Refactoring:** Use the retrieved documentation to guide your refactoring decisions. Replace outdated patterns with current ones and ensure your changes align with the library's latest recommendations.

**Rationale:**

*   **Modernization:** Ensures that refactoring efforts not only improve code structure but also modernize its dependencies and API usage.
*   **Risk Reduction:** Prevents the introduction of new issues by relying on outdated or deprecated library features.
*   **Efficiency:** Provides a direct and reliable method for obtaining critical information for a successful refactor.