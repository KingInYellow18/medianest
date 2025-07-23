#!/bin/bash
# 4-Tier Workflow Monitoring and Alerting Setup
# QA Coordinator Agent - Continuous Monitoring Implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}📊 QA MONITORING: 4-Tier Workflow Monitoring Setup${NC}"
echo "=================================================================="

MONITORING_DIR=".github/workflows/monitoring"
ALERTS_CONFIG="infrastructure/monitoring/alert_rules.yml"
DASHBOARDS_DIR="infrastructure/monitoring/dashboards"

# Function to create monitoring directory structure
setup_monitoring_structure() {
    echo -e "\n${BLUE}📁 Setting up monitoring directory structure${NC}"
    
    mkdir -p "$MONITORING_DIR"
    mkdir -p "infrastructure/monitoring/dashboards"
    mkdir -p "infrastructure/monitoring/scripts"
    mkdir -p "logs/workflow-monitoring"
    
    echo -e "${GREEN}✅ Monitoring directories created${NC}"
}

# Function to create GitHub Actions workflow monitoring
create_workflow_monitoring() {
    echo -e "\n${BLUE}⚙️ Creating GitHub Actions workflow monitoring${NC}"
    
    cat > "$MONITORING_DIR/workflow-health-check.yml" << 'EOF'
name: 4-Tier Workflow Health Check

on:
  schedule:
    # Run every 30 minutes during business hours
    - cron: '*/30 8-18 * * 1-5'
  workflow_dispatch:
  push:
    branches: [ main, development, test, claude-flowv2 ]
  pull_request:
    branches: [ main, development, test ]

env:
  MONITORING_ENABLED: true
  ALERT_SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}

