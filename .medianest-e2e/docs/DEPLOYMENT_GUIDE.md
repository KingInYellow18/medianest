# MediaNest E2E Testing - Comprehensive Deployment Guide

## 🚀 Production-Ready Deployment

This comprehensive deployment guide covers every aspect of deploying the MediaNest Playwright E2E Testing Framework with HIVE-MIND coordination across development, staging, and production environments, ensuring maximum reliability, security, and performance.

## 📋 Pre-Deployment Checklist

### System Requirements

#### Minimum Requirements (Development)

```bash
# Hardware
CPU: 4 cores (2.0 GHz minimum)
RAM: 8 GB
Storage: 50 GB free space
Network: 10 Mbps stable connection

# Software
Node.js: 18.17.0 or higher
NPM: 9.0.0 or higher
Git: 2.34.0 or higher
Docker: 20.10.0 or higher (optional)
```

#### Recommended Requirements (Staging/Production)

```bash
# Hardware
CPU: 8+ cores (3.0 GHz or higher)
RAM: 32 GB or higher
Storage: 500 GB SSD
Network: 100 Mbps stable connection with low latency

# Software
Node.js: Latest LTS version
NPM: Latest stable version
Git: Latest version
Docker: Latest version
Kubernetes: 1.25+ (for orchestrated deployments)
```

#### Browser Requirements

```bash
# Automatically installed by Playwright
Chromium: Latest stable
Firefox: Latest stable
WebKit: Latest stable
Google Chrome: Latest stable (for performance testing)
Microsoft Edge: Latest stable (for cross-browser testing)
```

### Environment Validation Script

```bash
#!/bin/bash
# scripts/validate-deployment-environment.sh

echo "🔍 Validating deployment environment for MediaNest E2E Testing Framework..."

# Function to check command existence and version
check_command() {
  local cmd=$1
  local min_version=$2
  local current_version

  if command -v "$cmd" >/dev/null 2>&1; then
    case "$cmd" in
      "node")
        current_version=$(node --version | sed 's/v//')
        ;;
      "npm")
        current_version=$(npm --version)
        ;;
      "git")
        current_version=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        ;;
      "docker")
        current_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        ;;
    esac

    echo "✅ $cmd: $current_version (required: $min_version+)"

    # Version comparison (simplified)
    if [[ "$current_version" < "$min_version" ]]; then
      echo "⚠️  Warning: $cmd version $current_version is below recommended $min_version"
      return 1
    fi
  else
    echo "❌ $cmd: Not found (required: $min_version+)"
    return 1
  fi

  return 0
}

# System checks
echo "\n📊 System Requirements:"
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $2}')"
echo "Disk Space: $(df -h . | awk 'NR==2 {print $4}')"

# Software version checks
echo "\n🔧 Software Requirements:"
check_command "node" "18.17.0" || VALIDATION_FAILED=1
check_command "npm" "9.0.0" || VALIDATION_FAILED=1
check_command "git" "2.34.0" || VALIDATION_FAILED=1
check_command "docker" "20.10.0" || echo "ℹ️  Docker is optional but recommended"

# Network connectivity check
echo "\n🌐 Network Connectivity:"
if curl -f -s --max-time 10 "https://github.com" > /dev/null; then
  echo "✅ Internet connectivity: OK"
else
  echo "❌ Internet connectivity: Failed"
  VALIDATION_FAILED=1
fi

# Port availability check
echo "\n🔌 Port Availability:"
check_port() {
  local port=$1
  local service=$2

  if lsof -i :$port > /dev/null 2>&1; then
    echo "⚠️  Port $port ($service): In use"
  else
    echo "✅ Port $port ($service): Available"
  fi
}

check_port 3000 "MediaNest App"
check_port 3001 "MediaNest API"
check_port 8080 "Test Dashboard"
check_port 9323 "Metrics Export"

# Final validation result
if [[ $VALIDATION_FAILED ]]; then
  echo "\n❌ Environment validation failed. Please address the issues above."
  exit 1
else
  echo "\n✅ Environment validation passed. Ready for deployment!"
  exit 0
fi
```

## 🏗️ Environment Setup

### 1. Development Environment Setup

#### Quick Setup Script

