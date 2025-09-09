#!/bin/bash

# MediaNest Documentation Quality Validation Script
# Comprehensive validation for documentation quality, links, formatting, and standards compliance

set -euo pipefail

# Configuration
DOCS_DIR="docs"
SCRIPTS_DIR="scripts"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${ROOT_DIR}/docs-quality-check.log"
TEMP_DIR="/tmp/medianest-docs-check"
EXIT_CODE=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
    EXIT_CODE=1
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    EXIT_CODE=2
}

# Initialize
initialize() {
    log_info "Starting MediaNest Documentation Quality Check"
    log_info "Root directory: $ROOT_DIR"
    log_info "Docs directory: $DOCS_DIR"
    
    # Clean up previous runs
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    # Clear log file
    > "$LOG_FILE"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_tools=()
    
    # Required tools
    command -v mkdocs >/dev/null 2>&1 || missing_tools+=("mkdocs")
    command -v node >/dev/null 2>&1 || missing_tools+=("node")
    command -v python3 >/dev/null 2>&1 || missing_tools+=("python3")
    command -v markdown-link-check >/dev/null 2>&1 || missing_tools+=("markdown-link-check")
    command -v markdownlint >/dev/null 2>&1 || missing_tools+=("markdownlint")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install missing tools:"
        log_info "  npm install -g markdown-link-check markdownlint-cli"
        log_info "  pip install mkdocs mkdocs-material"
        return 1
    fi
    
    log_success "All dependencies are installed"
}

# Validate MkDocs configuration
validate_mkdocs_config() {
    log_info "Validating MkDocs configuration..."
    
    local config_files=("mkdocs.yml" "mkdocs-production.yml" "mkdocs-test.yml")
    
    for config in "${config_files[@]}"; do
        if [[ -f "$ROOT_DIR/$config" ]]; then
            log_info "Checking $config..."
            
            # Test MkDocs configuration
            if mkdocs build --config-file "$ROOT_DIR/$config" --site-dir "$TEMP_DIR/test-build-$config" --quiet; then
                log_success "$config is valid"
            else
                log_error "$config has configuration errors"
            fi
            
            # Check for required sections
            if grep -q "site_name:" "$ROOT_DIR/$config"; then
                log_success "$config has site_name configured"
            else
                log_warning "$config missing site_name"
            fi
            
            if grep -q "nav:" "$ROOT_DIR/$config"; then
                log_success "$config has navigation configured"
            else
                log_warning "$config missing navigation"
            fi
        else
            log_warning "$config not found"
        fi
    done
}

# Validate Markdown syntax and formatting
validate_markdown_syntax() {
    log_info "Validating Markdown syntax and formatting..."
    
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    if [[ -z "$markdown_files" ]]; then
        log_warning "No Markdown files found in $DOCS_DIR"
        return
    fi
    
    local syntax_errors=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        # Check with markdownlint
        if markdownlint "$file" > "$TEMP_DIR/lint-$(basename "$file").log" 2>&1; then
            log_success "Markdown syntax OK: $relative_file"
        else
            log_error "Markdown syntax errors in $relative_file:"
            cat "$TEMP_DIR/lint-$(basename "$file").log" | head -10 | tee -a "$LOG_FILE"
            ((syntax_errors++))
        fi
        
        # Check for common issues
        if grep -n "TODO\|FIXME\|XXX" "$file" > /dev/null; then
            log_warning "TODO/FIXME markers found in $relative_file:"
            grep -n "TODO\|FIXME\|XXX" "$file" | head -5 | tee -a "$LOG_FILE"
        fi
        
    done <<< "$markdown_files"
    
    if [[ $syntax_errors -gt 0 ]]; then
        log_error "Found $syntax_errors files with Markdown syntax errors"
    else
        log_success "All Markdown files have valid syntax"
    fi
}

