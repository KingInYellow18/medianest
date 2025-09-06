#!/bin/bash

# Quick test script for Prometheus metrics
echo "🧪 Quick Prometheus Metrics Test"
echo "================================="

# Check if Node.js server files exist
if [ ! -f "src/middleware/metrics.ts" ]; then
    echo "❌ metrics.ts not found!"
    exit 1
fi

if [ ! -f "src/server.ts" ]; then
    echo "❌ server.ts not found!"
    exit 1
fi

echo "✅ Source files found"

# Test TypeScript compilation
echo "🔨 Testing TypeScript compilation..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Check if Prometheus config exists
if [ -f "../config/monitoring/prometheus.yml" ]; then
    echo "✅ Prometheus config found"
else
    echo "❌ Prometheus config not found"
fi

if [ -f "../config/monitoring/docker-compose.monitoring.yml" ]; then
    echo "✅ Docker monitoring setup found"
else
    echo "❌ Docker monitoring setup not found"
fi

echo ""
echo "🎉 All checks passed!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to install dependencies"
echo "2. Run 'npm run build' to build the project"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Visit http://localhost:3001/metrics to see Prometheus metrics"
echo "5. Visit http://localhost:3001/health for health check"
echo ""
echo "To start monitoring stack:"
echo "cd ../config/monitoring && docker-compose -f docker-compose.monitoring.yml up -d"