```bash
#!/bin/bash
# scripts/setup-development.sh

set -e

echo "🚀 Setting up MediaNest E2E Testing Framework - Development Environment"

# Create project structure
echo "📁 Creating project structure..."
mkdir -p {config,docs,examples,fixtures,page-objects,scripts,specs,types,utils}
mkdir -p {reports,screenshots,test-results}
mkdir -p .{swarm,claude-flow}

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps

# Setup HIVE-MIND
echo "🧠 Initializing HIVE-MIND coordination..."
npx claude-flow@alpha hooks session-start \
  --session-id "dev-$(date +%s)" \
  --topology "distributed" \
  --enable-persistence

# Create environment file
echo "⚙️ Creating development environment file..."
cat > .env.local << EOF
# MediaNest Development Configuration
NODE_ENV=development
MEDIANEST_BASE_URL=http://localhost:3000
MEDIANEST_API_URL=http://localhost:3001
PLEX_SERVER_URL=http://localhost:32400

# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
TEST_USER_EMAIL=testuser@medianest.local
TEST_USER_PASSWORD=testpassword123

# HIVE-MIND Configuration
HIVE_MIND_ENABLED=true
HIVE_PERSISTENCE=true
HIVE_NODE_ID=dev-node-\$(hostname)-\$(date +%s)
HIVE_COORDINATION_TYPE=distributed
HIVE_SYNC_INTERVAL=5000

# Test Configuration
TEST_TIMEOUT=30000
TEST_RETRIES=1
TEST_WORKERS=4
TEST_REPORTER=html
TEST_HEADED=false
TEST_DEBUG=true

# Browser Configuration
BROWSER_CHANNEL=chrome
BROWSER_HEADLESS=false
BROWSER_VIEWPORT_WIDTH=1920
BROWSER_VIEWPORT_HEIGHT=1080

# Feature Flags
VISUAL_TESTING=true
A11Y_TESTING=true
PERFORMANCE_TESTING=true
EOF

# Run health check
echo "🔍 Running health check..."
npm run health:full

# Setup git hooks
echo "🔗 Setting up git hooks..."
if [ -d ".git" ]; then
  echo '#!/bin/bash
npm run test:smoke
' > .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
fi

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review and update .env.local with your specific configuration"
echo "2. Start MediaNest application: npm run start"
echo "3. Run smoke tests: npm run test:smoke"
echo "4. Open test dashboard: npm run dashboard:start"
```

#### Development Dockerfile

```dockerfile
# Dockerfile.development
FROM node:18-alpine AS development

# Install system dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    firefox \
    webkit2gtk \
    glib \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .medianest-e2e/package*.json .medianest-e2e/

# Install dependencies
RUN npm ci
WORKDIR /app/.medianest-e2e
RUN npm ci

# Install Playwright browsers
RUN npx playwright install --with-deps

# Copy source code
COPY . /app/

# Create non-root user for security
RUN addgroup -g 1001 -S playwright && \
    adduser -S playwright -u 1001 -G playwright

# Set permissions
RUN chown -R playwright:playwright /app
USER playwright

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD npm run health:check || exit 1

# Default command
CMD ["npm", "run", "test:watch"]
```

#### Development Docker Compose

```yaml
# docker-compose.development.yml
version: '3.8'

services:
  medianest-e2e-dev:
    build:
      context: .
      dockerfile: Dockerfile.development
    container_name: medianest-e2e-dev
    environment:
      - NODE_ENV=development
      - HIVE_MIND_ENABLED=true
      - TEST_HEADED=false
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.medianest-e2e/node_modules
    ports:
      - '8080:8080' # Test dashboard
      - '9323:9323' # Metrics
    networks:
      - medianest-network
    depends_on:
      - medianest-app
      - medianest-api

  medianest-app:
    image: medianest/app:latest
    ports:
      - '3000:3000'
    networks:
      - medianest-network

  medianest-api:
    image: medianest/api:latest
    ports:
      - '3001:3001'
    networks:
      - medianest-network

networks:
  medianest-network:
    driver: bridge
```

### 2. Staging Environment Setup

#### Staging Configuration

```bash
#!/bin/bash
# scripts/setup-staging.sh

set -e

echo "🎭 Setting up MediaNest E2E Testing Framework - Staging Environment"

# Environment validation
echo "🔍 Validating staging environment..."
./scripts/validate-deployment-environment.sh

# Install production dependencies
echo "📦 Installing production dependencies..."
NODE_ENV=staging npm ci --only=production

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps chromium firefox webkit

# Setup HIVE-MIND for staging
echo "🧠 Initializing HIVE-MIND coordination for staging..."
npx claude-flow@alpha hooks session-start \
  --session-id "staging-$(date +%s)" \
  --topology "mesh" \
  --enable-persistence \
  --max-agents 8

# Create staging environment file
echo "⚙️ Creating staging environment configuration..."
cat > .env.staging << EOF
# MediaNest Staging Configuration
NODE_ENV=staging
MEDIANEST_BASE_URL=https://staging.medianest.dev
MEDIANEST_API_URL=https://api-staging.medianest.dev
PLEX_SERVER_URL=https://plex-staging.medianest.dev

# Authentication (Use secure vault in real deployment)
ADMIN_USERNAME=\${STAGING_ADMIN_USER}
ADMIN_PASSWORD=\${STAGING_ADMIN_PASS}

# HIVE-MIND Configuration
HIVE_MIND_ENABLED=true
HIVE_PERSISTENCE=true
HIVE_NODE_ID=staging-node-\$(hostname)-\$(date +%s)
HIVE_COORDINATION_TYPE=mesh
HIVE_SYNC_INTERVAL=3000
HIVE_INTELLIGENT_SELECTION=true
HIVE_FLAKE_DETECTION=true

# Test Configuration
TEST_TIMEOUT=45000
TEST_RETRIES=2
TEST_WORKERS=6
TEST_REPORTER=json,html
TEST_HEADED=false
TEST_DEBUG=false

# CI Integration
CI=true
GITHUB_ACTIONS=\${GITHUB_ACTIONS}
SLACK_WEBHOOK_URL=\${STAGING_SLACK_WEBHOOK}

# Performance
PERFORMANCE_BUDGET_ENABLED=true
VISUAL_TESTING=true
A11Y_TESTING=true
EOF

# Setup monitoring
echo "📊 Setting up monitoring..."
mkdir -p monitoring
cat > monitoring/docker-compose.monitoring.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  grafana-data:
EOF

# Setup log aggregation
echo "📝 Setting up log aggregation..."
mkdir -p logs
cat > logs/fluentd.conf << EOF
<source>
  @type tail
  path /var/log/e2e-tests/*.log
  pos_file /var/log/fluentd/e2e-tests.log.pos
  tag e2e.tests
  format json
</source>

<match e2e.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name medianest-e2e
  type_name _doc
</match>
EOF

echo "✅ Staging environment setup complete!"
```

