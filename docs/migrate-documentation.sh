#!/bin/bash

# MediaNest Documentation Migration Script
# This script migrates the current sprawling documentation structure to an optimized hierarchy
# Total consolidation: 5,461 → ~150-200 well-organized documents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="${PROJECT_ROOT}/docs"
NEW_DOCS_DIR="${DOCS_DIR}/new-structure"
BACKUP_DIR="${DOCS_DIR}/migration-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}=== MediaNest Documentation Migration ===${NC}"
echo -e "${YELLOW}Project Root: ${PROJECT_ROOT}${NC}"
echo -e "${YELLOW}Current Docs: ${DOCS_DIR}${NC}"
echo -e "${YELLOW}New Structure: ${NEW_DOCS_DIR}${NC}"
echo -e "${YELLOW}Backup Location: ${BACKUP_DIR}${NC}"

# Function to log with timestamp
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to create directory structure
create_structure() {
    log "Creating new documentation structure..."
    
    # Create main directories
    mkdir -p "${NEW_DOCS_DIR}"/{01-getting-started,02-architecture,03-api,04-frontend,05-backend,06-testing,07-deployment,08-security,09-operations,10-integrations,11-development,12-migration,13-reference,14-tutorials,archive,templates}
    
    # Create archive subdirectories
    mkdir -p "${NEW_DOCS_DIR}/archive"/{deprecated-features,legacy-migrations,historical-decisions,phase-documentation,reports,temporary-migrations}
    mkdir -p "${NEW_DOCS_DIR}/archive/phase-documentation"/{phase0,phase1,phase3,phase5}
    mkdir -p "${NEW_DOCS_DIR}/archive/reports"/{technical-debt,quality-reports,performance-reports,migration-reports}
    
    log "Directory structure created successfully"
}

# Function to create template files with proper structure
create_templates() {
    log "Creating template README files..."
    
    # Main README template
    cat > "${NEW_DOCS_DIR}/README.md" << 'EOF'
# MediaNest Documentation

## Quick Navigation
- 🚀 [Quick Start Guide](QUICK_START.md)
- 🏗️ [Architecture Overview](02-architecture/README.md)
- 🔌 [API Documentation](03-api/README.md)
- 🧪 [Testing Guide](06-testing/README.md)
- 🚀 [Deployment Guide](07-deployment/README.md)

## Documentation Sections
1. [Getting Started](01-getting-started/) - Setup & installation
2. [Architecture](02-architecture/) - System design & decisions  
3. [API Documentation](03-api/) - REST API reference
4. [Frontend Development](04-frontend/) - React/Next.js guides
5. [Backend Development](05-backend/) - Express.js/Node.js guides
6. [Testing](06-testing/) - Testing strategies & tools
7. [Deployment](07-deployment/) - Deployment & operations
8. [Security](08-security/) - Security implementation
9. [Operations](09-operations/) - Monitoring & maintenance
10. [Integrations](10-integrations/) - Third-party integrations
11. [Development](11-development/) - Development workflow
12. [Migration](12-migration/) - Version migrations
13. [Reference](13-reference/) - Configuration & API reference
14. [Tutorials](14-tutorials/) - Step-by-step guides

## Archive
- [Archived Documentation](archive/) - Historical and deprecated docs

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for documentation contribution guidelines.
EOF

    # Create section README templates
    local sections=("01-getting-started" "02-architecture" "03-api" "04-frontend" "05-backend" "06-testing" "07-deployment" "08-security" "09-operations" "10-integrations" "11-development" "12-migration" "13-reference" "14-tutorials")
    
    for section in "${sections[@]}"; do
        section_name=$(echo "$section" | cut -d'-' -f2- | tr '-' ' ' | sed 's/\b\w/\u&/g')
        cat > "${NEW_DOCS_DIR}/${section}/README.md" << EOF
# ${section_name}

## Overview
This section contains documentation for ${section_name,,}.

## Documents in this Section
<!-- This will be populated during migration -->

## Related Sections
<!-- Cross-references will be added during migration -->

## Quick Reference
<!-- Key information and links will be added during migration -->
EOF
    done
    
    log "Template files created successfully"
}

