#!/bin/bash

# Basic test runner with timeout protection
echo "🧪 Running basic tests with timeout protection..."

# Run a single test file to verify configuration
echo "📝 Testing single test file..."
timeout 30s npx vitest run tests/unit/services/health.service.test.ts

# Run all tests with timeout
echo "📊 Running all tests..."
timeout 60s npx vitest run

echo "✅ Basic tests completed"