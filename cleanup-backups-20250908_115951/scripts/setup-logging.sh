#!/bin/bash

# Comprehensive logging setup script for Observe application

set -e

echo "🚀 Setting up comprehensive logging infrastructure for Observe application..."

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p logs
mkdir -p config/monitoring/logging
mkdir -p backend/src/middleware
mkdir -p backend/src/utils
mkdir -p frontend/src/lib
chmod 755 logs

# Install backend dependencies
echo "📦 Installing backend logging dependencies..."
cd backend
npm install winston winston-daily-rotate-file winston-elasticsearch uuid

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Return to root
cd ..

# Create log rotation configuration
echo "⚙️ Setting up log rotation..."
cat > config/logrotate.conf << 'EOF'
# Log rotation configuration for Observe application
/home/*/projects/observe/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        # Signal application to reopen log files
        pkill -USR1 node || true
    endscript
}
EOF

# Set up ELK stack with Docker
echo "🐳 Setting up ELK stack with Docker Compose..."
if command -v docker-compose &> /dev/null; then
    cd config/monitoring/logging
    
    # Create additional configuration files
    cat > elasticsearch.yml << 'EOF'
cluster.name: "observe-logs"
network.host: 0.0.0.0
xpack.security.enabled: false
xpack.monitoring.collection.enabled: true
EOF

    cat > kibana.yml << 'EOF'
server.name: observe-kibana
server.host: "0.0.0.0"
elasticsearch.hosts: ["http://elasticsearch:9200"]
monitoring.ui.container.elasticsearch.enabled: true
EOF

    cat > grafana-datasources.yml << 'EOF'
apiVersion: 1
datasources:
  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: "[observe-logs-]YYYY.MM.DD"
    interval: Daily
    timeField: "@timestamp"
    version: 80
    isDefault: true
EOF

    cat > alertmanager.yml << 'EOF'
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@observe.local'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

    cat > curator-config.yml << 'EOF'
---
client:
  hosts:
    - elasticsearch
  port: 9200
  url_prefix:
  use_ssl: False
  certificate:
  client_cert:
  client_key:
  ssl_no_validate: False
  http_auth:
  timeout: 30
  master_only: False

logging:
  loglevel: INFO
  logfile:
  logformat: default
  blacklist: ['elasticsearch', 'urllib3']
EOF

    cat > curator-actions.yml << 'EOF'
---
actions:
  1:
    action: delete_indices
    description: >-
      Delete indices older than 30 days (based on index name), for observe-logs
      prefixed indices. Ignore the error if the filter does not result in an
      actionable list of indices (ignore_empty_list) and exit cleanly.
    options:
      ignore_empty_list: True
      disable_action: False
    filters:
    - filtertype: pattern
      kind: prefix
      value: observe-logs-
    - filtertype: age
      source: name
      direction: older
      timestring: '%Y.%m.%d'
      unit: days
      unit_count: 30
EOF

    echo "📊 Starting ELK stack..."
    docker-compose -f docker-compose.logging.yml up -d
    
    echo "⏱️ Waiting for services to be ready..."
    sleep 30
    
    # Create Elasticsearch index template
    curl -X PUT "localhost:9200/_index_template/observe-logs" \
         -H 'Content-Type: application/json' \
         -d @elasticsearch-pipeline.json || true
    
    # Import Kibana dashboards
    if [ -f kibana-dashboards.json ]; then
        curl -X POST "localhost:5601/api/saved_objects/_import" \
             -H "kbn-xsrf: true" \
             -F "file=@kibana-dashboards.json" || true
    fi
    
    cd ../../..
else
    echo "⚠️ Docker Compose not found. Please install Docker and Docker Compose to set up the ELK stack."
fi

# Create sample environment file
echo "📝 Creating sample environment configuration..."
cp config/monitoring/logging/.env.example .env.logging

# Create startup script
echo "🚀 Creating logging startup script..."
cat > scripts/start-with-logging.sh << 'EOF'
#!/bin/bash

# Start application with full logging enabled
export LOG_LEVEL=debug
export LOG_REQUEST_BODY=true
export ENABLE_METRICS=true
export NODE_ENV=development

# Ensure log directory exists
mkdir -p logs

# Start backend with logging
echo "🚀 Starting backend with enhanced logging..."
cd backend
npm run dev &
BACKEND_PID=$!

# Start frontend
echo "🚀 Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait for services
echo "✅ Services started. Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID"
echo "📊 Kibana available at: http://localhost:5601"
echo "🔍 Elasticsearch available at: http://localhost:9200"
echo "📈 Grafana available at: http://localhost:3001"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
EOF

chmod +x scripts/start-with-logging.sh

# Create monitoring script
echo "📊 Creating log monitoring script..."
cat > scripts/monitor-logs.sh << 'EOF'
#!/bin/bash

# Real-time log monitoring script

echo "📊 Observe Application Log Monitor"
echo "=================================="

# Function to monitor specific log level
monitor_logs() {
    local log_level=$1
    local log_file="logs/${log_level}-$(date +%Y-%m-%d).log"
    
    if [ -f "$log_file" ]; then
        echo "📋 Monitoring $log_level logs..."
        tail -f "$log_file" | grep --color=always "$log_level"
    else
        echo "⚠️ Log file $log_file not found"
    fi
}

# Function to show log statistics
show_stats() {
    echo "📈 Log Statistics (Last 24 hours):"
    echo "=================================="
    
    for level in error warn info debug; do
        if ls logs/${level}-*.log 1> /dev/null 2>&1; then
            count=$(grep -h "\"level\":\"${level^^}\"" logs/${level}-*.log 2>/dev/null | wc -l)
            echo "  $level: $count entries"
        fi
    done
    
    echo ""
    echo "🔍 Recent Errors:"
    echo "================"
    if ls logs/error-*.log 1> /dev/null 2>&1; then
        grep -h "\"level\":\"ERROR\"" logs/error-*.log 2>/dev/null | tail -5 | jq -r '.message' 2>/dev/null || echo "No recent errors"
    fi
}

# Main menu
case "$1" in
    "error")
        monitor_logs "error"
        ;;
    "warn")
        monitor_logs "warn"
        ;;
    "info")
        monitor_logs "info"
        ;;
    "debug")
        monitor_logs "debug"
        ;;
    "stats")
        show_stats
        ;;
    "all")
        echo "📋 Monitoring all logs..."
        tail -f logs/combined-*.log 2>/dev/null | grep --color=always -E "(ERROR|WARN|INFO|DEBUG)"
        ;;
    *)
        echo "Usage: $0 {error|warn|info|debug|all|stats}"
        echo ""
        echo "Examples:"
        echo "  $0 error     - Monitor error logs in real-time"
        echo "  $0 all       - Monitor all logs in real-time"
        echo "  $0 stats     - Show log statistics"
        exit 1
        ;;
esac
EOF

chmod +x scripts/monitor-logs.sh

# Create log analysis script
echo "🔍 Creating log analysis script..."
cat > scripts/analyze-logs.sh << 'EOF'
#!/bin/bash

# Log analysis and insights script

echo "🔍 Observe Application Log Analysis"
echo "==================================="

# Function to analyze correlation IDs
analyze_correlations() {
    echo "📊 Correlation ID Analysis:"
    echo "=========================="
    
    if ls logs/combined-*.log 1> /dev/null 2>&1; then
        echo "Most active correlation IDs (last 1000 entries):"
        tail -1000 logs/combined-*.log | grep -o '"correlationId":"[^"]*"' | sort | uniq -c | sort -rn | head -10
        echo ""
    fi
}

# Function to analyze performance
analyze_performance() {
    echo "⚡ Performance Analysis:"
    echo "======================"
    
    if ls logs/combined-*.log 1> /dev/null 2>&1; then
        echo "Slowest requests (duration > 1000ms):"
        grep '"duration":[0-9]*' logs/combined-*.log | \
        jq -r 'select(.duration > 1000) | "\(.duration)ms - \(.method) \(.url) [\(.correlationId[0:8])]"' | \
        sort -rn | head -10 2>/dev/null || echo "No slow requests found"
        echo ""
        
        echo "Average response times by endpoint:"
        grep '"method":"' logs/combined-*.log | \
        jq -r '"\(.method) \(.url) \(.duration // 0)"' | \
        awk '{endpoint=$1" "$2; sum[endpoint]+=$3; count[endpoint]++} END {for(e in sum) printf "%.2fms - %s\n", sum[e]/count[e], e}' | \
        sort -rn | head -10 2>/dev/null || echo "No performance data available"
        echo ""
    fi
}

# Function to analyze errors
analyze_errors() {
    echo "🚨 Error Analysis:"
    echo "=================="
    
    if ls logs/error-*.log 1> /dev/null 2>&1; then
        echo "Most common errors:"
        grep '"message":"' logs/error-*.log | \
        jq -r '.message' | sort | uniq -c | sort -rn | head -10 2>/dev/null || \
        grep -o '"message":"[^"]*"' logs/error-*.log | sort | uniq -c | sort -rn | head -10
        echo ""
        
        echo "Errors by endpoint:"
        grep '"url":"' logs/error-*.log | \
        jq -r '"\(.method) \(.url)"' | sort | uniq -c | sort -rn | head -10 2>/dev/null || \
        echo "No endpoint error data available"
        echo ""
    fi
}

# Function to analyze security events
analyze_security() {
    echo "🔐 Security Event Analysis:"
    echo "=========================="
    
    if ls logs/combined-*.log 1> /dev/null 2>&1; then
        echo "Authentication events:"
        grep -E '"event":"(login_|auth|access_denied)"' logs/combined-*.log | \
        jq -r '.event' | sort | uniq -c | sort -rn 2>/dev/null || \
        echo "No security events found"
        echo ""
        
        echo "Failed authentication attempts by IP:"
        grep '"event":"login_failure"' logs/combined-*.log | \
        jq -r '.ip' | sort | uniq -c | sort -rn | head -10 2>/dev/null || \
        echo "No failed auth attempts found"
        echo ""
    fi
}

# Main execution
case "$1" in
    "correlation")
        analyze_correlations
        ;;
    "performance")
        analyze_performance
        ;;
    "errors")
        analyze_errors
        ;;
    "security")
        analyze_security
        ;;
    "full")
        analyze_correlations
        analyze_performance
        analyze_errors
        analyze_security
        ;;
    *)
        echo "Usage: $0 {correlation|performance|errors|security|full}"
        echo ""
        echo "Examples:"
        echo "  $0 performance - Analyze request performance"
        echo "  $0 errors      - Analyze error patterns"
        echo "  $0 full        - Run all analyses"
        exit 1
        ;;
esac
EOF

chmod +x scripts/analyze-logs.sh

echo "✅ Logging infrastructure setup complete!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Copy .env.logging to .env and configure your settings"
echo "2. Run 'npm install' in both backend and frontend directories"
echo "3. Start services: ./scripts/start-with-logging.sh"
echo "4. Monitor logs: ./scripts/monitor-logs.sh all"
echo "5. Analyze logs: ./scripts/analyze-logs.sh full"
echo ""
echo "🔗 Access Points:"
echo "================"
echo "• Backend: http://localhost:3000"
echo "• Frontend: http://localhost:3001" 
echo "• Kibana: http://localhost:5601"
echo "• Elasticsearch: http://localhost:9200"
echo "• Grafana: http://localhost:3001"
echo ""
echo "📊 The ELK stack provides comprehensive log aggregation, search, and visualization."
echo "🔍 Use the monitoring and analysis scripts for real-time insights."
echo "🚀 Happy logging!"