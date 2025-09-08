#!/bin/bash

# MediaNest Monitoring Stop Script
# Gracefully stops all monitoring components

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
LOG_DIR="logs"
PID_DIR="$LOG_DIR/pids"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Stopping MediaNest Monitoring Suite                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo

# Function to stop process by PID file
stop_process() {
    local name=$1
    local pid_file="$PID_DIR/$2.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}🛑 Stopping $name (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null || true
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
                sleep 1
                ((count++))
            done
            
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${RED}   Force killing $name...${NC}"
                kill -9 "$pid" 2>/dev/null || true
            fi
            
            echo -e "${GREEN}✓ $name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $name${NC}"
    fi
}

# Store shutdown status
npx claude-flow@alpha memory store "monitoring-suite-status" "stopping" --namespace "observability"

# Stop monitoring components
stop_process "Metrics Collector" "metrics-collector"
stop_process "Health Monitor" "health-monitor"

# Kill any remaining monitoring processes
echo -e "${YELLOW}🔍 Checking for remaining monitoring processes...${NC}"
pgrep -f "monitoring-dashboard\|deployment-health\|metrics-collector" | while read -r pid; do
    if [[ -n "$pid" ]]; then
        echo -e "${YELLOW}   Stopping remaining process (PID: $pid)${NC}"
        kill "$pid" 2>/dev/null || true
    fi
done

# Generate final report if metrics exist
if [[ -d "$LOG_DIR/metrics" ]]; then
    echo -e "${BLUE}📊 Generating final metrics report...${NC}"
    if command -v jq >/dev/null 2>&1; then
        scripts/metrics-collector.sh report "$(date +%Y%m%d)" || echo -e "${YELLOW}   Could not generate report${NC}"
    else
        echo -e "${YELLOW}   jq not available, skipping report generation${NC}"
    fi
fi

echo
echo -e "${GREEN}📈 Monitoring Session Summary:${NC}"
if [[ -f "$LOG_DIR/metrics-collector.log" ]]; then
    local start_time=$(head -1 "$LOG_DIR/metrics-collector.log" | grep -o '\[.*\]' | tr -d '[]' || echo "unknown")
    local end_time=$(date -Iseconds)
    echo "   • Started: $start_time"
    echo "   • Stopped: $end_time"
    echo "   • Metrics Log: $LOG_DIR/metrics-collector.log"
    echo "   • Health Log: $LOG_DIR/health-monitor.log"
    
    # Count collected metrics
    if [[ -d "$LOG_DIR/metrics" ]]; then
        local metric_files=$(find "$LOG_DIR/metrics" -name "*.jsonl" | wc -l)
        local total_entries=$(find "$LOG_DIR/metrics" -name "*.jsonl" -exec wc -l {} + | tail -1 | awk '{print $1}' || echo 0)
        echo "   • Metric Files: $metric_files"
        echo "   • Total Entries: $total_entries"
    fi
fi

echo
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                         Monitoring Suite Stopped                           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"

# Store final status
npx claude-flow@alpha memory store "monitoring-suite-status" "stopped" --namespace "observability"
npx claude-flow@alpha memory store "monitoring-shutdown-time" "$(date -Iseconds)" --namespace "observability"

echo -e "${GREEN}✅ All monitoring components stopped successfully${NC}"