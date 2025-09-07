# Observe Application - Comprehensive Logging System

## 🚀 Overview

This comprehensive logging system provides structured logging, centralized log management, and real-time monitoring for the Observe application. It includes correlation ID tracking, performance monitoring, security event logging, and a complete ELK stack for log aggregation and visualization.

## 🏗️ Architecture

### Backend Logging
- **Winston**: Structured logging with daily rotation
- **Correlation IDs**: Request tracking across services
- **Performance Monitoring**: Request/response timing
- **Security Events**: Authentication and access logging
- **Database Operations**: Query performance tracking
- **External Services**: API call logging

### Frontend Logging
- **Error Tracking**: Unhandled errors and exceptions
- **User Interactions**: Click tracking and user behavior
- **API Calls**: Frontend-to-backend request logging
- **Performance Metrics**: Page load times and performance
- **Security Events**: Client-side security monitoring

### Centralized Processing
- **Elasticsearch**: Log storage and indexing
- **Kibana**: Visualization and dashboards
- **Logstash**: Log processing and enrichment
- **Filebeat**: Log shipping and forwarding
- **Grafana**: Monitoring and alerting

## 📁 File Structure

```
/home/kinginyellow/projects/observe/
├── backend/src/middleware/
│   ├── logging.ts              # Core logging middleware
│   └── apiLogger.ts            # API-specific logging
├── backend/src/utils/
│   └── correlationId.ts        # Correlation ID management
├── frontend/src/lib/
│   └── logger.ts               # Frontend logging utility
├── config/monitoring/logging/
│   ├── winston.config.ts       # Winston configuration
│   ├── filebeat.yml           # Log shipping config
│   ├── logstash.conf          # Log processing
│   ├── elasticsearch-pipeline.json # ES processing pipeline
│   ├── docker-compose.logging.yml  # ELK stack setup
│   ├── kibana-dashboards.json # Pre-built dashboards
│   └── .env.example           # Environment configuration
└── scripts/
    ├── setup-logging.sh       # Complete setup script
    ├── monitor-logs.sh        # Real-time monitoring
    └── analyze-logs.sh        # Log analysis tools
```

## 🎯 Key Features

### 1. Structured Logging
```typescript
// Backend logging with correlation ID
logger.info('User action completed', {
  correlationId: 'req-123',
  userId: 'user456',
  operation: 'update_profile',
  duration: 245,
  metadata: { field: 'email' }
});
```

### 2. Correlation ID Tracking
```typescript
// Automatic correlation ID generation and propagation
export const requestLoggingMiddleware = (req, res, next) => {
  const correlationId = req.get('X-Correlation-ID') || uuidv4();
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);
  // ... logging logic
};
```

### 3. Performance Monitoring
```typescript
// Automatic performance tracking
logPerformanceMetric('api_response_time', 1250, 'ms', correlationId, {
  endpoint: 'POST /api/users',
  statusCode: 201
});
```

### 4. Frontend Error Tracking
```typescript
// Frontend error logging
logger.error('API call failed', {
  correlationId: 'fe-123',
  endpoint: '/api/users',
  error: error.message,
  userId: getCurrentUserId()
});
```

### 5. Security Event Logging
```typescript
// Authentication event tracking
logAuthEvent('login_failure', userId, correlationId, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  reason: 'invalid_password'
});
```

## 🚀 Quick Start

### 1. Setup
```bash
# Run the comprehensive setup script
./scripts/setup-logging.sh

# Or manual setup
mkdir -p logs
cd backend && npm install winston winston-daily-rotate-file uuid
cd ../frontend && npm install
```

### 2. Configuration
```bash
# Copy and configure environment variables
cp config/monitoring/logging/.env.example .env
# Edit .env with your specific settings
```

### 3. Start Services
```bash
# Start with enhanced logging
./scripts/start-with-logging.sh

# Or start ELK stack separately
cd config/monitoring/logging
docker-compose -f docker-compose.logging.yml up -d
```

### 4. Monitor and Analyze
```bash
# Real-time log monitoring
./scripts/monitor-logs.sh all        # All logs
./scripts/monitor-logs.sh error      # Error logs only

# Log analysis
./scripts/analyze-logs.sh performance # Performance analysis
./scripts/analyze-logs.sh security   # Security analysis
./scripts/analyze-logs.sh full       # Complete analysis
```

## 📊 Dashboard Access

- **Kibana**: http://localhost:5601 (Log visualization)
- **Grafana**: http://localhost:3001 (Metrics and alerting)
- **Elasticsearch**: http://localhost:9200 (Direct API access)
- **Application**: http://localhost:3000 (Backend API)

## 🔧 Configuration Options

