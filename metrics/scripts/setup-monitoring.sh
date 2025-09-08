#!/bin/bash

# MediaNest Technical Debt Metrics - Monitoring Setup Script
# Sets up continuous monitoring and alerting for technical debt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
METRICS_DIR="${PROJECT_ROOT}/metrics"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
MONITORING_INTERVAL=${MONITORING_INTERVAL:-"15"} # minutes
ENABLE_ALERTS=${ENABLE_ALERTS:-"true"}
ENABLE_DASHBOARD_SERVER=${ENABLE_DASHBOARD_SERVER:-"false"}
DASHBOARD_PORT=${DASHBOARD_PORT:-"3001"}

setup_monitoring_environment() {
    log_info "Setting up monitoring environment..."
    
    # Create necessary directories
    mkdir -p "${METRICS_DIR}/logs"
    mkdir -p "${METRICS_DIR}/data/history"
    mkdir -p "${METRICS_DIR}/alerts"
    mkdir -p "${METRICS_DIR}/generated"
    mkdir -p "${METRICS_DIR}/config"
    
    # Set up log rotation
    setup_log_rotation
    
    # Create monitoring configuration
    create_monitoring_config
    
    log_success "Monitoring environment setup complete"
}

setup_log_rotation() {
    local logrotate_config="${METRICS_DIR}/config/logrotate.conf"
    
    cat > "${logrotate_config}" << EOF
${METRICS_DIR}/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        # Signal monitoring process to reopen log files
        pkill -USR1 -f "monitoring-alerts.js" || true
    endscript
}
EOF
    
    log_info "Log rotation configuration created: ${logrotate_config}"
}

create_monitoring_config() {
    local config_file="${METRICS_DIR}/config/monitoring.json"
    
    cat > "${config_file}" << EOF
{
    "monitoring": {
        "interval": ${MONITORING_INTERVAL},
        "enableAlerts": ${ENABLE_ALERTS},
        "enableDashboard": ${ENABLE_DASHBOARD_SERVER},
        "dashboardPort": ${DASHBOARD_PORT}
    },
    "thresholds": {
        "security": {
            "criticalVulnerabilities": 0,
            "highVulnerabilities": 5,
            "securityScore": 85
        },
        "build": {
            "typeScriptErrors": 10,
            "testCoverageMin": 70,
            "buildFailureAlert": true
        },
        "performance": {
            "bundleSizeMaxKB": 500,
            "lighthouseScoreMin": 85,
            "apiResponseMaxMs": 100
        },
        "codeQuality": {
            "technicalDebtMaxHours": 80,
            "codeSmellsMax": 100,
            "cyclomaticComplexityMax": 10
        }
    },
    "alertChannels": {
        "console": true,
        "file": true,
        "email": false,
        "slack": false,
        "github": false
    },
    "retention": {
        "metricsHistory": 90,
        "alertHistory": 365,
        "logFiles": 30
    }
}
EOF
    
    log_success "Monitoring configuration created: ${config_file}"
}

create_systemd_service() {
    log_info "Creating systemd service for continuous monitoring..."
    
    local service_name="medianest-technical-debt-monitor"
    local service_file="/etc/systemd/system/${service_name}.service"
    local user=$(whoami)
    
    # Check if we have permission to create systemd service
    if [[ ! -w "/etc/systemd/system" ]]; then
        log_warning "Cannot create systemd service (no permission). Creating user service instead..."
        create_user_systemd_service
        return
    fi
    
    sudo tee "${service_file}" > /dev/null << EOF
[Unit]
Description=MediaNest Technical Debt Monitor
After=network.target
Wants=network.target

[Service]
Type=simple
User=${user}
Group=${user}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/node monitoring-alerts.js
ExecReload=/bin/kill -USR1 \$MAINPID
Restart=always
RestartSec=10
StandardOutput=append:${METRICS_DIR}/logs/monitor.log
StandardError=append:${METRICS_DIR}/logs/monitor-error.log

# Environment variables
Environment=NODE_ENV=production
Environment=METRICS_DIR=${METRICS_DIR}
Environment=MONITORING_INTERVAL=${MONITORING_INTERVAL}

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "${service_name}"
    
    log_success "Systemd service created: ${service_name}"
    log_info "Start with: sudo systemctl start ${service_name}"
    log_info "Check status: sudo systemctl status ${service_name}"
}

