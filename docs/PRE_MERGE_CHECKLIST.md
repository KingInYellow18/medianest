# Pre-Merge Checklist - MediaNest Development to Staging

**Version:** 1.0  
**Last Updated:** September 9, 2025  
**Purpose:** Comprehensive validation checklist to ensure develop branch is fully ready for human review and merge to staging

---

## ✅ SECTION 1: Developer Self-Validation (Before Human Review)

### 1.1 Docker Configuration Validation
**Objective:** Ensure all Docker configurations are tested and functional

- [ ] **Docker services start successfully**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.dev.yml up -d
  docker compose -f config/docker/docker-compose.prod.yml config --quiet
  docker compose -f config/docker/docker-compose.test.yml config --quiet
  
  # Expected output: All services start without errors
  # Validation: All containers show "healthy" status after 2 minutes
  ```

- [ ] **Docker health checks pass**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.dev.yml ps
  
  # Expected output: All services show "healthy" status
  # Timeout: Wait up to 5 minutes for all health checks to pass
  ```

- [ ] **Docker secrets mounting works (production config)**
  ```bash
  # Command to validate:
  ls -la secrets/
  docker compose -f config/docker/docker-compose.prod.yml exec backend ls -la /run/secrets/
  
  # Expected output: All required secret files present with correct permissions (600)
  ```

- [ ] **Multi-stage Docker builds complete**
  ```bash
  # Command to validate:
  docker build --target development .
  docker build --target test .
  docker build --target production .
  
  # Expected output: All builds complete successfully
  # Performance check: Build time < 10 minutes
  ```

### 1.2 Environment Configuration Completeness
**Objective:** Verify all environment files are complete and documented

- [ ] **All required environment variables present**
  ```bash
  # Command to validate:
  ./scripts/config-validation.sh --check-required
  
  # Expected output: "✅ All required environment variables present"
  # Check against: docs/CONFIGURATION_AUDIT.md critical variables list
  ```

- [ ] **.env.example includes all discovered variables**
  ```bash
  # Command to validate:
  grep -c "^[A-Z]" .env.example
  # Count should match the 250+ variables referenced in codebase
  
  # Manual verification: Check .env.example contains:
  # - NEXTAUTH_SECRET (critical)
  # - ENCRYPTION_KEY (critical) 
  # - CSRF_SECRET (critical)
  # - METRICS_TOKEN (critical)
  # - All SMTP configuration variables
  # - All external service API keys
  ```

- [ ] **Environment file structure is consistent**
  ```bash
  # Files that must exist:
  ls -la .env.example .env.production.example .env.test.example
  
  # Expected output: All files present, .env.example is most comprehensive
  ```

- [ ] **No secrets committed to version control**
  ```bash
  # Command to validate:
  git log --patch --all | grep -i "secret\|password\|key" | grep -v "example\|template"
  
  # Expected output: No sensitive values found in git history
  ```

### 1.3 Configuration Management Validation
**Objective:** Ensure configuration audit recommendations have been addressed

- [ ] **Critical security gaps resolved**
  ```bash
  # Validate presence of critical security variables:
  grep -E "^(NEXTAUTH_SECRET|ENCRYPTION_KEY|CSRF_SECRET|METRICS_TOKEN)" .env.example
  
  # Expected output: All 4 critical security variables documented
  ```

- [ ] **External service configurations documented**
  ```bash
  # Validate external service documentation:
  grep -E "^(SMTP_|YOUTUBE_API_KEY|TMDB_API_KEY|OVERSEERR_)" .env.example
  
  # Expected output: All external service variables documented with examples
  ```

- [ ] **Database and Redis configurations optimized**
  ```bash
  # Check production database configuration:
  grep -E "DB_POOL|CONNECTION_TIMEOUT|REDIS.*MEMORY" .env.production.example
  
  # Expected output: Performance tuning parameters documented
  ```

### 1.4 Security Configuration Implementation
**Objective:** Verify security best practices are implemented

- [ ] **Secrets generation scripts functional**
  ```bash
  # Command to validate:
  ./scripts/generate-secrets.sh --test-mode
  
  # Expected output: "✅ All secrets generated successfully"
  # Validation: Generated secrets have proper entropy (32+ characters)
  ```

- [ ] **Container security hardening in place**
  ```bash
  # Command to validate:
  docker inspect medianest-backend | jq '.[0].HostConfig.SecurityOpt'
  
  # Expected output: ["no-new-privileges:true"]
  # Additional check: Non-root user configured (UID 1001)
  ```

- [ ] **Network segmentation configured**
  ```bash
  # Command to validate:
  docker network ls | grep medianest
  
  # Expected output: Separate networks for frontend/backend isolation
  ```

---

## ✅ SECTION 2: Documentation Completeness Check

### 2.1 Deployment Documentation Verification
**Objective:** Ensure all deployment documentation exists and is comprehensive

- [ ] **README_DEPLOYMENT.md exists and is comprehensive**
  ```bash
  # Command to validate:
  test -f README_DEPLOYMENT.md && wc -l README_DEPLOYMENT.md
  
  # Expected output: File exists with 500+ lines of documentation
  # Content check: Contains step-by-step deployment instructions
  ```

- [ ] **ENVIRONMENT_VARIABLES.md covers all discovered variables**
  ```bash
  # Command to validate:
  test -f docs/ENVIRONMENT_VARIABLES.md
  grep -c "^##\|^-" docs/ENVIRONMENT_VARIABLES.md
  
  # Expected output: File exists with 100+ environment variable entries
  ```

- [ ] **DOCKER_CONFIGURATION_ANALYSIS.md includes all findings**
  ```bash
  # Command to validate:
  test -f docs/DOCKER_CONFIGURATION_ANALYSIS.md && wc -l docs/DOCKER_CONFIGURATION_ANALYSIS.md
  
  # Expected output: File exists with 1200+ lines (comprehensive analysis)
  # Content validation: Contains security, performance, and operational analysis
  ```

- [ ] **CONFIGURATION_AUDIT.md identifies all gaps**
  ```bash
  # Command to validate:
  test -f docs/CONFIGURATION_AUDIT.md
  grep -c "Critical\|High\|Medium" docs/CONFIGURATION_AUDIT.md
  
  # Expected output: File exists with detailed risk assessments
  # Content check: Contains 27+ critical missing variables documentation
  ```

### 2.2 Deployment Scripts Documentation
**Objective:** Ensure all deployment scripts are documented and executable

- [ ] **All deployment scripts are executable**
  ```bash
  # Command to validate:
  find scripts/ -name "*.sh" -type f -executable | wc -l
  find scripts/ -name "*.sh" -type f | wc -l
  
  # Expected output: Both commands return same count (all scripts executable)
  ```

- [ ] **Script documentation includes usage examples**
  ```bash
  # Command to validate:
  for script in scripts/*.sh; do
    head -20 "$script" | grep -q "Usage:\|Example:" || echo "Missing docs: $script"
  done
  
  # Expected output: No missing documentation messages
  ```

- [ ] **Help options work for all scripts**
  ```bash
  # Command to validate:
  ./scripts/deployment-automation.sh --help
  ./scripts/generate-secrets.sh --help
  
  # Expected output: Helpful usage information for each script
  ```

### 2.3 Troubleshooting and Support Documentation
**Objective:** Verify comprehensive troubleshooting resources exist

- [ ] **Troubleshooting guide covers common issues**
  ```bash
  # Command to validate:
  test -f docs/deployment/TROUBLESHOOTING_GUIDE.md
  grep -c "##\|Problem:\|Solution:" docs/deployment/TROUBLESHOOTING_GUIDE.md
  
  # Expected output: File exists with 20+ documented issues and solutions
  ```

- [ ] **Prerequisites checklist is actionable**
  ```bash
  # Command to validate:
  test -f docs/deployment/PREREQUISITES_CHECKLIST.md
  grep -c "- \[ \]" docs/deployment/PREREQUISITES_CHECKLIST.md
  
  # Expected output: File exists with 15+ actionable checklist items
  ```

---

## ✅ SECTION 3: Configuration Validation

### 3.1 Environment Template Validation
**Objective:** Ensure .env.example includes all required variables from audit

- [ ] **All 27+ critical missing variables added to .env.example**
  ```bash
  # Command to validate:
  critical_vars="NEXTAUTH_SECRET ENCRYPTION_KEY CSRF_SECRET METRICS_TOKEN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM YOUTUBE_API_KEY TMDB_API_KEY OVERSEERR_URL OVERSEERR_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY SENTRY_DSN JAEGER_ENDPOINT"
  
  for var in $critical_vars; do
    grep -q "^$var=" .env.example || echo "Missing: $var"
  done
  
  # Expected output: No missing variable messages
  ```

- [ ] **Variable grouping and documentation clear**
  ```bash
  # Command to validate:
  grep -c "^# =====\|^# .*CONFIGURATION" .env.example
  
  # Expected output: 8+ section headers organizing variables by category
  ```

- [ ] **Required vs optional variables clearly marked**
  ```bash
  # Command to validate:
  grep -c "REQUIRED\|OPTIONAL" .env.example
  
  # Expected output: 50+ variables marked as required or optional
  ```

### 3.2 Docker Configuration Compliance
**Objective:** Verify Docker configurations match code requirements

- [ ] **Service dependencies correctly configured**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.prod.yml config | grep -A 10 "depends_on:"
  
  # Expected output: Backend depends on postgres and redis with health conditions
  ```

- [ ] **Resource limits appropriate for deployment**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.prod.yml config | grep -A 5 "deploy:"
  
  # Expected output: Memory limits (1G backend, 512M frontend), CPU limits defined
  ```

- [ ] **Health checks configured for all services**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.prod.yml config | grep -c "healthcheck:"
  
  # Expected output: 4+ health checks configured
  ```

### 3.3 External Service Dependencies
**Objective:** Ensure all external service dependencies are documented

- [ ] **All external APIs documented with examples**
  ```bash
  # Command to validate:
  grep -A 2 -B 1 "API_KEY\|_URL.*=" .env.example | grep -c "# Example\|# Get from"
  
  # Expected output: 10+ external services have documentation examples
  ```

- [ ] **Graceful degradation documented for optional services**
  ```bash
  # Command to validate:
  grep -c "OPTIONAL\|graceful" docs/CONFIGURATION_AUDIT.md
  
  # Expected output: 5+ references to optional services and graceful degradation
  ```

- [ ] **Service integration tests exist**
  ```bash
  # Command to validate:
  find tests/ -name "*integration*" -type f | grep -c "service\|external"
  
  # Expected output: 3+ integration test files for external services
  ```

---

## ✅ SECTION 4: Testing Requirements

### 4.1 Local Deployment Test
**Objective:** Verify complete local deployment works successfully

- [ ] **Clean deployment from scratch succeeds**
  ```bash
  # Command sequence to validate:
  docker system prune -af
  docker volume prune -f
  ./scripts/deployment-automation.sh deploy --environment=development
  
  # Expected outcome: Complete deployment successful within 10 minutes
  # Validation: All services respond to health checks
  ```

- [ ] **All services start in correct order**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.dev.yml up -d
  sleep 60
  docker compose ps --format table
  
  # Expected output: postgres and redis start first, then backend, then frontend
  # All services show "Up" status
  ```

- [ ] **Service-to-service communication works**
  ```bash
  # Command to validate:
  docker compose exec backend curl -f http://postgres:5432 2>/dev/null; echo "DB: $?"
  docker compose exec backend curl -f http://redis:6379 2>/dev/null; echo "Redis: $?"
  docker compose exec frontend curl -f http://backend:4000/api/health
  
  # Expected output: All connections succeed (exit code 0)
  ```

### 4.2 Service Accessibility and Functionality
**Objective:** Verify all services are accessible and functional

- [ ] **Web interface accessible**
  ```bash
  # Command to validate:
  curl -I http://localhost:3000
  
  # Expected output: HTTP 200 OK status
  # Additional check: Page loads in browser with no console errors
  ```

- [ ] **API endpoints respond correctly**
  ```bash
  # Command to validate:
  curl -f http://localhost:4000/api/health
  curl -f http://localhost:4000/api/version
  
  # Expected output: JSON responses with health status and version information
  ```

- [ ] **Database connection functional**
  ```bash
  # Command to validate:
  docker compose exec backend npx prisma db push --accept-data-loss
  
  # Expected output: Database schema created successfully
  ```

### 4.3 Database Operations
**Objective:** Ensure database migrations and operations work correctly

- [ ] **Database migrations execute without errors**
  ```bash
  # Command to validate:
  docker compose exec backend npx prisma migrate deploy
  
  # Expected output: All migrations applied successfully
  # No "failed" or "error" messages in output
  ```

- [ ] **Database seeding works (if applicable)**
  ```bash
  # Command to validate:
  docker compose exec backend npm run seed
  
  # Expected output: Seed data created successfully
  # Or: Clear message if seeding not applicable
  ```

- [ ] **Database backup and restore functional**
  ```bash
  # Command to validate:
  ./scripts/deployment-automation.sh backup --test
  ./scripts/deployment-automation.sh restore --test --latest
  
  # Expected output: Backup and restore operations complete successfully
  ```

### 4.4 SSL Configuration Testing (If Applicable)
**Objective:** Verify SSL configuration works in testing scenarios

- [ ] **Self-signed certificate generation works**
  ```bash
  # Command to validate:
  SSL_MODE=self-signed ./scripts/generate-secrets.sh
  ls -la secrets/ | grep -E "\.crt|\.key"
  
  # Expected output: SSL certificate and key files created
  ```

- [ ] **HTTPS redirection configured**
  ```bash
  # Command to validate (if SSL enabled):
  curl -I http://localhost | grep -i location
  
  # Expected output: Redirect to HTTPS URL (if SSL configured)
  ```

---

## ✅ SECTION 5: Human Review Preparation

### 5.1 Version Control Readiness
**Objective:** Ensure all changes are properly committed and organized

- [ ] **All changes committed to develop branch**
  ```bash
  # Command to validate:
  git status --porcelain
  
  # Expected output: No uncommitted changes (empty output)
  ```

- [ ] **Commit messages are clear and descriptive**
  ```bash
  # Command to validate:
  git log --oneline -10
  
  # Expected output: Clear, descriptive commit messages following conventional format
  # No "WIP", "temp", or "fix" commits without explanation
  ```

- [ ] **No sensitive data committed to repository**
  ```bash
  # Command to validate:
  git log --patch -10 | grep -i "password\|secret\|key" | grep -v "example\|template"
  
  # Expected output: No sensitive values found in recent commits
  ```

- [ ] **All new files properly tracked**
  ```bash
  # Command to validate:
  git ls-files --others --exclude-standard
  
  # Expected output: Only expected untracked files (like logs, temp files)
  # Ensure all documentation and configuration files are tracked
  ```

### 5.2 Merge Conflict Prevention
**Objective:** Ensure clean merge to staging branch

- [ ] **Develop branch up-to-date with main**
  ```bash
  # Command to validate:
  git fetch origin
  git log --oneline origin/main..develop
  
  # Expected output: Clear view of commits that will be merged
  # Resolution: Rebase if necessary to clean up history
  ```

- [ ] **No merge conflicts with staging branch**
  ```bash
  # Command to validate:
  git fetch origin
  git merge-tree $(git merge-base HEAD origin/staging) HEAD origin/staging
  
  # Expected output: No conflict markers (<<<<<<<, =======, >>>>>>>)
  ```

### 5.3 Documentation Completeness for Review
**Objective:** Provide reviewers with comprehensive context

- [ ] **CHANGELOG.md updated with all changes**
  ```bash
  # Command to validate:
  test -f CHANGELOG.md
  grep -A 10 "## \[Unreleased\]" CHANGELOG.md | grep -c "- "
  
  # Expected output: 5+ new changes documented in changelog
  ```

- [ ] **Pull request template information prepared**
  ```bash
  # Create summary for PR description:
  cat > PR_SUMMARY.md << EOF
  ## Summary
  - Complete configuration audit remediation
  - Docker configuration optimization and security hardening
  - Comprehensive deployment documentation
  - Environment variable consolidation and validation
  
  ## Changes Made
  - Added 27+ missing critical environment variables to .env.example
  - Implemented security configuration recommendations
  - Created comprehensive deployment documentation
  - Enhanced Docker configurations with production-grade security
  - Implemented configuration validation and testing procedures
  
  ## Testing Completed
  - Local deployment validation
  - Docker configuration testing
  - Environment variable validation
  - Security configuration verification
  - Documentation completeness review
  EOF
  
  # Expected output: PR summary file created
  ```

---

## ✅ SECTION 6: Production Deployment Readiness

### 6.1 Critical Gap Resolution
**Objective:** Verify all critical gaps from audit are addressed

- [ ] **All 27 critical missing environment variables addressed**
  ```bash
  # Command to validate:
  ./scripts/validate-critical-config.sh
  
  # Expected output: "✅ All critical configuration gaps resolved"
  ```

- [ ] **Security vulnerabilities resolved**
  ```bash
  # Command to validate:
  docker run --rm -v $(pwd):/app securecodewarrior/docker-security-scanner /app
  
  # Expected output: No critical or high severity security issues
  ```

- [ ] **Production configuration validated**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.prod.yml config --quiet
  ./scripts/deployment-automation.sh validate --environment=production
  
  # Expected output: No configuration errors, all validations pass
  ```

### 6.2 Performance and Monitoring
**Objective:** Ensure monitoring and performance considerations are met

- [ ] **Resource monitoring configured**
  ```bash
  # Command to validate:
  grep -c "prometheus\|grafana\|monitoring" config/docker/docker-compose.prod.yml
  
  # Expected output: 10+ references to monitoring configuration
  ```

- [ ] **Performance benchmarks documented**
  ```bash
  # Command to validate:
  grep -A 5 -B 5 "Performance\|Benchmark" docs/deployment/README.md
  
  # Expected output: Performance targets and optimization techniques documented
  ```

- [ ] **Alerting and notification configured**
  ```bash
  # Command to validate:
  find config/ -name "*alert*" -o -name "*notification*" | wc -l
  
  # Expected output: 2+ alerting configuration files
  ```

### 6.3 Backup and Recovery
**Objective:** Verify backup and disaster recovery procedures are ready

- [ ] **Automated backup procedures verified**
  ```bash
  # Command to validate:
  ./scripts/deployment-automation.sh backup --dry-run
  
  # Expected output: Backup procedures execute without errors
  ```

- [ ] **Recovery procedures documented and tested**
  ```bash
  # Command to validate:
  test -f docs/deployment/DISASTER_RECOVERY.md
  grep -c "Recovery\|Restore" docs/deployment/DISASTER_RECOVERY.md
  
  # Expected output: Recovery documentation exists with 10+ recovery procedures
  ```

- [ ] **Data persistence verified**
  ```bash
  # Command to validate:
  docker volume ls | grep -c medianest
  
  # Expected output: 4+ persistent volumes configured for data
  ```

### 6.4 Security Hardening Final Check
**Objective:** Final security validation before production deployment

- [ ] **Container security scan passes**
  ```bash
  # Command to validate:
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image medianest:latest
  
  # Expected output: No HIGH or CRITICAL vulnerabilities
  ```

- [ ] **Network security configuration verified**
  ```bash
  # Command to validate:
  docker compose -f config/docker/docker-compose.prod.yml config | grep -A 5 "networks:"
  
  # Expected output: Proper network isolation configured
  ```

- [ ] **Secrets management fully implemented**
  ```bash
  # Command to validate:
  ls -la secrets/
  find secrets/ -name "*.txt" -exec wc -c {} \; | grep -v " 0 "
  
  # Expected output: All required secret files present and non-empty
  ```

---

## 🎯 VALIDATION COMMANDS SUMMARY

### Quick Validation Script
Create and run this comprehensive validation script:

```bash
#!/bin/bash
# PRE_MERGE_VALIDATION.sh - Complete pre-merge validation

