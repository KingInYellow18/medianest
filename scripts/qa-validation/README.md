# 4-Tier Workflow QA Validation Suite

**Designed by QA Coordinator Agent**

## Overview

This comprehensive testing and validation framework ensures the safe and reliable implementation of MediaNest's 4-tier workflow reorganization (main → development → test → claude-flowv2).

## Quick Start

### 1. Run Comprehensive Validation

```bash
# Run all validation tests
./scripts/qa-validation/run-comprehensive-workflow-tests.sh

# Run specific test suite
./scripts/qa-validation/run-comprehensive-workflow-tests.sh --suite branch-structure
```

### 2. Individual Test Suites

```bash
# Test branch structure and configuration
./scripts/qa-validation/test-branch-structure.sh

# Test merge workflow functionality  
./scripts/qa-validation/test-merge-workflow.sh

# Test environment deployment readiness
./scripts/qa-validation/test-environment-deployment.sh

# Test rollback and recovery procedures
./scripts/qa-validation/test-rollback-procedures.sh
```

### 3. Setup Monitoring

```bash
# Install monitoring and alerting system
./scripts/qa-validation/workflow-monitoring-setup.sh
```

## Test Categories

### 🏗️ Branch Structure Validation
**Script**: `test-branch-structure.sh`

- ✅ Validates 4-tier branch existence (main, development, test, claude-flowv2)
- ✅ Tests branch protection rules
- ✅ Verifies environment mapping and configurations
- ✅ Validates gitignore system per branch
- ✅ Checks CI/CD workflow files

**Key Tests**:
- Branch accessibility and remote synchronization
- Protection rule enforcement
- Environment-specific configuration files
- Branch-specific gitignore functionality

### 🔄 Merge Workflow Testing
**Script**: `test-merge-workflow.sh`

- ✅ Tests feature → development workflow
- ✅ Validates development → test promotion
- ✅ Verifies test → main production promotion
- ✅ Tests hotfix workflow (main → development back-merge)
- ✅ Validates commit history preservation

**Key Tests**:
- End-to-end merge flow simulation
- Conflict resolution procedures
- Production promotion readiness checks
- Emergency hotfix deployment capability

### 🌍 Environment Deployment Testing
**Script**: `test-environment-deployment.sh`

- ✅ Validates environment-specific configurations
- ✅ Tests deployment readiness for each branch
- ✅ Verifies service health check endpoints
- ✅ Validates security configurations
- ✅ Tests performance optimizations

**Key Tests**:
- Environment file validation (.env.production, .env.staging, etc.)
- Docker configuration and build readiness
- Database connectivity and configuration
- Security audit and dependency scanning

### ⏪ Rollback Procedures Testing
**Script**: `test-rollback-procedures.sh`

- ✅ Tests git rollback capabilities (soft rollback, revert commits)
- ✅ Validates deployment rollback procedures
- ✅ Tests database rollback and point-in-time recovery
- ✅ Verifies configuration rollback procedures
- ✅ Tests disaster recovery capabilities

**Key Tests**:
- Git history rollback simulation
- Blue-green deployment rollback capability
- Database migration rollback procedures
- Complete repository backup and restore

### 📊 Monitoring and Alerting
**Script**: `workflow-monitoring-setup.sh`

- ✅ Sets up GitHub Actions workflow monitoring
- ✅ Configures alerting rules and thresholds
- ✅ Creates monitoring dashboards
- ✅ Implements continuous health checks
- ✅ Sets up anomaly detection

**Key Components**:
- Real-time workflow health monitoring
- Slack/email/GitHub issue notifications
- Performance metrics collection
- Security compliance monitoring

## Validation Results

### 📊 Comprehensive Report

Each test run generates:
- **JSON Report**: Machine-readable validation results
- **Markdown Report**: Human-readable summary with recommendations
- **Individual Logs**: Detailed output for each test suite
- **Artifacts**: Test evidence and debugging information

### 🎯 Quality Gates

#### ✅ PASS Criteria
- All 4 required branches accessible and protected
- Merge workflow success rate >90%
- Environment configurations complete
- Rollback procedures validated
- Monitoring system operational

#### ⚠️ WARNING Criteria  
- Merge success rate 80-90%
- Missing non-critical configuration files
- Limited rollback documentation
- Partial monitoring coverage

#### ❌ FAIL Criteria
- Missing required branches
- Merge workflow success rate <80%
- Critical security issues
- Rollback procedures non-functional
- No monitoring capabilities

## Usage Examples

### Pre-Migration Validation
```bash
# Full validation before implementing 4-tier workflow
./scripts/qa-validation/run-comprehensive-workflow-tests.sh

# Check results
cat /tmp/qa-validation-results-*/comprehensive-validation-report.md
```