create_user_systemd_service() {
    log_info "Creating user systemd service..."
    
    local service_name="medianest-technical-debt-monitor"
    local user_service_dir="${HOME}/.config/systemd/user"
    local service_file="${user_service_dir}/${service_name}.service"
    
    mkdir -p "${user_service_dir}"
    
    cat > "${service_file}" << EOF
[Unit]
Description=MediaNest Technical Debt Monitor (User Service)
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/node monitoring-alerts.js
ExecReload=/bin/kill -USR1 \$MAINPID
Restart=always
RestartSec=10
StandardOutput=append:${METRICS_DIR}/logs/monitor.log
StandardError=append:${METRICS_DIR}/logs/monitor-error.log

# Environment variables
Environment=NODE_ENV=production
Environment=METRICS_DIR=${METRICS_DIR}
Environment=MONITORING_INTERVAL=${MONITORING_INTERVAL}

[Install]
WantedBy=default.target
EOF
    
    # Enable lingering for user services
    sudo loginctl enable-linger "$(whoami)" 2>/dev/null || true
    
    # Reload and enable user service
    systemctl --user daemon-reload
    systemctl --user enable "${service_name}"
    
    log_success "User systemd service created: ${service_name}"
    log_info "Start with: systemctl --user start ${service_name}"
    log_info "Check status: systemctl --user status ${service_name}"
}

create_cron_jobs() {
    log_info "Setting up cron jobs for periodic tasks..."
    
    local cron_file="/tmp/medianest-metrics-cron"
    
    # Create cron entries
    cat > "${cron_file}" << EOF
# MediaNest Technical Debt Metrics - Cron Jobs
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
METRICS_DIR=${METRICS_DIR}

# Collect metrics every 15 minutes
*/15 * * * * cd ${SCRIPT_DIR} && ./ci-integration.sh collect >> ${METRICS_DIR}/logs/cron.log 2>&1

# Generate dashboards every hour
0 * * * * cd ${SCRIPT_DIR} && ./ci-integration.sh generate >> ${METRICS_DIR}/logs/cron.log 2>&1

# Daily quality gate validation at 9 AM
0 9 * * * cd ${SCRIPT_DIR} && ./ci-integration.sh validate >> ${METRICS_DIR}/logs/cron.log 2>&1

# Weekly comprehensive report on Mondays at 10 AM
0 10 * * 1 cd ${SCRIPT_DIR} && ./ci-integration.sh report >> ${METRICS_DIR}/logs/cron.log 2>&1

# Monthly cleanup - remove old logs and archives
0 2 1 * * find ${METRICS_DIR}/logs -name "*.log" -mtime +30 -delete 2>/dev/null || true
5 2 1 * * find ${METRICS_DIR}/data/archive -name "*.json" -mtime +90 -delete 2>/dev/null || true
EOF
    
    # Install cron jobs
    crontab "${cron_file}"
    rm -f "${cron_file}"
    
    log_success "Cron jobs installed successfully"
    log_info "View with: crontab -l"
}

