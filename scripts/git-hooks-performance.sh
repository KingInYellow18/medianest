#!/usr/bin/env bash
# Git Hooks Performance Testing
# Quick performance testing and optimization for MediaNest git hooks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Performance thresholds (seconds)
EXCELLENT_THRESHOLD=1.0
GOOD_THRESHOLD=2.0
WARNING_THRESHOLD=5.0

# Function to run performance test
test_hook_performance() {
    local hook_name="$1"
    local hook_path="$2"
    local iterations=${3:-1}
    
    echo -e "${BLUE}⏱️  Testing $hook_name performance...${NC}"
    
    local total_time=0
    local successful_runs=0
    
    for ((i=1; i<=iterations; i++)); do
        echo -n "  Run $i/$iterations: "
        
        # Create test environment
        if [[ "$hook_name" == "pre-commit" ]]; then
            # Create a temporary test file
            echo "// Performance test file" > .performance-test.tmp
            git add .performance-test.tmp >/dev/null 2>&1
        elif [[ "$hook_name" == "commit-msg" ]]; then
            # Create test commit message
            echo "test: performance measurement for commit message validation" > .commit-msg-test.tmp
        fi
        
        # Measure execution time
        start_time=$(date +%s.%3N)
        
        if [[ "$hook_name" == "pre-commit" ]]; then
            if timeout 15s "$hook_path" >/dev/null 2>&1; then
                end_time=$(date +%s.%3N)
                execution_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
                total_time=$(echo "$total_time + $execution_time" | bc -l 2>/dev/null || echo "$total_time")
                successful_runs=$((successful_runs + 1))
                printf "%.3fs\n" "$execution_time"
            else
                echo "TIMEOUT/ERROR"
            fi
            # Cleanup
            git reset HEAD .performance-test.tmp >/dev/null 2>&1 || true
            rm -f .performance-test.tmp
        elif [[ "$hook_name" == "commit-msg" ]]; then
            if timeout 10s "$hook_path" .commit-msg-test.tmp >/dev/null 2>&1; then
                end_time=$(date +%s.%3N)
                execution_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
                total_time=$(echo "$total_time + $execution_time" | bc -l 2>/dev/null || echo "$total_time")
                successful_runs=$((successful_runs + 1))
                printf "%.3fs\n" "$execution_time"
            else
                echo "TIMEOUT/ERROR"
            fi
            # Cleanup
            rm -f .commit-msg-test.tmp
        fi
    done
    
    # Calculate average
    if [ "$successful_runs" -gt 0 ]; then
        average_time=$(echo "scale=3; $total_time / $successful_runs" | bc -l 2>/dev/null || echo "0")
        
        # Determine performance rating
        if (( $(echo "$average_time <= $EXCELLENT_THRESHOLD" | bc -l) )); then
            echo -e "${GREEN}🚀 EXCELLENT: Average ${average_time}s (${successful_runs}/${iterations} runs)${NC}"
        elif (( $(echo "$average_time <= $GOOD_THRESHOLD" | bc -l) )); then
            echo -e "${GREEN}✅ GOOD: Average ${average_time}s (${successful_runs}/${iterations} runs)${NC}"
        elif (( $(echo "$average_time <= $WARNING_THRESHOLD" | bc -l) )); then
            echo -e "${YELLOW}⚠️  ACCEPTABLE: Average ${average_time}s (${successful_runs}/${iterations} runs)${NC}"
        else
            echo -e "${RED}❌ SLOW: Average ${average_time}s (${successful_runs}/${iterations} runs)${NC}"
        fi
    else
        echo -e "${RED}❌ ALL RUNS FAILED${NC}"
    fi
    
    echo ""
}

# Function to optimize performance
optimize_performance() {
    echo -e "${BLUE}🔧 Running Performance Optimizations...${NC}"
    
    echo "1. Clearing npm cache..."
    npm cache clean --force >/dev/null 2>&1
    echo -e "${GREEN}   ✅ npm cache cleared${NC}"
    
    echo "2. Updating dependencies..."
    npm update >/dev/null 2>&1
    echo -e "${GREEN}   ✅ Dependencies updated${NC}"
    
    echo "3. Setting optimal Node.js options..."
    export NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"
    echo -e "${GREEN}   ✅ Node.js options optimized${NC}"
    
    echo ""
}

