#!/bin/bash

# MediaNest Documentation Quality Assurance Runner
# Comprehensive QA testing suite for documentation

set -e

# Configuration
DOCS_DIR="docs"
SITE_URL="http://localhost:8000"
QA_DIR="tests/docs-qa"
RESULTS_DIR="$QA_DIR/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}🚀 MediaNest Documentation Quality Assurance${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if site is running
check_site() {
    if curl -s --head "$SITE_URL" | head -n 1 | grep -q "200 OK"; then
        return 0
    else
        return 1
    fi
}

# Function to start MkDocs server if needed
start_mkdocs() {
    if ! check_site; then
        echo -e "${YELLOW}⚠️  Documentation site not running, starting MkDocs server...${NC}"
        
        # Check if MkDocs is installed
        if ! command_exists mkdocs; then
            echo -e "${RED}❌ MkDocs not found. Please install with: pip install mkdocs-material${NC}"
            exit 1
        fi
        
        # Start MkDocs in background
        echo -e "${BLUE}🔧 Starting MkDocs server at $SITE_URL${NC}"
        mkdocs serve --dev-addr=localhost:8000 > "$RESULTS_DIR/mkdocs.log" 2>&1 &
        MKDOCS_PID=$!
        
        # Wait for server to start
        echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
        for i in {1..30}; do
            if check_site; then
                echo -e "${GREEN}✅ MkDocs server started successfully${NC}"
                break
            fi
            sleep 1
        done
        
        if ! check_site; then
            echo -e "${RED}❌ Failed to start MkDocs server${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Documentation site is running at $SITE_URL${NC}"
    fi
}

# Function to stop MkDocs server
stop_mkdocs() {
    if [ ! -z "$MKDOCS_PID" ]; then
        echo -e "${YELLOW}🛑 Stopping MkDocs server...${NC}"
        kill $MKDOCS_PID 2>/dev/null || true
    fi
}

