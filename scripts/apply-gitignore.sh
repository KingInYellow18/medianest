#!/bin/bash
# =============================================================================
# MediaNest Branch-Specific .gitignore Application Script
# Purpose: Automatically apply appropriate .gitignore based on current branch
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROJECT_ROOT=$(git rev-parse --show-toplevel)
TEMPLATES_DIR="$PROJECT_ROOT/.gitignore-templates"

echo -e "${BLUE}🔍 Current branch: ${YELLOW}$CURRENT_BRANCH${NC}"

# Function to apply gitignore template
apply_gitignore() {
    local branch=$1
    local template_file="$TEMPLATES_DIR/.gitignore.$branch"
    local target_file="$PROJECT_ROOT/.gitignore"
    
    if [[ -f "$template_file" ]]; then
        echo -e "${GREEN}✅ Applying .gitignore template for $branch branch${NC}"
        cp "$template_file" "$target_file"
        echo -e "${GREEN}📝 Applied: $(basename $template_file) → .gitignore${NC}"
        
        # Log the change
        echo "$(date): Applied .gitignore.$branch to .gitignore" >> "$PROJECT_ROOT/.gitignore-history.log"
        
        return 0
    else
        echo -e "${RED}❌ Template not found: $template_file${NC}"
        return 1
    fi
}

# Function to show current differences
show_differences() {
    local branch=$1
    local template_file="$TEMPLATES_DIR/.gitignore.$branch"
    local current_file="$PROJECT_ROOT/.gitignore"
    
    if [[ -f "$template_file" && -f "$current_file" ]]; then
        echo -e "${BLUE}📊 Differences between current .gitignore and $branch template:${NC}"
        if diff -q "$current_file" "$template_file" > /dev/null; then
            echo -e "${GREEN}✅ No differences - .gitignore is up to date${NC}"
        else
            diff -u "$current_file" "$template_file" | head -20
            echo -e "${YELLOW}... (showing first 20 lines of diff)${NC}"
        fi
    fi
}

# Main logic
case "$CURRENT_BRANCH" in
    "main")
        echo -e "${GREEN}🏭 Production branch detected${NC}"
        show_differences "main"
        apply_gitignore "main"
        ;;
    "development")
        echo -e "${BLUE}🔧 Development branch detected${NC}"
        show_differences "development"
        apply_gitignore "development"
        ;;
    "test")
        echo -e "${YELLOW}🧪 Test branch detected${NC}"
        show_differences "test"
        apply_gitignore "test"
        ;;
    "claude-flow")
        echo -e "${YELLOW}🤖 Claude Flow branch detected${NC}"
        show_differences "claude-flow"
        apply_gitignore "claude-flow"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Unknown branch: $CURRENT_BRANCH${NC}"
        echo -e "${BLUE}Available templates:${NC}"
        ls -1 "$TEMPLATES_DIR"/.gitignore.* 2>/dev/null | sed 's/.*\.gitignore\./  - /' || echo "  No templates found"
        echo -e "${BLUE}💡 Defaulting to development branch template${NC}"
        apply_gitignore "development"
        ;;
esac

echo -e "${GREEN}🎉 .gitignore application complete!${NC}"

# Optional: Check git status
if command -v git &> /dev/null; then
    echo -e "${BLUE}📋 Git status after .gitignore update:${NC}"
    git status --porcelain | head -10
    if [[ $(git status --porcelain | wc -l) -gt 10 ]]; then
        echo -e "${YELLOW}... (showing first 10 changes)${NC}"
    fi
fi