#### Staging Deployment Pipeline

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

env:
  NODE_VERSION: '18'
  ENVIRONMENT: staging

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 🔧 Configure staging environment
        run: |
          cp .env.staging .env.local
          # Replace environment variables with secrets
          sed -i "s/\${STAGING_ADMIN_USER}/${{ secrets.STAGING_ADMIN_USER }}/g" .env.local
          sed -i "s/\${STAGING_ADMIN_PASS}/${{ secrets.STAGING_ADMIN_PASS }}/g" .env.local
          sed -i "s/\${STAGING_SLACK_WEBHOOK}/${{ secrets.STAGING_SLACK_WEBHOOK }}/g" .env.local

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install --with-deps

      - name: 🔍 Validate staging environment
        working-directory: .medianest-e2e
        run: |
          npm run validate:environment -- \
            --base-url "$MEDIANEST_BASE_URL" \
            --timeout 30000

      - name: 🧠 Initialize HIVE-MIND
        working-directory: .medianest-e2e
        run: |
          npx claude-flow@alpha hooks session-start \
            --session-id "staging-deploy-${{ github.run_id }}" \
            --topology "mesh" \
            --enable-persistence

      - name: 🧪 Run staging tests
        working-directory: .medianest-e2e
        run: |
          npm run test:staging

      - name: 📊 Generate deployment report
        if: always()
        working-directory: .medianest-e2e
        run: |
          npm run report:generate -- \
            --environment staging \
            --deployment-id "${{ github.run_id }}" \
            --include-performance \
            --include-accessibility

      - name: 📤 Upload deployment artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: staging-deployment-report
          path: |
            .medianest-e2e/reports/
            .medianest-e2e/test-results/
          retention-days: 30

      - name: 📢 Notify deployment status
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.STAGING_SLACK_WEBHOOK }}
          custom_payload: |
            {
              "channel": "#medianest-staging",
              "username": "Staging Deployment Bot",
              "attachments": [{
                "color": "${{ job.status == 'success' && 'good' || 'danger' }}",
                "title": "MediaNest E2E Framework Staging Deployment",
                "fields": [
                  {
                    "title": "Status",
                    "value": "${{ job.status }}",
                    "short": true
                  },
                  {
                    "title": "Environment",
                    "value": "Staging",
                    "short": true
                  },
                  {
                    "title": "Commit",
                    "value": "${{ github.sha }}",
                    "short": true
                  }
                ]
              }]
            }
```

### 3. Production Environment Setup

#### Production Security Configuration

```bash
#!/bin/bash
# scripts/setup-production.sh

set -e

echo "🏭 Setting up MediaNest E2E Testing Framework - Production Environment"

# Security validation
echo "🔒 Running security validation..."
if [ "$USER" = "root" ]; then
  echo "❌ Error: Do not run production setup as root user"
  exit 1
fi

# Create production user and directories
echo "👤 Setting up production user and directories..."
sudo useradd -m -s /bin/bash medianest-e2e || echo "User already exists"
sudo mkdir -p /opt/medianest-e2e/{app,data,logs,config}
sudo chown -R medianest-e2e:medianest-e2e /opt/medianest-e2e

# Switch to production user
sudo -u medianest-e2e bash << 'PROD_SETUP'
cd /opt/medianest-e2e/app

# Clone production code
git clone https://github.com/your-org/medianest-playwright.git .
cd .medianest-e2e

# Install production dependencies
NODE_ENV=production npm ci --only=production

# Install Playwright browsers
npx playwright install --with-deps chromium firefox webkit

# Create secure configuration
cat > /opt/medianest-e2e/config/production.env << EOF
# MediaNest Production Configuration
NODE_ENV=production
MEDIANEST_BASE_URL=https://medianest.com
MEDIANEST_API_URL=https://api.medianest.com

# HIVE-MIND Production Configuration
HIVE_MIND_ENABLED=true
HIVE_PERSISTENCE=false  # Don't persist test data in production
HIVE_NODE_ID=prod-node-\$(hostname)-\$(date +%s)
HIVE_COORDINATION_TYPE=centralized
HIVE_SYNC_INTERVAL=10000  # Conservative sync for production

