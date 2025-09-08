#!/bin/bash
# EMERGENCY SECRET ROTATION SCRIPT
# Generated: $(date)
# Security Incident Response

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# New cryptographically secure secrets (256-bit)
NEW_JWT_SECRET="724e208ffe92c42c197cfe93013943c9dfbff58a3a052040ec57f68c7f494916"
NEW_NEXTAUTH_SECRET="9f246d65ab022d5444ba40afbe1a2ca870d921687b1b607292408c2201d86e8b"
NEW_ENCRYPTION_KEY="a64675debd636bf260e6747667c9f45361dfcf269d2c86bb351e62d49af38bbc"
NEW_JWT_SECRET_ROTATION="gdTsTSfbS3JCEvUw8SCU3NJ+wRPK8folC/jl5lCoj54="

# Compromised secrets to replace
OLD_JWT_SECRET="da70b067dbe203df294779265b0ddaf6d14d827d6ed821ce60746cb0f9fb966d"
OLD_NEXTAUTH_SECRET="2091416d1b17f0b969e184c97715cc5af73e23ad1470c1169a6730b4b5454da9"
OLD_ENCRYPTION_KEY="fe64c50cedac97792790e561982002cf5438add5af15881ae063c6c0ef92f5c2"

echo -e "${RED}🚨 EMERGENCY SECRET ROTATION INITIATED${NC}"
echo -e "${YELLOW}Rotating compromised secrets identified in security audit${NC}"

# Backup current secrets
BACKUP_DIR="/home/kinginyellow/projects/medianest/security/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Creating backup of current environment files...${NC}"

# Find and backup all environment files
find /home/kinginyellow/projects/medianest -name "*.env*" -type f ! -path "*/node_modules/*" | while read -r file; do
    if [[ -f "$file" ]]; then
        backup_path="$BACKUP_DIR/$(basename "$file")"
        cp "$file" "$backup_path"
        echo "  Backed up: $file -> $backup_path"
    fi
done

echo -e "${GREEN}✅ Backup complete${NC}"

# Function to rotate secrets in a file
rotate_secrets_in_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        echo "  Processing: $file"
        
        # Replace compromised secrets
        sed -i "s/$OLD_JWT_SECRET/$NEW_JWT_SECRET/g" "$file" 2>/dev/null || true
        sed -i "s/$OLD_NEXTAUTH_SECRET/$NEW_NEXTAUTH_SECRET/g" "$file" 2>/dev/null || true
        sed -i "s/$OLD_ENCRYPTION_KEY/$NEW_ENCRYPTION_KEY/g" "$file" 2>/dev/null || true
        
        # Update generic placeholders for production files
        sed -i "s/JWT_SECRET=your-jwt-secret-key/JWT_SECRET=$NEW_JWT_SECRET/g" "$file" 2>/dev/null || true
        sed -i "s/NEXTAUTH_SECRET=your-nextauth-secret-key/NEXTAUTH_SECRET=$NEW_NEXTAUTH_SECRET/g" "$file" 2>/dev/null || true
        sed -i "s/ENCRYPTION_KEY=your-32-byte-encryption-key/ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY/g" "$file" 2>/dev/null || true
    fi
}

echo -e "${YELLOW}Rotating secrets in environment files...${NC}"

# Rotate secrets in primary environment files
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/.env"
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/.env.production"
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/backend/.env"
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/backend/.env.production"
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/backend/.env.production.final"
rotate_secrets_in_file "/home/kinginyellow/projects/medianest/backend/.env.temp"

echo -e "${GREEN}✅ Secret rotation complete${NC}"

# Remove exposed secrets from documentation files
echo -e "${YELLOW}Sanitizing documentation files...${NC}"

DOC_FILES=(
    "/home/kinginyellow/projects/medianest/docs/SECURITY_VULNERABILITY_ASSESSMENT_REPORT.md"
    "/home/kinginyellow/projects/medianest/docs/security-scan-results.json"
    "/home/kinginyellow/projects/medianest/STAGING_READINESS_AUDIT_REPORT.md"
)

for doc_file in "${DOC_FILES[@]}"; do
    if [[ -f "$doc_file" ]]; then
        echo "  Sanitizing: $doc_file"
        sed -i "s/$OLD_JWT_SECRET/[REDACTED-ROTATED]/g" "$doc_file" 2>/dev/null || true
        sed -i "s/$OLD_NEXTAUTH_SECRET/[REDACTED-ROTATED]/g" "$doc_file" 2>/dev/null || true  
        sed -i "s/$OLD_ENCRYPTION_KEY/[REDACTED-ROTATED]/g" "$doc_file" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ Documentation sanitized${NC}"

# Verification
echo -e "${YELLOW}Verifying rotation success...${NC}"

REMAINING_SECRETS=0
if grep -r "$OLD_JWT_SECRET" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=security 2>/dev/null; then
    ((REMAINING_SECRETS++))
fi
if grep -r "$OLD_NEXTAUTH_SECRET" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=security 2>/dev/null; then
    ((REMAINING_SECRETS++))
fi
if grep -r "$OLD_ENCRYPTION_KEY" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=security 2>/dev/null; then
    ((REMAINING_SECRETS++))
fi

if [[ $REMAINING_SECRETS -eq 0 ]]; then
    echo -e "${GREEN}✅ ROTATION SUCCESSFUL: No compromised secrets found${NC}"
else
    echo -e "${RED}⚠️  WARNING: $REMAINING_SECRETS compromised secrets still found${NC}"
fi

echo -e "${GREEN}🔐 Emergency rotation complete${NC}"
echo -e "${YELLOW}Backup location: $BACKUP_DIR${NC}"
echo -e "${YELLOW}New secrets have been applied to all environment files${NC}"
echo ""
echo -e "${RED}NEXT STEPS:${NC}"
echo "1. Restart all services to load new secrets"
echo "2. Verify application functionality"
echo "3. Update any external systems using these secrets"
echo "4. Monitor for any authentication failures"
echo "5. Document incident in security log"