# Validate Mermaid diagrams
validate_mermaid_diagrams() {
    log_info "Validating Mermaid diagrams..."
    
    local mermaid_files
    mermaid_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f -exec grep -l "```mermaid" {} \;)
    
    if [[ -z "$mermaid_files" ]]; then
        log_info "No Mermaid diagrams found"
        return
    fi
    
    local diagram_errors=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        local diagram_count
        diagram_count=$(grep -c "```mermaid" "$file" || true)
        
        log_info "Checking $diagram_count Mermaid diagrams in $relative_file"
        
        # Extract Mermaid diagrams and validate syntax
        awk '/```mermaid/,/```/' "$file" | grep -v "^```" > "$TEMP_DIR/mermaid-$(basename "$file").mmd" 2>/dev/null || true
        
        if [[ -s "$TEMP_DIR/mermaid-$(basename "$file").mmd" ]]; then
            # Basic syntax validation (check for common issues)
            if grep -E "(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|gitgraph|erDiagram|journey)" "$TEMP_DIR/mermaid-$(basename "$file").mmd" > /dev/null; then
                log_success "Mermaid diagrams in $relative_file have valid syntax"
            else
                log_warning "Potential Mermaid syntax issues in $relative_file"
                ((diagram_errors++))
            fi
        fi
        
    done <<< "$mermaid_files"
    
    if [[ $diagram_errors -gt 0 ]]; then
        log_warning "Found potential issues in $diagram_errors files with Mermaid diagrams"
    else
        log_success "All Mermaid diagrams appear to have valid syntax"
    fi
}

