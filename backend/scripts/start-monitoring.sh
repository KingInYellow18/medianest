#!/bin/bash

# MediaNest Monitoring Startup Script
# Launches comprehensive monitoring suite for staging deployment

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="logs"
PID_DIR="$LOG_DIR/pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       MediaNest Monitoring Suite                            ║${NC}"
echo -e "${BLUE}║                          Starting Components...                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo

# Store initial monitoring status
npx claude-flow@alpha memory store "monitoring-suite-status" "starting" --namespace "observability"

# Start metrics collector
echo -e "${YELLOW}🔧 Starting Metrics Collector...${NC}"
nohup "$SCRIPT_DIR/metrics-collector.sh" continuous 60 > "$LOG_DIR/metrics-collector.log" 2>&1 &
echo $! > "$PID_DIR/metrics-collector.pid"
echo -e "${GREEN}✓ Metrics Collector started (PID: $!)${NC}"

# Start health monitoring
echo -e "${YELLOW}🏥 Starting Health Monitor...${NC}"
nohup "$SCRIPT_DIR/deployment-health.sh" continuous 120 > "$LOG_DIR/health-monitor.log" 2>&1 &
echo $! > "$PID_DIR/health-monitor.pid"
echo -e "${GREEN}✓ Health Monitor started (PID: $!)${NC}"

# Wait a moment for services to start
sleep 3

# Initial health check
echo -e "${YELLOW}🩺 Running Initial Health Check...${NC}"
if "$SCRIPT_DIR/deployment-health.sh" quick; then
    echo -e "${GREEN}✓ Initial health check passed${NC}"
    npx claude-flow@alpha memory store "monitoring-suite-status" "healthy" --namespace "observability"
else
    echo -e "${YELLOW}⚠️  Initial health check shows issues - monitoring will track recovery${NC}"
    npx claude-flow@alpha memory store "monitoring-suite-status" "degraded" --namespace "observability"
fi

echo
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                          Monitoring Suite Active                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}📊 Components Running:${NC}"
echo "   • Metrics Collector: Collecting every 60 seconds"
echo "   • Health Monitor: Checking every 2 minutes"
echo
echo -e "${YELLOW}📝 Log Files:${NC}"
echo "   • Metrics: $LOG_DIR/metrics-collector.log"
echo "   • Health: $LOG_DIR/health-monitor.log"
echo "   • Raw Metrics: $LOG_DIR/metrics/"
echo
echo -e "${YELLOW}🎛️  Available Commands:${NC}"
echo "   • View Dashboard: $SCRIPT_DIR/monitoring-dashboard.sh"
echo "   • Quick Health: $SCRIPT_DIR/deployment-health.sh quick"
echo "   • Stop Monitoring: $SCRIPT_DIR/stop-monitoring.sh"
echo
echo -e "${GREEN}✅ Monitoring suite started successfully!${NC}"

# Store final status
npx claude-flow@alpha memory store "monitoring-startup-time" "$(date -Iseconds)" --namespace "observability"
npx claude-flow@alpha hooks post-task --task-id "monitoring-setup"