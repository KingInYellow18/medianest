#!/bin/bash
# Emergency build script for deployment
echo "🚨 EMERGENCY BUILD - Using relaxed TypeScript configuration"
echo "⏰ $(date)"

# Use emergency TypeScript config with relaxed rules
npm run build -- --project tsconfig.emergency.json

if [ $? -eq 0 ]; then
    echo "✅ EMERGENCY BUILD SUCCESSFUL!"
    echo "📦 Ready for deployment with emergency configuration"
    echo "⚠️  Note: Some type errors suppressed for deployment"
else
    echo "❌ Emergency build failed - critical errors remain"
    exit 1
fi