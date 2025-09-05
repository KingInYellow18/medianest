#!/bin/bash

echo "=== Testing MCP Server Connections ==="
echo

# Test if MCP servers are properly configured
echo "1. Checking configured MCP servers:"
claude mcp list
echo

# Test perplexity server
echo "2. Testing Perplexity MCP server:"
echo "Testing if perplexity binary exists and is executable..."
if [ -f "/home/kinginyellow/Documents/Claude/MCP/perplexity-mcp/build/index.js" ]; then
    echo "✓ Perplexity binary found"
    # Try to run with timeout to see if it starts
    timeout 2 bash -c 'PERPLEXITY_API_KEY=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 node /home/kinginyellow/Documents/Claude/MCP/perplexity-mcp/build/index.js' 2>&1 | head -5
else
    echo "✗ Perplexity binary not found"
fi
echo

# Test task-orchestrator
echo "3. Testing Task Orchestrator:"
which mcp-task-orchestrator
pipx list | grep -i task-orchestrator
echo

# Test sequential thinking
echo "4. Testing Sequential Thinking:"
echo "Checking if npx can find the package..."
npx @modelcontextprotocol/server-sequential-thinking --help 2>&1 | head -5
echo

echo "=== MCP Server Test Complete ==="