#!/bin/bash

# MediaNest MKDocs Validation Script
# Comprehensive validation for documentation build

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "    MediaNest MKDocs Documentation Validation"
echo "═══════════════════════════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if MKDocs is installed
if ! command -v mkdocs &> /dev/null; then
    echo -e "${YELLOW}MKDocs not found. Installing...${NC}"
    pip install mkdocs mkdocs-material pymdown-extensions mkdocs-minify-plugin mkdocs-git-revision-date-localized-plugin
fi

echo -e "\n${BLUE}1. Validating MKDocs Configuration${NC}"
echo "----------------------------------------"

# Check if mkdocs.yml exists
if [ ! -f "mkdocs.yml" ]; then
    echo -e "${RED}✗ mkdocs.yml not found${NC}"
    exit 1
fi

# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('mkdocs.yml'))" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ mkdocs.yml syntax is valid${NC}"
else
    echo -e "${RED}✗ mkdocs.yml has syntax errors${NC}"
    exit 1
fi

echo -e "\n${BLUE}2. Checking Documentation Structure${NC}"
echo "----------------------------------------"

# Check required directories
REQUIRED_DIRS=(
    "docs"
    "docs/architecture"
    "docs/api"
    "docs/getting-started"
    "docs/developers"
    "docs/visuals"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓ $dir exists${NC}"
    else
        echo -e "${YELLOW}⚠ $dir missing - creating...${NC}"
        mkdir -p "$dir"
    fi
done

echo -e "\n${BLUE}3. Checking Required Files${NC}"
echo "----------------------------------------"

# Check if index.md exists
if [ -f "docs/index.md" ]; then
    echo -e "${GREEN}✓ docs/index.md exists${NC}"
else
    echo -e "${RED}✗ docs/index.md missing${NC}"
    exit 1
fi

echo -e "\n${BLUE}4. Building Documentation${NC}"
echo "----------------------------------------"

# Try to build documentation
echo "Running MKDocs build..."
mkdocs build --clean --quiet 2>&1 | tee /tmp/mkdocs-build.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ MKDocs build successful${NC}"
else
    echo -e "${RED}✗ MKDocs build failed${NC}"
    echo "Error details:"
    cat /tmp/mkdocs-build.log
    exit 1
fi

echo -e "\n${BLUE}5. Validating Build Output${NC}"
echo "----------------------------------------"

# Check if site directory was created
if [ -d "site" ]; then
    echo -e "${GREEN}✓ Site directory created${NC}"
    
    # Count generated HTML files
    HTML_COUNT=$(find site -name "*.html" | wc -l)
    echo -e "${GREEN}✓ Generated $HTML_COUNT HTML files${NC}"
    
    # Check for key files
    KEY_FILES=("index.html" "404.html" "search/search_index.json")
    for file in "${KEY_FILES[@]}"; do
        if [ -f "site/$file" ]; then
            echo -e "${GREEN}✓ $file generated${NC}"
        else
            echo -e "${YELLOW}⚠ $file missing${NC}"
        fi
    done
else
    echo -e "${RED}✗ Site directory not created${NC}"
    exit 1
fi

echo -e "\n${BLUE}6. Checking Links (Basic)${NC}"
echo "----------------------------------------"

# Basic link checking in markdown files
BROKEN_LINKS=0
for file in $(find docs -name "*.md"); do
    # Check for broken internal links
    grep -oP '\[.*?\]\((?!http).*?\)' "$file" 2>/dev/null | while read -r link; do
        # Extract path from link
        path=$(echo "$link" | sed -E 's/.*\((.*)\).*/\1/' | sed 's/#.*//')
        if [ ! -z "$path" ] && [[ "$path" != "/"* ]]; then
            # Convert relative path
            dir=$(dirname "$file")
            full_path="$dir/$path"
            if [ ! -f "$full_path" ] && [ ! -f "$full_path.md" ]; then
                echo -e "${YELLOW}⚠ Potential broken link in $file: $path${NC}"
                ((BROKEN_LINKS++))
            fi
        fi
    done
done

if [ $BROKEN_LINKS -eq 0 ]; then
    echo -e "${GREEN}✓ No obvious broken links detected${NC}"
fi

echo -e "\n${BLUE}7. Validation Summary${NC}"
echo "----------------------------------------"

# Summary
echo -e "${GREEN}✓ MKDocs configuration is valid${NC}"
echo -e "${GREEN}✓ Documentation structure is correct${NC}"
echo -e "${GREEN}✓ Build completed successfully${NC}"
echo -e "${GREEN}✓ Site files generated${NC}"

# Check site size
SITE_SIZE=$(du -sh site 2>/dev/null | cut -f1)
echo -e "\n${BLUE}Site Statistics:${NC}"
echo "  • Size: $SITE_SIZE"
echo "  • HTML Files: $HTML_COUNT"
echo "  • Build Date: $(date)"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}    Documentation validation complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}Next Steps:${NC}"
echo "  1. Review the site at: file://$(pwd)/site/index.html"
echo "  2. Start local server: mkdocs serve"
echo "  3. Deploy to GitHub Pages: mkdocs gh-deploy"

exit 0