### Environment Variables
```bash
# Logging levels
LOG_LEVEL=debug|info|warn|error

# Performance thresholds
SLOW_QUERY_THRESHOLD=1000    # ms
SLOW_REQUEST_THRESHOLD=5000  # ms

# Data logging
LOG_REQUEST_BODY=true|false
LOG_RESPONSE_BODY=true|false

# Elasticsearch
ELASTICSEARCH_HOST=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

### Winston Configuration
```typescript
// Custom log levels and formats
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Structured JSON format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);
```

## 📈 Monitoring and Alerting

### Built-in Dashboards
1. **Application Overview**: Log levels, response times, error timeline
2. **Performance Dashboard**: Slow queries, API response times
3. **Security Dashboard**: Authentication events, failed logins
4. **Error Analysis**: Error patterns, stack trace analysis

### Key Metrics
- Request/response times
- Error rates by endpoint
- Authentication success/failure rates
- Database query performance
- Memory and CPU usage
- Log volume and patterns

### Alerting Rules
- Error rate > 5% over 5 minutes
- Average response time > 2 seconds
- Failed authentication > 10 attempts/minute
- Database queries > 5 seconds
- Log ingestion failures

## 🔍 Log Analysis

### Correlation ID Tracking
```bash
# Find all logs for a specific request
grep "correlationId\":\"req-123" logs/combined-*.log

# Analyze request flow
./scripts/analyze-logs.sh correlation
```

### Performance Analysis
```bash
# Find slow requests
grep '"duration":[0-9]*' logs/combined-*.log | \
jq 'select(.duration > 1000)'

# Average response times
./scripts/analyze-logs.sh performance
```

### Security Analysis
```bash
# Failed authentication attempts
grep '"event":"login_failure"' logs/combined-*.log

# Security event analysis
./scripts/analyze-logs.sh security
```

## 🛠️ Development Usage

### Backend Integration
```typescript
import { requestLoggingMiddleware, logError } from './middleware/logging';

// Add to Express app
app.use(requestLoggingMiddleware);

// Error logging
try {
  await riskyOperation();
} catch (error) {
  logError(error, {
    correlationId: req.correlationId,
    operation: 'risky_operation'
  });
  throw error;
}
```

### Frontend Integration
```typescript
import logger from '@/lib/logger';

// Error logging
logger.error('Network request failed', {
  endpoint: '/api/users',
  error: error.message
});

// User interaction tracking
logger.userInteraction('button_click', 'ProfileForm', {
  action: 'save',
  formData: sanitizedData
});
```

### Database Integration
```typescript
import { logDatabaseOperation } from './middleware/logging';

// Wrap database operations
const startTime = performance.now();
try {
  const result = await db.query(sql, params);
  logDatabaseOperation('SELECT', 'users', correlationId, startTime, null, result);
  return result;
} catch (error) {
  logDatabaseOperation('SELECT', 'users', correlationId, startTime, error);
  throw error;
}
```

## 📚 Best Practices

### 1. Correlation ID Usage
- Always propagate correlation IDs across service boundaries
- Include correlation IDs in all log entries
- Use correlation IDs for request tracing

### 2. Sensitive Data
- Never log passwords, tokens, or personal data
- Use sanitization functions for request/response bodies
- Hash user IDs for privacy

### 3. Performance
- Use appropriate log levels (debug only in development)
- Implement log rotation to manage disk space
- Monitor log volume and adjust retention policies

### 4. Error Handling
- Log errors with full context and stack traces
- Include correlation IDs in error responses
- Implement error alerting for critical issues

## 🔒 Security Considerations

### Data Privacy
- Sensitive fields are automatically redacted
- User IDs are hashed in logs
- Request/response bodies are sanitized

### Access Control
- Log files have restricted permissions (644)
- Elasticsearch requires authentication in production
- Dashboard access should be restricted

### Retention Policies
- Logs are rotated daily and compressed
- Default retention: 30 days for active logs, 90 days archived
- Security logs may require longer retention

## 🚨 Troubleshooting

### Common Issues
1. **High disk usage**: Adjust log rotation settings
2. **Missing correlation IDs**: Check middleware order
3. **Elasticsearch connection**: Verify service status
4. **Log shipping failures**: Check Filebeat configuration

### Debug Commands
```bash
# Check log file permissions
ls -la logs/

# Test Elasticsearch connection
curl -X GET "localhost:9200/_cluster/health"

# Validate JSON log format
tail logs/combined-*.log | jq .

# Monitor log ingestion
./scripts/monitor-logs.sh stats
```

## 📞 Support

For issues or questions about the logging system:
1. Check the troubleshooting section
2. Review log analysis scripts output
3. Monitor dashboard alerts
4. Examine correlation ID flows for request tracing

---

**🎯 The comprehensive logging system provides full observability into your application's behavior, performance, and security events. Use the provided tools and dashboards to gain insights and maintain system health.**