#!/bin/bash

# Link Checking Script for MediaNest Documentation
# Validates internal and external links in markdown files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="docs"
SITE_DIR="site"
TIMEOUT=30
MAX_RETRIES=3
CONCURRENT_CHECKS=10
EXTERNAL_CHECK_DELAY=1

# Output files
INTERNAL_LOG="link-check-internal.log"
EXTERNAL_LOG="link-check-external.log"
BROKEN_LINKS_JSON="broken-links-$(date +%Y%m%d-%H%M%S).json"

# Usage information
usage() {
    echo "Usage: $0 [internal|external|all]"
    echo "  internal: Check internal links only"
    echo "  external: Check external links only"
    echo "  all:      Check both internal and external links (default)"
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
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    command -v jq >/dev/null 2>&1 || log_warning "jq not found (optional for JSON output)"
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "Dependencies check completed"
}

# Extract links from markdown files
extract_links() {
    log_info "Extracting links from markdown files..."
    
    # Create temporary files for different link types
    local internal_links_temp="/tmp/internal_links.txt"
    local external_links_temp="/tmp/external_links.txt"
    local anchor_links_temp="/tmp/anchor_links.txt"
    
    : > "$internal_links_temp"
    : > "$external_links_temp"
    : > "$anchor_links_temp"
    
    # Process each markdown file
    find "$DOCS_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
        python3 << EOF
import re
import os

file_path = "$file"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all markdown links
link_pattern = r'\[([^\]]*)\]\(([^)]+)\)'
links = re.findall(link_pattern, content)

for link_text, link_url in links:
    # Remove fragments for processing
    clean_url = link_url.split('#')[0] if '#' in link_url else link_url
    
    if link_url.startswith('http://') or link_url.startswith('https://'):
        # External link
        with open("$external_links_temp", "a") as f:
            f.write(f"{file_path}:{link_url}\n")
    elif link_url.startswith('#'):
        # Anchor link within same page
        with open("$anchor_links_temp", "a") as f:
            f.write(f"{file_path}:{link_url}\n")
    elif link_url.startswith('/') or not link_url.startswith('.'):
        # Internal link (absolute or relative)
        with open("$internal_links_temp", "a") as f:
            f.write(f"{file_path}:{link_url}\n")
    else:
        # Relative link
        with open("$internal_links_temp", "a") as f:
            f.write(f"{file_path}:{link_url}\n")

# Also extract reference-style links
ref_pattern = r'\[([^\]]+)\]:\s*(.+)'
ref_links = re.findall(ref_pattern, content)

for ref_name, ref_url in ref_links:
    if ref_url.startswith('http://') or ref_url.startswith('https://'):
        with open("$external_links_temp", "a") as f:
            f.write(f"{file_path}:{ref_url}\n")
EOF
    done
    
    log_success "Link extraction completed"
    echo "$internal_links_temp:$external_links_temp:$anchor_links_temp"
}