# Check for broken internal links
validate_internal_links() {
    log_info "Validating internal links..."
    
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    local link_errors=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        # Extract internal links (relative links)
        local internal_links
        internal_links=$(grep -oE '\[([^\]]*)\]\(([^)]*)\)' "$file" | grep -E '\]\([^http][^)]*\)' || true)
        
        if [[ -n "$internal_links" ]]; then
            while IFS= read -r link; do
                local link_path
                link_path=$(echo "$link" | sed -E 's/.*\]\(([^)]*)\).*/\1/')
                
                # Remove anchors for file existence check
                local file_path="${link_path%#*}"
                
                # Resolve relative path
                local full_path
                if [[ "$file_path" == /* ]]; then
                    full_path="$ROOT_DIR$file_path"
                else
                    full_path="$(dirname "$file")/$file_path"
                fi
                
                # Check if target exists
                if [[ -f "$full_path" || -d "$full_path" ]]; then
                    log_success "Internal link OK: $link_path in $relative_file"
                else
                    log_error "Broken internal link: $link_path in $relative_file"
                    ((link_errors++))
                fi
                
            done <<< "$internal_links"
        fi
        
    done <<< "$markdown_files"
    
    if [[ $link_errors -gt 0 ]]; then
        log_error "Found $link_errors broken internal links"
    else
        log_success "All internal links are valid"
    fi
}

# Check external links (if markdown-link-check is available)
validate_external_links() {
    log_info "Validating external links..."
    
    if ! command -v markdown-link-check >/dev/null 2>&1; then
        log_warning "markdown-link-check not installed, skipping external link validation"
        return
    fi
    
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f | head -10) # Limit to avoid rate limiting
    
    local link_errors=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        log_info "Checking external links in $relative_file..."
        
        if markdown-link-check "$file" --config "$ROOT_DIR/.markdown-link-check.json" > "$TEMP_DIR/link-check-$(basename "$file").log" 2>&1; then
            log_success "External links OK in $relative_file"
        else
            log_error "Broken external links found in $relative_file:"
            grep "✖" "$TEMP_DIR/link-check-$(basename "$file").log" | head -5 | tee -a "$LOG_FILE" || true
            ((link_errors++))
        fi
        
    done <<< "$markdown_files"
    
    if [[ $link_errors -gt 0 ]]; then
        log_warning "Found broken external links in $link_errors files"
    else
        log_success "External links validation completed"
    fi
}

# Validate image references
validate_images() {
    log_info "Validating image references..."
    
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    local image_errors=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        # Extract image references
        local image_refs
        image_refs=$(grep -oE '!\[([^\]]*)\]\(([^)]*)\)' "$file" || true)
        
        if [[ -n "$image_refs" ]]; then
            while IFS= read -r img; do
                local img_path
                img_path=$(echo "$img" | sed -E 's/.*\]\(([^)]*)\).*/\1/')
                
                # Skip external images
                if [[ "$img_path" =~ ^https?:// ]]; then
                    continue
                fi
                
                # Resolve relative path
                local full_img_path
                if [[ "$img_path" == /* ]]; then
                    full_img_path="$ROOT_DIR$img_path"
                else
                    full_img_path="$(dirname "$file")/$img_path"
                fi
                
                # Check if image exists
                if [[ -f "$full_img_path" ]]; then
                    log_success "Image OK: $img_path in $relative_file"
                else
                    log_error "Missing image: $img_path in $relative_file"
                    ((image_errors++))
                fi
                
            done <<< "$image_refs"
        fi
        
    done <<< "$markdown_files"
    
    if [[ $image_errors -gt 0 ]]; then
        log_error "Found $image_errors missing images"
    else
        log_success "All image references are valid"
    fi
}

# Check documentation structure and navigation
validate_navigation_structure() {
    log_info "Validating navigation structure..."
    
    # Check if all pages in nav are accessible
    if [[ -f "$ROOT_DIR/mkdocs.yml" ]]; then
        local nav_files
        nav_files=$(python3 -c "
import yaml
import sys
try:
    with open('$ROOT_DIR/mkdocs.yml', 'r') as f:
        config = yaml.safe_load(f)
    nav = config.get('nav', [])
    
    def extract_files(item, prefix=''):
        if isinstance(item, str):
            print(f'$ROOT_DIR/$DOCS_DIR/{item}')
        elif isinstance(item, dict):
            for key, value in item.items():
                if isinstance(value, str):
                    print(f'$ROOT_DIR/$DOCS_DIR/{value}')
                elif isinstance(value, list):
                    for subitem in value:
                        extract_files(subitem, prefix + key + '/')
                else:
                    extract_files(value, prefix + key + '/')
        elif isinstance(item, list):
            for subitem in item:
                extract_files(subitem, prefix)
    
    for item in nav:
        extract_files(item)
except Exception as e:
    print(f'Error parsing navigation: {e}', file=sys.stderr)
        ")
        
        local missing_nav_files=0
        
        if [[ -n "$nav_files" ]]; then
            while IFS= read -r nav_file; do
                if [[ -f "$nav_file" ]]; then
                    log_success "Navigation file exists: ${nav_file#$ROOT_DIR/$DOCS_DIR/}"
                else
                    log_error "Navigation file missing: ${nav_file#$ROOT_DIR/$DOCS_DIR/}"
                    ((missing_nav_files++))
                fi
            done <<< "$nav_files"
        fi
        
        if [[ $missing_nav_files -gt 0 ]]; then
            log_error "Found $missing_nav_files missing navigation files"
        else
            log_success "All navigation files exist"
        fi
    fi
    
    # Check for orphaned files (files not in navigation)
    local all_md_files
    all_md_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    local orphaned_count=0
    
    while IFS= read -r md_file; do
        local relative_md="${md_file#$ROOT_DIR/$DOCS_DIR/}"
        
        if ! grep -q "$relative_md" "$ROOT_DIR/mkdocs.yml" 2>/dev/null; then
            log_warning "Orphaned file (not in navigation): $relative_md"
            ((orphaned_count++))
        fi
    done <<< "$all_md_files"
    
    if [[ $orphaned_count -gt 0 ]]; then
        log_warning "Found $orphaned_count orphaned files not included in navigation"
    else
        log_success "All Markdown files are included in navigation"
    fi
}

# Validate code blocks and syntax highlighting
validate_code_blocks() {
    log_info "Validating code blocks and syntax highlighting..."
    
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    local code_block_issues=0
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        # Check for unclosed code blocks
        local triple_backticks
        triple_backticks=$(grep -c '^```' "$file" || true)
        
        if [[ $((triple_backticks % 2)) -ne 0 ]]; then
            log_error "Unclosed code block in $relative_file - odd number of triple backticks: $triple_backticks"
            code_block_issues=$((code_block_issues + 1))
        fi
        
        # Check for common language identifiers
        local code_blocks
        code_blocks=$(grep "^```" "$file" | grep -v "^```$" || true)
        
        if [[ -n "$code_blocks" ]]; then
            while IFS= read -r block; do
                local lang="${block#\`\`\`}"
                
                # Validate common language identifiers
                case "$lang" in
                    bash|shell|sh|javascript|js|typescript|ts|python|py|json|yaml|yml|dockerfile|sql|mermaid|html|css|markdown|md)
                        log_success "Valid syntax highlighting: $lang in $relative_file"
                        ;;
                    *)
                        log_warning "Unknown syntax highlighting language: '$lang' in $relative_file"
                        ;;
                esac
            done <<< "$code_blocks"
        fi
        
    done <<< "$markdown_files"
    
    if [[ $code_block_issues -gt 0 ]]; then
        log_error "Found $code_block_issues code block issues"
    else
        log_success "All code blocks are properly formatted"
    fi
}

# Check for documentation standards compliance
validate_documentation_standards() {
    log_info "Validating documentation standards compliance..."
    
    local standards_violations=0
    local markdown_files
    markdown_files=$(find "$ROOT_DIR/$DOCS_DIR" -name "*.md" -type f)
    
    while IFS= read -r file; do
        local relative_file="${file#$ROOT_DIR/}"
        
        # Check for proper headings structure
        if ! head -1 "$file" | grep -q "^# "; then
            log_warning "File should start with H1 heading: $relative_file"
            ((standards_violations++))
        fi
        
        # Check for consistent heading levels (no skipping levels)
        local prev_level=0
        while IFS= read -r line; do
            if [[ "$line" =~ ^#+[[:space:]] ]]; then
                local level=${#${line%%[^#]*}}
                if [[ $level -gt $((prev_level + 1)) && $prev_level -gt 0 ]]; then
                    log_warning "Heading level skip detected in $relative_file: H$prev_level to H$level"
                    ((standards_violations++))
                fi
                prev_level=$level
            fi
        done < "$file"
        
        # Check for proper table formatting
        if grep -q "|" "$file"; then
            local table_issues
            table_issues=$(awk '
                /\|/ {
                    if (prev_table && !prev_line_table && NR > 1) {
                        print "Line " (NR-1) ": Table should have header separator"
                    }
                    if ($0 ~ /\|.*\|/ && $0 !~ /\|.*[-:]+.*\|/) {
                        table_line = 1
                    } else if ($0 ~ /\|.*[-:]+.*\|/) {
                        table_sep = 1
                    }
                    prev_table = 1
                    prev_line_table = 1
                } 
                !/\|/ { 
                    prev_line_table = 0 
                }
            ' "$file")
            
            if [[ -n "$table_issues" ]]; then
                log_warning "Table formatting issues in $relative_file:"
                echo "$table_issues" | tee -a "$LOG_FILE"
                ((standards_violations++))
            fi
        fi
        
    done <<< "$markdown_files"
    
    if [[ $standards_violations -gt 0 ]]; then
        log_warning "Found $standards_violations documentation standards violations"
    else
        log_success "All files comply with documentation standards"
    fi
}

# Generate quality report
generate_quality_report() {
    log_info "Generating documentation quality report..."
    
    local report_file="$ROOT_DIR/docs-quality-report.md"
    
    cat > "$report_file" << EOF
# Documentation Quality Report

Generated on: $(date)
Checked directory: $DOCS_DIR

## Summary

- **Overall Status**: $([ $EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- **Exit Code**: $EXIT_CODE
- **Log File**: $LOG_FILE

## Validation Results

### MkDocs Configuration
- Configuration files validated
- Build test completed

### Markdown Quality
- Syntax validation completed
- Formatting standards checked

### Link Validation
- Internal links checked
- External links validated (if enabled)

### Image References
- All image references validated

### Code Blocks
- Syntax highlighting validated
- Code block formatting checked

### Navigation Structure
- Navigation completeness verified
- Orphaned files identified

### Standards Compliance
- Documentation standards validated
- Heading structure verified

## Recommendations

$([ $EXIT_CODE -eq 0 ] && echo "✅ All quality checks passed!" || echo "⚠️ Review errors in log file: $LOG_FILE")

## Next Steps

1. Address any errors found in the validation
2. Run this script regularly as part of CI/CD pipeline
3. Consider adding pre-commit hooks for continuous validation

---
*This report was generated by the MediaNest Documentation Quality Check script*
EOF

    log_success "Quality report generated: $report_file"
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    log_info "Documentation quality check completed with exit code: $EXIT_CODE"
}

# Main execution
main() {
    initialize
    
    # Change to root directory
    cd "$ROOT_DIR"
    
    # Run all validations
    check_dependencies || exit 1
    validate_mkdocs_config
    validate_markdown_syntax
    validate_mermaid_diagrams
    validate_internal_links
    validate_external_links
    validate_images
    validate_navigation_structure
    validate_code_blocks
    validate_documentation_standards
    
    # Generate report
    generate_quality_report
    
    # Cleanup
    cleanup
    
    exit $EXIT_CODE
}

# Run main function
main "$@"