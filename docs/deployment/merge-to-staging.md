# MERGE TO STAGING - COMPREHENSIVE INSTRUCTIONS

## CRITICAL WARNING ⚠️

This document contains precise instructions for merging develop branch to staging. **Follow these instructions EXACTLY** - deviation could result in production deployment failures or data loss.

---

## SECTION 1: Pre-Merge Preparation

### 1.1 Verification Checklist

**MANDATORY - Complete ALL items before proceeding:**

```bash
# Check current branch and status
git status
git branch -v

# Verify you are on develop branch
if [ "$(git branch --show-current)" != "develop" ]; then
    echo "ERROR: Must be on develop branch"
    exit 1
fi

# Ensure develop is clean and up-to-date
git fetch origin
git status --porcelain | wc -l  # Should return 0 for clean state
```

**Expected Output:**
- Current branch: `develop`
- Working tree: clean (no uncommitted changes)
- Branch status: up to date with origin/develop

### 1.2 Documentation Verification

**Verify all critical documentation exists:**

```bash
# Check for required deployment documentation
ls -la docs/deployment/
ls -la README_DEPLOYMENT.md
ls -la docs/CONFIGURATION_AUDIT.md
ls -la docs/DOCKER_CONFIGURATION_ANALYSIS.md

# Verify MkDocs configuration
mkdocs build --clean --strict --config-file mkdocs.yml
```

**Expected Files Present:**
- ✅ `docs/deployment/` directory with deployment configurations
- ✅ `README_DEPLOYMENT.md` - Primary deployment guide
- ✅ `docs/CONFIGURATION_AUDIT.md` - Configuration audit results
- ✅ `docs/DOCKER_CONFIGURATION_ANALYSIS.md` - Docker setup analysis
- ✅ `scripts/deployment-automation.sh` - Deployment automation
- ✅ `scripts/generate-secrets.sh` - Secret generation utility

### 1.3 Backup Procedures

**Create comprehensive backup before merge:**

```bash
# Create timestamped backup branch
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_BRANCH="backup/pre-staging-merge-$TIMESTAMP"

git checkout -b $BACKUP_BRANCH
git push -u origin $BACKUP_BRANCH

# Return to develop
git checkout develop

# Create backup of critical files
mkdir -p backups/pre-staging-merge-$TIMESTAMP
cp -r docs/ backups/pre-staging-merge-$TIMESTAMP/
cp -r scripts/ backups/pre-staging-merge-$TIMESTAMP/
cp README_DEPLOYMENT.md backups/pre-staging-merge-$TIMESTAMP/
cp mkdocs*.yml backups/pre-staging-merge-$TIMESTAMP/

echo "Backup completed: $BACKUP_BRANCH"
echo "File backup: backups/pre-staging-merge-$TIMESTAMP/"
```

### 1.4 Team Coordination

**Communication Protocol:**

1. **Notify stakeholders** of impending staging merge
2. **Lock develop branch** to prevent concurrent changes
3. **Coordinate with operations team** for staging environment readiness
4. **Schedule rollback window** (minimum 2 hours)

**Slack/Email Notification Template:**
```
🚨 STAGING MERGE INITIATED

Branch: develop → staging
Timestamp: $(date)
Backup: backup/pre-staging-merge-$TIMESTAMP
Estimated Duration: 30-60 minutes
Rollback Window: 2 hours

DO NOT MERGE TO DEVELOP DURING THIS PROCESS
```

---

## SECTION 2: Step-by-Step Merge Instructions

### 2.1 Pre-Merge Validation

**Execute comprehensive validation:**

```bash
# Run complete test suite
npm run test:all || {
    echo "CRITICAL ERROR: Tests failing - ABORT MERGE"
    exit 1
}

# Validate Docker configuration
./validate-docker-setup.sh || {
    echo "CRITICAL ERROR: Docker validation failed - ABORT MERGE"
    exit 1
}

# Check for security vulnerabilities
npm audit --audit-level=high || {
    echo "WARNING: Security vulnerabilities detected - Review required"
    read -p "Continue with merge? (y/N): " -n 1 -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
}

# Validate MkDocs build
mkdocs build --clean --strict || {
    echo "CRITICAL ERROR: Documentation build failed - ABORT MERGE"
    exit 1
}
```

### 2.2 Execute Merge to Staging

**CRITICAL: Execute these commands in exact order:**

```bash
# Step 1: Fetch latest changes
git fetch origin

# Step 2: Switch to staging branch
git checkout staging
git pull origin staging

# Step 3: Verify staging branch state
echo "Current staging commit:"
git log --oneline -n 5

# Step 4: Execute merge (NO FAST-FORWARD to maintain history)
git merge --no-ff develop -m "chore: merge develop to staging for deployment validation

- Complete documentation overhaul with MkDocs Material
- Enhanced deployment automation and configuration
- Security updates and vulnerability fixes
- Performance optimizations and testing improvements
- Comprehensive Docker configuration analysis

🚨 STAGING DEPLOYMENT - REQUIRES VALIDATION BEFORE PRODUCTION

Merged from: develop ($(git rev-parse develop))
Backup: backup/pre-staging-merge-$(date +"%Y%m%d-%H%M%S")

🤖 Generated with Claude Code (https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Expected Success Output:**
```
Merge made by the 'recursive' strategy.
[List of changed files]
```

### 2.3 Conflict Resolution Strategies

**If merge conflicts occur:**

```bash
# Check conflict status
git status

# For documentation conflicts (common with parallel updates):
# 1. Review conflicted files
git diff --name-only --diff-filter=U

# 2. For each conflicted file:
# Manual resolution required - prioritize develop branch changes for:
# - Configuration files
# - Documentation updates
# - Security improvements

# 3. After resolving conflicts:
git add [resolved-files]
git commit -m "resolve: merge conflicts in staging deployment

Resolved conflicts in:
- [list files]

Prioritized develop branch changes for configuration and security updates."

# 4. Verify resolution
git log --oneline -n 3
```

### 2.4 Push Staging Branch

**Push merged changes to remote:**

```bash
# Push staging branch
git push origin staging

# Verify push success
git log --oneline origin/staging -n 5

# Create merge tag for tracking
MERGE_TAG="staging-merge-$(date +"%Y%m%d-%H%M%S")"
git tag -a $MERGE_TAG -m "Staging merge: develop → staging $(date)"
git push origin $MERGE_TAG

echo "Staging merge completed successfully"
echo "Merge tag: $MERGE_TAG"
```

---

## SECTION 3: Post-Merge Verification

### 3.1 Merge Success Verification

**Verify merge integrity:**

```bash
# Check merge commit exists
git log --oneline --merges -n 5

# Verify file changes
git diff HEAD~1 --name-only | head -20

