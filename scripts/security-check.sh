#!/bin/bash

# MediaNest Security Check Script
# Comprehensive security audit for staging readiness

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Report file
REPORT_FILE="reports/security-audit.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Initialize report
mkdir -p reports
echo "# MediaNest Security Audit Report" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Generated:** $TIMESTAMP" >> "$REPORT_FILE"
echo "**Environment:** Staging Readiness Assessment" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "- $1" >> "$REPORT_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "- ✅ $1" >> "$REPORT_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "- ⚠️ $1" >> "$REPORT_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "- ❌ $1" >> "$REPORT_FILE"
}

echo -e "${BLUE}🔒 Starting MediaNest Security Audit${NC}"
echo ""

# Check 1: NPM Dependencies Vulnerabilities
echo "## 1. Dependency Vulnerability Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking npm dependencies for vulnerabilities..."

npm audit --json > /tmp/npm-audit.json 2>/dev/null || true
VULN_COUNT=$(jq '.metadata.vulnerabilities.total' /tmp/npm-audit.json 2>/dev/null || echo "0")

if [ "$VULN_COUNT" -eq 0 ]; then
    log_success "No npm vulnerabilities found"
else
    log_error "$VULN_COUNT npm vulnerabilities detected"
    echo "" >> "$REPORT_FILE"
    echo "### Detailed Vulnerability Report" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    jq '.vulnerabilities' /tmp/npm-audit.json >> "$REPORT_FILE" 2>/dev/null || echo "Error parsing vulnerabilities" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

# Check 2: Hardcoded Secrets Detection
echo "" >> "$REPORT_FILE"
echo "## 2. Hardcoded Secrets Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Scanning for hardcoded secrets and credentials..."

SECRET_PATTERNS=(
    "password.*=.*['\"][^'\"]*['\"]"
    "secret.*=.*['\"][^'\"]*['\"]"
    "key.*=.*['\"][^'\"]*['\"]"
    "token.*=.*['\"][^'\"]*['\"]"
    "api_key.*=.*['\"][^'\"]*['\"]"
    "private_key"
    "-----BEGIN.*KEY-----"
    "ssh-rsa"
    "AKIA[0-9A-Z]{16}"
)

SECRET_FOUND=false
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -rP --include="*.js" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage --exclude="*test*" --exclude="*spec*" "$pattern" . >/dev/null 2>&1; then
        log_warning "Potential hardcoded secret pattern found: $pattern"
        SECRET_FOUND=true
    fi
done

if [ "$SECRET_FOUND" = false ]; then
    log_success "No obvious hardcoded secrets detected in source code"
fi

# Check 3: Environment File Security
echo "" >> "$REPORT_FILE"
echo "## 3. Environment File Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking environment file security..."

# Check if .env files are properly ignored
if git ls-files | grep -E "\.env$" >/dev/null 2>&1; then
    log_error ".env file is tracked in git - contains secrets!"
else
    log_success ".env file is properly excluded from git"
fi

# Check for default/weak secrets in .env files
if [ -f ".env" ]; then
    log_info "Analyzing .env file for weak configurations..."
    
    if grep -q "changeme\|password123\|secret123\|default" .env; then
        log_warning "Default/weak secrets found in .env file"
    else
        log_success ".env file does not contain obvious weak secrets"
    fi
    
    # Check for proper secret lengths
    if grep -E "SECRET.*=.{32,}" .env >/dev/null; then
        log_success "JWT/Auth secrets appear to have adequate length"
    else
        log_warning "Some secrets may be too short for production use"
    fi
fi

# Check 4: Docker Security
echo "" >> "$REPORT_FILE"
echo "## 4. Container Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking Docker security configuration..."

if [ -f "Dockerfile" ]; then
    # Check for security anti-patterns in Dockerfile
    if grep -q "^USER root\|ADD.*http\|--disable-content-trust" Dockerfile; then
        log_warning "Potential security issues in Dockerfile"
    else
        log_success "Dockerfile follows basic security practices"
    fi
    
    # Check for non-root user
    if grep -q "USER.*[^root]" Dockerfile; then
        log_success "Dockerfile uses non-root user"
    else
        log_warning "Dockerfile may be running as root"
    fi
fi

# Check 5: File Permissions
echo "" >> "$REPORT_FILE"
echo "## 5. File Permission Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking file permissions..."

# Check for world-writable files
WRITABLE_FILES=$(find . -type f -perm -002 ! -path "./node_modules/*" ! -path "./.git/*" 2>/dev/null | wc -l)
if [ "$WRITABLE_FILES" -eq 0 ]; then
    log_success "No world-writable files found"
else
    log_warning "$WRITABLE_FILES world-writable files detected"
fi

# Check for executable files in unexpected places
EXEC_FILES=$(find ./src ./backend/src ./frontend/src -type f -executable 2>/dev/null | wc -l)
if [ "$EXEC_FILES" -eq 0 ]; then
    log_success "No unexpected executable files in source directories"
else
    log_info "$EXEC_FILES executable files found in source directories (review recommended)"
fi

# Check 6: SSL/TLS Configuration
echo "" >> "$REPORT_FILE"
echo "## 6. SSL/TLS Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking SSL/TLS configuration..."

# Check for HTTPS enforcement
if grep -r "app.use.*helmet\|require.*helmet" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
    log_success "Helmet.js security middleware detected"
else
    log_warning "Helmet.js security middleware not detected"
fi

# Check for HTTPS redirect
if grep -r "HTTPS.*true\|secure.*true\|ssl.*true" . --include="*.js" --include="*.ts" --include="*.json" >/dev/null 2>&1; then
    log_success "HTTPS/SSL configuration detected"
else
    log_warning "HTTPS/SSL configuration not clearly detected"
fi

# Check 7: Database Security
echo "" >> "$REPORT_FILE"
echo "## 7. Database Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking database security configuration..."

# Check for SQL injection prevention (parameterized queries)
if grep -r "\.query\|\.execute" . --include="*.js" --include="*.ts" | grep -v "node_modules" | grep -E "\$[0-9]+|\?" >/dev/null 2>&1; then
    log_success "Parameterized query patterns detected"
else
    log_info "Database query patterns need manual review"
fi

# Check for connection encryption
if grep -r "ssl.*true\|sslmode.*require" . --include="*.js" --include="*.ts" --include="*.env*" >/dev/null 2>&1; then
    log_success "Database SSL/encryption configuration detected"
else
    log_warning "Database SSL/encryption not clearly configured"
fi

# Check 8: Authentication Security
echo "" >> "$REPORT_FILE"
echo "## 8. Authentication Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking authentication security..."

# Check for JWT security
if grep -r "jsonwebtoken\|jwt" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
    log_success "JWT authentication system detected"
    
    # Check for proper JWT secret handling
    if grep -r "process\.env.*JWT" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
        log_success "JWT secret loaded from environment variables"
    else
        log_warning "JWT secret handling needs review"
    fi
fi

# Check for password hashing
if grep -r "bcrypt\|argon2\|scrypt" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
    log_success "Password hashing library detected"
else
    log_warning "Password hashing implementation not detected"
fi

# Check 9: Input Validation
echo "" >> "$REPORT_FILE"
echo "## 9. Input Validation" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking input validation patterns..."

if grep -r "validator\|joi\|yup\|zod" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
    log_success "Input validation library detected"
else
    log_warning "Input validation library not clearly detected"
fi

# Check 10: Security Headers
echo "" >> "$REPORT_FILE"
echo "## 10. Security Headers Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
log_info "Checking security headers configuration..."

SECURITY_HEADERS=("helmet" "cors" "csp" "hsts" "x-frame-options")
for header in "${SECURITY_HEADERS[@]}"; do
    if grep -r "$header" . --include="*.js" --include="*.ts" >/dev/null 2>&1; then
        log_success "$header configuration detected"
    else
        log_info "$header configuration not detected (manual review needed)"
    fi
done

# Summary
echo "" >> "$REPORT_FILE"
echo "## Security Audit Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Audit completed at:** $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count issues
ERROR_COUNT=$(grep -c "❌" "$REPORT_FILE" || echo "0")
WARNING_COUNT=$(grep -c "⚠️" "$REPORT_FILE" || echo "0")
SUCCESS_COUNT=$(grep -c "✅" "$REPORT_FILE" || echo "0")

echo "### Results Overview" >> "$REPORT_FILE"
echo "- ✅ Successful checks: $SUCCESS_COUNT" >> "$REPORT_FILE"
echo "- ⚠️ Warnings: $WARNING_COUNT" >> "$REPORT_FILE"
echo "- ❌ Errors: $ERROR_COUNT" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$ERROR_COUNT" -eq 0 ] && [ "$WARNING_COUNT" -eq 0 ]; then
    echo "### 🎉 STAGING READY" >> "$REPORT_FILE"
    echo "No critical security issues detected. System appears ready for staging deployment." >> "$REPORT_FILE"
    log_success "Security audit completed - STAGING READY"
elif [ "$ERROR_COUNT" -eq 0 ]; then
    echo "### ⚠️ STAGING READY WITH WARNINGS" >> "$REPORT_FILE"
    echo "Minor security improvements recommended but no blocking issues found." >> "$REPORT_FILE"
    log_warning "Security audit completed - STAGING READY WITH WARNINGS"
else
    echo "### ❌ STAGING BLOCKED" >> "$REPORT_FILE"
    echo "Critical security issues must be resolved before staging deployment." >> "$REPORT_FILE"
    log_error "Security audit completed - STAGING BLOCKED"
fi

echo ""
echo -e "${GREEN}🔒 Security audit complete. Report saved to: $REPORT_FILE${NC}"

# Exit with appropriate code
if [ "$ERROR_COUNT" -gt 0 ]; then
    exit 1
elif [ "$WARNING_COUNT" -gt 0 ]; then
    exit 2
else
    exit 0
fi