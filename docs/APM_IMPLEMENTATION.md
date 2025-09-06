# APM and Error Tracking Implementation Guide

## 🎯 Overview

This document provides a comprehensive guide to the implemented Application Performance Monitoring (APM) and error tracking infrastructure for the Observe project. The implementation includes real-time error tracking, performance monitoring, alerting, and observability tools.

## 📋 Implementation Summary

### ✅ Completed Components

#### 1. Backend Error Tracking
- **File**: `/backend/src/config/sentry.ts`
- **Features**:
  - Comprehensive Sentry integration with Node.js profiling
  - Request/response tracking with user context
  - Database query performance monitoring
  - Custom transaction tracking
  - Automatic breadcrumb generation
  - Error filtering and sanitization

#### 2. Frontend Error Tracking
- **File**: `/frontend/src/lib/error-tracking.ts`
- **Features**:
  - React error boundaries with Sentry integration
  - Session replay for debugging
  - Core Web Vitals monitoring (LCP, FID, CLS)
  - User interaction tracking
  - API call performance monitoring
  - Custom event tracking

#### 3. Enhanced Error Boundaries
- **File**: `/frontend/src/components/ErrorBoundary.tsx`
- **Features**:
  - Custom React error boundary with fallback UI
  - Sentry error boundary wrapper
  - Enhanced error context capture
  - Development-friendly error display
  - HOC for component wrapping

#### 4. Performance Monitoring Hooks
- **File**: `/frontend/src/hooks/usePerformanceMonitoring.ts`
- **Features**:
  - Core Web Vitals tracking
  - Custom performance metrics
  - User interaction monitoring
  - API performance tracking
  - Resource loading analysis
  - Component render performance

#### 5. Backend Middleware
- **File**: `/backend/src/middleware/error-tracking.ts`
- **Features**:
  - Request context capture
  - Performance monitoring middleware
  - Database query wrapping
  - Rate limiting error handling
  - Validation error processing
  - Comprehensive error responses

#### 6. Performance Configuration
- **File**: `/config/monitoring/apm/performance-config.ts`
- **Features**:
  - Configurable performance thresholds
  - API endpoint monitoring rules
  - Database performance settings
  - Core Web Vitals configuration
  - Error budget calculations
  - Performance classification

#### 7. Alert Configuration
- **File**: `/config/monitoring/alerts/alert-config.ts`
- **Features**:
  - Multi-channel notification system
  - SLO-based alerting rules
  - Error budget tracking
  - Intelligent alert routing
  - Prometheus alert generation
  - Notification service integration

#### 8. Dashboard Configuration
- **File**: `/config/monitoring/dashboards/error-dashboard.ts`
- **Features**:
  - Comprehensive error tracking dashboard
  - Performance monitoring dashboard
  - Grafana dashboard generation
  - Custom panel configurations
  - Real-time metrics visualization

#### 9. SLI/SLO Monitoring
- **File**: `/config/monitoring/apm/sli-monitoring.ts`
- **Features**:
  - Service Level Indicator definitions
  - Service Level Objective tracking
  - Error budget calculation and monitoring
  - Prometheus rule generation
  - SLO reporting and analysis

#### 10. Enhanced Logger
- **File**: `/backend/src/utils/logger.ts`
- **Features**:
  - Winston logging with Sentry integration
  - Structured logging with metadata
  - Performance logging
  - Security event logging
  - Business event tracking

#### 11. Monitoring Infrastructure
- **File**: `/config/monitoring/apm/docker-compose.monitoring.yml`
- **Features**:
  - Complete monitoring stack (Prometheus, Grafana, Alertmanager)
  - Distributed tracing with Jaeger
  - Log aggregation with Loki
  - Container and system metrics
  - Auto-scaling monitoring services

## 🔧 Configuration Files

### Environment Variables Required

```bash
# Backend Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Frontend Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.01
NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE=1.0

# Monitoring
GRAFANA_ADMIN_PASSWORD=secure-password
PROMETHEUS_RETENTION=90d

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook
PAGERDUTY_INTEGRATION_KEY=your-integration-key
```

### Package Dependencies

```json
{
  "dependencies": {
    "@sentry/node": "^7.84.0",
    "@sentry/react": "^7.84.0",
    "@sentry/profiling-node": "^1.3.1",
    "winston": "^3.11.0",
    "prom-client": "^15.1.0"
  }
}
```

## 🚀 Quick Start Integration

### Backend Setup

```typescript
// app.ts
import { sentryService } from './config/sentry';
import { errorTrackingMiddleware } from './middleware/error-tracking';

// Initialize Sentry
sentryService.initialize();

// Add middleware in order
app.use(sentryService.requestHandler());
app.use(sentryService.tracingHandler());
app.use(errorTrackingMiddleware.captureContext());
app.use(errorTrackingMiddleware.monitorPerformance());

// Your routes here
app.use('/api', routes);

// Error handling (must be last)
app.use(sentryService.errorHandler());
app.use(errorTrackingMiddleware.handleError());
```

### Frontend Setup

```typescript
// _app.tsx or main.tsx
import { frontendErrorTracking } from '../lib/error-tracking';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize error tracking
frontendErrorTracking.initialize();

function App() {
  return (
    <ErrorBoundary>
      <YourAppComponents />
    </ErrorBoundary>
  );
}
```