# Function to show system performance info
show_system_info() {
    echo -e "${BLUE}💻 System Performance Information:${NC}"
    
    # CPU info
    if command -v nproc >/dev/null 2>&1; then
        echo "  CPU Cores: $(nproc)"
    fi
    
    # Memory info
    if command -v free >/dev/null 2>&1; then
        mem_info=$(free -h | awk 'NR==2{printf "Used: %s/%s (%.2f%%)", $3,$2,$3*100/$2 }')
        echo "  Memory: $mem_info"
    fi
    
    # Disk space
    disk_info=$(df -h . | awk 'NR==2{printf "Used: %s/%s (%s)", $3,$2,$5}')
    echo "  Disk: $disk_info"
    
    # Node.js memory
    if command -v node >/dev/null 2>&1; then
        node_version=$(node --version)
        echo "  Node.js: $node_version"
        
        # Check if Node.js options are set
        if [ -n "${NODE_OPTIONS:-}" ]; then
            echo "  Node Options: $NODE_OPTIONS"
        else
            echo -e "${YELLOW}  Node Options: Not optimized${NC}"
        fi
    fi
    
    echo ""
}

# Function to benchmark with different configurations
benchmark_configurations() {
    echo -e "${BLUE}🏁 Benchmarking Different Configurations...${NC}"
    
    # Test 1: Default configuration
    echo "Configuration 1: Default settings"
    unset NODE_OPTIONS 2>/dev/null || true
    test_hook_performance "pre-commit" ".husky/pre-commit" 1
    
    # Test 2: Optimized Node.js options
    echo "Configuration 2: Optimized Node.js options"
    export NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"
    test_hook_performance "pre-commit" ".husky/pre-commit" 1
    
    # Test 3: With bypass (for comparison)
    echo "Configuration 3: Emergency bypass (baseline)"
    export MEDIANEST_SKIP_HOOKS=1
    test_hook_performance "pre-commit" ".husky/pre-commit" 1
    unset MEDIANEST_SKIP_HOOKS
}

# Function to show optimization recommendations
show_recommendations() {
    echo -e "${BLUE}💡 Performance Optimization Recommendations:${NC}"
    echo ""
    echo -e "${GREEN}Quick Wins:${NC}"
    echo "  • Set NODE_OPTIONS='--max-old-space-size=512 --optimize-for-size'"
    echo "  • Run 'npm cache clean --force' regularly"
    echo "  • Use 'npx lint-staged --concurrent' for parallel processing"
    echo ""
    echo -e "${YELLOW}Medium-term Improvements:${NC}"
    echo "  • Configure Prettier cache: --cache flag"
    echo "  • Optimize lint-staged configuration for file types"
    echo "  • Consider using pre-commit bypass for WIP commits"
    echo ""
    echo -e "${BLUE}Environment Optimizations:${NC}"
    echo "  • Use SSD storage for better I/O performance"
    echo "  • Ensure adequate RAM (>= 4GB recommended)"
    echo "  • Close unnecessary applications during development"
    echo ""
    echo -e "${GREEN}Bypass Usage:${NC}"
    echo "  • Use 'MEDIANEST_SKIP_PRECOMMIT=1' for drafts"
    echo "  • Use 'MEDIANEST_SKIP_HOOKS=1' for emergencies only"
    echo "  • Always run 'npm run lint:fix' after bypassing"
}

# Main execution
main() {
    echo "⚡ Git Hooks Performance Testing for MediaNest"
    echo "=============================================="
    echo ""
    
    case "${1:-test}" in
        "test")
            show_system_info
            
            if [ -f ".husky/pre-commit" ]; then
                test_hook_performance "pre-commit" ".husky/pre-commit" 3
            else
                echo -e "${RED}❌ Pre-commit hook not found${NC}"
            fi
            
            if [ -f ".husky/commit-msg" ]; then
                test_hook_performance "commit-msg" ".husky/commit-msg" 3
            else
                echo -e "${RED}❌ Commit-msg hook not found${NC}"
            fi
            
            show_recommendations
            ;;
        "optimize")
            show_system_info
            optimize_performance
            echo "Testing optimized performance..."
            if [ -f ".husky/pre-commit" ]; then
                test_hook_performance "pre-commit" ".husky/pre-commit" 1
            fi
            ;;
        "benchmark")
            show_system_info
            benchmark_configurations
            show_recommendations
            ;;
        "quick")
            if [ -f ".husky/pre-commit" ]; then
                test_hook_performance "pre-commit" ".husky/pre-commit" 1
            fi
            if [ -f ".husky/commit-msg" ]; then
                test_hook_performance "commit-msg" ".husky/commit-msg" 1
            fi
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  test       Run comprehensive performance tests (default)"
            echo "  optimize   Optimize and test performance"
            echo "  benchmark  Compare different configurations"
            echo "  quick      Run single quick test"
            echo "  help       Show this help message"
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi