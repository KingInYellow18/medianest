# 🐳 Docker Integration Testing Suite

Comprehensive integration testing framework for MediaNest's consolidated Docker configuration. This suite validates multi-stage builds, service functionality, performance characteristics, and configuration regression testing.

## 📋 Overview

The Docker Integration Testing Suite consists of four main components:

1. **Docker Validation Suite** - Multi-stage build and service startup testing
2. **Performance Benchmarking** - Resource usage and performance analysis  
3. **Configuration Regression Tests** - Functionality preservation validation
4. **Master Orchestrator** - Coordinated execution and comprehensive reporting

## 🚀 Quick Start

### Run Full Validation
```bash
# Run comprehensive validation (parallel execution)
./run-docker-validation.sh

# Run quick validation (faster, essential tests only)
./run-docker-validation.sh --quick

# Run sequential validation (one test at a time)
./run-docker-validation.sh --no-parallel
```

### Individual Test Suites
```bash
# Run only Docker validation tests
./docker-validation-suite.sh

# Run only performance benchmarking
./performance-benchmarking.sh

# Run only regression tests
./configuration-regression-tests.sh
```

## 🧪 Test Suites

### 1. Docker Validation Suite
**File**: `docker-validation-suite.sh`  
**Duration**: ~15-30 minutes  
**Purpose**: Validates consolidated Docker configuration functionality

#### Tests Included:
- ✅ Multi-stage build validation (7+ targets)
- ✅ Build caching effectiveness testing
- ✅ Development environment startup
- ✅ Production environment startup (with secrets)
- ✅ Volume persistence and mounting
- ✅ Network connectivity between services
- ✅ Environment variable propagation
- ✅ Security configuration validation

#### Key Metrics:
- Build times for each target
- Service startup times
- Health check response times
- Resource utilization
- Security compliance scores

### 2. Performance Benchmarking Suite
**File**: `performance-benchmarking.sh`  
**Duration**: ~20-40 minutes  
**Purpose**: Comprehensive performance analysis and optimization validation

#### Tests Included:
- 📊 Startup performance measurement
- 📊 Resource usage monitoring under load
- 📊 Horizontal scaling performance
- 📊 Memory leak detection
- 📊 Network performance analysis
- 📊 Legacy configuration comparison

#### Key Metrics:
- Container startup times (development vs production)
- CPU and memory usage patterns
- Response time distributions
- Throughput under concurrent load
- Memory growth rates
- Network latency measurements

### 3. Configuration Regression Tests
**File**: `configuration-regression-tests.sh`  
**Duration**: ~10-20 minutes  
**Purpose**: Ensures configuration changes don't break existing functionality

#### Tests Included:
- 🔍 API compatibility validation
- 🔍 Environment variable regression
- 🔍 Volume persistence regression
- 🔍 Network connectivity regression
- 🔍 Security configuration regression

#### Key Features:
- Baseline reference capture
- Automated regression detection
- Detailed failure analysis
- Change impact assessment

### 4. Master Orchestrator
**File**: `run-docker-validation.sh`  
**Duration**: ~45-90 minutes (full suite)  
**Purpose**: Coordinated execution with comprehensive reporting

#### Execution Modes:
- **Parallel**: Run all suites simultaneously (faster)
- **Sequential**: Run suites one after another (detailed logging)
- **Quick**: Essential tests only (fastest)

## 📊 Test Results and Reports

### Result Directories Structure
```
tests/docker-integration/
├── results/                          # Docker validation results
│   ├── build-metrics/
│   ├── health-checks/
│   └── docker-validation-report.md
├── performance-results/              # Performance benchmarking results
│   ├── startup/
│   ├── resource-usage/
│   ├── scaling/
│   ├── memory/
│   └── docker-performance-report.md
├── regression-results/              # Regression test results
│   ├── api-compatibility/
│   ├── environment-validation/
│   └── docker-regression-report.md
└── orchestrator-results/            # Master orchestrator results
    ├── combined-reports/
    └── docker-validation-master-report.md
```

### Report Types

#### 1. Individual Suite Reports
- **Format**: Markdown + JSON
- **Content**: Detailed test results, metrics, and analysis
- **Location**: Each suite's results directory

#### 2. Master Validation Report
- **Format**: Comprehensive Markdown report
- **Content**: Consolidated results from all suites
- **Location**: `orchestrator-results/combined-reports/`

#### 3. JSON Summaries
- **Format**: Structured JSON data
- **Content**: Machine-readable test results
- **Use**: CI/CD integration and automated analysis

## 🔧 Configuration

### Environment Variables
```bash
# Test configuration
export DOCKER_TEST_TIMEOUT=300
export PERFORMANCE_SAMPLES=10
export REGRESSION_SAMPLES=5

# Docker configuration paths
export DOCKER_CONFIG_DIR="config/docker-consolidated"
export PROJECT_ROOT="/path/to/medianest"
```

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- curl
- jq
- bc (for calculations)

### Required Docker Configuration
The tests expect the following Docker configuration structure:
```
config/docker-consolidated/
├── Dockerfile                    # Multi-stage consolidated Dockerfile
├── docker-compose.base.yml      # Base service definitions
├── docker-compose.dev.yml       # Development overrides
└── docker-compose.prod.yml      # Production overrides
```

## 🎯 Test Scenarios