# Confirm all expected files present
CRITICAL_FILES=(
    "README_DEPLOYMENT.md"
    "docs/CONFIGURATION_AUDIT.md"
    "docs/DOCKER_CONFIGURATION_ANALYSIS.md"
    "scripts/deployment-automation.sh"
    "scripts/generate-secrets.sh"
    "mkdocs.yml"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "CRITICAL ERROR: Missing file: $file"
        exit 1
    else
        echo "✅ Verified: $file"
    fi
done
```

### 3.2 Documentation Validation in Staging

**Validate documentation builds correctly:**

```bash
# Clean build test
rm -rf site/
mkdocs build --clean --strict --config-file mkdocs.yml

# Verify critical pages exist
CRITICAL_PAGES=(
    "site/index.html"
    "site/deployment/index.html"
    "site/configuration/index.html"
    "site/docker/index.html"
)

for page in "${CRITICAL_PAGES[@]}"; do
    if [ ! -f "$page" ]; then
        echo "ERROR: Missing documentation page: $page"
    else
        echo "✅ Documentation page exists: $page"
    fi
done

# Test documentation server (optional - for local validation)
# mkdocs serve --config-file mkdocs.yml &
# SERVER_PID=$!
# sleep 5
# curl -f http://localhost:8000 > /dev/null && echo "✅ Documentation server responding"
# kill $SERVER_PID
```

### 3.3 Configuration Verification

**Validate all configurations are correct:**

```bash
# Check environment configuration
if [ ! -f ".env.production.example" ]; then
    echo "ERROR: Missing production environment template"
    exit 1
fi

# Validate Docker configuration
docker-compose -f docker-swarm-stack.yml config > /dev/null || {
    echo "ERROR: Docker Swarm configuration invalid"
    exit 1
}

# Check deployment scripts are executable
chmod +x scripts/*.sh
ls -la scripts/*.sh | grep "^-rwx"

# Validate secret generation
./scripts/generate-secrets.sh --test || {
    echo "ERROR: Secret generation script failed"
    exit 1
}
```

---

## SECTION 4: Staging Deployment Instructions

### 4.1 Staging Environment Preparation

**Prepare staging environment for deployment:**

```bash
# Set staging environment variables
export DEPLOYMENT_ENV=staging
export MEDIANEST_ENV=staging

# Create staging secrets (if not exists)
if [ ! -f "secrets/staging.env" ]; then
    ./scripts/generate-secrets.sh --env staging
fi

# Backup current staging deployment (if exists)
STAGING_BACKUP_DIR="backups/staging-backup-$(date +"%Y%m%d-%H%M%S")"
mkdir -p $STAGING_BACKUP_DIR

# Copy current staging configurations
cp -r deployment/staging/* $STAGING_BACKUP_DIR/ 2>/dev/null || true
```

### 4.2 Deploy to Staging Environment

**Execute staging deployment:**

```bash
# Method 1: Using deployment automation script
./scripts/deployment-automation.sh --environment staging --validate-only

# Review deployment plan
read -p "Proceed with staging deployment? (y/N): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./scripts/deployment-automation.sh --environment staging --deploy
fi

# Method 2: Manual Docker deployment (if automation fails)
# docker-compose -f deployment/staging/docker-compose.staging.yml up -d
```

**Expected Deployment Success Indicators:**
- ✅ All containers start successfully
- ✅ Database migrations complete
- ✅ Health checks pass
- ✅ Documentation site accessible
- ✅ API endpoints responding

### 4.3 Staging Validation Checklist

**Complete functional validation:**

```bash
# Health check endpoints
curl -f http://staging.medianest.com/health || echo "❌ Backend health check failed"
curl -f http://staging.medianest.com/api/v1/status || echo "❌ API status check failed"

# Documentation accessibility
curl -f http://docs.staging.medianest.com || echo "❌ Documentation site inaccessible"

# Database connectivity
# Run database connection test through API
curl -X GET http://staging.medianest.com/api/v1/system/db-status

# File upload functionality (if applicable)
# Test file upload endpoint

# Authentication flow (if applicable)
# Test login/logout functionality
```

### 4.4 Performance Testing

**Basic performance validation:**

```bash
# Load testing (if tools available)
if command -v ab &> /dev/null; then
    ab -n 100 -c 10 http://staging.medianest.com/ > performance-staging-test.log
    echo "Performance test completed - check performance-staging-test.log"
fi

# Memory usage check
docker stats --no-stream --format "{{.Container}}: {{.CPUPerc}} CPU, {{.MemUsage}} Memory"

# Disk usage check
df -h
docker system df
```

---

## SECTION 5: Production Readiness Assessment

### 5.1 Production Readiness Criteria

**Evaluate against production readiness checklist:**

#### ✅ Technical Requirements
- [ ] All staging tests pass
- [ ] Performance metrics within acceptable ranges
- [ ] Security scans complete with no critical vulnerabilities
- [ ] Database migrations tested and validated
- [ ] Backup and recovery procedures tested
- [ ] Monitoring and alerting configured
- [ ] SSL certificates valid and configured
- [ ] Load balancer configuration validated

#### ✅ Documentation Requirements  
- [ ] Deployment documentation complete and tested
- [ ] API documentation updated and accurate
- [ ] Configuration documentation validated
- [ ] Troubleshooting guides updated
- [ ] Runbook procedures documented
- [ ] Rollback procedures tested

#### ✅ Operational Requirements
- [ ] Staging environment mirrors production
- [ ] Infrastructure capacity validated
- [ ] DNS configuration prepared
- [ ] CDN configuration (if applicable)
- [ ] Third-party service integrations tested
- [ ] Compliance requirements met

### 5.2 Go/No-Go Decision Framework

**Decision Criteria Matrix:**

```bash
# Create assessment checklist
cat > production-readiness-assessment.md << 'EOF'
# Production Readiness Assessment

## Date: $(date)
## Staging Merge: [TAG NAME]
## Assessor: [NAME]

### CRITICAL BLOCKERS (Must be RESOLVED before production)
- [ ] All automated tests passing
- [ ] Security audit complete with no HIGH/CRITICAL vulnerabilities  
- [ ] Performance benchmarks meet production requirements
- [ ] Database migration successfully tested
- [ ] Rollback procedures validated

### HIGH PRIORITY (Should be resolved before production)
- [ ] Documentation completeness review
- [ ] Load testing under expected traffic
- [ ] Integration testing with all external services
- [ ] Monitoring dashboard functionality
- [ ] Error handling and logging verification

### MEDIUM PRIORITY (Can be addressed post-deployment with monitoring)
- [ ] Performance optimization opportunities identified
- [ ] User experience enhancements documented
- [ ] Additional monitoring metrics implementation
- [ ] Code quality improvements scheduled

## DECISION: GO / NO-GO
## JUSTIFICATION: [Detailed reasoning]
## SIGN-OFF: [Stakeholder signatures/approvals]
EOF

echo "Complete production-readiness-assessment.md before proceeding"
```

### 5.3 Production Deployment Preparation

**If GO decision reached:**

```bash
# Create production deployment branch
git checkout -b production-deploy-$(date +"%Y%m%d-%H%M%S")
git push -u origin production-deploy-$(date +"%Y%m%d-%H%M%S")

# Generate production secrets
./scripts/generate-secrets.sh --env production

# Validate production configuration
cp .env.production.example .env.production.staging-test
# Edit .env.production.staging-test with staging-like production values
# Test configuration validity

# Schedule production deployment window
# Prepare production deployment checklist
# Notify all stakeholders of deployment timeline
```

### 5.4 Risk Assessment and Mitigation

**Production deployment risks and mitigation strategies:**

#### 🔴 HIGH RISK
- **Database Migration Failure**
  - Mitigation: Full database backup, tested rollback procedure
  - Validation: Migration tested on production-like data volume

- **Third-party Service Integration Failure**  
  - Mitigation: Fallback configurations, circuit breakers implemented
  - Validation: All integrations tested in staging

- **Performance Degradation Under Load**
  - Mitigation: Auto-scaling configured, performance monitoring active
  - Validation: Load testing completed with realistic traffic patterns

#### 🟡 MEDIUM RISK
- **Configuration Errors**
  - Mitigation: Configuration validation scripts, infrastructure as code
  - Validation: All configurations tested in staging environment

- **SSL/TLS Certificate Issues**
  - Mitigation: Certificate automation, backup certificates ready
  - Validation: SSL configuration tested and validated

#### 🟢 LOW RISK
- **Documentation Gaps**
  - Mitigation: Comprehensive documentation review completed
  - Validation: Documentation tested by independent team member

---

## SECTION 6: Communication and Handoff

### 6.1 Stakeholder Notification Procedures

**Notification Timeline:**

#### Pre-Merge Notification (24 hours before)
```
Subject: [MEDIANEST] Staging Deployment Scheduled - [DATE]

Team,

Staging deployment scheduled for [DATE/TIME]:
- Branch: develop → staging
- Expected duration: 1-2 hours
- Validation period: 24-48 hours
- Production deployment target: [DATE]

Impact:
- Staging environment will be unavailable during deployment
- No develop branch changes during merge window
- Testing team should prepare validation procedures

Contacts:
- Technical Lead: [NAME/CONTACT]
- Operations: [NAME/CONTACT]  
- Project Manager: [NAME/CONTACT]
```

#### Merge Completion Notification
```
Subject: [MEDIANEST] Staging Deployment COMPLETE - Validation Phase

Team,

Staging deployment completed successfully:
- Merge completed: [TIMESTAMP]
- Staging environment: [URL]
- Documentation: [URL]
- Merge tag: [TAG]

Next Steps:
1. QA team: Begin staging validation
2. Operations: Monitor staging performance
3. Stakeholders: Review updated documentation
4. Development: Resume develop branch work

Validation deadline: [DATE/TIME]
Production go/no-go decision: [DATE/TIME]
```

### 6.2 Operations Team Handoff

**Handoff Package Contents:**

```bash
# Create handoff documentation package
mkdir -p handoff/operations-$(date +"%Y%m%d")
cd handoff/operations-$(date +"%Y%m%d")

# Copy critical operational documentation
cp ../../README_DEPLOYMENT.md ./
cp ../../docs/CONFIGURATION_AUDIT.md ./
cp ../../docs/DOCKER_CONFIGURATION_ANALYSIS.md ./
cp -r ../../scripts/ ./
cp -r ../../deployment/ ./

# Create handoff checklist
cat > OPERATIONS_HANDOFF_CHECKLIST.md << 'EOF'
# Operations Team Handoff Checklist

## Environment Information
- Staging URL: [URL]
- Documentation URL: [URL]  
- Monitoring Dashboard: [URL]
- Logging System: [URL]

## Critical Procedures
- [ ] Deployment automation script tested
- [ ] Rollback procedure documented and tested
- [ ] Monitoring alerts configured
- [ ] Backup procedures validated
- [ ] Secret management process documented

## Emergency Contacts
- Technical Lead: [CONTACT]
- Database Administrator: [CONTACT]
- Security Team: [CONTACT]
- Infrastructure Team: [CONTACT]

## Sign-off
Operations Team Lead: [SIGNATURE/DATE]
Technical Lead: [SIGNATURE/DATE]
EOF

echo "Operations handoff package created in handoff/operations-$(date +"%Y%m%d")/"
```

### 6.3 Training Requirements

**Mandatory Training Sessions:**

1. **Deployment Procedures Training**
   - Target: Operations and DevOps teams
   - Duration: 2 hours
   - Content: New deployment automation, rollback procedures

2. **Documentation Platform Training**
   - Target: All technical teams
   - Duration: 1 hour  
   - Content: New MkDocs documentation structure and usage

3. **Configuration Management Training**
   - Target: System administrators
   - Duration: 1 hour
   - Content: New configuration audit procedures and tools

### 6.4 Maintenance and Update Responsibilities

**Ongoing Responsibilities Matrix:**

| Component | Primary Owner | Secondary Owner | Update Frequency |
|-----------|---------------|------------------|------------------|
| Deployment Scripts | DevOps Team | Technical Lead | As needed |
| Documentation | Technical Writer | Development Team | Weekly |
| Configuration Audit | System Admin | Security Team | Monthly |
| Docker Configurations | DevOps Team | Backend Team | As needed |
| Security Procedures | Security Team | Technical Lead | Quarterly |

---

## ROLLBACK PROCEDURES 🚨

### Emergency Rollback (If Critical Issues Found)

```bash
# IMMEDIATE ROLLBACK - Execute if critical issues discovered

# Step 1: Stop staging deployment
docker-compose -f deployment/staging/docker-compose.staging.yml down

# Step 2: Reset staging branch to previous state
git checkout staging
LAST_KNOWN_GOOD=$(git log --format="%H" -n 1 HEAD~1)
git reset --hard $LAST_KNOWN_GOOD
git push --force-with-lease origin staging

# Step 3: Redeploy previous version
./scripts/deployment-automation.sh --environment staging --deploy --force

# Step 4: Notify stakeholders
echo "🚨 ROLLBACK EXECUTED - Staging returned to previous version"
echo "Reason: [DOCUMENT REASON]"
echo "Timestamp: $(date)"
```

### Post-Rollback Actions

1. **Document the failure** in incident report
2. **Analyze root cause** of deployment issues  
3. **Fix issues in develop branch** before retry
4. **Update rollback procedures** based on lessons learned
5. **Schedule post-mortem** within 24 hours

---

## SUCCESS CRITERIA VALIDATION ✅

**Merge is considered successful when ALL criteria are met:**

### Technical Validation
- [ ] Merge completed without conflicts
- [ ] All critical files present in staging branch
- [ ] Documentation builds without errors
- [ ] Staging environment deploys successfully
- [ ] All health checks pass
- [ ] Performance metrics within acceptable range

### Functional Validation  
- [ ] All API endpoints responding correctly
- [ ] Database connectivity verified
- [ ] File upload/download functionality works
- [ ] Authentication/authorization working
- [ ] Third-party integrations functional

### Operational Validation
- [ ] Monitoring systems active and alerting
- [ ] Logging collection functioning
- [ ] Backup procedures validated
- [ ] Rollback procedures tested
- [ ] Documentation accessible and accurate

### Stakeholder Sign-off
- [ ] QA team validation complete
- [ ] Operations team handoff complete  
- [ ] Security review passed
- [ ] Technical lead approval
- [ ] Project manager sign-off

---

## CONTACT INFORMATION 📞

### Emergency Contacts
- **Technical Lead**: [NAME] - [PHONE] - [EMAIL]
- **DevOps Lead**: [NAME] - [PHONE] - [EMAIL]  
- **Database Administrator**: [NAME] - [PHONE] - [EMAIL]
- **Security Team**: [NAME] - [PHONE] - [EMAIL]

### Escalation Path
1. Technical issues → Technical Lead
2. Infrastructure issues → DevOps Lead
3. Security concerns → Security Team
4. Business impact → Project Manager → Stakeholder Leadership

---

**Document Version**: 1.0  
**Last Updated**: September 9, 2025  
**Next Review**: After production deployment completion  
**Owner**: Release Engineering Team

---

⚠️ **CRITICAL REMINDER**: This merge affects production readiness. Ensure ALL procedures are followed exactly. When in doubt, STOP and consult with team leads before proceeding.