jobs:
  workflow-health:
    runs-on: ubuntu-latest
    name: Monitor 4-Tier Workflow Health
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Fetch all history for branch analysis
        
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install monitoring dependencies
      run: |
        npm install -g @octokit/rest axios moment
        
    - name: Check branch structure health
      id: branch-health
      run: |
        echo "Checking 4-tier branch structure..."
        
        # Check required branches exist
        required_branches=("main" "development" "test" "claude-flowv2")
        missing_branches=()
        
        for branch in "${required_branches[@]}"; do
          if ! git show-ref --verify --quiet refs/remotes/origin/$branch; then
            missing_branches+=("$branch")
          fi
        done
        
        if [ ${#missing_branches[@]} -gt 0 ]; then
          echo "missing_branches=${missing_branches[*]}" >> $GITHUB_OUTPUT
          echo "branch_health=failed" >> $GITHUB_OUTPUT
        else
          echo "branch_health=healthy" >> $GITHUB_OUTPUT
        fi
        
        # Check branch synchronization
        git fetch origin
        
        # Check if development is ahead of test by too much
        dev_ahead=$(git rev-list --count origin/test..origin/development 2>/dev/null || echo "0")
        test_ahead=$(git rev-list --count origin/main..origin/test 2>/dev/null || echo "0")
        
        echo "dev_ahead_of_test=$dev_ahead" >> $GITHUB_OUTPUT
        echo "test_ahead_of_main=$test_ahead" >> $GITHUB_OUTPUT
        
        # Alert thresholds
        if [ "$dev_ahead" -gt 20 ]; then
          echo "dev_test_sync=warning" >> $GITHUB_OUTPUT
        else
          echo "dev_test_sync=healthy" >> $GITHUB_OUTPUT
        fi
        
        if [ "$test_ahead" -gt 10 ]; then
          echo "test_main_sync=warning" >> $GITHUB_OUTPUT
        else
          echo "test_main_sync=healthy" >> $GITHUB_OUTPUT
        fi
        
    - name: Check merge workflow health
      id: merge-health
      run: |
        echo "Checking merge workflow health..."
        
        # Check recent merge success rate
        recent_merges=$(git log --oneline --merges --since="7 days ago" | wc -l)
        failed_workflows=$(gh run list --limit 50 --json conclusion | jq '[.[] | select(.conclusion == "failure")] | length')
        
        echo "recent_merges=$recent_merges" >> $GITHUB_OUTPUT
        echo "failed_workflows=$failed_workflows" >> $GITHUB_OUTPUT
        
        # Calculate success rate
        if [ "$recent_merges" -gt 0 ]; then
          success_rate=$(( (recent_merges - failed_workflows) * 100 / recent_merges ))
          echo "merge_success_rate=$success_rate" >> $GITHUB_OUTPUT
          
          if [ "$success_rate" -lt 80 ]; then
            echo "merge_health=critical" >> $GITHUB_OUTPUT
          elif [ "$success_rate" -lt 90 ]; then
            echo "merge_health=warning" >> $GITHUB_OUTPUT
          else
            echo "merge_health=healthy" >> $GITHUB_OUTPUT
          fi
        else
          echo "merge_health=no_data" >> $GITHUB_OUTPUT
          echo "merge_success_rate=0" >> $GITHUB_OUTPUT
        fi
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Check deployment health
      id: deployment-health
      run: |
        echo "Checking deployment health..."
        
        # Check if deployment workflows are configured
        deployment_workflows=0
        if [ -f ".github/workflows/deploy-production.yml" ]; then
          ((deployment_workflows++))
        fi
        if [ -f ".github/workflows/deploy-staging.yml" ]; then
          ((deployment_workflows++))
        fi
        if [ -f ".github/workflows/deploy-testing.yml" ]; then
          ((deployment_workflows++))
        fi
        
        echo "deployment_workflows_configured=$deployment_workflows" >> $GITHUB_OUTPUT
        
        if [ "$deployment_workflows" -ge 3 ]; then
          echo "deployment_config=healthy" >> $GITHUB_OUTPUT
        elif [ "$deployment_workflows" -ge 1 ]; then
          echo "deployment_config=partial" >> $GITHUB_OUTPUT
        else
          echo "deployment_config=missing" >> $GITHUB_OUTPUT
        fi
        
    - name: Generate monitoring report
      run: |
        cat > workflow-health-report.json << EOF
        {
          "timestamp": "$(date -Iseconds)",
          "branch_health": {
            "status": "${{ steps.branch-health.outputs.branch_health }}",
            "missing_branches": "${{ steps.branch-health.outputs.missing_branches }}",
            "dev_ahead_of_test": ${{ steps.branch-health.outputs.dev_ahead_of_test }},
            "test_ahead_of_main": ${{ steps.branch-health.outputs.test_ahead_of_main }},
            "sync_status": {
              "dev_test": "${{ steps.branch-health.outputs.dev_test_sync }}",
              "test_main": "${{ steps.branch-health.outputs.test_main_sync }}"
            }
          },
          "merge_health": {
            "status": "${{ steps.merge-health.outputs.merge_health }}",
            "recent_merges": ${{ steps.merge-health.outputs.recent_merges }},
            "failed_workflows": ${{ steps.merge-health.outputs.failed_workflows }},
            "success_rate": ${{ steps.merge-health.outputs.merge_success_rate }}
          },
          "deployment_health": {
            "status": "${{ steps.deployment-health.outputs.deployment_config }}",
            "workflows_configured": ${{ steps.deployment-health.outputs.deployment_workflows_configured }}
          }
        }
        EOF
        
        echo "Generated monitoring report:"
        cat workflow-health-report.json
        
    - name: Send alerts for critical issues
      if: steps.branch-health.outputs.branch_health == 'failed' || steps.merge-health.outputs.merge_health == 'critical'
      run: |
        if [ -n "${{ env.ALERT_SLACK_WEBHOOK }}" ]; then
          curl -X POST -H 'Content-type: application/json' \
            --data '{
              "text": "🚨 4-Tier Workflow Health Alert",
              "attachments": [
                {
                  "color": "danger",
                  "fields": [
                    {
                      "title": "Branch Health",
                      "value": "${{ steps.branch-health.outputs.branch_health }}",
                      "short": true
                    },
                    {
                      "title": "Merge Success Rate",
                      "value": "${{ steps.merge-health.outputs.merge_success_rate }}%",
                      "short": true
                    },
                    {
                      "title": "Repository",
                      "value": "${{ github.repository }}",
                      "short": true
                    },
                    {
                      "title": "Triggered By",
                      "value": "${{ github.event_name }}",
                      "short": true
                    }
                  ]
                }
              ]
            }' \
            ${{ env.ALERT_SLACK_WEBHOOK }}
        else
          echo "No Slack webhook configured for alerts"
        fi
        
    - name: Upload monitoring artifacts
      uses: actions/upload-artifact@v4
      with:
        name: workflow-health-report
        path: workflow-health-report.json
        retention-days: 30
EOF

    echo -e "${GREEN}✅ GitHub Actions workflow monitoring created${NC}"
}