create_monitoring_scripts() {
    log_info "Creating monitoring utility scripts..."
    
    # Status check script
    cat > "${METRICS_DIR}/scripts/status-check.sh" << 'EOF'
#!/bin/bash
# Quick status check for MediaNest technical debt monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_DIR="$(dirname "${SCRIPT_DIR}")"

echo "=== MediaNest Technical Debt Status ==="
echo "Timestamp: $(date)"
echo ""

# Check if monitoring is running
if pgrep -f "monitoring-alerts.js" > /dev/null; then
    echo "✅ Monitoring service: RUNNING"
else
    echo "❌ Monitoring service: NOT RUNNING"
fi

# Check recent metrics
if [[ -f "${METRICS_DIR}/data/current-metrics.json" ]]; then
    echo "✅ Current metrics: AVAILABLE"
    echo "   Last updated: $(stat -c %y "${METRICS_DIR}/data/current-metrics.json" 2>/dev/null || echo 'unknown')"
else
    echo "❌ Current metrics: NOT AVAILABLE"
fi

# Check recent alerts
if [[ -f "${METRICS_DIR}/alerts/alert-history.json" ]]; then
    local recent_alerts=$(tail -n 100 "${METRICS_DIR}/alerts/alerts.log" 2>/dev/null | wc -l)
    echo "📊 Recent alerts: ${recent_alerts} in last 100 lines"
else
    echo "📊 Recent alerts: NO ALERT HISTORY"
fi

# Check dashboard availability
if [[ -f "${METRICS_DIR}/generated/technical-dashboard.html" ]]; then
    echo "✅ Dashboard: AVAILABLE"
else
    echo "❌ Dashboard: NOT GENERATED"
fi

echo ""
echo "=== Quick Actions ==="
echo "Start monitoring: systemctl --user start medianest-technical-debt-monitor"
echo "Check logs: tail -f ${METRICS_DIR}/logs/monitor.log"
echo "View dashboard: open ${METRICS_DIR}/generated/technical-dashboard.html"
EOF
    
    # Log viewer script
    cat > "${METRICS_DIR}/scripts/view-logs.sh" << 'EOF'
#!/bin/bash
# Log viewer for MediaNest technical debt monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_DIR="$(dirname "${SCRIPT_DIR}")"

case "${1:-monitor}" in
    "monitor"|"m")
        echo "=== Monitoring Logs ==="
        tail -f "${METRICS_DIR}/logs/monitor.log"
        ;;
    "alerts"|"a")
        echo "=== Alert Logs ==="
        tail -f "${METRICS_DIR}/alerts/alerts.log"
        ;;
    "cron"|"c")
        echo "=== Cron Logs ==="
        tail -f "${METRICS_DIR}/logs/cron.log"
        ;;
    "all")
        echo "=== All Logs ==="
        tail -f "${METRICS_DIR}/logs"/*.log
        ;;
    *)
        echo "Usage: $0 [monitor|alerts|cron|all]"
        echo "  monitor (m) - View monitoring service logs"
        echo "  alerts (a)  - View alert logs"
        echo "  cron (c)    - View cron job logs"
        echo "  all         - View all logs"
        ;;
esac
EOF
    
    # Make scripts executable
    chmod +x "${METRICS_DIR}/scripts/status-check.sh"
    chmod +x "${METRICS_DIR}/scripts/view-logs.sh"
    
    log_success "Monitoring utility scripts created"
}

setup_dashboard_server() {
    if [[ "${ENABLE_DASHBOARD_SERVER}" != "true" ]]; then
        log_info "Dashboard server disabled, skipping setup..."
        return
    fi
    
    log_info "Setting up dashboard server..."
    
    # Create simple HTTP server script for dashboards
    cat > "${METRICS_DIR}/scripts/dashboard-server.js" << EOF
#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = ${DASHBOARD_PORT};
const METRICS_DIR = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(METRICS_DIR, 'generated');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/markdown'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(GENERATED_DIR, req.url === '/' ? 'technical-dashboard.html' : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(GENERATED_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'text/plain';
      
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(\`Dashboard server running at http://localhost:\${PORT}\`);
  console.log(\`Access technical dashboard: http://localhost:\${PORT}/technical-dashboard.html\`);
  console.log(\`Access API: http://localhost:\${PORT}/api/\`);
});
EOF
    
    chmod +x "${METRICS_DIR}/scripts/dashboard-server.js"
    
    log_success "Dashboard server script created"
    log_info "Start with: node ${METRICS_DIR}/scripts/dashboard-server.js"
    log_info "Access at: http://localhost:${DASHBOARD_PORT}"
}

install_monitoring_dependencies() {
    log_info "Installing monitoring dependencies..."
    
    cd "${PROJECT_ROOT}"
    
    # Ensure Node.js dependencies are available
    if [[ ! -f "package.json" ]]; then
        npm init -y
    fi
    
    # Install any additional monitoring dependencies
    npm install --save-dev chart.js 2>/dev/null || true
    
    log_success "Monitoring dependencies installed"
}

create_monitoring_documentation() {
    log_info "Creating monitoring documentation..."
    
    cat > "${METRICS_DIR}/MONITORING_SETUP.md" << EOF
# MediaNest Technical Debt Monitoring Setup

This document describes the monitoring setup for MediaNest technical debt tracking.

## Components

### 1. Continuous Monitoring Service
- **Service**: \`medianest-technical-debt-monitor\`
- **Interval**: Every ${MONITORING_INTERVAL} minutes
- **Logs**: \`${METRICS_DIR}/logs/monitor.log\`

### 2. Periodic Data Collection
- **Metrics Collection**: Every 15 minutes via cron
- **Dashboard Generation**: Every hour
- **Quality Gates**: Daily at 9 AM
- **Reports**: Weekly on Mondays

### 3. Dashboard Server
$(if [[ "${ENABLE_DASHBOARD_SERVER}" == "true" ]]; then
echo "- **Status**: ENABLED"
echo "- **Port**: ${DASHBOARD_PORT}"
echo "- **URL**: http://localhost:${DASHBOARD_PORT}"
else
echo "- **Status**: DISABLED"
fi)

## Quick Commands

### Service Management
\`\`\`bash
# Start monitoring
systemctl --user start medianest-technical-debt-monitor

# Check status
systemctl --user status medianest-technical-debt-monitor

# View logs
tail -f ${METRICS_DIR}/logs/monitor.log

# Stop monitoring
systemctl --user stop medianest-technical-debt-monitor
\`\`\`

### Manual Operations
\`\`\`bash
# Collect metrics now
cd ${SCRIPT_DIR} && ./ci-integration.sh collect

# Generate dashboards
cd ${SCRIPT_DIR} && ./ci-integration.sh generate

# Check quality gates
cd ${SCRIPT_DIR} && ./ci-integration.sh validate

# View current status
${METRICS_DIR}/scripts/status-check.sh
\`\`\`

## File Locations

- **Configuration**: \`${METRICS_DIR}/config/monitoring.json\`
- **Current Metrics**: \`${METRICS_DIR}/data/current-metrics.json\`
- **Progress Tracking**: \`${METRICS_DIR}/data/progress-tracking.json\`
- **Alert History**: \`${METRICS_DIR}/alerts/alert-history.json\`
- **Dashboards**: \`${METRICS_DIR}/generated/\`
- **Logs**: \`${METRICS_DIR}/logs/\`

## Alert Thresholds

Current alert thresholds (configurable in monitoring.json):

- **Critical Vulnerabilities**: > 0
- **High Vulnerabilities**: > 5  
- **Security Score**: < 85
- **TypeScript Errors**: > 10
- **Test Coverage**: < 70%
- **Bundle Size**: > 500KB
- **Technical Debt**: > 80 hours

## Customization

Edit \`${METRICS_DIR}/config/monitoring.json\` to customize:
- Alert thresholds
- Monitoring intervals
- Notification channels
- Data retention policies

## Troubleshooting

### Monitoring Not Running
\`\`\`bash
# Check service status
systemctl --user status medianest-technical-debt-monitor

# Check logs for errors
tail -50 ${METRICS_DIR}/logs/monitor-error.log

# Restart service
systemctl --user restart medianest-technical-debt-monitor
\`\`\`

### Missing Metrics
\`\`\`bash
# Manual metrics collection
cd ${SCRIPT_DIR} && node metrics-collector.js

# Check data directory
ls -la ${METRICS_DIR}/data/
\`\`\`

### Dashboard Issues
\`\`\`bash
# Regenerate dashboards
cd ${SCRIPT_DIR} && node dashboard-generator.js

# Check generated files
ls -la ${METRICS_DIR}/generated/
\`\`\`

## Support

For issues with the monitoring setup:
1. Check the troubleshooting section above
2. Review logs in \`${METRICS_DIR}/logs/\`
3. Verify configuration in \`${METRICS_DIR}/config/monitoring.json\`
4. Test individual components manually

---

*Generated by MediaNest Technical Debt Monitoring Setup*
*Last updated: $(date)*
EOF
    
    log_success "Monitoring documentation created: ${METRICS_DIR}/MONITORING_SETUP.md"
}

# Main setup function
main() {
    log_info "Starting MediaNest Technical Debt Monitoring Setup"
    log_info "Metrics Directory: ${METRICS_DIR}"
    
    setup_monitoring_environment
    install_monitoring_dependencies
    create_systemd_service
    create_cron_jobs
    create_monitoring_scripts
    setup_dashboard_server
    create_monitoring_documentation
    
    log_success "Monitoring setup complete!"
    echo ""
    log_info "Next Steps:"
    echo "  1. Review configuration: ${METRICS_DIR}/config/monitoring.json"
    echo "  2. Start monitoring: systemctl --user start medianest-technical-debt-monitor"
    echo "  3. Check status: ${METRICS_DIR}/scripts/status-check.sh"
    echo "  4. View logs: ${METRICS_DIR}/scripts/view-logs.sh"
    if [[ "${ENABLE_DASHBOARD_SERVER}" == "true" ]]; then
        echo "  5. Access dashboard: http://localhost:${DASHBOARD_PORT}"
    fi
    echo ""
    log_info "Documentation available: ${METRICS_DIR}/MONITORING_SETUP.md"
}

# Handle command line arguments
case "${1:-main}" in
    "main"|"")
        main
        ;;
    "service")
        create_systemd_service
        ;;
    "cron")
        create_cron_jobs
        ;;
    "dashboard")
        setup_dashboard_server
        ;;
    "docs")
        create_monitoring_documentation
        ;;
    *)
        echo "Usage: $0 [main|service|cron|dashboard|docs]"
        echo ""
        echo "Commands:"
        echo "  main      - Complete monitoring setup (default)"
        echo "  service   - Create systemd service only"
        echo "  cron      - Setup cron jobs only"
        echo "  dashboard - Setup dashboard server only"
        echo "  docs      - Generate documentation only"
        exit 1
        ;;
esac