echo "🚀 Starting Pre-Merge Validation..."

# Section 1: Docker Validation
echo "📦 Docker Configuration Validation..."
docker compose -f config/docker/docker-compose.dev.yml config --quiet && echo "✅ Dev config valid" || echo "❌ Dev config invalid"
docker compose -f config/docker/docker-compose.prod.yml config --quiet && echo "✅ Prod config valid" || echo "❌ Prod config invalid"

# Section 2: Environment Validation
echo "⚙️ Environment Configuration Validation..."
test -f .env.example && echo "✅ .env.example exists" || echo "❌ .env.example missing"
test -f .env.production.example && echo "✅ .env.production.example exists" || echo "❌ .env.production.example missing"

# Section 3: Documentation Validation
echo "📚 Documentation Validation..."
test -f docs/CONFIGURATION_AUDIT.md && echo "✅ Configuration audit exists" || echo "❌ Configuration audit missing"
test -f docs/DOCKER_CONFIGURATION_ANALYSIS.md && echo "✅ Docker analysis exists" || echo "❌ Docker analysis missing"
test -f README_DEPLOYMENT.md && echo "✅ Deployment guide exists" || echo "❌ Deployment guide missing"

# Section 4: Security Validation
echo "🔒 Security Validation..."
if [ -d secrets/ ]; then
    echo "✅ Secrets directory exists"
    ls secrets/*.txt > /dev/null 2>&1 && echo "✅ Secret files present" || echo "❌ Secret files missing"
else
    echo "❌ Secrets directory missing"
fi

# Section 5: Git Validation
echo "📋 Git Repository Validation..."
git status --porcelain | wc -l | grep -q "^0$" && echo "✅ No uncommitted changes" || echo "❌ Uncommitted changes exist"

echo "✨ Pre-Merge Validation Complete!"
```

### Critical Environment Variables Validation
```bash
#!/bin/bash
# validate-critical-config.sh

CRITICAL_VARS=(
    "NEXTAUTH_SECRET"
    "ENCRYPTION_KEY"
    "CSRF_SECRET"
    "METRICS_TOKEN"
    "SMTP_HOST"
    "SMTP_USER"
    "SMTP_PASSWORD"
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
)

echo "🔍 Validating Critical Environment Variables..."

for var in "${CRITICAL_VARS[@]}"; do
    if grep -q "^$var=" .env.example; then
        echo "✅ $var documented"
    else
        echo "❌ $var missing from .env.example"
    fi
done
```

---

## 📈 SUCCESS CRITERIA

### All Sections Must Pass
- **Section 1 (Developer Self-Validation)**: 100% completion required
- **Section 2 (Documentation Completeness)**: 100% completion required  
- **Section 3 (Configuration Validation)**: 100% completion required
- **Section 4 (Testing Requirements)**: 100% completion required
- **Section 5 (Human Review Preparation)**: 100% completion required
- **Section 6 (Production Deployment Readiness)**: 100% completion required

### Performance Benchmarks
- Docker build time: < 10 minutes
- Container startup time: < 5 minutes
- All health checks pass within 2 minutes
- No memory leaks during 30-minute test run

### Security Standards
- No HIGH or CRITICAL vulnerabilities in container scans
- All secrets properly managed (no hardcoded values)
- Network isolation properly configured
- Container security hardening implemented

---

## 🚨 FAILURE PROTOCOLS

### If Any Check Fails:
1. **STOP** - Do not proceed with merge
2. **Document** the specific failure in GitHub issue
3. **Fix** the underlying issue  
4. **Re-run** the complete checklist
5. **Update** documentation if process gaps identified

### Emergency Override Process:
Only for critical hotfixes - requires:
- Senior developer approval
- Documented risk assessment
- Immediate follow-up issue created
- Post-merge remediation plan

---

**✅ This checklist ensures MediaNest's develop branch meets enterprise-grade standards for security, reliability, and operational excellence before human review and staging deployment.**