### Post-Migration Verification
```bash
# Verify workflow after reorganization
./scripts/qa-validation/test-merge-workflow.sh
./scripts/qa-validation/test-environment-deployment.sh

# Setup monitoring for ongoing health
./scripts/qa-validation/workflow-monitoring-setup.sh
```

### Troubleshooting Failed Tests
```bash
# Run specific failing test with verbose output
./scripts/qa-validation/test-branch-structure.sh

# Check detailed logs
ls /tmp/qa-validation-results-*/
cat /tmp/qa-validation-results-*/branch-structure-output.log
```

### Continuous Monitoring
```bash
# Manual health check
./infrastructure/monitoring/scripts/health-check.sh

# Collect current metrics
./infrastructure/monitoring/scripts/collect-metrics.sh
```

## Integration with CI/CD

### GitHub Actions Integration
The monitoring setup automatically creates GitHub Actions workflows:
- `workflow-health-check.yml`: Regular health monitoring
- `continuous-monitoring.yml`: Real-time anomaly detection

### Local Development Integration
```bash
# Add to git hooks for pre-push validation
echo "./scripts/qa-validation/test-merge-workflow.sh" >> .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Customization

### Adjusting Test Thresholds
Edit the scripts to modify validation criteria:

```bash
# In test-merge-workflow.sh, adjust success rate threshold
success_rate_threshold=85  # Default: 80

# In test-branch-structure.sh, add custom branch requirements
required_branches=("main" "development" "test" "claude-flowv2" "hotfix")
```

### Custom Monitoring Rules
Edit `infrastructure/monitoring/alert_rules.yml` to customize:
- Alert thresholds
- Notification channels  
- Escalation procedures
- Maintenance windows

## Best Practices

### Before Running Tests
1. **Backup current state**: Ensure git repository is backed up
2. **Clean working directory**: Commit or stash uncommitted changes
3. **Update branches**: Fetch latest changes from remote
4. **Check permissions**: Ensure scripts are executable

### Interpreting Results
1. **Review comprehensive report**: Start with the markdown summary
2. **Investigate failures**: Check individual test logs for details
3. **Address critical issues**: Fix failures before proceeding
4. **Monitor warnings**: Plan to address non-critical issues

### After Validation
1. **Implement monitoring**: Set up continuous health monitoring
2. **Document procedures**: Update team documentation with findings
3. **Train team**: Ensure team understands new workflow procedures
4. **Schedule regular checks**: Run validation periodically

## Troubleshooting

### Common Issues

#### Script Permission Denied
```bash
chmod +x scripts/qa-validation/*.sh
```

#### Git Branch Access Issues
```bash
git fetch origin
git branch -a  # Verify all branches exist
```

#### Missing Dependencies
```bash
# Install required tools
sudo apt-get update
sudo apt-get install jq curl git

# For macOS
brew install jq curl git
```

#### Test Failures Due to Local Changes
```bash
# Stash local changes temporarily
git stash
./scripts/qa-validation/run-comprehensive-workflow-tests.sh
git stash pop
```

### Getting Help

1. **Check test logs**: Review detailed output in results directory
2. **Run individual tests**: Isolate failing components
3. **Verify prerequisites**: Ensure git repository and branches exist
4. **Contact QA team**: Escalate persistent issues

## File Structure

```
scripts/qa-validation/
├── README.md                              # This documentation
├── run-comprehensive-workflow-tests.sh    # Master test runner
├── test-branch-structure.sh              # Branch validation
├── test-merge-workflow.sh                # Merge workflow testing
├── test-environment-deployment.sh        # Environment validation
├── test-rollback-procedures.sh           # Rollback testing
└── workflow-monitoring-setup.sh          # Monitoring setup

infrastructure/monitoring/
├── README.md                             # Monitoring documentation
├── alert_rules.yml                       # Alerting configuration
├── dashboards/                           # Dashboard configs
└── scripts/                              # Health check utilities

.github/workflows/monitoring/
├── workflow-health-check.yml             # GitHub Actions monitoring
└── continuous-monitoring.yml             # Real-time monitoring
```

## Success Criteria

### ✅ Ready for Production
- All comprehensive tests pass (0 critical failures)
- Monitoring system operational
- Team trained on new procedures
- Rollback procedures validated

### 🎯 Quality Score: 95%+
- Branch structure: 100% compliant
- Merge workflow: >95% success rate
- Environment configs: Complete
- Security validation: No critical issues
- Monitoring coverage: Comprehensive

---

**Created by QA Coordinator Agent for MediaNest 4-Tier Workflow**  
*Comprehensive testing framework ensuring safe workflow reorganization*