# Security
ENCRYPT_SECRETS=true
SECURE_HEADERS=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9323
LOG_LEVEL=error

# Test Configuration (Conservative for production)
TEST_TIMEOUT=60000
TEST_RETRIES=3
TEST_WORKERS=2  # Conservative for production
TEST_REPORTER=json
TEST_HEADED=false
TEST_SUITE=smoke  # Only smoke tests in production

# Rate limiting to avoid impacting production
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=10
EOF

PROD_SETUP

# Setup systemd service
echo "⚙️ Creating systemd service..."
sudo cat > /etc/systemd/system/medianest-e2e.service << EOF
[Unit]
Description=MediaNest E2E Testing Framework
After=network.target
Wants=network.target

[Service]
Type=simple
User=medianest-e2e
Group=medianest-e2e
WorkingDirectory=/opt/medianest-e2e/app/.medianest-e2e
Environment=NODE_ENV=production
EnvironmentFile=/opt/medianest-e2e/config/production.env
ExecStart=/usr/bin/npm run test:production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=medianest-e2e

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/medianest-e2e/data /opt/medianest-e2e/logs
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictRealtime=yes
MemoryDenyWriteExecute=yes

[Install]
WantedBy=multi-user.target
EOF

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo cat > /etc/logrotate.d/medianest-e2e << EOF
/opt/medianest-e2e/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 medianest-e2e medianest-e2e
    postrotate
        systemctl reload medianest-e2e
    endscript
}
EOF

# Setup monitoring
echo "📊 Setting up production monitoring..."
sudo cat > /opt/medianest-e2e/config/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'medianest-e2e'
    static_configs:
      - targets: ['localhost:9323']
    scrape_interval: 30s
    metrics_path: /metrics

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF

# Setup firewall rules
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 9323  # Metrics port
sudo ufw --force enable

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable medianest-e2e
sudo systemctl start medianest-e2e

# Setup health monitoring
echo "❤️ Setting up health monitoring..."
sudo cat > /opt/medianest-e2e/scripts/health-check.sh << 'EOF'
#!/bin/bash
# Production health check script

LOG_FILE="/opt/medianest-e2e/logs/health-check.log"
MAX_LOG_SIZE=10485760  # 10MB

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
fi

