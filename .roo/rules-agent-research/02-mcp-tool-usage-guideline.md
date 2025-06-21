+++
id = "AGENT-RESEARCH-RULE-MCP-USAGE-V1"
title = "Agent Research: Guideline for MCP Tool Usage"
context_type = "rules"
scope = "Defines how agent-research should use available MCP tools for research, validation, and context enrichment."
target_audience = ["agent-research"]
granularity = "guideline"
status = "active"
last_updated = "2025-06-21"
tags = ["rules", "guideline", "mcp", "research", "validation", "context7", "vertex-ai"]
related_context = [
    ".roo/rules/10-vertex-mcp-usage-guideline.md"
]
template_schema_doc = ".ruru/templates/toml-md/16_ai_rule.README.md"
relevance = "High: Core guidance for the agent's primary function."
+++

# Guideline: MCP Tool Usage for Research

## 1. Objective
This guideline directs the `agent-research` mode on how to effectively use the available MCP servers for gathering information, enriching context, and validating findings.

## 2. Available MCP Servers & Primary Use Cases

This mode should be aware of and utilize the following MCP servers:

*   **`github.com/shariqriazz/vertex-ai-mcp-server` (`vertex-ai-mcp-server`)**:
    *   **Use Case:** General web searches, answering natural language queries, explaining topics, and generating project guidelines. This is the primary tool for broad research and initial information gathering.
    *   **Preferred Tools:**
        *   `answer_query_websearch`: For getting direct answers to questions using Google Search.
        *   `explain_topic_with_docs`: For in-depth explanations of software topics based on official documentation.
        *   `get_doc_snippets`: For retrieving specific code snippets or concise answers.
    *   **Output Handling:** Follow the `RULE-VERTEX-MCP-USAGE-V2` guideline. Prefer `save_*` variants for non-trivial output and report the file path.

*   **`github.com/upstash/context7-mcp` (`context7-mcp`)**:
    *   **Use Case:** Retrieving highly-structured, up-to-date documentation for specific software libraries and frameworks. This is the preferred tool when the user's request is about a known library.
    *   **Workflow:**
        1.  Use `resolve-library-id` to get the Context7-compatible ID for a given library name.
        2.  Use `get-library-docs` with the obtained ID to fetch the documentation.
    *   **Note:** This provides high-quality, focused context that is often superior to a general web search for library-specific questions.

*   **`github.com/mendableai/firecrawl-mcp-server` (`firecrawl-mcp-server`)**:
    *   **Use Case:** Scraping specific websites or performing deep research on a topic by crawling multiple URLs.
    *   **Preferred Tools:**
        *   `firecrawl_scrape`: When a specific URL needs to be scraped for content.
        *   `firecrawl_search`: For SERP results on a query.
        *   `firecrawl_deep_research`: For comprehensive research on a query.

*   **`github.com/modelcontextprotocol/servers/tree/main/src/brave-search` (`brave-search`)**:
    *   **Use Case:** An alternative to the Vertex AI web search for general queries.
    *   **Preferred Tool:** `brave_web_search`.

## 3. Standard Research Workflow

1.  **Analyze Request:** Determine the core of the user's research query. Is it a general question, a request for library documentation, or a need to scrape a specific site?
2.  **Select Best Tool:**
    *   For library/framework documentation -> **`context7-mcp`**.
    *   For general questions or topic explanations -> **`vertex-ai-mcp-server`**.
    *   For scraping a specific URL -> **`firecrawl-mcp-server`**.
    *   For broad web search -> **`vertex-ai-mcp-server`** or **`brave-search`**.
3.  **Execute and Synthesize:**
    *   Use the chosen MCP tool to gather the raw information.
    *   If using a `save_*` tool, read the resulting file to get the content.
    *   Synthesize the gathered information into a clear, concise answer for the user or for the requesting mode.
    *   Present the answer, citing the sources or the file path of the saved research.