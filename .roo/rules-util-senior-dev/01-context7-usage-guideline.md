+++
id = "SENIOR-DEV-RULE-CONTEXT7-V1"
title = "Senior Developer: Guideline - Using Context7 for Documentation"
context_type = "rules"
scope = "Guidance for util-senior-dev on using the Context7 MCP server"
target_audience = ["util-senior-dev"]
granularity = "guideline"
status = "active"
last_updated = "2025-06-21"
tags = ["rules", "guideline", "mcp", "context7", "documentation", "senior-dev"]
related_context = [
    ".ruru/modes/util-senior-dev/util-senior-dev.mode.md",
    ".ruru/mcp-servers/context7-mcp.md"
]
template_schema_doc = ".ruru/templates/toml-md/16_ai_rule.README.md"
relevance = "High: Ensures correct use of documentation-fetching tools."
+++

# Guideline: Using Context7 for Documentation

**Objective:** To ensure that when you require documentation for a specific library or technology, you use the `context7-mcp` server for the most accurate and up-to-date information.

**Applies To:** `util-senior-dev`.

**Guideline:**

1.  **Identify Need for Documentation:** When you encounter a task that requires understanding a specific library, framework, or API, your primary source for documentation should be the `context7-mcp` server.

2.  **Workflow for Fetching Documentation:**
    *   **Step 1: Resolve Library ID:** Use the `resolve-library-id` tool from the `context7-mcp` server to get the precise, Context7-compatible ID for the library.
        *   **Tool:** `use_mcp_tool`
        *   **Server:** `github.com/upstash/context7-mcp`
        *   **Tool Name:** `resolve-library-id`
        *   **Argument:** `{"libraryName": "[name-of-library]"}`
    *   **Step 2: Get Documentation:** Once you have the compatible ID, use the `get-library-docs` tool to fetch the relevant documentation.
        *   **Tool:** `use_mcp_tool`
        *   **Server:** `github.com/upstash/context7-mcp`
        *   **Tool Name:** `get-library-docs`
        *   **Arguments:** `{"context7CompatibleLibraryID": "[ID-from-step-1]", "topic": "[specific-topic-or-feature]"}`

3.  **Incorporate into Code:** Use the retrieved documentation to inform your code implementation, ensuring you are following best practices and using the library correctly.

**Rationale:**

*   **Accuracy:** `context7-mcp` provides access to the latest official documentation.
*   **Efficiency:** Directly fetching documentation is faster and more reliable than general web searches.
*   **Consistency:** Ensures a standard, approved method for information gathering across development modes.