# Check internal links
check_internal_links() {
    log_info "Checking internal links..."
    
    local link_files
    IFS=':' read -r internal_links_temp external_links_temp anchor_links_temp <<< "$(extract_links)"
    
    local broken_count=0
    local total_count=0
    
    # Initialize log file
    echo "Internal Link Check Report - $(date)" > "$INTERNAL_LOG"
    echo "=======================================" >> "$INTERNAL_LOG"
    echo "" >> "$INTERNAL_LOG"
    
    # Check internal file links
    if [ -s "$internal_links_temp" ]; then
        while IFS=':' read -r source_file link_url; do
            ((total_count++))
            
            # Skip external links that might have slipped through
            if [[ $link_url =~ ^https?:// ]]; then
                continue
            fi
            
            # Convert relative paths to absolute paths
            local target_file
            local source_dir=$(dirname "$source_file")
            
            if [[ $link_url = /* ]]; then
                # Absolute path from docs root
                target_file="$DOCS_DIR${link_url}"
            else
                # Relative path
                target_file=$(realpath "$source_dir/$link_url" 2>/dev/null || echo "$source_dir/$link_url")
            fi
            
            # Remove fragments
            local clean_target=$(echo "$target_file" | sed 's/#.*//')
            
            # Check if file exists
            if [ -f "$clean_target" ]; then
                echo "✅ $source_file -> $link_url" >> "$INTERNAL_LOG"
                log_info "✅ Valid: $link_url (from ${source_file#$DOCS_DIR/})"
            else
                ((broken_count++))
                echo "❌ $source_file -> $link_url (NOT FOUND)" >> "$INTERNAL_LOG"
                log_error "❌ Broken: $link_url (from ${source_file#$DOCS_DIR/})"
            fi
            
        done < "$internal_links_temp"
    fi
    
    # Check anchor links if site is built
    if [ -d "$SITE_DIR" ] && [ -s "$anchor_links_temp" ]; then
        log_info "Checking anchor links in built site..."
        
        while IFS=':' read -r source_file anchor_url; do
            ((total_count++))
            
            # Convert source file to HTML path
            local html_file="${source_file/$DOCS_DIR/$SITE_DIR}"
            html_file="${html_file%.md}.html"
            
            if [ -f "$html_file" ]; then
                # Extract anchor from URL
                local anchor="${anchor_url#'#'}"
                
                # Check if anchor exists in HTML file
                if grep -q "id=[\"']$anchor[\"']" "$html_file" || grep -q "name=[\"']$anchor[\"']" "$html_file"; then
                    echo "✅ $source_file -> $anchor_url" >> "$INTERNAL_LOG"
                    log_info "✅ Valid anchor: $anchor_url (from ${source_file#$DOCS_DIR/})"
                else
                    ((broken_count++))
                    echo "❌ $source_file -> $anchor_url (ANCHOR NOT FOUND)" >> "$INTERNAL_LOG"
                    log_error "❌ Broken anchor: $anchor_url (from ${source_file#$DOCS_DIR/})"
                fi
            fi
            
        done < "$anchor_links_temp"
    fi
    
    echo "" >> "$INTERNAL_LOG"
    echo "Summary: $broken_count broken links out of $total_count total internal links" >> "$INTERNAL_LOG"
    
    if [ $broken_count -eq 0 ]; then
        log_success "Internal link check passed: $total_count links verified"
        return 0
    else
        log_error "Internal link check failed: $broken_count broken links found"
        return 1
    fi
}

# Check external links
check_external_links() {
    log_info "Checking external links..."
    
    local link_files
    IFS=':' read -r internal_links_temp external_links_temp anchor_links_temp <<< "$(extract_links)"
    
    local broken_count=0
    local total_count=0
    local timeout_count=0
    
    # Initialize log file
    echo "External Link Check Report - $(date)" > "$EXTERNAL_LOG"
    echo "========================================" >> "$EXTERNAL_LOG"
    echo "" >> "$EXTERNAL_LOG"
    
    # Initialize JSON report
    echo '{"timestamp": "'$(date -Iseconds)'", "broken_links": []}' > "$BROKEN_LINKS_JSON"
    
    if [ -s "$external_links_temp" ]; then
        # Sort and deduplicate external links
        local unique_external_links="/tmp/unique_external_links.txt"
        sort -u "$external_links_temp" > "$unique_external_links"
        
        while IFS=':' read -r source_file link_url; do
            ((total_count++))
            
            # Rate limiting
            sleep "$EXTERNAL_CHECK_DELAY"
            
            log_info "Checking external link: $link_url"
            
            # Check HTTP status with retries
            local status_code=""
            local retry_count=0
            
            while [ $retry_count -lt $MAX_RETRIES ]; do
                status_code=$(curl -s -o /dev/null -w "%{http_code}" \
                    --max-time "$TIMEOUT" \
                    --user-agent "MediaNest-Docs-LinkChecker/1.0" \
                    --location \
                    --fail-early \
                    "$link_url" 2>/dev/null || echo "000")
                
                if [[ $status_code =~ ^[2-3][0-9][0-9]$ ]]; then
                    break
                fi
                
                ((retry_count++))
                if [ $retry_count -lt $MAX_RETRIES ]; then
                    log_warning "Retry $retry_count/$MAX_RETRIES for $link_url"
                    sleep $((retry_count * 2))
                fi
            done
            
            # Evaluate status
            if [[ $status_code =~ ^[2-3][0-9][0-9]$ ]]; then
                echo "✅ $source_file -> $link_url ($status_code)" >> "$EXTERNAL_LOG"
                log_success "✅ Valid: $link_url ($status_code)"
            elif [[ $status_code == "000" ]]; then
                ((timeout_count++))
                echo "⏰ $source_file -> $link_url (TIMEOUT)" >> "$EXTERNAL_LOG"
                log_warning "⏰ Timeout: $link_url"
                
                # Add to JSON report
                jq --arg file "$source_file" --arg url "$link_url" --arg status "timeout" \
                   '.broken_links += [{"file": $file, "url": $url, "status": $status}]' \
                   "$BROKEN_LINKS_JSON" > "${BROKEN_LINKS_JSON}.tmp" && mv "${BROKEN_LINKS_JSON}.tmp" "$BROKEN_LINKS_JSON"
            else
                ((broken_count++))
                echo "❌ $source_file -> $link_url ($status_code)" >> "$EXTERNAL_LOG"
                log_error "❌ Broken: $link_url ($status_code)"
                
                # Add to JSON report
                jq --arg file "$source_file" --arg url "$link_url" --arg status "$status_code" \
                   '.broken_links += [{"file": $file, "url": $url, "status": $status}]' \
                   "$BROKEN_LINKS_JSON" > "${BROKEN_LINKS_JSON}.tmp" && mv "${BROKEN_LINKS_JSON}.tmp" "$BROKEN_LINKS_JSON"
            fi
            
        done < "$unique_external_links"
    fi
    
    echo "" >> "$EXTERNAL_LOG"
    echo "Summary: $broken_count broken links, $timeout_count timeouts out of $total_count total external links" >> "$EXTERNAL_LOG"
    
    # Finalize JSON report
    jq --arg total "$total_count" --arg broken "$broken_count" --arg timeouts "$timeout_count" \
       '. + {"summary": {"total": ($total|tonumber), "broken": ($broken|tonumber), "timeouts": ($timeouts|tonumber)}}' \
       "$BROKEN_LINKS_JSON" > "${BROKEN_LINKS_JSON}.tmp" && mv "${BROKEN_LINKS_JSON}.tmp" "$BROKEN_LINKS_JSON"
    
    if [ $broken_count -eq 0 ]; then
        log_success "External link check completed: $total_count links checked, $timeout_count timeouts"
        return 0
    else
        log_warning "External link check completed with issues: $broken_count broken links, $timeout_count timeouts"
        return 0  # Don't fail CI for external link issues
    fi
}

# Generate comprehensive report
generate_report() {
    log_info "Generating comprehensive link report..."
    
    local report_file="link-check-comprehensive-report.md"
    
    cat > "$report_file" << EOF
# Link Check Comprehensive Report

**Generated:** $(date)  
**Repository:** $(git remote get-url origin 2>/dev/null || echo "Unknown")  
**Branch:** $(git branch --show-current 2>/dev/null || echo "Unknown")  
**Commit:** $(git rev-parse --short HEAD 2>/dev/null || echo "Unknown")

## Summary

EOF
    
    if [ -f "$INTERNAL_LOG" ]; then
        echo "### Internal Links" >> "$report_file"
        tail -1 "$INTERNAL_LOG" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if [ -f "$EXTERNAL_LOG" ]; then
        echo "### External Links" >> "$report_file"
        tail -1 "$EXTERNAL_LOG" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    echo "## Recommendations" >> "$report_file"
    echo "" >> "$report_file"
    echo "- Fix broken internal links immediately" >> "$report_file"
    echo "- Review external links that returned errors" >> "$report_file"
    echo "- Consider adding redirects for moved content" >> "$report_file"
    echo "- Update or remove links to deprecated resources" >> "$report_file"
    echo "" >> "$report_file"
    
    if [ -f "$BROKEN_LINKS_JSON" ]; then
        echo "## Broken Links Details" >> "$report_file"
        echo "" >> "$report_file"
        echo '```json' >> "$report_file"
        cat "$BROKEN_LINKS_JSON" >> "$report_file"
        echo '```' >> "$report_file"
    fi
    
    log_success "Comprehensive report generated: $report_file"
}

# Clean up temporary files
cleanup() {
    rm -f /tmp/internal_links.txt /tmp/external_links.txt /tmp/anchor_links.txt /tmp/unique_external_links.txt
}

# Main execution
main() {
    local check_type="${1:-all}"
    local exit_code=0
    
    # Trap for cleanup
    trap cleanup EXIT
    
    log_info "Starting link check (type: $check_type)"
    
    check_dependencies
    
    case $check_type in
        "internal")
            check_internal_links || exit_code=1
            ;;
        "external")
            check_external_links || exit_code=1
            ;;
        "all")
            check_internal_links || exit_code=1
            check_external_links  # Don't fail on external link issues
            generate_report
            ;;
        *)
            log_error "Invalid check type: $check_type"
            usage
            ;;
    esac
    
    if [ $exit_code -eq 0 ]; then
        log_success "Link checking completed successfully"
    else
        log_error "Link checking failed"
    fi
    
    exit $exit_code
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi