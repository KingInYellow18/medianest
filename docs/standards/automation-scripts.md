# MediaNest Automation Scripts Documentation

## Overview
This document details automation patterns and scripts discovered from the MediaNest codebase using Serena MCP analysis, establishing standards for deployment, build, and operational automation.

## Project Script Organization

### NPM Scripts Architecture
**MediaNest Established Pattern:**
```json
{
  "scripts": {
    "build": "./scripts/build-stabilizer.sh",
    "build:fast": "npm run build:backend && npm run build:frontend",
    "build:optimized": "node scripts/build-performance-enhancer.js optimize && npm run build",
    "build:clean": "npm run clean && npm run build",
    "build:docker": "docker build -f Dockerfile.optimized --target backend-production -t medianest-backend .",
    "build:production": "NODE_ENV=production npm run build:optimized",
    "build:verify": "node -e 'console.log(\"Build verification:\"); const fs=require(\"fs\"); console.log(\"Backend:\", fs.existsSync(\"backend/dist\") ? \"✅\" : \"❌\"); console.log(\"Frontend:\", fs.existsSync(\"frontend/.next\") ? \"✅\" : \"❌\");'",
    
    "start": "npm run start:backend",
    "start:backend": "cd backend && npm start",
    "start:frontend": "cd frontend && npm start",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "cd backend && npm run test:e2e",
    "test:all": "npm run test:backend && npm run test:frontend && npm run test:shared",
    
    "deploy": "npm run build && npm run deploy:api",
    "deploy:api": "pm2 start ecosystem.config.js",
    
    "security:scan": "node scripts/security-monitor.js --scan",
    "security:monitor": "node scripts/security-monitor.js --daily",
    
    "clean": "rimraf backend/dist frontend/.next shared/dist node_modules/.cache .build-cache",
    "clean:cache": "npm cache clean --force && node scripts/build-performance-enhancer.js clean",
    "clean:deep": "npm run clean && npm run clean:cache && rimraf node_modules */node_modules"
  }
}
```

## Build Automation Scripts

### 1. Production Build Script (build-stabilizer.sh)
**Discovered Pattern - Robust Build with Error Handling:**
```bash
#!/bin/bash
# Build stabilizer with comprehensive error handling and recovery

set -euo pipefail  # Exit on errors, undefined vars, pipe failures

echo "🚀 MediaNest Build Stabilizer"
echo "⏰ Build started at: $(date)"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-build checks
check_requirements() {
    log_info "Checking build requirements..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE="18.0.0"
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    log_info "Node.js version: $NODE_VERSION"
    
    # Check npm version
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_info "npm version: $(npm --version)"
    
    # Check TypeScript installation
    if ! npm list typescript &> /dev/null; then
        log_warn "TypeScript not found, installing..."
        npm install -D typescript
    fi
}

# Clean previous builds
clean_build() {
    log_info "Cleaning previous builds..."
    rm -rf backend/dist/
    rm -rf frontend/.next/
    rm -rf shared/dist/
    rm -rf .build-cache/
    log_info "Clean completed"
}

# Install dependencies with cache optimization
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [[ -f package-lock.json ]]; then
        npm ci --prefer-offline --no-audit
    else
        log_warn "No package-lock.json found, running npm install"
        npm install
    fi
    
    log_info "Dependencies installed"
}

# Type checking
type_check() {
    log_info "Running type checks..."
    
    if npm run typecheck 2>&1; then
        log_info "Type checking passed"
    else
        log_warn "Type checking failed, attempting fixes..."
        npm run typecheck:fix || log_warn "Auto-fix failed, proceeding with build"
    fi
}

# Build backend
build_backend() {
    log_info "Building backend..."
    
    cd backend
    if npm run build; then
        log_info "Backend build successful"
    else
        log_error "Backend build failed"
        cd ..
        exit 1
    fi
    cd ..
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."
    
    cd frontend
    if npm run build; then
        log_info "Frontend build successful"
    else
        log_error "Frontend build failed"
        cd ..
        exit 1
    fi
    cd ..
}

# Build shared components
build_shared() {
    log_info "Building shared components..."
    
    cd shared
    if npm run build; then
        log_info "Shared components build successful"
    else
        log_warn "Shared components build failed, continuing..."
    fi
    cd ..
}

# Verify build outputs
verify_build() {
    log_info "Verifying build outputs..."
    
    BACKEND_BUILT=false
    FRONTEND_BUILT=false
    
    if [[ -d "backend/dist" ]] && [[ "$(ls -A backend/dist)" ]]; then
        log_info "✅ Backend build verified"
        BACKEND_BUILT=true
    else
        log_error "❌ Backend build verification failed"
    fi
    
    if [[ -d "frontend/.next" ]] && [[ "$(ls -A frontend/.next)" ]]; then
        log_info "✅ Frontend build verified"
        FRONTEND_BUILT=true
    else
        log_error "❌ Frontend build verification failed"
    fi
    
    if [[ "$BACKEND_BUILT" == true ]] && [[ "$FRONTEND_BUILT" == true ]]; then
        log_info "🎉 All builds verified successfully"
    else
        log_error "Build verification failed"
        exit 1
    fi
}

# Generate build report
generate_build_report() {
    log_info "Generating build report..."
    
    BUILD_TIME=$(date)
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    cat > build-report.json << EOF
{
  "buildTime": "$BUILD_TIME",
  "nodeVersion": "$NODE_VERSION",
  "npmVersion": "$NPM_VERSION",
  "backend": {
    "built": $(test -d backend/dist && echo true || echo false),
    "size": "$(du -sh backend/dist 2>/dev/null | cut -f1 || echo "N/A")"
  },
  "frontend": {
    "built": $(test -d frontend/.next && echo true || echo false),
    "size": "$(du -sh frontend/.next 2>/dev/null | cut -f1 || echo "N/A")"
  },
  "shared": {
    "built": $(test -d shared/dist && echo true || echo false),
    "size": "$(du -sh shared/dist 2>/dev/null | cut -f1 || echo "N/A")"
  }
}
EOF

    log_info "Build report generated: build-report.json"
}

# Main build process
main() {
    local start_time=$(date +%s)
    
    log_info "Starting MediaNest build process..."
    
    check_requirements
    clean_build
    install_dependencies
    type_check
    build_shared
    build_backend
    build_frontend
    verify_build
    generate_build_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "🎉 Build completed successfully in ${duration}s"
    log_info "📦 Artifacts ready for deployment"
}

# Error handling
trap 'log_error "Build failed with exit code $?"; exit 1' ERR

# Run main function
main "$@"
```

### 2. Deployment Build Script
**MediaNest Pattern - Production Deployment:**
```bash
#!/bin/bash
# Production deployment build with type safety bypass
echo "🚀 DEPLOYMENT BUILD - Lenient TypeScript configuration"
echo "⏰ $(date)"

# Clean previous build
rm -rf dist/

# Use deployment TypeScript config with maximum leniency  
npm run build -- --project tsconfig.deploy.json || {
    echo "⚠️  Build completed with type warnings"
    echo "🎯 Proceeding with deployment-ready artifacts"
}

echo "✅ DEPLOYMENT BUILD COMPLETE"
echo "📦 Artifacts ready in dist/ directory"
echo "🚀 Ready for production deployment"
```

## Docker Automation Patterns

### 1. Production Docker Compose
**MediaNest Production Configuration:**
```yaml
version: '3.8'

networks:
  medianest_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
  redis_data:
  nginx_cache:
  app_logs:
  ssl_certs:

services:
  # PostgreSQL Database with optimized configuration
  postgres:
    image: postgres:15-alpine
    container_name: medianest_postgres_prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: '--encoding=UTF8 --lc-collate=C --lc-ctype=C'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    ports:
      - '127.0.0.1:5432:5432'
    networks:
      medianest_network:
        ipv4_address: 172.20.0.10
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_NAME}']
      interval: 30s
      timeout: 10s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    security_opt:
      - no-new-privileges:true

  # Redis Cache with persistence
  redis:
    image: redis:7-alpine
    container_name: medianest_redis_prod
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --rdbcompression yes
    volumes:
      - redis_data:/data
    networks:
      medianest_network:
        ipv4_address: 172.20.0.11
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 30s
      timeout: 10s
      retries: 5

  # MediaNest Application
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
      args:
        NODE_ENV: production
    container_name: medianest_app_prod
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_HOST: redis
    volumes:
      - app_logs:/app/logs
      - ./uploads:/app/uploads:ro
    networks:
      medianest_network:
        ipv4_address: 172.20.0.12
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
      replicas: 2
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: medianest_nginx_prod
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./config/production/nginx.conf:/etc/nginx/nginx.conf:ro
      - nginx_cache:/var/cache/nginx
      - ssl_certs:/etc/ssl/certs:ro
    networks:
      medianest_network:
        ipv4_address: 172.20.0.13
    depends_on:
      - app
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

### 2. Docker Build Scripts
```bash
#!/bin/bash
# Docker build automation with multi-stage optimization

echo "🐳 Building MediaNest Docker images..."

# Build optimized backend image
echo "Building backend image..."
docker build \
  -f Dockerfile.optimized \
  --target backend-production \
  --build-arg NODE_ENV=production \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  -t medianest-backend:latest \
  -t medianest-backend:$(git rev-parse --short HEAD) \
  .

# Build frontend image
echo "Building frontend image..."
docker build \
  -f Dockerfile.optimized \
  --target frontend-production \
  --build-arg NODE_ENV=production \
  -t medianest-frontend:latest \
  .

# Verify images
echo "Verifying images..."
docker images | grep medianest

echo "✅ Docker images built successfully"
```

## Testing Automation

### 1. Comprehensive Test Runner
```bash
#!/bin/bash
# Comprehensive testing automation

set -e

echo "🧪 Running MediaNest Test Suite"

# Function to run tests with proper error handling
run_test_suite() {
    local suite=$1
    local description=$2
    
    echo "Running $description..."
    
    if eval "$suite"; then
        echo "✅ $description passed"
    else
        echo "❌ $description failed"
        exit 1
    fi
}

# Unit tests
run_test_suite "npm run test:backend" "Backend Unit Tests"
run_test_suite "npm run test:frontend" "Frontend Unit Tests" 
run_test_suite "npm run test:shared" "Shared Component Tests"

# Integration tests
run_test_suite "cd backend && npm run test:integration" "Integration Tests"

# E2E tests
run_test_suite "npm run test:e2e" "End-to-End Tests"

# Type checking
run_test_suite "npm run typecheck" "TypeScript Type Checking"

# Linting
run_test_suite "npm run lint" "Code Linting"

# Security scanning
run_test_suite "npm audit" "Security Vulnerability Check"

echo "🎉 All tests passed successfully!"
```

### 2. Performance Testing Automation
```javascript
// scripts/performance-test.js
const { performance } = require('perf_hooks');
const axios = require('axios');

class PerformanceTestSuite {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async runTest(name, testFn, iterations = 100) {
    console.log(`Running ${name}...`);
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testFn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    const result = { name, avg, min, max, iterations };
    this.results.push(result);
    
