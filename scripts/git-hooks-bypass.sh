#!/usr/bin/env bash
# Git Hooks Bypass Manager
# Interactive bypass management for MediaNest git hooks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show current bypass status
show_status() {
    echo -e "${BLUE}📊 Current Git Hooks Bypass Status:${NC}"
    echo "----------------------------------------"
    
    if [ "${MEDIANEST_SKIP_HOOKS:-}" = "1" ]; then
        echo -e "${RED}🚨 EMERGENCY MODE: All hooks bypassed${NC}"
    elif [ "${MEDIANEST_SKIP_PRECOMMIT:-}" = "1" ]; then
        echo -e "${YELLOW}⚠️  PRE-COMMIT BYPASS: Formatting skipped${NC}"
    else
        echo -e "${GREEN}✅ NORMAL MODE: All hooks active${NC}"
    fi
    
    echo ""
    echo "Environment variables:"
    echo "  MEDIANEST_SKIP_HOOKS: ${MEDIANEST_SKIP_HOOKS:-'not set'}"
    echo "  MEDIANEST_SKIP_PRECOMMIT: ${MEDIANEST_SKIP_PRECOMMIT:-'not set'}"
}

# Function to set bypass modes
set_bypass() {
    case "$1" in
        "emergency")
            export MEDIANEST_SKIP_HOOKS=1
            echo -e "${RED}🚨 EMERGENCY MODE ACTIVATED${NC}"
            echo "   All hooks bypassed except basic commit message validation"
            echo "   Use for: Production outages, critical security fixes"
            ;;
        "precommit")
            export MEDIANEST_SKIP_PRECOMMIT=1
            unset MEDIANEST_SKIP_HOOKS 2>/dev/null || true
            echo -e "${YELLOW}⚠️  PRE-COMMIT BYPASS ACTIVATED${NC}"
            echo "   Code formatting skipped, commit message validation active"
            echo "   Use for: WIP commits, experiments, draft implementations"
            echo "   Remember: Run 'npm run lint:fix' before pushing"
            ;;
        "clear")
            unset MEDIANEST_SKIP_HOOKS 2>/dev/null || true
            unset MEDIANEST_SKIP_PRECOMMIT 2>/dev/null || true
            echo -e "${GREEN}✅ NORMAL MODE RESTORED${NC}"
            echo "   All hooks active and running normally"
            ;;
        *)
            echo -e "${RED}❌ Unknown bypass mode: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Function to show help
show_help() {
    echo "Git Hooks Bypass Manager for MediaNest"
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  $0 emergency   # Skip all hooks (emergency situations)"
    echo "  $0 precommit   # Skip pre-commit only (development)"
    echo "  $0 status      # Show current bypass status"
    echo "  $0 clear       # Return to normal mode"
    echo ""
    echo -e "${BLUE}Bypass Modes:${NC}"
    echo -e "${RED}  emergency${NC}  - Skip all hooks except basic validation"
    echo "               Use for: Production outages, critical security fixes"
    echo ""
    echo -e "${YELLOW}  precommit${NC}  - Skip code formatting, keep message validation"
    echo "               Use for: WIP commits, experiments, drafts"
    echo ""
    echo -e "${GREEN}  clear${NC}      - Return to normal hook execution"
    echo "               Use for: Regular development workflow"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  # Emergency production fix"
    echo "  $0 emergency"
    echo "  git commit -m \"emergency: fix critical auth bypass\""
    echo ""
    echo "  # Work-in-progress commit"
    echo "  $0 precommit"
    echo "  git commit -m \"wip: exploring new caching approach\""
    echo ""
    echo "  # Return to normal"
    echo "  $0 clear"
    echo "  git commit -m \"feat: implement user authentication\""
}

# Function to validate environment
validate_environment() {
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: Not in a git repository${NC}"
        exit 1
    fi
    
    # Check if husky is set up
    if [ ! -d ".husky" ]; then
        echo -e "${YELLOW}⚠️  Warning: .husky directory not found${NC}"
        echo "   Run 'npm run hooks:install' to set up git hooks"
    fi
}

# Main execution
main() {
    validate_environment
    
    case "${1:-status}" in
        "emergency"|"precommit"|"clear")
            set_bypass "$1"
            echo ""
            show_status
            ;;
        "status")
            show_status
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi