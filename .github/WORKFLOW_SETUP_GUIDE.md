# GitHub Workflow Automation Setup Guide

## 🚀 Quick Start

This guide will help you set up the comprehensive GitHub workflow automation system for PR management with multi-reviewer coordination.

## 📋 Prerequisites

Before setting up the workflows, ensure you have:

- [ ] Repository admin access
- [ ] GitHub Actions enabled
- [ ] Branch protection rules capability
- [ ] Secret management access
- [ ] Team/organization setup (optional but recommended)

## 🔧 Step-by-Step Setup

### Step 1: Repository Configuration

#### 1.1 Enable GitHub Actions

1. Go to your repository settings
2. Navigate to **Actions** → **General**
3. Under "Actions permissions", select **Allow all actions and reusable workflows**
4. Under "Workflow permissions", select **Read and write permissions**
5. Check **Allow GitHub Actions to create and approve pull requests**

#### 1.2 Configure Branch Protection Rules

Create protection rules for your main branches:

```bash
# Using GitHub CLI (recommended)
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Quality Gate Automation","PR Review Coordination"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null

# Repeat for development and test branches with adjusted requirements
```

Or configure via GitHub UI:
1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable "Require pull request reviews before merging"
4. Set required approving reviews: 2
5. Enable "Require status checks to pass before merging"
6. Add required status checks: `Quality Gate Automation`, `PR Review Coordination`

### Step 2: Team Setup (Optional but Recommended)

#### 2.1 Create Review Teams

Create teams for automated reviewer assignment:

```bash
# Create teams (requires organization admin)
gh api orgs/:org/teams --method POST --field name="backend-team" --field description="Backend code reviewers"
gh api orgs/:org/teams --method POST --field name="frontend-team" --field description="Frontend code reviewers"
gh api orgs/:org/teams --method POST --field name="devops-team" --field description="DevOps and infrastructure reviewers"
gh api orgs/:org/teams --method POST --field name="security-reviewers" --field description="Security-focused reviewers"
gh api orgs/:org/teams --method POST --field name="qa-team" --field description="Quality assurance reviewers"
```

#### 2.2 Configure CODEOWNERS

Create `.github/CODEOWNERS` file:

```bash
# Copy the existing CODEOWNERS file or create a new one
cp .github/CODEOWNERS.example .github/CODEOWNERS

# Edit to match your team structure
# Global code owners - all changes require review from maintainers
* @maintainers

# Backend specific ownership
/backend/ @backend-team @maintainers
/backend/src/controllers/ @backend-team @api-reviewers
/backend/src/services/ @backend-team @senior-backend

# Frontend specific ownership  
/frontend/ @frontend-team @maintainers
/frontend/src/components/ @frontend-team @ui-reviewers

# Shared code requires both teams
/shared/ @backend-team @frontend-team @maintainers

# Infrastructure and DevOps
/.github/ @devops-team @maintainers
/.github/workflows/ @devops-team @ci-cd-reviewers @security-reviewers
```

### Step 3: Secret Configuration

#### 3.1 Required Secrets

Set up the following repository secrets:

1. **GITHUB_TOKEN** (automatically provided by GitHub Actions)
2. **SLACK_WEBHOOK_URL** (optional - for Slack notifications)
3. **TEAMS_WEBHOOK_URL** (optional - for Microsoft Teams notifications)

#### 3.2 Setting Up Notification Webhooks

**For Slack:**
1. Go to your Slack workspace
2. Create a new app or use existing one
3. Enable Incoming Webhooks
4. Create webhook for desired channel
5. Add webhook URL to repository secrets as `SLACK_WEBHOOK_URL`

**For Microsoft Teams:**
1. Go to your Teams channel
2. Click "..." → Connectors → Incoming Webhook
3. Configure webhook with name and icon
4. Copy webhook URL
5. Add to repository secrets as `TEAMS_WEBHOOK_URL`

### Step 4: Workflow File Deployment

The workflow files should already be in place. Verify they exist:

```bash
ls -la .github/workflows/
# Should show:
# - pr-review-coordination.yml
# - quality-gate-automation.yml
# - notification-management.yml
# - pr-automation.yml
# - branch-protection.yml (if exists)
```

If workflows are missing, ensure they're properly committed to your repository.

### Step 5: Label Configuration

#### 5.1 Create Required Labels

Create labels used by the automation system:

```bash
# Quality and status labels
gh label create "quality-gate-passed" --color "0E8A16" --description "All quality gates have passed"
gh label create "quality-gate-failed" --color "D93F0B" --description "Quality gates need attention"
gh label create "needs-review" --color "FBCA04" --description "PR needs review"
gh label create "ready-to-merge" --color "0E8A16" --description "PR is ready to merge"
gh label create "needs-changes" --color "D93F0B" --description "PR needs changes based on review"

# Complexity labels
gh label create "complexity:low" --color "C5DEF5" --description "Low complexity change"
gh label create "complexity:medium" --color "BFD4F2" --description "Medium complexity change"  
gh label create "complexity:high" --color "B60205" --description "High complexity change"

# Priority labels
gh label create "priority:high" --color "D93F0B" --description "High priority"
gh label create "priority:medium" --color "FBCA04" --description "Medium priority"
gh label create "priority:low" --color "0E8A16" --description "Low priority"

# Automation labels
gh label create "auto-merge" --color "7F0799" --description "Eligible for auto-merge"
gh label create "notification" --color "5319E7" --description "Automated notification"
gh label create "review-coordination-active" --color "1D76DB" --description "Review coordination is active"
```

### Step 6: Testing the Setup

#### 6.1 Test Workflow Triggers

Create a test PR to verify workflows:

```bash
# Create a test branch
git checkout -b test/workflow-automation-setup

# Make a small change
echo "# Test workflow automation" >> TEST_WORKFLOW.md
git add TEST_WORKFLOW.md
git commit -m "test: verify workflow automation setup"
git push origin test/workflow-automation-setup

# Create PR
gh pr create --title "test: verify workflow automation setup" \
             --body "This PR tests the workflow automation system setup"
```

#### 6.2 Verify Workflow Execution

1. Check that workflows are triggered in GitHub Actions tab
2. Verify reviewer assignment occurs automatically
3. Confirm quality gates run and provide feedback
4. Test notification delivery (if webhooks configured)

#### 6.3 Manual Workflow Testing

Test manual workflow triggers:

```bash
# Test PR review coordination
gh workflow run "PR Review Coordination & Multi-Reviewer Management" \
  -f pr_number=1 -f action=assign-reviewers

# Test quality gates
gh workflow run "Quality Gate Automation & Validation" \
  -f full_scan=true

# Test notifications
gh workflow run "Smart Notification Management & Communication" \
  -f notification_type=daily-summary -f target_audience=maintainers
```

### Step 7: Configuration Customization

#### 7.1 Adjust Quality Thresholds

Edit the workflow files to customize thresholds:

```yaml
# In quality-gate-automation.yml
env:
  QUALITY_THRESHOLD: 80      # Adjust as needed (0-100)
  COVERAGE_THRESHOLD: 80     # Test coverage requirement
  PERFORMANCE_THRESHOLD: 90  # Performance score requirement
  SECURITY_THRESHOLD: 85     # Security score requirement
```

#### 7.2 Customize Reviewer Assignment

Modify reviewer mapping in `pr-review-coordination.yml`:

```yaml
# Update expertise area mappings
case "$file" in
  backend/*)
    expertise_areas+=("api-design")
    teams+=("your-backend-team")  # Customize team names
    ;;
  frontend/*)
    expertise_areas+=("ui-ux")
    teams+=("your-frontend-team")
    ;;
esac
```

#### 7.3 Configure Notification Preferences

Adjust notification settings in `notification-management.yml`:

```yaml
env:
  NOTIFICATION_ENABLED: true  # Set to false to disable all notifications
  # Add custom notification conditions as needed
```

## 🔍 Verification Checklist

After setup, verify the following:

- [ ] **Workflows are active**: Check GitHub Actions tab shows workflows
- [ ] **Branch protection works**: Try pushing directly to main (should be blocked)
- [ ] **PR automation works**: Create test PR and verify automation
- [ ] **Quality gates run**: Confirm linting, testing, security scans execute
- [ ] **Reviewer assignment works**: Verify reviewers are assigned based on files changed
- [ ] **Notifications deliver**: Test Slack/Teams notifications if configured
- [ ] **Labels are applied**: Check that automation labels are created and applied
- [ ] **Metrics collection works**: Verify artifacts are uploaded with metrics

## 🚨 Common Issues and Solutions

### Issue: Workflows not triggering

**Cause**: Workflow files not in correct location or syntax errors
**Solution**: 
1. Verify files are in `.github/workflows/`
2. Check YAML syntax with `yamllint`
3. Review GitHub Actions logs for errors

### Issue: Permission denied errors

**Cause**: Insufficient GitHub token permissions
**Solution**:
1. Check repository settings → Actions → General → Workflow permissions
2. Enable "Read and write permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"

### Issue: Reviewer assignment not working

**Cause**: Teams don't exist or CODEOWNERS misconfigured
**Solution**:
1. Verify teams exist in organization
2. Check CODEOWNERS file syntax
3. Ensure team members have repository access

### Issue: Quality gates failing

**Cause**: Code doesn't meet quality thresholds
**Solution**:
1. Review specific failing checks in workflow logs
2. Adjust thresholds if needed
3. Fix code quality issues

### Issue: Notifications not sending

**Cause**: Webhook URLs incorrect or secrets not configured
**Solution**:
1. Verify webhook URLs are correct
2. Check secrets are properly set
3. Test webhook URLs manually

## 🔧 Advanced Configuration

### Environment-Specific Setup

For different environments (staging, production), create environment-specific workflow files:

```bash
# Create environment-specific workflows
cp .github/workflows/quality-gate-automation.yml .github/workflows/quality-gate-staging.yml
# Modify staging workflow for different requirements
```

### Custom Workflow Integration

To integrate with existing workflows:

1. Add workflow dependencies:
```yaml
needs: [existing-workflow-job]
```

2. Share data between workflows using artifacts:
```yaml
- name: Upload results
  uses: actions/upload-artifact@v4
  with:
    name: workflow-results
    path: results.json
```

### Monitoring and Observability

Set up monitoring for workflow health:

1. **Workflow Success Rate**: Monitor via GitHub API
2. **Quality Metrics Trends**: Export metrics to external systems
3. **Notification Delivery**: Track webhook response codes
4. **Review Time Metrics**: Measure time from PR creation to merge

## 📞 Support and Maintenance

### Getting Help

If you encounter issues:

1. **Check Documentation**: Review this guide and workflow documentation
2. **GitHub Actions Logs**: Examine workflow run logs for specific errors
3. **Community Resources**: Search GitHub Actions community discussions
4. **Create Issue**: Open issue in repository with `workflow-automation` label

### Regular Maintenance

Schedule regular maintenance tasks:

- **Weekly**: Review workflow performance metrics
- **Monthly**: Update reviewer team assignments
- **Quarterly**: Audit and update quality thresholds
- **As Needed**: Update notification templates and webhooks

### Updates and Upgrades

When updating workflows:

1. Test changes in fork or feature branch first
2. Use workflow dispatch to validate functionality
3. Monitor metrics after deployment
4. Update documentation to reflect changes

---

## 🎉 Congratulations!

Your GitHub workflow automation system is now set up and ready to streamline your PR management process. The system will:

- ✅ Automatically assign reviewers based on expertise
- ✅ Run comprehensive quality gates
- ✅ Provide intelligent notifications
- ✅ Track review progress and metrics
- ✅ Enforce branch protection and compliance

For ongoing success, remember to:
- Monitor workflow performance regularly
- Keep team assignments updated
- Adjust thresholds based on team needs
- Gather feedback from team members

Happy coding! 🚀

---

*Setup guide version 1.0 - For updates and improvements, please contribute to the repository.*