    console.log(`${name}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    return result;
  }

  async testHealthEndpoint() {
    return this.runTest('Health Check Endpoint', async () => {
      await axios.get(`${this.baseUrl}/health`);
    });
  }

  async testAPIEndpoint() {
    return this.runTest('API Endpoint', async () => {
      await axios.get(`${this.baseUrl}/api/v1/media`);
    });
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        avgResponseTime: this.results.reduce((sum, r) => sum + r.avg, 0) / this.results.length
      }
    };

    require('fs').writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
    console.log('Performance report saved to performance-report.json');
  }
}

async function runPerformanceTests() {
  const suite = new PerformanceTestSuite();
  
  await suite.testHealthEndpoint();
  await suite.testAPIEndpoint();
  
  suite.generateReport();
}

if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = PerformanceTestSuite;
```

## Security Automation

### 1. Security Monitoring Script
```javascript
// scripts/security-monitor.js
const { execSync } = require('child_process');
const fs = require('fs');

class SecurityMonitor {
  constructor() {
    this.vulnerabilities = [];
    this.reportPath = 'security-report.json';
  }

  async runSecurityAudit() {
    console.log('🔒 Running security audit...');
    
    try {
      // NPM audit
      const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
      const auditData = JSON.parse(auditOutput);
      
      if (auditData.vulnerabilities && Object.keys(auditData.vulnerabilities).length > 0) {
        this.vulnerabilities.push({
          type: 'npm-audit',
          data: auditData.vulnerabilities,
          severity: this.getMaxSeverity(auditData.vulnerabilities),
          timestamp: new Date().toISOString()
        });
      }

      console.log('✅ Security audit completed');
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      this.vulnerabilities.push({
        type: 'audit-error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  getMaxSeverity(vulnerabilities) {
    const severityLevels = { low: 1, moderate: 2, high: 3, critical: 4 };
    let maxSeverity = 'low';
    
    Object.values(vulnerabilities).forEach(vuln => {
      if (severityLevels[vuln.severity] > severityLevels[maxSeverity]) {
        maxSeverity = vuln.severity;
      }
    });
    
    return maxSeverity;
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalVulnerabilities: this.vulnerabilities.length,
        highestSeverity: this.getHighestSeverity(),
        status: this.vulnerabilities.length === 0 ? 'clean' : 'issues-found'
      },
      vulnerabilities: this.vulnerabilities
    };

    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`Security report saved to ${this.reportPath}`);
    
    return report;
  }

  getHighestSeverity() {
    if (this.vulnerabilities.length === 0) return 'none';
    
    const severities = this.vulnerabilities.map(v => v.severity).filter(Boolean);
    const severityOrder = ['low', 'moderate', 'high', 'critical'];
    
    return severityOrder.reduce((highest, current) => {
      return severities.includes(current) ? current : highest;
    }, 'low');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const monitor = new SecurityMonitor();
  
  switch (command) {
    case '--scan':
      await monitor.runSecurityAudit();
      const report = monitor.generateReport();
      
      if (report.summary.status !== 'clean') {
        console.warn('⚠️  Security issues found. Review security-report.json');
        process.exit(1);
      }
      break;
      
    case '--daily':
      console.log('Running daily security check...');
      await monitor.runSecurityAudit();
      monitor.generateReport();
      break;
      
    default:
      console.log('Usage: node security-monitor.js [--scan|--daily]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SecurityMonitor;
```

## Monitoring and Health Check Automation

### 1. Health Check Script
```bash
#!/bin/bash
# Comprehensive health check automation

HEALTH_ENDPOINT="http://localhost:3000/health"
SIMPLE_HEALTH_ENDPOINT="http://localhost:3000/simple-health"

echo "🏥 MediaNest Health Check"

# Check if application is running
check_app_health() {
    echo "Checking application health..."
    
    if curl -f -s "$SIMPLE_HEALTH_ENDPOINT" > /dev/null; then
        echo "✅ Application is running"
    else
        echo "❌ Application is not responding"
        exit 1
    fi
}

# Check detailed health
check_detailed_health() {
    echo "Checking detailed health status..."
    
    HEALTH_RESPONSE=$(curl -s "$HEALTH_ENDPOINT")
    
    if echo "$HEALTH_RESPONSE" | jq -e '.status == "ok"' > /dev/null 2>&1; then
        echo "✅ All services are healthy"
    else
        echo "❌ Some services are unhealthy:"
        echo "$HEALTH_RESPONSE" | jq '.services'
        exit 1
    fi
}

# Check database connectivity
check_database() {
    echo "Checking database connectivity..."
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ Database is accessible"
    else
        echo "❌ Database is not accessible"
        exit 1
    fi
}

# Check Redis connectivity
check_redis() {
    echo "Checking Redis connectivity..."
    
    if redis-cli -p 6379 ping > /dev/null 2>&1; then
        echo "✅ Redis is accessible"
    else
        echo "❌ Redis is not accessible"
        exit 1
    fi
}

# Main health check
main() {
    check_app_health
    check_detailed_health
    check_database
    check_redis
    
    echo "🎉 All health checks passed"
}

main "$@"
```

## CI/CD Integration Scripts

### 1. GitHub Actions Integration
```yaml
name: MediaNest CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: ./scripts/run-all-tests.sh
    
    - name: Run security audit
      run: npm run security:scan
    
    - name: Build application
      run: npm run build
    
    - name: Verify build
      run: npm run build:verify

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: ./scripts/deploy-production.sh
```

## Backup Automation

### 1. Database Backup Script
```bash
#!/bin/bash
# Automated database backup with retention

BACKUP_DIR="./backups"
DB_NAME="${DB_NAME:-medianest}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS=30

echo "📦 Starting database backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
BACKUP_FILE="$BACKUP_DIR/medianest-$(date +%Y%m%d_%H%M%S).sql"

# Create backup
pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

if [[ $? -eq 0 ]]; then
    echo "✅ Database backup created: $BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup compressed: $BACKUP_FILE.gz"
    
    # Cleanup old backups
    find "$BACKUP_DIR" -name "medianest-*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "✅ Old backups cleaned up (retention: $RETENTION_DAYS days)"
else
    echo "❌ Database backup failed"
    exit 1
fi
```

## Performance Optimization Scripts

### 1. Build Performance Enhancer
```javascript
// scripts/build-performance-enhancer.js
const fs = require('fs');
const path = require('path');

class BuildPerformanceEnhancer {
  constructor() {
    this.cacheDir = '.build-cache';
    this.metricsFile = 'build-metrics.json';
  }

  optimize() {
    console.log('🚀 Optimizing build performance...');
    
    this.createCacheDir();
    this.optimizeNodeModules();
    this.generateBuildMetrics();
    
    console.log('✅ Build optimization complete');
  }

  createCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log(`Created cache directory: ${this.cacheDir}`);
    }
  }

  optimizeNodeModules() {
    // Clean unnecessary files from node_modules
    const unnecessaryPatterns = [
      '**/test/**',
      '**/tests/**',
      '**/*.test.js',
      '**/*.spec.js',
      '**/README.md',
      '**/CHANGELOG.md'
    ];

    console.log('Optimizing node_modules...');
    // Implementation would use glob patterns to remove unnecessary files
  }

  generateBuildMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      buildOptimizations: {
        cacheEnabled: fs.existsSync(this.cacheDir),
        nodeModulesOptimized: true
      }
    };

    fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
    console.log(`Build metrics saved to ${this.metricsFile}`);
  }

  clean() {
    console.log('🧹 Cleaning build caches...');
    
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true });
      console.log('Cache directory cleaned');
    }

    console.log('✅ Cache cleanup complete');
  }

  analyze() {
    console.log('📊 Analyzing build performance...');
    
    if (fs.existsSync(this.metricsFile)) {
      const metrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      console.log('Build Metrics:', JSON.stringify(metrics, null, 2));
    } else {
      console.log('No build metrics found. Run optimize first.');
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const enhancer = new BuildPerformanceEnhancer();
  
  switch (command) {
    case 'optimize':
      enhancer.optimize();
      break;
    case 'clean':
      enhancer.clean();
      break;
    case 'analyze':
      enhancer.analyze();
      break;
    default:
      console.log('Usage: node build-performance-enhancer.js [optimize|clean|analyze]');
  }
}

if (require.main === module) {
  main();
}

module.exports = BuildPerformanceEnhancer;
```

## Conclusion

These automation scripts provide:

1. **Robust Build Process**: Error handling and recovery mechanisms
2. **Production Deployment**: Docker-based deployment with health checks
3. **Comprehensive Testing**: Automated test suites with performance metrics
4. **Security Monitoring**: Continuous vulnerability scanning
5. **Health Monitoring**: Automated health checks and alerting
6. **Backup Automation**: Automated database backups with retention
7. **Performance Optimization**: Build performance enhancements
8. **CI/CD Integration**: GitHub Actions workflow automation

All scripts follow MediaNest established patterns discovered through Serena MCP analysis and provide a solid foundation for reliable, automated operations.