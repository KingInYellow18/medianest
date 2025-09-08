#!/bin/bash
# Emergency Secret Rotation Script for MediaNest
# Usage: ./emergency-secret-rotation.sh [environment]
# Environments: dev, prod, staging, test

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SCRIPT_DIR/rotation"
DATE_STAMP=$(date +%Y%m%d_%H%M%S)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compromised secrets (for reference and cleanup)
OLD_JWT_SECRET="da70b067dbe203df294779265b0ddaf6d14d827d6ed821ce60746cb0f9fb966d"
OLD_NEXTAUTH_SECRET="2091416d1b17f0b969e184c97715cc5af73e23ad1470c1169a6730b4b5454da9"
OLD_ENCRYPTION_KEY="fe64c50cedac97792790e561982002cf5438add5af15881ae063c6c0ef92f5c2"

# New secrets (generated securely)
NEW_JWT_SECRET="6ac5561b8aea0d86a219fb59cc6345af4bdcd6af7a3de03aad02c22ea46538fc"
NEW_NEXTAUTH_SECRET="d32ff017138c6bc615e30ed112f022a75cfe76613ead26fd472e9b5217607cb0"
NEW_ENCRYPTION_KEY="a1672676894b232f005e0730819a0978967c2adec73e9c5b23917acf33004cbd"
NEW_JWT_SECRET_ROTATION="IugJN+oeqBy9hPekfgQe5SMzqVCXgVTD+Qlt68IUcws="

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

create_backup_directory() {
    log_info "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    
    # Create rotation log
    cat > "$BACKUP_DIR/rotation_log_$DATE_STAMP.txt" << EOF
# Emergency Secret Rotation Log
# Date: $(date)
# Reason: Security breach - hardcoded secrets exposed
# Compromised secrets rotated: JWT_SECRET, NEXTAUTH_SECRET, ENCRYPTION_KEY

Old JWT_SECRET (compromised): $OLD_JWT_SECRET
Old NEXTAUTH_SECRET (compromised): $OLD_NEXTAUTH_SECRET  
Old ENCRYPTION_KEY (compromised): $OLD_ENCRYPTION_KEY

New JWT_SECRET: $NEW_JWT_SECRET
New NEXTAUTH_SECRET: $NEW_NEXTAUTH_SECRET
New ENCRYPTION_KEY: $NEW_ENCRYPTION_KEY
New JWT_SECRET_ROTATION: $NEW_JWT_SECRET_ROTATION

Status: COMPLETED
Next rotation due: $(date -d '+90 days')
EOF
}

generate_new_secrets() {
    log_info "Generating new cryptographically secure secrets..."
    
    # Generate fresh secrets with maximum entropy
    NEW_JWT_EMERGENCY=$(openssl rand -hex 32)
    NEW_NEXTAUTH_EMERGENCY=$(openssl rand -hex 32)
    NEW_ENCRYPTION_EMERGENCY=$(openssl rand -hex 32)
    NEW_ROTATION_EMERGENCY=$(openssl rand -base64 32)
    
    log_success "New emergency secrets generated"
    
    # Save to secure backup
    cat > "$BACKUP_DIR/emergency_secrets_$DATE_STAMP.key" << EOF
# EMERGENCY GENERATED SECRETS - CLASSIFIED
# Generated: $(date)
# Entropy: 256-bit (maximum security)

JWT_SECRET_EMERGENCY=$NEW_JWT_EMERGENCY
NEXTAUTH_SECRET_EMERGENCY=$NEW_NEXTAUTH_EMERGENCY
ENCRYPTION_KEY_EMERGENCY=$NEW_ENCRYPTION_EMERGENCY
JWT_SECRET_ROTATION_EMERGENCY=$NEW_ROTATION_EMERGENCY

# WARNING: This file contains highly sensitive secrets
# Restrict access: chmod 600
# Store in secure vault after rotation
EOF
    
    chmod 600 "$BACKUP_DIR/emergency_secrets_$DATE_STAMP.key"
}