# Function to install Python dependencies
install_dependencies() {
    echo -e "${BLUE}🔧 Installing Python dependencies...${NC}"
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -q aiohttp beautifulsoup4 requests selenium psutil pyyaml
    
    # Install Chrome/Chromium for Selenium (if not already installed)
    if ! command_exists google-chrome && ! command_exists chromium-browser; then
        echo -e "${YELLOW}⚠️  Chrome/Chromium not found. Some tests may be skipped.${NC}"
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to run individual QA module
run_qa_module() {
    local module=$1
    local description=$2
    local script=$3
    
    echo -e "${PURPLE}$module $description${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..50})${NC}"
    
    if [ -f "$QA_DIR/$script" ]; then
        if python3 "$QA_DIR/$script"; then
            echo -e "${GREEN}✅ $description completed successfully${NC}"
        else
            echo -e "${RED}❌ $description failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  $script not found, skipping${NC}"
    fi
    
    echo ""
}

# Function to run comprehensive QA
run_comprehensive_qa() {
    echo -e "${BLUE}🏃 Running Comprehensive Documentation QA${NC}"
    echo ""
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run comprehensive QA dashboard
    if python3 "$QA_DIR/quality_dashboard.py" --site-url="$SITE_URL" --docs-dir="$DOCS_DIR" "$@"; then
        echo -e "${GREEN}✅ Comprehensive QA completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Comprehensive QA failed${NC}"
        return 1
    fi
}

# Function to run individual modules
run_individual_modules() {
    echo -e "${BLUE}🔍 Running Individual QA Modules${NC}"
    echo ""
    
    # Activate virtual environment
    source venv/bin/activate
    
    local failed_modules=0
    
    # Link Checking
    if ! run_qa_module "🔗" "Link Validation" "comprehensive_link_checker.py"; then
        ((failed_modules++))
    fi
    
    # Formatting Validation
    if ! run_qa_module "📋" "Formatting Validation" "formatting_validator.py"; then
        ((failed_modules++))
    fi
    
    # Accessibility Testing
    if ! run_qa_module "♿" "Accessibility Testing" "accessibility_tester.py"; then
        ((failed_modules++))
    fi
    
    # Mobile Responsiveness (only if site is running)
    if check_site; then
        if ! run_qa_module "📱" "Mobile Responsiveness" "mobile_responsiveness_tester.py"; then
            ((failed_modules++))
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping mobile responsiveness tests (site not running)${NC}"
    fi
    
    # Performance Monitoring (only if site is running)
    if check_site; then
        if ! run_qa_module "⚡" "Performance Monitoring" "performance_monitor.py"; then
            ((failed_modules++))
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping performance tests (site not running)${NC}"
    fi
    
    return $failed_modules
}

# Function to generate summary report
generate_summary() {
    echo -e "${BLUE}📊 Generating Summary Report${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..50})${NC}"
    
    if [ -f "$RESULTS_DIR/comprehensive_qa_report.json" ]; then
        echo -e "${GREEN}✅ Quality Dashboard: file://$PWD/$RESULTS_DIR/quality_dashboard.html${NC}"
        echo -e "${GREEN}✅ Comprehensive Report: $RESULTS_DIR/comprehensive_qa_report.json${NC}"
        
        # Extract key metrics if jq is available
        if command_exists jq; then
            local overall_score=$(cat "$RESULTS_DIR/comprehensive_qa_report.json" | jq -r '.quality_metrics.overall_score // "N/A"')
            local critical_issues=$(cat "$RESULTS_DIR/comprehensive_qa_report.json" | jq -r '.quality_metrics.critical_issues // "N/A"')
            local overall_status=$(cat "$RESULTS_DIR/comprehensive_qa_report.json" | jq -r '.summary.overall_status // "N/A"')
            
            echo ""
            echo -e "${BLUE}📈 Key Metrics:${NC}"
            echo -e "   Overall Score: $overall_score/100"
            echo -e "   Critical Issues: $critical_issues"
            echo -e "   Status: $overall_status"
        fi
    fi
    
    echo ""
    echo -e "${BLUE}📁 Individual Reports:${NC}"
    for report in "$RESULTS_DIR"/*_report.json; do
        if [ -f "$report" ]; then
            echo -e "   📄 $(basename "$report")"
        fi
    done
    
    echo ""
}

# Function to show help
show_help() {
    echo "MediaNest Documentation Quality Assurance Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --comprehensive      Run comprehensive QA (default)"
    echo "  --individual         Run individual QA modules"
    echo "  --install-deps       Install Python dependencies"
    echo "  --start-server       Start MkDocs server only"
    echo "  --skip MODULE        Skip specific modules (links,formatting,accessibility,mobile,performance)"
    echo "  --site-url URL       Documentation site URL (default: http://localhost:8000)"
    echo "  --docs-dir DIR       Documentation directory (default: docs)"
    echo "  --ci                 Generate CI-friendly output"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run comprehensive QA"
    echo "  $0 --individual                      # Run individual modules"
    echo "  $0 --skip mobile --skip performance  # Skip mobile and performance tests"
    echo "  $0 --ci                              # Generate CI report"
    echo "  $0 --install-deps                    # Install dependencies only"
    echo ""
}

# Parse command line arguments
COMPREHENSIVE=true
INDIVIDUAL=false
INSTALL_DEPS_ONLY=false
START_SERVER_ONLY=false
CI_MODE=false
SKIP_MODULES=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --comprehensive)
            COMPREHENSIVE=true
            INDIVIDUAL=false
            shift
            ;;
        --individual)
            INDIVIDUAL=true
            COMPREHENSIVE=false
            shift
            ;;
        --install-deps)
            INSTALL_DEPS_ONLY=true
            shift
            ;;
        --start-server)
            START_SERVER_ONLY=true
            shift
            ;;
        --skip)
            SKIP_MODULES+=("--skip" "$2")
            shift 2
            ;;
        --site-url)
            SITE_URL="$2"
            shift 2
            ;;
        --docs-dir)
            DOCS_DIR="$2"
            shift 2
            ;;
        --ci)
            CI_MODE=true
            SKIP_MODULES+=("--ci")
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Trap to cleanup on exit
trap 'stop_mkdocs' EXIT INT TERM

# Main execution
main() {
    echo -e "${BLUE}🔧 Setup Phase${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..50})${NC}"
    
    # Install dependencies
    install_dependencies
    
    if [ "$INSTALL_DEPS_ONLY" = true ]; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
        exit 0
    fi
    
    # Start MkDocs server if needed
    start_mkdocs
    
    if [ "$START_SERVER_ONLY" = true ]; then
        echo -e "${GREEN}✅ MkDocs server is running at $SITE_URL${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
        wait
        exit 0
    fi
    
    echo ""
    
    # Run QA based on selected mode
    local exit_code=0
    
    if [ "$COMPREHENSIVE" = true ]; then
        if ! run_comprehensive_qa "${SKIP_MODULES[@]}"; then
            exit_code=1
        fi
    elif [ "$INDIVIDUAL" = true ]; then
        if ! run_individual_modules; then
            exit_code=1
        fi
    fi
    
    echo ""
    
    # Generate summary
    generate_summary
    
    # Final status
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 Documentation QA completed successfully!${NC}"
    else
        echo -e "${RED}💥 Documentation QA failed! Please review the issues above.${NC}"
    fi
    
    exit $exit_code
}

# Run main function
main