### Build Validation Scenarios
1. **Clean Builds**: Fresh builds without cache
2. **Cached Builds**: Subsequent builds with layer caching
3. **Target-Specific Builds**: Each multi-stage target individually
4. **Cross-Platform Builds**: Multiple architectures (if configured)

### Service Startup Scenarios
1. **Development Mode**: Hot-reload enabled, debug tools active
2. **Production Mode**: Security hardened, read-only filesystems
3. **Scaled Deployment**: Multiple service instances
4. **Resource-Constrained**: Limited memory/CPU allocation

### Performance Test Scenarios
1. **Baseline Performance**: No load conditions
2. **Concurrent Load**: Multiple simultaneous requests
3. **Memory Stress**: Extended operation testing
4. **Network Latency**: Service-to-service communication

### Regression Test Scenarios
1. **API Compatibility**: Endpoint response validation
2. **Data Persistence**: Volume and database integrity
3. **Security Compliance**: Configuration hardening validation
4. **Environment Parity**: Dev/prod configuration consistency

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Docker daemon status
systemctl status docker

# Verify Dockerfile syntax
docker build --dry-run -f config/docker-consolidated/Dockerfile .

# Check build context size
du -sh . --exclude=node_modules
```

#### Service Startup Issues
```bash
# Check service logs
docker-compose logs backend frontend

# Verify network connectivity
docker network ls
docker network inspect medianest-internal

# Check port availability
netstat -tlnp | grep -E ':(3000|4000|5432|6379)'
```

#### Permission Issues
```bash
# Fix script permissions
chmod +x tests/docker-integration/*.sh

# Check Docker socket permissions
sudo usermod -aG docker $USER
newgrp docker
```

#### Memory/Resource Issues
```bash
# Check Docker resource usage
docker system df
docker stats

# Clean up resources
docker system prune -af --volumes
```

### Test-Specific Troubleshooting

#### Performance Tests Taking Too Long
- Use `--quick` mode for faster validation
- Reduce `PERFORMANCE_SAMPLES` in scripts
- Check system resource availability

#### Regression Tests Failing
- Verify baseline reference exists
- Check if changes are intentional
- Update baseline if configuration changes are expected

#### Production Tests Failing
- Verify Docker secrets are properly configured
- Check if production environment variables are set
- Ensure adequate system resources for production mode

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Configuration Validation

on:
  pull_request:
    paths:
      - 'config/docker-consolidated/**'
      - 'Dockerfile*'
      - 'docker-compose*.yml'

jobs:
  docker-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Docker Validation
        run: |
          cd tests/docker-integration
          ./run-docker-validation.sh --quick
      
      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: docker-test-results
          path: tests/docker-integration/**/results/
```

### Jenkins Pipeline Example
```groovy
pipeline {
    agent any
    stages {
        stage('Docker Validation') {
            steps {
                sh '''
                    cd tests/docker-integration
                    ./run-docker-validation.sh --no-parallel
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'tests/docker-integration/**/results/**'
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'tests/docker-integration/orchestrator-results/combined-reports',
                        reportFiles: 'docker-validation-master-report.md',
                        reportName: 'Docker Validation Report'
                    ])
                }
            }
        }
    }
}
```

## 📈 Metrics and Monitoring

### Key Performance Indicators
- **Build Time**: Target completion times
- **Startup Time**: Service readiness duration
- **Response Time**: API endpoint latency
- **Resource Usage**: CPU, memory, disk utilization
- **Success Rate**: Test pass/fail ratios

### Performance Baselines
- **Development Startup**: < 60 seconds
- **Production Startup**: < 120 seconds
- **API Response Time**: < 200ms average
- **Memory Growth**: < 20% over test duration
- **Build Cache Effectiveness**: > 30% time reduction

### Quality Gates
- **Build Success Rate**: 100%
- **Service Health Checks**: 100% pass
- **Regression Tests**: 0 failures
- **Security Compliance**: 100%

## 🔐 Security Considerations

### Security Test Coverage
- Non-root user execution
- Read-only filesystem enforcement
- Capability dropping validation
- Secret management verification
- Network isolation testing

### Production Security Validation
- Docker secrets integration
- Container hardening compliance
- Resource limit enforcement
- Security scanning integration

## 🤝 Contributing

### Adding New Tests
1. Create test function in appropriate suite
2. Add test to main execution flow
3. Update documentation and examples
4. Ensure proper cleanup and error handling

### Test Development Guidelines
- Use consistent logging and output formatting
- Include timeout and retry mechanisms
- Generate both human-readable and JSON output
- Clean up resources after test completion
- Follow existing error handling patterns

### Best Practices
- Test isolation: Each test should be independent
- Resource management: Clean up after tests
- Error reporting: Clear failure messages
- Performance: Optimize test execution time
- Documentation: Update README for changes

---

## 📞 Support

For issues or questions regarding the Docker Integration Testing Suite:

1. **Check Troubleshooting Section**: Common issues and solutions
2. **Review Test Logs**: Detailed error information in results directories
3. **Create Issue**: Report bugs or feature requests
4. **Contact Team**: Reach out to the MediaNest development team

---

**Last Updated**: $(date)  
**Suite Version**: 2.0.0  
**Compatibility**: Docker Engine 20.10+, Docker Compose 2.0+