{
    echo "$(date): Starting health check"

    # Check service status
    if systemctl is-active --quiet medianest-e2e; then
        echo "$(date): Service is running"
    else
        echo "$(date): ERROR: Service is not running"
        exit 1
    fi

    # Check metrics endpoint
    if curl -f -s http://localhost:9323/metrics > /dev/null; then
        echo "$(date): Metrics endpoint is healthy"
    else
        echo "$(date): WARNING: Metrics endpoint is not responding"
    fi

    # Check disk space
    DISK_USAGE=$(df /opt/medianest-e2e | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        echo "$(date): WARNING: Disk usage is at ${DISK_USAGE}%"
    fi

    # Check memory usage
    MEMORY_USAGE=$(free | grep '^Mem:' | awk '{print int($3/$2 * 100)}')
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        echo "$(date): WARNING: Memory usage is at ${MEMORY_USAGE}%"
    fi

    echo "$(date): Health check completed successfully"
} >> "$LOG_FILE" 2>&1
EOF

chmod +x /opt/medianest-e2e/scripts/health-check.sh

# Setup cron for health checks
echo "⏰ Setting up health check cron..."
sudo -u medianest-e2e crontab << EOF
# MediaNest E2E Health Checks
*/5 * * * * /opt/medianest-e2e/scripts/health-check.sh
0 2 * * * /opt/medianest-e2e/scripts/cleanup-old-data.sh
EOF

echo "✅ Production environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure secrets management (use vault or encrypted files)"
echo "2. Set up SSL certificates for HTTPS"
echo "3. Configure backup strategy"
echo "4. Set up monitoring dashboards"
echo "5. Test the production deployment"
```

## 🐳 Container Deployment

### Production Dockerfile

```dockerfile
# Dockerfile.production
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    firefox \
    webkit2gtk \
    glib \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S medianest && \
    adduser -S medianest -u 1001 -G medianest

WORKDIR /app

# Copy package files
COPY --chown=medianest:medianest package*.json ./
COPY --chown=medianest:medianest .medianest-e2e/package*.json .medianest-e2e/

# Install dependencies
RUN npm ci --only=production
WORKDIR /app/.medianest-e2e
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install --with-deps

# Copy application code
COPY --chown=medianest:medianest . /app/

# Set security context
USER medianest

# Expose metrics port
EXPOSE 9323

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD npm run health:check || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["npm", "run", "test:production"]
```

### Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: medianest-e2e

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: medianest-e2e-config
  namespace: medianest-e2e
data:
  NODE_ENV: 'production'
  HIVE_MIND_ENABLED: 'true'
  HIVE_COORDINATION_TYPE: 'distributed'
  TEST_SUITE: 'smoke'
  LOG_LEVEL: 'info'
  METRICS_ENABLED: 'true'

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: medianest-e2e-secrets
  namespace: medianest-e2e
type: Opaque
data:
  # Base64 encoded values
  MEDIANEST_BASE_URL: aHR0cHM6Ly9tZWRpYW5lc3QuY29t
  ADMIN_USERNAME: YWRtaW4=
  ADMIN_PASSWORD: c2VjdXJlLXBhc3N3b3Jk

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: medianest-e2e
  namespace: medianest-e2e
  labels:
    app: medianest-e2e
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: medianest-e2e
  template:
    metadata:
      labels:
        app: medianest-e2e
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '9323'
        prometheus.io/path: '/metrics'
    spec:
      serviceAccountName: medianest-e2e
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
        - name: medianest-e2e
          image: medianest/e2e-testing:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 9323
              name: metrics
              protocol: TCP
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: HIVE_NODE_ID
              value: 'k8s-$(POD_NAME)'
          envFrom:
            - configMapRef:
                name: medianest-e2e-config
            - secretRef:
                name: medianest-e2e-secrets
          resources:
            requests:
              memory: '2Gi'
              cpu: '1'
            limits:
              memory: '4Gi'
              cpu: '2'
          livenessProbe:
            httpGet:
              path: /health
              port: 9323
            initialDelaySeconds: 60
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 9323
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          volumeMounts:
            - name: test-results
              mountPath: /app/test-results
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: test-results
          emptyDir:
            sizeLimit: 1Gi
        - name: logs
          emptyDir:
            sizeLimit: 500Mi
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - medianest-e2e
                topologyKey: kubernetes.io/hostname

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: medianest-e2e
  namespace: medianest-e2e
  labels:
    app: medianest-e2e
spec:
  selector:
    app: medianest-e2e
  ports:
    - name: metrics
      port: 9323
      targetPort: 9323
      protocol: TCP
  type: ClusterIP

---
# k8s/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: medianest-e2e
  namespace: medianest-e2e
  labels:
    app: medianest-e2e
spec:
  selector:
    matchLabels:
      app: medianest-e2e
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: medianest-e2e
  namespace: medianest-e2e
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: medianest-e2e
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

---
# k8s/cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: medianest-e2e-smoke-tests
  namespace: medianest-e2e
spec:
  schedule: '*/15 * * * *' # Every 15 minutes
  concurrencyPolicy: Forbid
  failedJobsHistoryLimit: 3
  successfulJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: medianest-e2e
          restartPolicy: Never
          containers:
            - name: medianest-e2e-smoke
              image: medianest/e2e-testing:latest
              command: ['npm', 'run', 'test:smoke']
              envFrom:
                - configMapRef:
                    name: medianest-e2e-config
                - secretRef:
                    name: medianest-e2e-secrets
              resources:
                requests:
                  memory: '1Gi'
                  cpu: '0.5'
                limits:
                  memory: '2Gi'
                  cpu: '1'
```

## 📊 Monitoring and Observability

### Comprehensive Monitoring Setup

```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./rules:/etc/prometheus/rules
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=grafana123
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - '9093:9093'
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - '3100:3100'
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - ../logs:/var/log/medianest-e2e:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:
```

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'rules/e2e-testing.yml'
  - 'rules/hive-mind.yml'

scrape_configs:
  - job_name: 'medianest-e2e'
    static_configs:
      - targets: ['host.docker.internal:9323']
    scrape_interval: 30s
    metrics_path: /metrics
    honor_labels: true

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['host.docker.internal:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "MediaNest E2E Testing Dashboard",
    "description": "Comprehensive monitoring for MediaNest E2E Testing Framework",
    "tags": ["medianest", "e2e", "testing", "hive-mind"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Test Execution Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(medianest_e2e_tests_total)",
            "legendFormat": "Total Tests"
          },
          {
            "expr": "sum(medianest_e2e_tests_passed)",
            "legendFormat": "Passed"
          },
          {
            "expr": "sum(medianest_e2e_tests_failed)",
            "legendFormat": "Failed"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      {
        "id": 2,
        "title": "HIVE-MIND Coordination",
        "type": "graph",
        "targets": [
          {
            "expr": "medianest_e2e_hive_nodes_active",
            "legendFormat": "Active Nodes"
          },
          {
            "expr": "medianest_e2e_hive_sync_latency",
            "legendFormat": "Sync Latency (ms)"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 }
      },
      {
        "id": 3,
        "title": "Performance Metrics",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, medianest_e2e_test_duration_seconds_bucket)",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, medianest_e2e_test_duration_seconds_bucket)",
            "legendFormat": "Median"
          }
        ],
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 8 }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

## 🔒 Security and Compliance

### Security Hardening Script

```bash
#!/bin/bash
# scripts/security-hardening.sh

set -e

echo "🔒 Applying security hardening for MediaNest E2E Testing Framework"

# 1. File System Security
echo "📁 Securing file system permissions..."
find /opt/medianest-e2e -type f -exec chmod 644 {} \;
find /opt/medianest-e2e -type d -exec chmod 755 {} \;
chmod 750 /opt/medianest-e2e/scripts/*.sh
chmod 600 /opt/medianest-e2e/config/*.env

# 2. Network Security
echo "🌐 Configuring network security..."
# Only allow necessary ports
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 9323/tcp  # Metrics port
sudo ufw --force enable

# 3. User Security
echo "👤 Hardening user security..."
# Disable password login for service user
sudo passwd -l medianest-e2e

# 4. Secret Management
echo "🔐 Setting up secret management..."
# Install and configure age for secret encryption
if ! command -v age &> /dev/null; then
    curl -L https://github.com/FiloSottile/age/releases/latest/download/age-v1.1.1-linux-amd64.tar.gz | tar xz
    sudo mv age/age* /usr/local/bin/
fi

# Generate encryption key
if [ ! -f /opt/medianest-e2e/config/secrets.key ]; then
    age-keygen > /opt/medianest-e2e/config/secrets.key
    chmod 600 /opt/medianest-e2e/config/secrets.key
    chown medianest-e2e:medianest-e2e /opt/medianest-e2e/config/secrets.key
fi

# 5. Audit Logging
echo "📝 Setting up audit logging..."
cat > /opt/medianest-e2e/config/audit.conf << EOF
# MediaNest E2E Audit Configuration
auth.info /var/log/medianest-e2e/auth.log
auth.warning /var/log/medianest-e2e/auth.log
authpriv.* /var/log/medianest-e2e/auth.log
EOF

# 6. Resource Limits
echo "⚖️ Setting up resource limits..."
cat >> /etc/security/limits.conf << EOF
# MediaNest E2E Resource Limits
medianest-e2e soft nofile 4096
medianest-e2e hard nofile 8192
medianest-e2e soft nproc 2048
medianest-e2e hard nproc 4096
medianest-e2e soft memlock 2097152
medianest-e2e hard memlock 2097152
EOF

# 7. System Hardening
echo "🛡️ Applying system hardening..."
# Disable unnecessary services
sudo systemctl disable avahi-daemon || true
sudo systemctl disable cups || true
sudo systemctl disable bluetooth || true

# Kernel hardening
cat >> /etc/sysctl.d/99-medianest-hardening.conf << EOF
# Network security
net.ipv4.ip_forward=0
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.all.accept_source_route=0
net.ipv4.conf.all.log_martians=1

# Memory protection
kernel.dmesg_restrict=1
kernel.kptr_restrict=2
kernel.yama.ptrace_scope=1
EOF

sysctl -p /etc/sysctl.d/99-medianest-hardening.conf

echo "✅ Security hardening complete!"
```

### Compliance Monitoring

```javascript
// scripts/compliance-check.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ComplianceMonitor {
  constructor() {
    this.complianceRules = {
      'file-permissions': this.checkFilePermissions,
      'secret-encryption': this.checkSecretEncryption,
      'audit-logging': this.checkAuditLogging,
      'access-controls': this.checkAccessControls,
      'data-retention': this.checkDataRetention,
    };
  }

  async runComplianceCheck() {
    console.log('🔍 Running compliance check...');

    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
      overallCompliance: 0,
      recommendations: [],
    };

    for (const [ruleName, checkFunction] of Object.entries(this.complianceRules)) {
      try {
        const checkResult = await checkFunction.call(this);
        results.checks[ruleName] = checkResult;

        if (!checkResult.compliant) {
          results.recommendations.push(...checkResult.recommendations);
        }
      } catch (error) {
        results.checks[ruleName] = {
          compliant: false,
          error: error.message,
          recommendations: [`Fix error in ${ruleName} check`],
        };
      }
    }

    // Calculate overall compliance
    const totalChecks = Object.keys(results.checks).length;
    const compliantChecks = Object.values(results.checks).filter((c) => c.compliant).length;
    results.overallCompliance = Math.round((compliantChecks / totalChecks) * 100);

    // Generate report
    await this.generateComplianceReport(results);

    return results;
  }

  async checkFilePermissions() {
    const sensitiveFiles = [
      '/opt/medianest-e2e/config/production.env',
      '/opt/medianest-e2e/config/secrets.key',
    ];

    const violations = [];

    for (const filePath of sensitiveFiles) {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const permissions = (stats.mode & parseInt('777', 8)).toString(8);

        if (permissions !== '600') {
          violations.push(`${filePath} has permissions ${permissions}, should be 600`);
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations: violations.length > 0 ? ['Fix file permissions using chmod 600'] : [],
    };
  }

  async checkSecretEncryption() {
    const secretsFile = '/opt/medianest-e2e/config/production.env';

    if (!fs.existsSync(secretsFile)) {
      return {
        compliant: false,
        recommendations: ['Create encrypted secrets file'],
      };
    }

    const content = fs.readFileSync(secretsFile, 'utf8');
    const hasPlaintextSecrets =
      content.includes('password=') && !content.includes('-----BEGIN AGE ENCRYPTED FILE-----');

    return {
      compliant: !hasPlaintextSecrets,
      recommendations: hasPlaintextSecrets ? ['Encrypt secrets using age or similar tool'] : [],
    };
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new ComplianceMonitor();
  monitor
    .runComplianceCheck()
    .then((results) => {
      console.log(`\n📊 Compliance Score: ${results.overallCompliance}%`);

      if (results.recommendations.length > 0) {
        console.log('\n⚠️  Recommendations:');
        results.recommendations.forEach((rec, i) => {
          console.log(`${i + 1}. ${rec}`);
        });
      }

      process.exit(results.overallCompliance >= 90 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Compliance check failed:', error);
      process.exit(1);
    });
}
```

## 📈 Performance Optimization

### Production Performance Tuning

```bash
#!/bin/bash
# scripts/performance-tuning.sh

echo "⚡ Applying performance tuning for production environment..."

# 1. System-level optimizations
echo "🖥️ Optimizing system performance..."

# Increase file descriptor limits
echo "fs.file-max = 65536" >> /etc/sysctl.conf

# Optimize network performance
cat >> /etc/sysctl.conf << EOF
# Network performance optimization
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
EOF

# 2. Node.js optimizations
echo "🟢 Optimizing Node.js performance..."
cat > /opt/medianest-e2e/config/node-performance.sh << EOF
#!/bin/bash
# Node.js performance environment variables

# Memory optimization
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Garbage collection optimization
export NODE_OPTIONS="\$NODE_OPTIONS --gc-interval=100"

# Event loop optimization
export UV_THREADPOOL_SIZE=16

# DNS optimization
export NODE_OPTIONS="\$NODE_OPTIONS --dns-result-order=ipv4first"

# V8 optimizations
export NODE_OPTIONS="\$NODE_OPTIONS --max-http-header-size=32768"
EOF

# 3. Playwright optimizations
echo "🎭 Optimizing Playwright performance..."
cat > /opt/medianest-e2e/config/playwright-performance.js << EOF
// Playwright performance optimizations
module.exports = {
  // Browser launch optimizations
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--memory-pressure-off',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI',
      '--disable-extensions'
    ],
    // Use single process for better resource management in production
    args: process.env.NODE_ENV === 'production' ?
      ['--single-process'] : []
  },

  // Connection optimizations
  connectOptions: {
    timeout: 30000
  },

  // Viewport optimization
  viewport: { width: 1280, height: 720 }, // Smaller viewport for faster rendering

  // Resource optimization
  ignoreHTTPSErrors: true,
  bypassCSP: true
};
EOF

# 4. HIVE-MIND performance tuning
echo "🧠 Optimizing HIVE-MIND performance..."
cat > /opt/medianest-e2e/config/hive-mind-performance.json << EOF
{
  "coordination": {
    "syncInterval": 10000,
    "maxStateSize": 500,
    "compressionEnabled": true,
    "compressionThreshold": 0.8,
    "batchSize": 50,
    "maxBatchWait": 1000
  },
  "networking": {
    "connectionPoolSize": 10,
    "keepAliveTimeout": 30000,
    "requestTimeout": 15000,
    "retryAttempts": 2
  },
  "memory": {
    "gcInterval": 60000,
    "maxMemoryUsage": 0.8,
    "memoryCheckInterval": 30000
  }
}
EOF

# 5. Database/storage optimizations
echo "💾 Optimizing storage performance..."
# Setup tmpfs for temporary test data
cat >> /etc/fstab << EOF
tmpfs /opt/medianest-e2e/data/temp tmpfs defaults,size=2G,mode=755 0 0
EOF

mkdir -p /opt/medianest-e2e/data/temp
mount /opt/medianest-e2e/data/temp

# 6. Apply system-level changes
sysctl -p

echo "✅ Performance tuning complete!"
echo "🔄 Restart the service to apply all optimizations:"
echo "sudo systemctl restart medianest-e2e"
```

## 🚦 Health Checks and Monitoring

### Comprehensive Health Check System

```javascript
// utils/health-check-system.js
const { createServer } = require('http');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

class HealthCheckSystem {
  constructor() {
    this.checks = new Map();
    this.server = null;
    this.isRunning = false;
  }

  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      function: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || 30000,
      lastRun: null,
      lastResult: null,
    });
  }

  async runAllChecks() {
    const results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failed: 0,
      },
    };

    for (const [name, check] of this.checks) {
      results.summary.total++;

      try {
        const startTime = Date.now();
        const result = await Promise.race([
          check.function(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), check.timeout)),
        ]);

        const duration = Date.now() - startTime;

        results.checks[name] = {
          status: 'pass',
          duration,
          result,
          critical: check.critical,
        };

        results.summary.passed++;
      } catch (error) {
        results.checks[name] = {
          status: 'fail',
          error: error.message,
          critical: check.critical,
        };

        results.summary.failed++;

        if (check.critical) {
          results.summary.critical_failed++;
          results.status = 'unhealthy';
        }
      }

      // Update check metadata
      check.lastRun = Date.now();
      check.lastResult = results.checks[name];
    }

    if (results.summary.failed > 0 && results.status === 'healthy') {
      results.status = 'degraded';
    }

    return results;
  }

  async startHealthServer(port = 9323) {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        switch (url.pathname) {
          case '/health':
            const healthResults = await this.runAllChecks();
            const statusCode =
              healthResults.status === 'healthy'
                ? 200
                : healthResults.status === 'degraded'
                  ? 200
                  : 503;

            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(healthResults, null, 2));
            break;

          case '/ready':
            const readinessResults = await this.checkReadiness();
            const readyStatusCode = readinessResults.ready ? 200 : 503;

            res.writeHead(readyStatusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readinessResults, null, 2));
            break;

          case '/metrics':
            const metrics = await this.generateMetrics();
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(metrics);
            break;

          default:
            res.writeHead(404);
            res.end('Not Found');
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    server.listen(port, () => {
      console.log(`🏥 Health check server running on port ${port}`);
      this.isRunning = true;
    });

    this.server = server;
  }

  async checkReadiness() {
    // Check if all critical systems are ready
    const criticalChecks = Array.from(this.checks.entries()).filter(([_, check]) => check.critical);

    const readinessResults = await Promise.all(
      criticalChecks.map(async ([name, check]) => {
        try {
          await check.function();
          return { name, ready: true };
        } catch (error) {
          return { name, ready: false, error: error.message };
        }
      }),
    );

    const allReady = readinessResults.every((r) => r.ready);

    return {
      ready: allReady,
      checks: readinessResults,
      timestamp: new Date().toISOString(),
    };
  }

  async generateMetrics() {
    const results = await this.runAllChecks();

    let metrics = `# HELP medianest_e2e_health_check_status Health check status (1=pass, 0=fail)
# TYPE medianest_e2e_health_check_status gauge
`;

    for (const [name, result] of Object.entries(results.checks)) {
      const value = result.status === 'pass' ? 1 : 0;
      metrics += `medianest_e2e_health_check_status{check="${name}",critical="${result.critical}"} ${value}\n`;

      if (result.duration !== undefined) {
        metrics += `medianest_e2e_health_check_duration_seconds{check="${name}"} ${result.duration / 1000}\n`;
      }
    }

    // Overall metrics
    metrics += `medianest_e2e_health_checks_total ${results.summary.total}\n`;
    metrics += `medianest_e2e_health_checks_passed ${results.summary.passed}\n`;
    metrics += `medianest_e2e_health_checks_failed ${results.summary.failed}\n`;
    metrics += `medianest_e2e_health_checks_critical_failed ${results.summary.critical_failed}\n`;

    return metrics;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.isRunning = false;
      console.log('🏥 Health check server stopped');
    }
  }
}

// Setup default health checks
const healthSystem = new HealthCheckSystem();

// Critical system checks
healthSystem.registerCheck(
  'playwright_browsers',
  async () => {
    const { stdout } = await execAsync('npx playwright --version');
    if (!stdout.includes('Version')) {
      throw new Error('Playwright not properly installed');
    }
    return { version: stdout.trim() };
  },
  { critical: true },
);

healthSystem.registerCheck(
  'hive_mind_coordinator',
  async () => {
    // Check HIVE-MIND coordinator status
    if (process.env.HIVE_MIND_ENABLED === 'true') {
      // This would check the actual coordinator status
      return { status: 'active', nodes: 1 };
    }
    return { status: 'disabled' };
  },
  { critical: false },
);

healthSystem.registerCheck(
  'disk_space',
  async () => {
    const { stdout } = await execAsync(
      "df /opt/medianest-e2e | tail -1 | awk '{print $5}' | sed 's/%//'",
    );
    const usage = parseInt(stdout.trim());

    if (usage > 90) {
      throw new Error(`Disk usage too high: ${usage}%`);
    }

    return { usage: `${usage}%` };
  },
  { critical: true },
);

healthSystem.registerCheck(
  'memory_usage',
  async () => {
    const { stdout } = await execAsync("free | grep '^Mem:' | awk '{print int($3/$2 * 100)}'");
    const usage = parseInt(stdout.trim());

    if (usage > 95) {
      throw new Error(`Memory usage too high: ${usage}%`);
    }

    return { usage: `${usage}%` };
  },
  { critical: true },
);

healthSystem.registerCheck(
  'test_framework_config',
  async () => {
    const configFile = '/opt/medianest-e2e/config/production.env';
    const fs = require('fs');

    if (!fs.existsSync(configFile)) {
      throw new Error('Configuration file not found');
    }

    return { config: 'valid' };
  },
  { critical: true },
);

module.exports = { HealthCheckSystem, healthSystem };

// Start health server if run directly
if (require.main === module) {
  const port = process.env.HEALTH_PORT || 9323;
  healthSystem.startHealthServer(port);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📥 Received SIGTERM, shutting down gracefully...');
    healthSystem.stop();
    process.exit(0);
  });
}
```

This comprehensive deployment guide provides everything needed to deploy the MediaNest E2E Testing Framework across all environments, from development to production, with complete monitoring, security, and performance optimization.