# Function to backup current documentation
backup_current_docs() {
    log "Creating backup of current documentation..."
    
    mkdir -p "${BACKUP_DIR}"
    
    # Copy current docs directory
    if [ -d "${DOCS_DIR}" ]; then
        cp -r "${DOCS_DIR}" "${BACKUP_DIR}/docs-backup"
    fi
    
    # Copy root-level documentation files
    find "${PROJECT_ROOT}" -maxdepth 1 -name "*.md" -not -path "${NEW_DOCS_DIR}/*" | while read -r file; do
        cp "$file" "${BACKUP_DIR}/"
    done
    
    # Copy other important documentation directories
    for dir in tasks backend/docs frontend/docs Test_Tasks_MIGRATED_2025-01-19; do
        if [ -d "${PROJECT_ROOT}/$dir" ]; then
            cp -r "${PROJECT_ROOT}/$dir" "${BACKUP_DIR}/"
        fi
    done
    
    log "Backup created at: ${BACKUP_DIR}"
}

# Function to migrate high-priority files
migrate_high_priority() {
    log "Migrating high-priority documentation files..."
    
    # Define high-priority file mappings
    declare -A high_priority_files=(
        ["docs/API_IMPLEMENTATION_GUIDE.md"]="03-api/README.md"
        ["docs/TESTING_ARCHITECTURE.md"]="06-testing/README.md"
        ["docs/BACKEND_IMPLEMENTATION_GUIDE.md"]="05-backend/README.md"
        ["docs/FRONTEND_ARCHITECTURE_GUIDE.md"]="04-frontend/README.md"
        ["docs/SECURITY_ARCHITECTURE_STRATEGY.md"]="08-security/README.md"
        ["docs/PERFORMANCE_STRATEGY.md"]="09-operations/performance-monitoring.md"
        ["IMPLEMENTATION_ROADMAP.md"]="01-getting-started/README.md"
        ["ARCHITECTURE_REPORT.md"]="02-architecture/README.md"
        ["docs/DEPLOYMENT_GUIDE.md"]="07-deployment/README.md"
        ["docs/AUTHENTICATION_ARCHITECTURE.md"]="02-architecture/authentication-flow.md"
        ["docs/RESPONSE_ENVELOPE_STANDARD.md"]="03-api/response-formats.md"
        ["docs/MANUAL_TESTING_GUIDE.md"]="06-testing/manual-testing-guide.md"
    )
    
    for source_file in "${!high_priority_files[@]}"; do
        target_file="${high_priority_files[$source_file]}"
        source_path="${PROJECT_ROOT}/${source_file}"
        target_path="${NEW_DOCS_DIR}/${target_file}"
        
        if [ -f "$source_path" ]; then
            log "Migrating: ${source_file} → ${target_file}"
            
            # Create target directory if needed
            mkdir -p "$(dirname "$target_path")"
            
            # Copy with migration header
            {
                echo "# $(basename "${target_file%.md}" | tr '-' ' ' | sed 's/\b\w/\u&/g')"
                echo
                echo "> **Migration Note:** This document was migrated and consolidated from: \`${source_file}\`"
                echo "> Last updated: $(date '+%Y-%m-%d')"
                echo
                cat "$source_path" | tail -n +2  # Skip original title line
            } > "$target_path"
        else
            warning "Source file not found: ${source_file}"
        fi
    done
}

# Function to migrate API documentation
migrate_api_docs() {
    log "Consolidating API documentation..."
    
    # Direct file mappings
    if [ -f "${PROJECT_ROOT}/docs/openapi.yaml" ]; then
        cp "${PROJECT_ROOT}/docs/openapi.yaml" "${NEW_DOCS_DIR}/03-api/openapi-spec.yaml"
    fi
    
    if [ -f "${PROJECT_ROOT}/docs/API_REFERENCE.md" ]; then
        # Merge with existing README
        {
            echo
            echo "## API Reference"
            echo
            cat "${PROJECT_ROOT}/docs/API_REFERENCE.md" | tail -n +2
        } >> "${NEW_DOCS_DIR}/03-api/README.md"
    fi
    
    if [ -f "${PROJECT_ROOT}/docs/PAGINATION_IMPLEMENTATION.md" ]; then
        cp "${PROJECT_ROOT}/docs/PAGINATION_IMPLEMENTATION.md" "${NEW_DOCS_DIR}/03-api/rate-limiting.md"
    fi
}

# Function to migrate testing documentation
migrate_testing_docs() {
    log "Consolidating testing documentation..."
    
    # Create individual testing documents
    local test_files=(
        "unit-testing.md"
        "integration-testing.md" 
        "e2e-testing.md"
        "test-data-management.md"
        "mocking-strategies.md"
    )
    
    for test_file in "${test_files[@]}"; do
        cat > "${NEW_DOCS_DIR}/06-testing/${test_file}" << EOF
# $(echo "${test_file%.md}" | tr '-' ' ' | sed 's/\b\w/\u&/g')

> **Migration Note:** This document consolidates testing information from multiple sources.
> Last updated: $(date '+%Y-%m-%d')

## Overview
<!-- Content to be consolidated from source files -->

## Implementation
<!-- Implementation details to be migrated -->

## Best Practices
<!-- Best practices to be consolidated -->

## Related Documentation
- [Testing Architecture](README.md)
- [Manual Testing Guide](manual-testing-guide.md)
EOF
    done
    
    # Migrate specific testing files
    if [ -f "${PROJECT_ROOT}/frontend/README-TESTING.md" ]; then
        {
            echo
            echo "## Frontend Testing"
            echo
            cat "${PROJECT_ROOT}/frontend/README-TESTING.md" | tail -n +2
        } >> "${NEW_DOCS_DIR}/06-testing/unit-testing.md"
    fi
    
    if [ -f "${PROJECT_ROOT}/backend/tests/README.md" ]; then
        {
            echo
            echo "## Backend Testing"
            echo
            cat "${PROJECT_ROOT}/backend/tests/README.md" | tail -n +2
        } >> "${NEW_DOCS_DIR}/06-testing/unit-testing.md"
    fi
}

# Function to migrate deployment documentation
migrate_deployment_docs() {
    log "Consolidating deployment documentation..."
    
    # Create deployment-specific documents
    local deploy_files=(
        "local-development.md"
        "staging-deployment.md"
        "production-deployment.md"
        "docker-guide.md"
        "nginx-configuration.md"
        "ssl-certificates.md"
        "monitoring-setup.md"
        "backup-recovery.md"
    )
    
    for deploy_file in "${deploy_files[@]}"; do
        cat > "${NEW_DOCS_DIR}/07-deployment/${deploy_file}" << EOF
# $(echo "${deploy_file%.md}" | tr '-' ' ' | sed 's/\b\w/\u&/g')

> **Migration Note:** This document consolidates deployment information from multiple sources.
> Last updated: $(date '+%Y-%m-%d')

## Overview
<!-- Content to be consolidated from source files -->

## Prerequisites
<!-- Prerequisites to be listed -->

## Implementation Steps
<!-- Step-by-step instructions -->

## Troubleshooting
<!-- Common issues and solutions -->

## Related Documentation
- [Deployment Overview](README.md)
EOF
    done
    
    # Migrate specific deployment files
    if [ -f "${PROJECT_ROOT}/docs/PRODUCTION_DEPLOYMENT.md" ]; then
        cat "${PROJECT_ROOT}/docs/PRODUCTION_DEPLOYMENT.md" >> "${NEW_DOCS_DIR}/07-deployment/production-deployment.md"
    fi
    
    if [ -f "${PROJECT_ROOT}/DOCKER_DEPLOYMENT.md" ]; then
        cat "${PROJECT_ROOT}/DOCKER_DEPLOYMENT.md" >> "${NEW_DOCS_DIR}/07-deployment/docker-guide.md"
    fi
    
    if [ -f "${PROJECT_ROOT}/INSTALLATION_GUIDE.md" ]; then
        cat "${PROJECT_ROOT}/INSTALLATION_GUIDE.md" >> "${NEW_DOCS_DIR}/07-deployment/local-development.md"
    fi
}

# Function to migrate archive materials
migrate_archive() {
    log "Migrating historical and archived documentation..."
    
    # Migrate phase documentation
    for phase in phase0 phase1 phase3 phase5; do
        if [ -d "${PROJECT_ROOT}/tasks/${phase}" ]; then
            cp -r "${PROJECT_ROOT}/tasks/${phase}"/* "${NEW_DOCS_DIR}/archive/phase-documentation/${phase}/" 2>/dev/null || true
        fi
        
        if [ -d "${PROJECT_ROOT}/docs/archive/phases/${phase}" ]; then
            cp -r "${PROJECT_ROOT}/docs/archive/phases/${phase}"/* "${NEW_DOCS_DIR}/archive/phase-documentation/${phase}/" 2>/dev/null || true
        fi
    done
    
    # Migrate technical debt reports
    find "${PROJECT_ROOT}" -name "*debt*.md" -o -name "*DEBT*.md" | while read -r file; do
        if [[ "$file" != *"${NEW_DOCS_DIR}"* ]]; then
            cp "$file" "${NEW_DOCS_DIR}/archive/reports/technical-debt/"
        fi
    done
    
    # Migrate temporary migration files
    if [ -d "${PROJECT_ROOT}/Test_Tasks_MIGRATED_2025-01-19" ]; then
        cp -r "${PROJECT_ROOT}/Test_Tasks_MIGRATED_2025-01-19"/* "${NEW_DOCS_DIR}/archive/temporary-migrations/"
    fi
    
    # Create archive index
    cat > "${NEW_DOCS_DIR}/archive/README.md" << 'EOF'
# Archived Documentation

This directory contains historical, deprecated, and migrated documentation.

## Structure
- **[deprecated-features/](deprecated-features/)** - Documentation for deprecated functionality
- **[legacy-migrations/](legacy-migrations/)** - Old migration guides
- **[historical-decisions/](historical-decisions/)** - Archived Architecture Decision Records
- **[phase-documentation/](phase-documentation/)** - Phase-based development documentation
- **[reports/](reports/)** - Historical reports and audits
- **[temporary-migrations/](temporary-migrations/)** - Temporary migration files

## Usage
These documents are preserved for historical reference and should not be used for current development.
EOF
}

# Function to create cross-references
create_cross_references() {
    log "Creating cross-reference system..."
    
    # Update section README files with document lists
    find "${NEW_DOCS_DIR}" -name "README.md" -not -path "*/archive/*" | while read -r readme_file; do
        section_dir=$(dirname "$readme_file")
        section_name=$(basename "$section_dir")
        
        # Skip main README
        if [ "$section_dir" = "$NEW_DOCS_DIR" ]; then
            continue
        fi
        
        # Add document list to section README
        {
            echo
            echo "## Documents in this Section"
            find "$section_dir" -name "*.md" -not -name "README.md" | sort | while read -r doc; do
                doc_name=$(basename "$doc" .md)
                doc_title=$(echo "$doc_name" | tr '-' ' ' | sed 's/\b\w/\u&/g')
                echo "- [$doc_title]($(basename "$doc"))"
            done
        } >> "$readme_file"
    done
}

# Function to generate migration report
generate_report() {
    log "Generating migration report..."
    
    local report_file="${NEW_DOCS_DIR}/MIGRATION_REPORT.md"
    
    cat > "$report_file" << EOF
# Documentation Migration Report

**Migration Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Migration Script:** migrate-documentation.sh

## Migration Summary

### File Count Reduction
- **Before:** ~5,461 total markdown files
- **After:** ~$(find "${NEW_DOCS_DIR}" -name "*.md" | wc -l) organized documentation files
- **Reduction:** ~$(echo "5461 - $(find "${NEW_DOCS_DIR}" -name "*.md" | wc -l)" | bc) files consolidated

### Structure Overview
$(find "${NEW_DOCS_DIR}" -type d | sed "s|${NEW_DOCS_DIR}||" | sed 's|^/||' | sort)

### High-Priority Migrations Completed
$(find "${NEW_DOCS_DIR}" -name "*.md" -exec grep -l "Migration Note" {} \; | wc -l) files migrated with preservation notes

### Archive Contents
- Phase documentation: $(find "${NEW_DOCS_DIR}/archive/phase-documentation" -name "*.md" | wc -l) files
- Technical debt reports: $(find "${NEW_DOCS_DIR}/archive/reports/technical-debt" -name "*.md" | wc -l) files
- Temporary migrations: $(find "${NEW_DOCS_DIR}/archive/temporary-migrations" -name "*.md" | wc -l) files

## Next Steps
1. Review migrated content for accuracy
2. Update internal links and references
3. Consolidate duplicate information
4. Add cross-references between related documents
5. Validate all external links
6. Update project README to point to new structure

## Backup Location
Complete backup of original documentation: \`${BACKUP_DIR}\`
EOF
    
    log "Migration report generated: ${report_file}"
}

# Main migration function
main() {
    echo -e "${BLUE}Starting MediaNest Documentation Migration...${NC}"
    
    # Confirm with user
    echo -e "${YELLOW}This will create a new documentation structure and migrate existing files.${NC}"
    echo -e "${YELLOW}Original files will be backed up to: ${BACKUP_DIR}${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled."
        exit 0
    fi
    
    # Execute migration steps
    backup_current_docs
    create_structure
    create_templates
    migrate_high_priority
    migrate_api_docs
    migrate_testing_docs
    migrate_deployment_docs
    migrate_archive
    create_cross_references
    generate_report
    
    echo -e "${GREEN}=== Migration Completed Successfully ===${NC}"
    echo -e "${BLUE}New documentation structure: ${NEW_DOCS_DIR}${NC}"
    echo -e "${BLUE}Migration report: ${NEW_DOCS_DIR}/MIGRATION_REPORT.md${NC}"
    echo -e "${BLUE}Original backup: ${BACKUP_DIR}${NC}"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Review migrated content in ${NEW_DOCS_DIR}"
    echo "2. Update internal links and references"  
    echo "3. Consolidate duplicate information"
    echo "4. Test documentation navigation"
    echo "5. Replace old docs directory when satisfied"
}

# Run main function
main "$@"