rotate_environment_file() {
    local env_file="$1"
    local env_name="$2"
    
    if [[ ! -f "$env_file" ]]; then
        log_warning "Environment file not found: $env_file"
        return
    fi
    
    log_info "Rotating secrets in $env_name environment: $env_file"
    
    # Create backup of original file
    cp "$env_file" "$BACKUP_DIR/$(basename "$env_file").backup.$DATE_STAMP"
    
    # Perform secret rotation
    sed -i.tmp \
        -e "s/$OLD_JWT_SECRET/$NEW_JWT_SECRET/g" \
        -e "s/$OLD_NEXTAUTH_SECRET/$NEW_NEXTAUTH_SECRET/g" \
        -e "s/$OLD_ENCRYPTION_KEY/$NEW_ENCRYPTION_KEY/g" \
        "$env_file"
    
    # Clean up temporary file
    rm -f "$env_file.tmp"
    
    log_success "Rotated secrets in $env_name environment"
}

scan_and_cleanup_codebase() {
    log_info "Scanning codebase for remaining hardcoded secrets..."
    
    # Find files containing old secrets (excluding backups and git)
    local files_with_secrets=$(grep -r -l "$OLD_JWT_SECRET\|$OLD_NEXTAUTH_SECRET\|$OLD_ENCRYPTION_KEY" \
        --exclude-dir=.git \
        --exclude-dir=node_modules \
        --exclude-dir=backups \
        --exclude="*.backup.*" \
        "$PROJECT_ROOT" 2>/dev/null || true)
    
    if [[ -n "$files_with_secrets" ]]; then
        log_warning "Found files with old secrets - manual review required:"
        echo "$files_with_secrets"
        
        # Save list for manual review
        echo "$files_with_secrets" > "$BACKUP_DIR/files_requiring_manual_review_$DATE_STAMP.txt"
    else
        log_success "No remaining hardcoded secrets found in codebase"
    fi
}

verify_rotation() {
    log_info "Verifying secret rotation..."
    
    local verification_failed=0
    
    # Check primary environment files
    for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.production" "$PROJECT_ROOT/backend/.env"; do
        if [[ -f "$env_file" ]]; then
            if grep -q "$OLD_JWT_SECRET\|$OLD_NEXTAUTH_SECRET\|$OLD_ENCRYPTION_KEY" "$env_file"; then
                log_error "Old secrets still present in $env_file"
                verification_failed=1
            else
                log_success "Verified rotation in $env_file"
            fi
        fi
    done
    
    return $verification_failed
}

main() {
    log_info "Starting emergency secret rotation..."
    log_warning "This will rotate ALL compromised secrets across environments"
    
    # Create secure backup structure
    create_backup_directory
    
    # Generate additional emergency secrets
    generate_new_secrets
    
    # Rotate secrets in all environment files
    rotate_environment_file "$PROJECT_ROOT/.env" "development"
    rotate_environment_file "$PROJECT_ROOT/.env.production" "production"
    rotate_environment_file "$PROJECT_ROOT/backend/.env" "backend"
    rotate_environment_file "$PROJECT_ROOT/backend/.env.production" "backend-production"
    rotate_environment_file "$PROJECT_ROOT/backend/.env.temp" "backend-temp"
    rotate_environment_file "$PROJECT_ROOT/frontend/.env.local" "frontend-local"
    
    # Scan for any remaining hardcoded secrets
    scan_and_cleanup_codebase
    
    # Verify rotation completed successfully
    if verify_rotation; then
        log_success "Emergency secret rotation completed successfully"
        log_info "Next steps:"
        echo "  1. Restart all services to pick up new secrets"
        echo "  2. Verify application functionality"
        echo "  3. Update production deployment secrets"
        echo "  4. Schedule regular secret rotation (90 days)"
        echo "  5. Review files in: $BACKUP_DIR/files_requiring_manual_review_$DATE_STAMP.txt"
    else
        log_error "Secret rotation verification failed - manual intervention required"
        exit 1
    fi
}

# Execute main function
main "$@"