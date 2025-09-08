#!/bin/bash

# MediaNest Documentation Cleanup Script
# Reorganizes scattered markdown files and consolidates duplicate documentation
# Created: 2025-09-08

set -euo pipefail

# Colors and constants
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
DRY_RUN=false
SKIP_CONFIRMATION=false
VERBOSE=false

log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
}

verbose_log() {
    [[ "$VERBOSE" == true ]] && log "INFO" "$@"
}

safe_move() {
    local source="$1"
    local destination="$2"
    local description="$3"
    
    if [[ ! -e "$source" ]]; then
        verbose_log "Skipping $description - source not found: $source"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "[DRY RUN] Would move $description: $source -> $destination"
        return 0
    fi
    
    # Create destination directory if needed
    mkdir -p "$(dirname "$destination")"
    
    # Handle conflicts
    if [[ -e "$destination" ]]; then
        log "WARN" "Destination exists, creating backup: $destination"
        mv "$destination" "${destination}.backup"
    fi
    
    mv "$source" "$destination"
    log "SUCCESS" "Moved $description: $source -> $destination"
}

create_docs_structure() {
    log "INFO" "=== Creating organized documentation structure ==="
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    if [[ "$DRY_RUN" == false ]]; then
        mkdir -p "$docs_dir"/{api,deployment,development,security,architecture,guides,reports}
        
        # Create index file
        cat > "$docs_dir/README.md" << 'EOF'
# MediaNest Documentation

## Table of Contents

### 🏗️ Architecture
- [System Architecture](./architecture/system-overview.md)
- [Database Design](./architecture/database-schema.md)
- [API Design](./architecture/api-design.md)

### 📚 API Documentation
- [REST API Reference](./api/rest-endpoints.md)
- [WebSocket API](./api/websocket-events.md)
- [Authentication](./api/authentication.md)

### 🚀 Deployment
- [Production Deployment](./deployment/production-setup.md)
- [Docker Configuration](./deployment/docker-guide.md)
- [Environment Setup](./deployment/environment-config.md)

### 🛠️ Development
- [Getting Started](./development/getting-started.md)
- [Development Workflow](./development/workflow.md)
- [Testing Guide](./development/testing.md)
- [Contributing Guidelines](./development/contributing.md)

### 🔐 Security
- [Security Overview](./security/security-overview.md)
- [Authentication & Authorization](./security/auth-guide.md)
- [Security Best Practices](./security/best-practices.md)

### 📖 Guides
- [User Guide](./guides/user-guide.md)
- [Admin Guide](./guides/admin-guide.md)
- [Troubleshooting](./guides/troubleshooting.md)

### 📊 Reports
- [Performance Reports](./reports/)
- [Security Audits](./reports/)
- [Code Quality Reports](./reports/)

## Quick Links

- [Installation Guide](./development/getting-started.md#installation)
- [API Reference](./api/rest-endpoints.md)
- [Deployment Guide](./deployment/production-setup.md)
- [Contributing](./development/contributing.md)

## Support

For questions and support, please refer to the troubleshooting guide or open an issue.
EOF
        
        log "SUCCESS" "Created documentation structure in $docs_dir"
    else
        log "INFO" "[DRY RUN] Would create organized documentation structure"
    fi
}

move_scattered_docs() {
    log "INFO" "=== Moving scattered documentation files ==="
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    # Map of file patterns to destination directories
    declare -A doc_mappings=(
        # Security documents
        ["*security*"]="security"
        ["*SECURITY*"]="security" 
        ["*auth*"]="security"
        ["*AUTH*"]="security"
        
        # Deployment documents
        ["*deploy*"]="deployment"
        ["*DEPLOY*"]="deployment"
        ["*docker*"]="deployment"
        ["*DOCKER*"]="deployment"
        ["*production*"]="deployment"
        ["*PRODUCTION*"]="deployment"
        
        # API documents
        ["*api*"]="api"
        ["*API*"]="api"
        ["*endpoint*"]="api"
        ["*swagger*"]="api"
        
        # Development documents
        ["*develop*"]="development"
        ["*DEVELOP*"]="development"
        ["*test*"]="development"
        ["*TEST*"]="development"
        ["*contributing*"]="development"
        ["*CONTRIBUTING*"]="development"
        
        # Architecture documents
        ["*architecture*"]="architecture"
        ["*ARCHITECTURE*"]="architecture"
        ["*design*"]="architecture"
        ["*DESIGN*"]="architecture"
        
        # Reports
        ["*report*"]="reports"
        ["*REPORT*"]="reports"
        ["*audit*"]="reports"
        ["*AUDIT*"]="reports"
    )
    
    # Find all markdown files in the project (excluding docs and node_modules)
    find "$PROJECT_ROOT" -name "*.md" -type f \
        -not -path "*/docs/*" \
        -not -path "*/node_modules/*" \
        -not -path "*/scripts/cleanup/*" | while read -r md_file; do
        
        local filename=$(basename "$md_file")
        local moved=false
        
        # Try to match patterns
        for pattern in "${!doc_mappings[@]}"; do
            if [[ "$filename" == $pattern ]]; then
                local dest_dir="${doc_mappings[$pattern]}"
                local destination="$docs_dir/$dest_dir/$filename"
                
                safe_move "$md_file" "$destination" "documentation file ($dest_dir)"
                moved=true
                break
            fi
        done
        
        # If no pattern matched, move to appropriate category based on location
        if [[ "$moved" == false ]]; then
            local relative_path="${md_file#$PROJECT_ROOT/}"
            local dest_subdir="guides"
            
            case "$relative_path" in
                backend/*) dest_subdir="development" ;;
                frontend/*) dest_subdir="development" ;;
                config/*) dest_subdir="deployment" ;;
                scripts/*) dest_subdir="development" ;;
                *) dest_subdir="guides" ;;
            esac
            
            local destination="$docs_dir/$dest_subdir/$filename"
            safe_move "$md_file" "$destination" "documentation file ($dest_subdir)"
        fi
    done
}

consolidate_duplicate_docs() {
    log "INFO" "=== Consolidating duplicate documentation ==="
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    if [[ ! -d "$docs_dir" ]]; then
        log "WARN" "Documentation directory not found, skipping consolidation"
        return 0
    fi
    
    # Find potential duplicates based on similar names
    local temp_file="/tmp/doc-duplicates.txt"
    
    find "$docs_dir" -name "*.md" -type f | while read -r file; do
        local basename=$(basename "$file" .md)
        local normalized=$(echo "$basename" | tr '[:upper:]' '[:lower:]' | sed 's/[_-]//g')
        echo "$normalized $file"
    done | sort > "$temp_file"
    
    # Group similar files
    local prev_normalized=""
    local files_group=()
    
    while read -r line; do
        local normalized=$(echo "$line" | cut -d' ' -f1)
        local file=$(echo "$line" | cut -d' ' -f2-)
        
        if [[ "$normalized" == "$prev_normalized" ]]; then
            files_group+=("$file")
        else
            # Process previous group if it has duplicates
            if [[ ${#files_group[@]} -gt 1 ]]; then
                process_duplicate_group "${files_group[@]}"
            fi
            
            # Start new group
            files_group=("$file")
            prev_normalized="$normalized"
        fi
    done < "$temp_file"
    
    # Process final group
    if [[ ${#files_group[@]} -gt 1 ]]; then
        process_duplicate_group "${files_group[@]}"
    fi
    
    rm -f "$temp_file"
}

process_duplicate_group() {
    local files=("$@")
    
    log "WARN" "Found potential duplicates:"
    for file in "${files[@]}"; do
        log "WARN" "  - $file"
    done
    
    if [[ "$DRY_RUN" == false ]]; then
        # Keep the largest/most complete file
        local primary_file=""
        local max_size=0
        
        for file in "${files[@]}"; do
            local size=$(wc -l < "$file" 2>/dev/null || echo "0")
            if [[ $size -gt $max_size ]]; then
                max_size=$size
                primary_file="$file"
            fi
        done
        
        if [[ -n "$primary_file" ]]; then
            log "INFO" "Keeping primary file: $primary_file"
            
            # Create consolidated content
            local temp_consolidated="/tmp/consolidated-$(basename "$primary_file")"
            cp "$primary_file" "$temp_consolidated"
            
            # Append unique content from other files
            for file in "${files[@]}"; do
                if [[ "$file" != "$primary_file" ]]; then
                    log "INFO" "Merging content from: $file"
                    echo -e "\n\n---\n*Content merged from $(basename "$file"):*\n" >> "$temp_consolidated"
                    cat "$file" >> "$temp_consolidated"
                    
                    # Remove duplicate file
                    rm -f "$file"
                fi
            done
            
            # Replace primary file with consolidated version
            mv "$temp_consolidated" "$primary_file"
            log "SUCCESS" "Consolidated duplicates into: $primary_file"
        fi
    else
        log "INFO" "[DRY RUN] Would consolidate duplicate files"
    fi
}

fix_broken_links() {
    log "INFO" "=== Fixing broken links ==="
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    if [[ ! -d "$docs_dir" ]]; then
        log "WARN" "Documentation directory not found, skipping link fixes"
        return 0
    fi
    
    # Find all markdown files and check their links
    find "$docs_dir" -name "*.md" -type f | while read -r file; do
        if [[ "$DRY_RUN" == false ]]; then
            local temp_file="/tmp/$(basename "$file")"
            local modified=false
            
            # Process each line
            while IFS= read -r line; do
                # Fix common broken link patterns
                local new_line="$line"
                
                # Fix relative paths that moved
                new_line=$(echo "$new_line" | sed 's|\.\./docs/|./|g')
                new_line=$(echo "$new_line" | sed 's|\.\./\.\./docs/|../|g')
                new_line=$(echo "$new_line" | sed 's|docs/docs/|docs/|g')
                
                # Fix README references
                new_line=$(echo "$new_line" | sed 's|README\.md|README.md|g')
                
                if [[ "$new_line" != "$line" ]]; then
                    modified=true
                fi
                
                echo "$new_line"
            done < "$file" > "$temp_file"
            
            if [[ "$modified" == true ]]; then
                mv "$temp_file" "$file"
                log "SUCCESS" "Fixed links in: $(basename "$file")"
            else
                rm -f "$temp_file"
                verbose_log "No link fixes needed in: $(basename "$file")"
            fi
        else
            log "INFO" "[DRY RUN] Would check and fix links in: $(basename "$file")"
        fi
    done
}

create_api_documentation_template() {
    log "INFO" "=== Creating API documentation templates ==="
    
    local api_dir="$PROJECT_ROOT/docs/api"
    
    if [[ "$DRY_RUN" == false ]]; then
        mkdir -p "$api_dir"
        
        # REST API documentation template
        cat > "$api_dir/rest-endpoints.md" << 'EOF'
# REST API Reference

## Overview

MediaNest provides a comprehensive REST API for managing media content and user interactions.

## Base URL

```
Production: https://api.medianest.com/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All API requests require authentication via Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### POST /auth/login
Login with credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

#### POST /auth/refresh
Refresh authentication token.

#### POST /auth/logout
Logout and invalidate token.

### Media Management

#### GET /media
Get user's media library.

#### POST /media
Add new media item.

#### GET /media/:id
Get specific media item.

#### PUT /media/:id
Update media item.

#### DELETE /media/:id
Delete media item.

### User Management

#### GET /users/profile
Get current user profile.

#### PUT /users/profile
Update user profile.

#### GET /users/preferences
Get user preferences.

#### PUT /users/preferences
Update user preferences.

## Error Responses

All API errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-08T12:00:00Z"
}
```

## Rate Limits

- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated requests

## Pagination

List endpoints support pagination:

```http
GET /media?page=1&limit=20&sort=createdAt&order=desc
```

## Webhooks

MediaNest supports webhooks for real-time updates. See [Webhook Documentation](./webhooks.md) for details.
EOF
        
        # WebSocket API documentation
        cat > "$api_dir/websocket-events.md" << 'EOF'
# WebSocket API Reference

## Overview

MediaNest provides real-time updates through WebSocket connections.

## Connection

```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## Events

### Client to Server

#### `join_room`
Join a specific room for updates.

```javascript
socket.emit('join_room', { room: 'media_updates' });
```

#### `media_action`
Perform action on media item.

```javascript
socket.emit('media_action', {
  action: 'play',
  mediaId: 'media-id-123'
});
```

### Server to Client

#### `media_updated`
Media item was updated.

```javascript
socket.on('media_updated', (data) => {
  console.log('Media updated:', data);
});
```

#### `notification`
General notification.

```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data.message);
});
```

## Authentication

WebSocket connections require JWT token authentication passed in the auth object during connection.

## Error Handling

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```
EOF
        
        log "SUCCESS" "Created API documentation templates"
    else
        log "INFO" "[DRY RUN] Would create API documentation templates"
    fi
}

clean_old_documentation() {
    log "INFO" "=== Cleaning up old documentation directories ==="
    
    local old_doc_dirs=(
        "$PROJECT_ROOT/docs-old*"
        "$PROJECT_ROOT/documentation*"
        "$PROJECT_ROOT/wiki*"
    )
    
    for pattern in "${old_doc_dirs[@]}"; do
        for old_dir in $pattern; do
            if [[ -d "$old_dir" ]]; then
                if [[ "$DRY_RUN" == false ]]; then
                    log "INFO" "Removing old documentation directory: $old_dir"
                    rm -rf "$old_dir"
                    log "SUCCESS" "Removed: $old_dir"
                else
                    log "INFO" "[DRY RUN] Would remove old documentation: $old_dir"
                fi
            fi
        done
    done
}

show_docs_cleanup_summary() {
    log "INFO" "=== Documentation Cleanup Summary ==="
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    if [[ -d "$docs_dir" ]]; then
        # Count files in each category
        local api_count=$(find "$docs_dir/api" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local security_count=$(find "$docs_dir/security" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local deployment_count=$(find "$docs_dir/deployment" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local development_count=$(find "$docs_dir/development" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local architecture_count=$(find "$docs_dir/architecture" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local guides_count=$(find "$docs_dir/guides" -name "*.md" 2>/dev/null | wc -l || echo "0")
        local reports_count=$(find "$docs_dir/reports" -name "*.md" 2>/dev/null | wc -l || echo "0")
        
        local total_docs=$((api_count + security_count + deployment_count + development_count + architecture_count + guides_count + reports_count))
        
        log "INFO" "Organized documentation structure:"
        log "INFO" "  📚 API Documentation: $api_count files"
        log "INFO" "  🔐 Security: $security_count files"
        log "INFO" "  🚀 Deployment: $deployment_count files"
        log "INFO" "  🛠️  Development: $development_count files"
        log "INFO" "  🏗️  Architecture: $architecture_count files"
        log "INFO" "  📖 Guides: $guides_count files"
        log "INFO" "  📊 Reports: $reports_count files"
        log "INFO" "  📄 Total Documentation: $total_docs files"
    else
        log "WARN" "Documentation directory not found"
    fi
    
    # Check for remaining scattered docs
    local scattered_count=$(find "$PROJECT_ROOT" -name "*.md" -type f \
        -not -path "*/docs/*" \
        -not -path "*/node_modules/*" \
        -not -path "*/scripts/cleanup/*" | wc -l || echo "0")
    
    log "INFO" "Remaining scattered documentation: $scattered_count files"
}

main() {
    echo -e "${BLUE}MediaNest Documentation Cleanup${NC}\n"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) DRY_RUN=true; shift ;;
            --yes) SKIP_CONFIRMATION=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            *) log "ERROR" "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN MODE - No documentation will be moved or modified"
    fi
    
    # Run documentation cleanup operations
    create_docs_structure
    move_scattered_docs
    consolidate_duplicate_docs
    fix_broken_links
    create_api_documentation_template
    clean_old_documentation
    
    # Show summary
    show_docs_cleanup_summary
    
    if [[ "$DRY_RUN" == false ]]; then
        log "SUCCESS" "Documentation cleanup completed successfully!"
        log "INFO" "Documentation now organized in: $PROJECT_ROOT/docs/"
    else
        log "INFO" "Dry run completed - no documentation was moved or modified"
    fi
}

main "$@"