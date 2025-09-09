#!/bin/bash

# Documentation Validation Script for MediaNest
# Validates documentation structure, content, and formatting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="docs"
MKDOCS_CONFIG="mkdocs.yml"
MIN_WORD_COUNT=50
MAX_LINE_LENGTH=120

# Usage information
usage() {
    echo "Usage: $0 [structure|content|format|all]"
    echo "  structure: Validate directory structure and file organization"
    echo "  content:   Validate content quality and completeness"
    echo "  format:    Validate markdown formatting and style"
    echo "  all:       Run all validation checks (default)"
    exit 1
}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_tools=()
    
    command -v python3 >/dev/null 2>&1 || missing_tools+=("python3")
    command -v mkdocs >/dev/null 2>&1 || missing_tools+=("mkdocs")
    command -v find >/dev/null 2>&1 || missing_tools+=("find")
    command -v grep >/dev/null 2>&1 || missing_tools+=("grep")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Validate directory structure
validate_structure() {
    log_info "Validating documentation structure..."
    
    local errors=0
    
    # Check if docs directory exists
    if [ ! -d "$DOCS_DIR" ]; then
        log_error "Documentation directory '$DOCS_DIR' not found"
        ((errors++))
    fi
    
    # Check if mkdocs.yml exists
    if [ ! -f "$MKDOCS_CONFIG" ]; then
        log_error "MkDocs configuration file '$MKDOCS_CONFIG' not found"
        ((errors++))
    fi
    
    # Check for required documentation sections
    local required_sections=(
        "index.md"
        "getting-started"
        "api"
        "deployment"
        "development"
    )
    
    for section in "${required_sections[@]}"; do
        if [ ! -e "$DOCS_DIR/$section" ] && [ ! -e "$DOCS_DIR/$section.md" ]; then
            log_warning "Recommended section missing: $section"
        fi
    done
    
    # Validate file naming conventions
    log_info "Checking file naming conventions..."
    find "$DOCS_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
        basename_file=$(basename "$file")
        if [[ ! "$basename_file" =~ ^[a-z0-9._-]+\.md$ ]]; then
            log_warning "File name should use lowercase with dashes/underscores: $file"
        fi
    done
    
    # Check for orphaned files (not referenced in navigation)
    if [ -f "$MKDOCS_CONFIG" ]; then
        log_info "Checking for orphaned files..."
        find "$DOCS_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
            relative_path=${file#$DOCS_DIR/}
            if ! grep -q "$relative_path" "$MKDOCS_CONFIG" && [ "$relative_path" != "index.md" ]; then
                log_warning "File may be orphaned (not in navigation): $relative_path"
            fi
        done
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Structure validation passed"
        return 0
    else
        log_error "Structure validation failed with $errors errors"
        return 1
    fi
}

# Validate content quality
validate_content() {
    log_info "Validating content quality..."
    
    local warnings=0
    local errors=0
    
    # Check each markdown file
    find "$DOCS_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
        log_info "Checking content in: ${file#$DOCS_DIR/}"
        
        # Check if file is empty
        if [ ! -s "$file" ]; then
            log_error "Empty file: $file"
            ((errors++))
            continue
        fi
        
        # Count words (excluding frontmatter)
        word_count=$(sed '/^---$/,/^---$/d' "$file" | wc -w)
        if [ "$word_count" -lt $MIN_WORD_COUNT ]; then
            log_warning "File may be too short ($word_count words): ${file#$DOCS_DIR/}"
            ((warnings++))
        fi
        
        # Check for TODO markers
        if grep -qi "todo\|fixme\|xxx" "$file"; then
            log_warning "TODO/FIXME markers found in: ${file#$DOCS_DIR/}"
            ((warnings++))
        fi
        
        # Check for broken internal references
        while IFS= read -r line; do
            if [[ $line =~ \[.*\]\(([^)]+)\) ]]; then
                link="${BASH_REMATCH[1]}"
                if [[ $link =~ ^[^#]*\.md(#.*)?$ ]] && [[ ! $link =~ ^https?:// ]]; then
                    # Remove fragment identifier
                    clean_link="${link%%#*}"
                    if [ ! -f "$DOCS_DIR/$clean_link" ]; then
                        log_error "Broken internal link in ${file#$DOCS_DIR/}: $link"
                        ((errors++))
                    fi
                fi
            fi
        done < "$file"
        
        # Check for required frontmatter in key files
        if [[ "$file" == *"/index.md" ]] || [[ "$file" == "docs/index.md" ]]; then
            if ! head -1 "$file" | grep -q "^---"; then
                log_warning "Index file missing frontmatter: ${file#$DOCS_DIR/}"
                ((warnings++))
            fi
        fi
    done
    
    log_info "Content validation complete: $errors errors, $warnings warnings"
    
    if [ $errors -eq 0 ]; then
        log_success "Content validation passed"
        return 0
    else
        log_error "Content validation failed with $errors errors"
        return 1
    fi
}

# Validate markdown formatting
validate_format() {
    log_info "Validating markdown formatting..."
    
    local warnings=0
    local errors=0
    
    find "$DOCS_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
        log_info "Checking format in: ${file#$DOCS_DIR/}"
        
        local line_num=0
        while IFS= read -r line; do
            ((line_num++))
            
            # Check line length
            if [ ${#line} -gt $MAX_LINE_LENGTH ]; then
                log_warning "Line too long (${#line} chars) in ${file#$DOCS_DIR/}:$line_num"
                ((warnings++))
            fi
            
            # Check for trailing whitespace
            if [[ $line =~ [[:space:]]+$ ]]; then
                log_warning "Trailing whitespace in ${file#$DOCS_DIR/}:$line_num"
                ((warnings++))
            fi
            
            # Check for missing space after hash in headers
            if [[ $line =~ ^#+[^[:space:]] ]]; then
                log_warning "Missing space after # in header in ${file#$DOCS_DIR/}:$line_num"
                ((warnings++))
            fi
            
            # Check for inconsistent list formatting
            if [[ $line =~ ^[[:space:]]*[-*+][^[:space:]] ]]; then
                log_warning "Missing space after list marker in ${file#$DOCS_DIR/}:$line_num"
                ((warnings++))
            fi
            
        done < "$file"
        
        # Check for consistent header hierarchy
        python3 -c "
import re
import sys

with open('$file', 'r') as f:
    content = f.read()

# Extract headers
headers = re.findall(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE)
if not headers:
    sys.exit(0)

prev_level = 0
for i, (hashes, title) in enumerate(headers):
    level = len(hashes)
    if level > prev_level + 1:
        print(f'WARNING: Header level skip in ${file#$DOCS_DIR/}: \"{title}\" (level {level} after level {prev_level})')
        sys.exit(1)
    prev_level = level
" || ((warnings++))
        
    done
    
    log_info "Format validation complete: $errors errors, $warnings warnings"
    
    if [ $errors -eq 0 ]; then
        log_success "Format validation passed"
        return 0
    else
        log_error "Format validation failed with $errors errors"
        return 1
    fi
}

# Test MkDocs build
test_build() {
    log_info "Testing MkDocs build..."
    
    if mkdocs build --strict --quiet; then
        log_success "MkDocs build successful"
        return 0
    else
        log_error "MkDocs build failed"
        return 1
    fi
}

# Generate validation report
generate_report() {
    log_info "Generating validation report..."
    
    local report_file="docs-validation-report.txt"
    
    cat > "$report_file" << EOF
# Documentation Validation Report
Generated: $(date)
Repository: $(git remote get-url origin 2>/dev/null || echo "Unknown")
Branch: $(git branch --show-current 2>/dev/null || echo "Unknown")
Commit: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")

## Summary
- Documentation directory: $DOCS_DIR
- Configuration file: $MKDOCS_CONFIG
- Total markdown files: $(find "$DOCS_DIR" -name "*.md" | wc -l)
- Total word count: $(find "$DOCS_DIR" -name "*.md" -exec cat {} \; | wc -w)

## Validation Results
EOF
    
    echo "Structure: $(validate_structure >/dev/null 2>&1 && echo "PASS" || echo "FAIL")" >> "$report_file"
    echo "Content: $(validate_content >/dev/null 2>&1 && echo "PASS" || echo "FAIL")" >> "$report_file"
    echo "Format: $(validate_format >/dev/null 2>&1 && echo "PASS" || echo "FAIL")" >> "$report_file"
    echo "Build: $(test_build >/dev/null 2>&1 && echo "PASS" || echo "FAIL")" >> "$report_file"
    
    log_success "Report generated: $report_file"
}

# Main execution
main() {
    local validation_type="${1:-all}"
    local exit_code=0
    
    log_info "Starting documentation validation (type: $validation_type)"
    
    check_dependencies
    
    case $validation_type in
        "structure")
            validate_structure || exit_code=1
            ;;
        "content")
            validate_content || exit_code=1
            ;;
        "format")
            validate_format || exit_code=1
            ;;
        "all")
            validate_structure || exit_code=1
            validate_content || exit_code=1
            validate_format || exit_code=1
            test_build || exit_code=1
            generate_report
            ;;
        *)
            log_error "Invalid validation type: $validation_type"
            usage
            ;;
    esac
    
    if [ $exit_code -eq 0 ]; then
        log_success "Documentation validation completed successfully"
    else
        log_error "Documentation validation failed"
    fi
    
    exit $exit_code
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi