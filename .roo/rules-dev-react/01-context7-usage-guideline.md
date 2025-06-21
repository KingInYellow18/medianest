+++
id = "DEV-REACT-RULE-CONTEXT7-USAGE-V1"
title = "React Specialist: Guideline for Context7 MCP Usage"
context_type = "rules"
scope = "Defines how the React Specialist mode should use the Context7 MCP for library documentation."
target_audience = ["dev-react"]
granularity = "guideline"
status = "active"
last_updated = "2025-06-21"
tags = ["rules", "guideline", "mcp", "context7", "documentation", "react"]
related_context = []
template_schema_doc = ".ruru/templates/toml-md/16_ai_rule.README.md"
relevance = "High: Provides a primary mechanism for retrieving up-to-date library context."
+++

# Guideline: Using Context7 for React Library Documentation

## 1. Objective
This guideline instructs the `dev-react` mode on the standard procedure for using the `context7-mcp` server to fetch accurate and up-to-date documentation for React libraries and related tools.

## 2. When to Use Context7
When you need to understand how to use a specific JavaScript/TypeScript library, component library, or framework commonly used with React (e.g., `react-router-dom`, `axios`, `zustand`, `framer-motion`), you **SHOULD** prefer using the `context7-mcp` server over a general web search. It provides structured, reliable, and current documentation.

## 3. Workflow

1.  **Identify the Library:** From the user's request or the code context, identify the name of the library for which you need documentation (e.g., "react-router-dom").

2.  **Resolve Library ID:** Use the `resolve-library-id` tool from the `context7-mcp` server to get the Context7-compatible library ID.
    *   **Tool:** `use_mcp_tool`
    *   **Server:** `github.com/upstash/context7-mcp`
    *   **Tool Name:** `resolve-library-id`
    *   **Argument:** `{"libraryName": "react-router-dom"}`

3.  **Fetch Documentation:** Once you have the `context7CompatibleLibraryID` from the previous step, use the `get-library-docs` tool to retrieve the documentation.
    *   **Tool:** `use_mcp_tool`
    *   **Server:** `github.com/upstash/context7-mcp`
    *   **Tool Name:** `get-library-docs`
    *   **Arguments:**
        *   `{"context7CompatibleLibraryID": "[ID_from_previous_step]"}`
        *   Optionally, you can specify a `topic` to focus the documentation search (e.g., `{"topic": "useNavigate hook"}`).

4.  **Apply Knowledge:** Use the retrieved documentation to inform your coding, answer user questions, or complete the assigned task. The documentation is considered an authoritative source.