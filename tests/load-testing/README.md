# MediaNest Production Load Testing Suite

## 🎯 Overview

This comprehensive load testing suite validates MediaNest's production readiness by testing system behavior under extreme load conditions. The suite covers all critical components and provides detailed performance analysis.

## 📋 Test Components

### 1. Comprehensive Load Test (`comprehensive-load-test.js`)

- **1200 concurrent users** simulation
- **5-phase testing** approach:
  - **Phase 1**: Gradual ramp-up (60 seconds)
  - **Phase 2**: Sustained load (300 seconds)
  - **Phase 3**: Spike testing (500 additional requests)
  - **Phase 4**: Stress testing (50% capacity overload)
  - **Phase 5**: Recovery testing (30 seconds)

**Key Features:**

- Authentication endpoint stress testing
- File upload/download performance validation
- API response time measurement
- Real-time metrics collection
- Weighted request distribution

### 2. Database Stress Test (`database-stress-test.js`)

- **PostgreSQL connection pool** testing (100 concurrent connections)
- **Query performance** validation (500 concurrent queries)
- **Redis cache** performance testing (1000 operations)
- **Transaction stress** testing with rollback scenarios
- **Mixed workload** simulation

**Metrics Tracked:**

- Query execution times (P50, P90, P95, P99)
- Connection pool utilization
- Cache hit/miss ratios
- Timeout and error monitoring

### 3. Container Resource Validator (`container-resource-validator.js`)

- **Docker container** monitoring under stress
- **Resource limit** enforcement validation
- **CPU/Memory** usage tracking
- **Container scaling** behavior testing
- **Network I/O** performance measurement
- **Recovery and stability** testing

**Monitored Containers:**

- `medianest_app_prod` (Backend)
- `medianest_postgres_prod` (Database)
- `medianest_redis_prod` (Cache)
- `medianest_nginx_prod` (Proxy)

### 4. CDN & Static Asset Testing

- Static asset loading performance
- Cache effectiveness validation
- Network throughput testing
- Response time analysis

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose
- MediaNest application running
- Required environment variables set

### Demo Test (30 seconds, 50 users)

```bash
node tests/load-testing/demo-load-test.js
```

### Full Production Test Suite

```bash
./tests/load-testing/run-all-load-tests.sh
```

## ⚙️ Configuration

### Environment Variables

```bash
export TEST_BASE_URL="http://localhost:3001"
export MAX_CONCURRENT_USERS="1200"
export TEST_DURATION="300"
export MAX_DB_CONNECTIONS="100"
export CONCURRENT_QUERIES="500"
```

### Custom Configuration

Each test module accepts configuration objects for customization:

```javascript
const config = {
  maxConcurrentUsers: 1000,
  testDuration: 180,
  baseUrl: 'https://your-medianest-instance.com',
};
```

## 📊 Performance Targets

### Success Criteria

- **Success Rate**: > 95%
- **Average Response Time**: < 500ms
- **P95 Response Time**: < 1000ms
- **Throughput**: > 100 req/s
- **Database Connections**: > 95% success rate
- **Cache Hit Ratio**: > 80%
- **Container Compliance**: No critical violations

### System Capacity

- **1000+ concurrent users** supported
- **100 concurrent database connections**
- **Memory usage** < 85% of limits
- **CPU usage** < 80% of limits
- **Network throughput** > 50 MB/s

## 📋 Test Execution Flow

```
1. Prerequisites Check
   ├── Docker availability
   ├── Container status
   └── Server connectivity

2. Phase 1: Comprehensive Load Test
   ├── User simulation
   ├── Request distribution
   └── Metrics collection

3. Phase 2: Database Stress Test
   ├── Connection pool testing
   ├── Query performance
   └── Cache validation

4. Phase 3: Container Validation
   ├── Resource monitoring
   ├── Limit enforcement
   └── Scaling behavior

5. Phase 4: CDN Performance
   ├── Static asset testing
   ├── Cache effectiveness
   └── Network throughput

6. Report Generation
   ├── Results aggregation
   ├── Performance analysis
   └── Recommendations
```

## 📈 Metrics & Reporting

### Real-Time Monitoring

- Response time percentiles
- Request success/failure rates
- Resource usage (CPU, Memory, Network)
- Database connection metrics
- Cache performance stats

### Report Generation

- **JSON reports** with detailed metrics
- **Performance recommendations**
- **Violation tracking**
- **Trend analysis**
- **System capacity planning**

### Memory Coordination

Results are stored in coordinated memory for agent collaboration:

- Key: `MEDIANEST_PROD_VALIDATION/performance_load`
- Subkeys: `comprehensive`, `database`, `containers`, `cdn`

## 🔧 Individual Test Components

### Running Tests Separately

#### Comprehensive Load Test

```bash
node tests/load-testing/comprehensive-load-test.js
```

#### Database Stress Test

```bash
node tests/load-testing/database-stress-test.js
```

#### Container Validation

```bash
node tests/load-testing/container-resource-validator.js
```

## 🎯 Use Cases

### Development Testing

- Performance regression detection
- Capacity planning validation
- Resource optimization guidance

### CI/CD Integration

- Automated performance validation
- Release readiness assessment
- Deployment verification

### Production Monitoring

- System health validation
- Performance baseline establishment
- Scaling decision support

## 🛠️ Troubleshooting

### Common Issues

#### Connection Refused

```
❌ Cannot reach target server
```

**Solution**: Ensure MediaNest is running and accessible at the configured URL.

#### Database Connection Failures

```
❌ Database connection timeout
```

**Solution**: Check PostgreSQL container status and connection limits.

#### Memory Issues

```
❌ JavaScript heap out of memory
```

**Solution**: Reduce concurrent users or increase Node.js memory limit:

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Permission Errors

```
❌ Docker permission denied
```

**Solution**: Ensure Docker permissions or run with appropriate privileges.

### Performance Tuning

#### Low Throughput

- Increase database connection pool size
- Optimize query performance
- Enable caching strategies
- Consider horizontal scaling

#### High Response Times

- Review database indexes
- Implement query optimization
- Add Redis caching
- Optimize application code

#### Resource Violations

- Increase container memory limits
- Optimize CPU usage patterns
- Implement connection pooling
- Review resource allocation

## 📋 Test Results Analysis

### Interpreting Results

#### Success Indicators

- ✅ Success rate > 95%
- ✅ P95 response time < 1000ms
- ✅ Zero critical resource violations
- ✅ Database success rate > 95%

#### Warning Signs

- ⚠️ Success rate 90-95%
- ⚠️ P95 response time 1000-2000ms
- ⚠️ Memory usage > 80%
- ⚠️ Cache hit rate < 70%

#### Critical Issues

- 🔴 Success rate < 90%
- 🔴 P95 response time > 2000ms
- 🔴 Resource violations detected
- 🔴 Database connection failures > 10%

### Performance Recommendations

The test suite automatically generates recommendations based on results:

- **Resource scaling** suggestions
- **Configuration optimization** advice
- **Infrastructure improvements** recommendations
- **Application performance** enhancements

## 🤝 Integration

### Claude Flow Coordination

The load testing suite integrates with Claude Flow for agent coordination:

```bash
# Pre-task initialization
npx claude-flow@alpha hooks pre-task --description "Load testing"

# Results storage
npx claude-flow@alpha hooks post-edit --memory-key "MEDIANEST_PROD_VALIDATION/performance_load"

# Session management
npx claude-flow@alpha hooks session-end --export-metrics true
```

### Continuous Integration

Add to your CI/CD pipeline:

```yaml
- name: Load Testing
  run: |
    ./tests/load-testing/run-all-load-tests.sh
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "Load testing failed"
      exit 1
    fi
```

## 📚 Additional Resources

- [MediaNest Documentation](../../../docs/)
- [Performance Optimization Guide](../../../docs/performance/)
- [Container Configuration](../../docker-compose.production.yml)
- [Database Schema](../../../database/)

## 🔍 Monitoring & Observability

The load testing suite includes built-in monitoring:

- Real-time progress tracking
- Resource usage visualization
- Error pattern detection
- Performance trend analysis

For production monitoring, integrate with:

- Prometheus metrics collection
- Grafana dashboards
- Application logging
- System monitoring tools

---

**Note**: This load testing suite is designed for production validation and should be run in appropriate test environments. Always ensure adequate resources are available for testing and monitor system behavior during test execution.