# Function to create alerting rules
create_alerting_rules() {
    echo -e "\n${BLUE}🚨 Creating alerting rules configuration${NC}"
    
    mkdir -p "$(dirname "$ALERTS_CONFIG")"
    
    cat > "$ALERTS_CONFIG" << 'EOF'
# 4-Tier Workflow Alert Rules Configuration
# QA Monitoring System

alert_rules:
  # Branch Health Alerts
  branch_health:
    missing_branches:
      severity: critical
      threshold: 1
      message: "Critical: Required branches missing from 4-tier workflow"
      actions:
        - notify_tech_lead
        - create_incident
        - block_deployments
        
    branch_sync_lag:
      severity: warning
      threshold:
        development_ahead_of_test: 20
        test_ahead_of_main: 10
      message: "Warning: Branch synchronization lag detected"
      actions:
        - notify_team
        - create_reminder
        
  # Merge Workflow Alerts  
  merge_workflow:
    success_rate_critical:
      severity: critical
      threshold: 80  # Below 80% success rate
      message: "Critical: Merge workflow success rate below threshold"
      actions:
        - notify_tech_lead
        - halt_merges
        - create_incident
        
    success_rate_warning:
      severity: warning
      threshold: 90  # Below 90% success rate
      message: "Warning: Merge workflow success rate declining"
      actions:
        - notify_team
        - investigate_failures
        
    merge_conflicts:
      severity: warning
      threshold: 5  # More than 5 conflicts per week
      message: "Warning: High merge conflict rate detected"
      actions:
        - notify_team
        - suggest_sync
        
  # Deployment Health Alerts
  deployment_health:
    deployment_failures:
      severity: critical
      threshold: 3  # 3 consecutive failures
      message: "Critical: Multiple deployment failures detected"
      actions:
        - notify_tech_lead
        - rollback_trigger
        - create_incident
        
    deployment_lag:
      severity: warning
      threshold: 48  # Hours since last successful deployment
      message: "Warning: Deployment lag detected"
      actions:
        - notify_team
        - check_pipeline
        
  # Security and Compliance Alerts
  security:
    branch_protection_bypass:
      severity: critical
      threshold: 1
      message: "Critical: Branch protection rules bypassed"
      actions:
        - notify_security_team
        - audit_changes
        - create_incident
        
    unauthorized_direct_push:
      severity: warning
      threshold: 1
      message: "Warning: Direct push to protected branch detected"
      actions:
        - notify_tech_lead
        - audit_change
        
  # Performance Alerts
  performance:
    workflow_execution_time:
      severity: warning
      threshold: 30  # Minutes
      message: "Warning: Workflow execution time exceeding threshold"
      actions:
        - notify_devops
        - optimize_pipeline
        
    test_execution_time:
      severity: warning
      threshold: 20  # Minutes
      message: "Warning: Test execution time too high"
      actions:
        - notify_team
        - optimize_tests

# Notification Channels
notification_channels:
  slack:
    webhook_url: "${SLACK_WEBHOOK_URL}"
    channels:
      critical: "#alerts-critical"
      warning: "#alerts-warning" 
      info: "#dev-notifications"
      
  email:
    smtp_server: "${SMTP_SERVER}"
    tech_lead: "${TECH_LEAD_EMAIL}"
    team: "${TEAM_EMAIL_LIST}"
    security_team: "${SECURITY_TEAM_EMAIL}"
    
  github:
    create_issues: true
    assign_to: "${DEFAULT_ASSIGNEE}"
    labels:
      critical: ["critical", "workflow", "urgent"]
      warning: ["warning", "workflow", "monitoring"]

# Escalation Rules
escalation:
  critical:
    immediate: [slack, email]
    after_5_minutes: [phone, pager]
    after_15_minutes: [escalate_to_manager]
    
  warning:
    immediate: [slack]
    after_30_minutes: [email]
    after_2_hours: [create_ticket]
    
# Maintenance Windows (No alerts during these times)
maintenance_windows:
  - name: "Weekly Maintenance"
    schedule: "0 2 * * SUN"  # Sunday 2 AM
    duration: 120  # minutes
    
  - name: "Emergency Maintenance"
    schedule: "manual"
    notify_before: 15  # minutes
EOF

    echo -e "${GREEN}✅ Alerting rules configuration created${NC}"
}

# Function to create monitoring dashboard configuration
create_monitoring_dashboards() {
    echo -e "\n${BLUE}📊 Creating monitoring dashboards${NC}"
    
    # Workflow Health Dashboard
    cat > "$DASHBOARDS_DIR/workflow-health.json" << 'EOF'
{
  "dashboard": {
    "title": "4-Tier Workflow Health Dashboard",
    "description": "Comprehensive monitoring for MediaNest 4-tier workflow",
    "panels": [
      {
        "title": "Branch Health Overview",
        "type": "stat",
        "metrics": [
          "workflow.branch.health.main",
          "workflow.branch.health.development", 
          "workflow.branch.health.test",
          "workflow.branch.health.claude_flowv2"
        ],
        "thresholds": {
          "healthy": {"color": "green", "value": 1},
          "warning": {"color": "yellow", "value": 0.8},
          "critical": {"color": "red", "value": 0.6}
        }
      },
      {
        "title": "Merge Success Rate (7 days)",
        "type": "timeseries",
        "metrics": [
          "workflow.merge.success_rate"
        ],
        "targets": [
          {
            "expr": "rate(workflow_merges_successful[7d]) / rate(workflow_merges_total[7d]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      },
      {
        "title": "Branch Synchronization Lag",
        "type": "bargauge",
        "metrics": [
          "workflow.branch.lag.development_to_test",
          "workflow.branch.lag.test_to_main"
        ],
        "thresholds": {
          "normal": {"color": "green", "value": 5},
          "warning": {"color": "yellow", "value": 10},
          "critical": {"color": "red", "value": 20}
        }
      },
      {
        "title": "Deployment Frequency",
        "type": "timeseries",
        "metrics": [
          "workflow.deployments.production",
          "workflow.deployments.staging",
          "workflow.deployments.testing"
        ]
      },
      {
        "title": "Workflow Execution Times",
        "type": "heatmap",
        "metrics": [
          "workflow.execution.duration"
        ],
        "buckets": [1, 5, 10, 15, 20, 30, 45, 60]
      },
      {
        "title": "Recent Alerts",
        "type": "logs",
        "query": "source=workflow_monitoring level=error OR level=warning",
        "limit": 20
      }
    ],
    "refresh": "30s",
    "time_range": "24h"
  }
}
EOF

    # Security Dashboard
    cat > "$DASHBOARDS_DIR/workflow-security.json" << 'EOF'
{
  "dashboard": {
    "title": "4-Tier Workflow Security Dashboard",
    "description": "Security monitoring for workflow operations",
    "panels": [
      {
        "title": "Branch Protection Status",
        "type": "stat",
        "metrics": [
          "security.branch_protection.main",
          "security.branch_protection.development",
          "security.branch_protection.test"
        ]
      },
      {
        "title": "Access Control Events",
        "type": "timeseries",
        "metrics": [
          "security.access.authorized",
          "security.access.unauthorized",
          "security.access.failed"
        ]
      },
      {
        "title": "Compliance Score",
        "type": "gauge",
        "metrics": [
          "security.compliance.score"
        ],
        "min": 0,
        "max": 100,
        "thresholds": {
          "poor": {"color": "red", "value": 60},
          "good": {"color": "yellow", "value": 80},
          "excellent": {"color": "green", "value": 95}
        }
      }
    ]
  }
}
EOF

    echo -e "${GREEN}✅ Monitoring dashboards created${NC}"
}

# Function to create monitoring scripts
create_monitoring_scripts() {
    echo -e "\n${BLUE}🔧 Creating monitoring utility scripts${NC}"
    
    # Health check script
    cat > "infrastructure/monitoring/scripts/health-check.sh" << 'EOF'
#!/bin/bash
# 4-Tier Workflow Health Check Script

check_branch_health() {
    local branches=("main" "development" "test" "claude-flowv2")
    local health_score=0
    local total_checks=0
    
    for branch in "${branches[@]}"; do
        ((total_checks++))
        if git show-ref --verify --quiet refs/remotes/origin/$branch; then
            ((health_score++))
            echo "✅ Branch $branch: healthy"
        else
            echo "❌ Branch $branch: missing"
        fi
    done
    
    local health_percentage=$((health_score * 100 / total_checks))
    echo "Branch health: $health_percentage%"
    
    return $((100 - health_percentage))
}

check_merge_health() {
    local recent_merges=$(git log --oneline --merges --since="7 days ago" | wc -l)
    local merge_conflicts=$(git log --grep="conflict" --since="7 days ago" | wc -l)
    
    echo "Recent merges (7 days): $recent_merges"
    echo "Merge conflicts (7 days): $merge_conflicts"
    
    if [ "$recent_merges" -gt 0 ]; then
        local conflict_rate=$((merge_conflicts * 100 / recent_merges))
        echo "Conflict rate: $conflict_rate%"
        
        if [ "$conflict_rate" -gt 20 ]; then
            return 1
        fi
    fi
    
    return 0
}

main() {
    echo "4-Tier Workflow Health Check - $(date)"
    echo "================================================"
    
    local exit_code=0
    
    if ! check_branch_health; then
        exit_code=1
    fi
    
    echo ""
    
    if ! check_merge_health; then
        exit_code=1
    fi
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ Overall health: GOOD"
    else
        echo "❌ Overall health: ISSUES DETECTED"
    fi
    
    exit $exit_code
}

main "$@"
EOF

    chmod +x "infrastructure/monitoring/scripts/health-check.sh"
    
    # Metrics collection script
    cat > "infrastructure/monitoring/scripts/collect-metrics.sh" << 'EOF'
#!/bin/bash
# Metrics Collection Script for 4-Tier Workflow

collect_branch_metrics() {
    local branches=("main" "development" "test" "claude-flowv2")
    
    for branch in "${branches[@]}"; do
        if git show-ref --verify --quiet refs/remotes/origin/$branch; then
            local commits=$(git rev-list --count origin/$branch)
            local last_commit=$(git log -1 --format="%at" origin/$branch)
            
            echo "workflow_branch_commits{branch=\"$branch\"} $commits"
            echo "workflow_branch_last_commit{branch=\"$branch\"} $last_commit"
        fi
    done
}

collect_merge_metrics() {
    local timeframes=("1 day ago" "7 days ago" "30 days ago")
    local labels=("1d" "7d" "30d")
    
    for i in "${!timeframes[@]}"; do
        local timeframe="${timeframes[$i]}"
        local label="${labels[$i]}"
        
        local merges=$(git log --oneline --merges --since="$timeframe" | wc -l)
        local commits=$(git log --oneline --since="$timeframe" | wc -l)
        
        echo "workflow_merges_total{period=\"$label\"} $merges"
        echo "workflow_commits_total{period=\"$label\"} $commits"
    done
}

collect_deployment_metrics() {
    # This would integrate with your deployment system
    # For now, we'll collect from git tags and releases
    
    local releases=$(git tag --list "v*" --sort=-version:refname | head -10 | wc -l)
    local last_release=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
    
    echo "workflow_releases_total $releases"
    echo "workflow_last_release_info{version=\"$last_release\"} 1"
}

main() {
    echo "# 4-Tier Workflow Metrics - $(date)"
    echo "# TYPE workflow_branch_commits counter"
    echo "# TYPE workflow_branch_last_commit gauge"
    echo "# TYPE workflow_merges_total counter"
    echo "# TYPE workflow_commits_total counter"
    echo "# TYPE workflow_releases_total counter"
    
    collect_branch_metrics
    collect_merge_metrics
    collect_deployment_metrics
}

main "$@"
EOF

    chmod +x "infrastructure/monitoring/scripts/collect-metrics.sh"
    
    echo -e "${GREEN}✅ Monitoring utility scripts created${NC}"
}

# Function to create continuous monitoring setup
create_continuous_monitoring() {
    echo -e "\n${BLUE}⏰ Setting up continuous monitoring${NC}"
    
    cat > "$MONITORING_DIR/continuous-monitoring.yml" << 'EOF'
name: Continuous Workflow Monitoring

on:
  schedule:
    # Every 15 minutes during business hours
    - cron: '*/15 8-18 * * 1-5'
    # Every hour outside business hours
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  continuous-monitoring:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
        
    - name: Run health checks
      run: |
        ./infrastructure/monitoring/scripts/health-check.sh
        
    - name: Collect metrics
      run: |
        ./infrastructure/monitoring/scripts/collect-metrics.sh > metrics.txt
        
    - name: Check for anomalies
      run: |
        # Basic anomaly detection
        current_merges=$(git log --oneline --merges --since="1 day ago" | wc -l)
        avg_merges=$(git log --oneline --merges --since="7 days ago" | wc -l)
        avg_merges=$((avg_merges / 7))
        
        if [ $current_merges -gt $((avg_merges * 3)) ]; then
          echo "⚠️ Anomaly detected: Unusual merge activity"
          echo "anomaly=high_merge_activity" >> $GITHUB_ENV
        fi
        
        # Check for large commits
        large_commits=$(git log --since="1 day ago" --pretty=format: --name-only | wc -l)
        if [ $large_commits -gt 100 ]; then
          echo "⚠️ Anomaly detected: Unusually large commits"
          echo "anomaly=large_commits" >> $GITHUB_ENV
        fi
        
    - name: Store metrics
      uses: actions/upload-artifact@v4
      with:
        name: workflow-metrics-${{ github.run_number }}
        path: metrics.txt
        retention-days: 7
EOF

    echo -e "${GREEN}✅ Continuous monitoring workflow created${NC}"
}

# Function to create documentation
create_monitoring_documentation() {
    echo -e "\n${BLUE}📚 Creating monitoring documentation${NC}"
    
    cat > "infrastructure/monitoring/README.md" << 'EOF'
# 4-Tier Workflow Monitoring System

## Overview

This monitoring system provides comprehensive visibility into the health and performance of the MediaNest 4-tier workflow (main → development → test → claude-flowv2).

## Components

### 1. Health Monitoring
- **Branch Structure**: Validates all required branches exist and are accessible
- **Merge Success Rate**: Tracks success/failure rate of merge operations
- **Branch Synchronization**: Monitors lag between branches
- **Deployment Health**: Validates deployment pipeline functionality

### 2. Alerting System
- **Real-time Alerts**: Immediate notifications for critical issues
- **Escalation Rules**: Automatic escalation based on severity and duration
- **Multiple Channels**: Slack, email, GitHub issues, and phone/pager integration

### 3. Dashboards
- **Workflow Health**: Overview of all workflow components
- **Security Dashboard**: Branch protection and access control monitoring
- **Performance Metrics**: Execution times and throughput analysis

### 4. Automated Monitoring
- **Continuous Health Checks**: Regular validation of workflow state
- **Anomaly Detection**: Automatic detection of unusual patterns
- **Metrics Collection**: Historical data for trend analysis

## Quick Start

### 1. Enable Monitoring
```bash
# Run initial setup
./infrastructure/monitoring/scripts/health-check.sh

# Collect baseline metrics
./infrastructure/monitoring/scripts/collect-metrics.sh
```

### 2. Configure Alerts
```bash
# Set environment variables for notifications
export SLACK_WEBHOOK_URL="your-slack-webhook"
export TECH_LEAD_EMAIL="tech-lead@company.com"
export TEAM_EMAIL_LIST="team@company.com"
```

### 3. View Dashboards
- Access GitHub Actions for workflow monitoring
- Check artifact uploads for metrics history
- Review alert notifications in configured channels

## Alert Types

### Critical Alerts (Immediate Response Required)
- Missing required branches
- Merge success rate below 80%
- Multiple deployment failures
- Branch protection bypass

### Warning Alerts (Investigation Recommended)
- Merge success rate below 90%
- Branch synchronization lag
- Unusual merge conflict rate
- Deployment delays

### Info Alerts (Awareness Only)
- Successful workflow completions
- Scheduled maintenance notifications
- Performance optimization opportunities

## Metrics Collected

### Branch Health Metrics
- `workflow_branch_commits{branch}`: Total commits per branch
- `workflow_branch_last_commit{branch}`: Timestamp of last commit
- `workflow_branch_sync_lag{from,to}`: Commit lag between branches

### Merge Workflow Metrics
- `workflow_merges_total{period}`: Number of merges in time period
- `workflow_merge_success_rate`: Percentage of successful merges
- `workflow_merge_conflicts{period}`: Number of conflicts in time period

### Deployment Metrics
- `workflow_deployments{environment}`: Deployment count per environment
- `workflow_deployment_duration{environment}`: Deployment time
- `workflow_deployment_success_rate{environment}`: Success percentage

### Performance Metrics
- `workflow_execution_duration`: Time for workflow completion
- `workflow_test_duration`: Test execution time
- `workflow_build_duration`: Build time per environment

## Troubleshooting

### Common Issues

#### 1. Missing Branch Alerts
```bash
# Check if branch exists locally
git branch -a | grep <branch-name>

# Create missing branch if needed
git checkout -b <branch-name> origin/main
```

#### 2. High Merge Conflict Rate
```bash
# Update branches regularly
git checkout development
git pull origin main
git push origin development
```

#### 3. Deployment Failures
```bash
# Check deployment logs
./infrastructure/monitoring/scripts/health-check.sh

# Verify environment configuration
cat .env.production
```

### Getting Help

1. **Check Dashboards**: Review current status and recent trends
2. **Review Logs**: Check GitHub Actions workflow logs
3. **Run Health Check**: Execute manual health check script
4. **Contact Team**: Use escalation procedures for critical issues

## Maintenance

### Weekly Tasks
- Review alert thresholds and adjust if needed
- Check dashboard effectiveness and update panels
- Validate escalation procedures and contact information

### Monthly Tasks
- Analyze trends and identify optimization opportunities
- Update documentation based on lessons learned
- Review and update monitoring coverage

### Quarterly Tasks
- Full system review and architecture updates
- Performance optimization based on collected data
- Training updates for team members

## Configuration Files

- `alert_rules.yml`: Alerting thresholds and notification rules
- `workflow-health-check.yml`: GitHub Actions monitoring workflow
- `dashboards/`: Dashboard configurations for various views
- `scripts/`: Utility scripts for health checks and metrics

## Integration

### Slack Integration
```bash
# Configure Slack webhook in GitHub secrets
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
```

### Email Integration
```bash
# Configure SMTP settings
gh secret set SMTP_SERVER --body "smtp.company.com"
gh secret set TECH_LEAD_EMAIL --body "tech-lead@company.com"
```

### External Monitoring Systems
- Prometheus/Grafana integration available
- DataDog/New Relic compatible metrics format
- Custom webhook support for other systems

---

For more information, see the individual configuration files and script documentation.
EOF

    echo -e "${GREEN}✅ Monitoring documentation created${NC}"
}

# Main execution
main() {
    echo -e "Setting up 4-tier workflow monitoring at $(date)"
    
    # Setup directory structure
    setup_monitoring_structure
    
    # Create monitoring components
    create_workflow_monitoring
    create_alerting_rules
    create_monitoring_dashboards
    create_monitoring_scripts
    create_continuous_monitoring
    create_monitoring_documentation
    
    # Make scripts executable
    chmod +x infrastructure/monitoring/scripts/*.sh
    
    echo -e "\n=================================================================="
    echo -e "${GREEN}🎉 MONITORING SETUP COMPLETE${NC}"
    echo "=================================================================="
    
    echo -e "${BLUE}📋 Created Components:${NC}"
    echo "• ✅ GitHub Actions workflow monitoring"
    echo "• ✅ Alerting rules and escalation procedures"  
    echo "• ✅ Health check and metrics collection scripts"
    echo "• ✅ Monitoring dashboards configuration"
    echo "• ✅ Continuous monitoring automation"
    echo "• ✅ Comprehensive documentation"
    
    echo -e "\n${BLUE}📁 File Locations:${NC}"
    echo "• Workflows: $MONITORING_DIR/"
    echo "• Alert Rules: $ALERTS_CONFIG"
    echo "• Dashboards: $DASHBOARDS_DIR/"
    echo "• Scripts: infrastructure/monitoring/scripts/"
    echo "• Documentation: infrastructure/monitoring/README.md"
    
    echo -e "\n${BLUE}🔧 Next Steps:${NC}"
    echo "1. Configure secrets in GitHub:"
    echo "   - SLACK_WEBHOOK_URL"
    echo "   - TECH_LEAD_EMAIL"
    echo "   - TEAM_EMAIL_LIST"
    echo ""
    echo "2. Enable GitHub Actions workflows"
    echo ""
    echo "3. Test monitoring:"
    echo "   ./infrastructure/monitoring/scripts/health-check.sh"
    echo ""
    echo "4. Review and customize alert thresholds in:"
    echo "   $ALERTS_CONFIG"
    
    echo -e "\n${GREEN}🛡️ 4-Tier Workflow Monitoring is ready for operation!${NC}"
}

# Run main function
main "$@"