### Component Performance Monitoring

```typescript
// Component usage
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';

function MyComponent() {
  const { trackInteractionPerformance } = usePerformanceMonitoring('MyComponent');
  
  const handleClick = () => {
    const start = performance.now();
    // Perform action
    trackInteractionPerformance('button_click', start, 'submit-button');
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

## 📊 Monitoring Stack

### Services Included

1. **Prometheus** (`:9090`) - Metrics collection and storage
2. **Grafana** (`:3000`) - Visualization and dashboards  
3. **Alertmanager** (`:9093`) - Alert routing and notifications
4. **Jaeger** (`:16686`) - Distributed tracing
5. **Loki** (`:3100`) - Log aggregation
6. **Node Exporter** (`:9100`) - System metrics
7. **cAdvisor** (`:8080`) - Container metrics

### Start Monitoring Stack

```bash
# Start all services
docker-compose -f config/monitoring/apm/docker-compose.monitoring.yml up -d

# Check status
docker-compose -f config/monitoring/apm/docker-compose.monitoring.yml ps

# View logs
docker-compose -f config/monitoring/apm/docker-compose.monitoring.yml logs -f
```

## 🎯 Key Features Implemented

### 1. Real-Time Error Tracking
- Automatic error detection and reporting
- Rich context capture (user, request, system info)
- Error grouping and deduplication
- Impact analysis and user correlation
- Source map support for stack traces

### 2. Performance Monitoring
- API endpoint response time tracking
- Database query performance monitoring
- Frontend Core Web Vitals measurement
- Resource loading analysis
- User interaction performance

### 3. Intelligent Alerting
- SLO-based alert rules
- Multi-channel notifications (Slack, Email, PagerDuty)
- Error budget tracking and alerts
- Smart escalation policies
- Alert deduplication and suppression

### 4. Comprehensive Dashboards
- Error tracking and analysis dashboard
- Performance monitoring dashboard
- Infrastructure health dashboard
- Business metrics dashboard
- Custom dashboard generation

### 5. Service Level Monitoring
- SLI/SLO definition and tracking
- Error budget calculation
- Performance target monitoring
- Automated violation detection
- Historical trend analysis

## 🚨 Default Alert Rules

### Critical Alerts
- **Service Unavailable**: < 99% availability over 5 minutes
- **High Error Rate**: > 5% error rate over 5 minutes  
- **Slow Response Time**: > 2 seconds 95th percentile
- **Database Issues**: > 1 second query time
- **Low Disk Space**: > 90% disk usage

### Warning Alerts
- **Performance Degradation**: Increasing response times
- **Error Budget Consumption**: > 80% budget consumed
- **Frontend Issues**: Poor Core Web Vitals
- **High Resource Usage**: > 80% CPU/Memory usage

## 📈 Performance Thresholds

### API Performance
- **Slow Request**: > 1000ms response time
- **Error Rate**: > 5% error threshold
- **Throughput**: < 100 requests/second alert

### Frontend Performance  
- **LCP**: > 2.5s for good, > 4s for poor
- **FID**: > 100ms for good, > 300ms for poor
- **CLS**: > 0.1 for good, > 0.25 for poor

### Database Performance
- **Slow Query**: > 500ms execution time
- **Connection Pool**: Monitor active/idle connections
- **Query Analysis**: Automatic optimization suggestions

## 🔒 Security & Privacy

### Data Protection
- Automatic sensitive data filtering (passwords, tokens)
- GDPR-compliant user data handling
- Configurable data retention policies
- Secure transport encryption (TLS/SSL)

### Access Control
- Role-based dashboard access
- API key management
- Audit logging for configuration changes
- Secure webhook endpoints

## 🎯 Next Steps

### Recommended Enhancements
1. **Custom Metrics**: Add business-specific KPIs
2. **A/B Testing Integration**: Performance impact analysis
3. **Mobile APM**: React Native error tracking
4. **Synthetic Monitoring**: Proactive uptime checks
5. **Cost Optimization**: Resource usage optimization

### Integration Opportunities
1. **CI/CD Pipeline**: Performance regression detection
2. **Incident Management**: PagerDuty/OpsGenie integration
3. **Business Intelligence**: Metrics correlation with business outcomes
4. **Capacity Planning**: Predictive scaling based on metrics

## 📚 Documentation References

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [SRE Practices](https://sre.google/sre-book/service-level-objectives/)

## ✅ Implementation Status

All required APM and error tracking components have been successfully implemented:

- ✅ Backend Sentry integration with performance profiling
- ✅ Frontend error tracking with session replay
- ✅ React error boundaries with enhanced context
- ✅ Performance monitoring hooks and utilities
- ✅ Comprehensive middleware for error capture
- ✅ Configurable performance thresholds
- ✅ Multi-channel alerting system
- ✅ Rich dashboard configurations
- ✅ SLI/SLO monitoring framework
- ✅ Enhanced logging with Sentry integration
- ✅ Complete monitoring infrastructure stack

The implementation provides production-ready error tracking, performance monitoring, and observability capabilities for the Observe project.