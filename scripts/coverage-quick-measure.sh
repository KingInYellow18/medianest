#!/bin/bash

# Coverage Quick Measurement Script
# Usage: ./scripts/coverage-quick-measure.sh [module]
# Modules: backend, frontend, shared, all (default)

set -e

echo "🔍 Coverage Validation Agent - Quick Measurement"
echo "==============================================="

MODULE=${1:-all}
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_DIR="coverage-reports"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Function to measure coverage for specific module
measure_module() {
    local module=$1
    local config_file=""
    
    case $module in
        "backend")
            config_file="vitest.coverage.config.ts"
            ;;
        "frontend") 
            config_file="vitest.coverage.config.ts"
            ;;
        "shared")
            config_file="vitest.coverage.config.ts"
            ;;
        "all")
            config_file="vitest.coverage.config.ts"
            ;;
        *)
            echo "❌ Unknown module: $module"
            echo "   Available: backend, frontend, shared, all"
            exit 1
            ;;
    esac
    
    echo "📊 Measuring $module coverage..."
    
    # Run coverage with timeout
    timeout 300s npx vitest \
        --config "$config_file" \
        --coverage \
        --run \
        --reporter=verbose \
        ${module:+--project=$module} \
        2>&1 | tee "$REPORT_DIR/coverage-${module}-${TIMESTAMP}.log"
    
    echo "✅ $module coverage measurement complete"
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo "📋 Generating Coverage Summary..."
    
    # Check if coverage directory exists
    if [ -d "coverage" ]; then
        echo "✅ Coverage reports generated in: ./coverage"
        
        # Extract coverage percentages if available
        if [ -f "coverage/coverage-summary.json" ]; then
            echo "📊 Coverage Summary:"
            cat coverage/coverage-summary.json | jq -r '.total | "   Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Functions: \(.functions.pct)% | Branches: \(.branches.pct)%"' 2>/dev/null || echo "   (Summary data available in coverage/coverage-summary.json)"
        fi
    else
        echo "⚠️ No coverage directory found - check for execution errors"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo "🔧 Checking prerequisites..."
    
    # Check if vitest is available
    if ! command -v npx > /dev/null 2>&1; then
        echo "❌ npx not available - please install Node.js"
        exit 1
    fi
    
    # Check if coverage config exists
    if [ ! -f "vitest.coverage.config.ts" ]; then
        echo "❌ Coverage configuration not found: vitest.coverage.config.ts"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

# Main execution
main() {
    check_prerequisites
    
    echo "🎯 Target Module: $MODULE"
    echo "📁 Reports Directory: $REPORT_DIR"
    echo ""
    
    case $MODULE in
        "all")
            echo "📊 Measuring coverage for all modules..."
            measure_module "all"
            ;;
        *)
            measure_module "$MODULE"
            ;;
    esac
    
    generate_summary
    
    echo ""
    echo "🎉 Coverage measurement complete!"
    echo "📁 Reports saved to: $REPORT_DIR/"
    echo "🌐 HTML Report: coverage/index.html"
    echo ""
    echo "💡 Next steps:"
    echo "   1. Review coverage reports"
    echo "   2. Identify any genuine gaps"
    echo "   3. Validate critical path coverage"
    echo "   4. Update CI/CD thresholds if needed"
}

# Handle script termination
trap 'echo "⚠️ Coverage measurement interrupted"' INT TERM

# Execute main function
main "$@"