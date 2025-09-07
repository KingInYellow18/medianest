# Distributed Tracing Setup Guide

## Overview

This project implements comprehensive distributed tracing using OpenTelemetry and Jaeger to provide end-to-end visibility across the full-stack application.

## Architecture

```
Frontend (React) → Backend (Node.js/Express) → Database (PostgreSQL)
      ↓                      ↓                        ↓
   Browser Tracing    OpenTelemetry SDK      Auto-instrumentation
      ↓                      ↓                        ↓
   Custom Spans       Express/HTTP Spans      Prisma/SQL Spans
      ↓                      ↓                        ↓
        ↘️                    ↓                      ↙️
          → Jaeger Collector → Jaeger Query UI ←
                    ↓
              OTLP Collector (optional)
                    ↓
             Elasticsearch (production)
```

## Quick Start

### 1. Start Tracing Infrastructure

```bash
# Development setup (Jaeger all-in-one)
./scripts/start-tracing.sh

# Production setup (with Elasticsearch)
PROFILE=production ./scripts/start-tracing.sh
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

```bash
# Backend .env
JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTLP_ENDPOINT=http://localhost:4318/v1/traces
TRACING_ENABLED=true
SERVICE_NAME=observe-backend
SERVICE_VERSION=1.0.0
NODE_ENV=development
```

### 4. Start Application

```bash
# Backend with tracing
cd backend
npm run dev

# Frontend with correlation
cd frontend
npm start
```

### 5. View Traces

Open [Jaeger UI](http://localhost:16686) to view traces.

## Features

### Backend Tracing

- **Automatic Instrumentation**:

  - Express.js routes and middleware
  - HTTP client requests
  - Prisma database operations
  - Redis cache operations

- **Custom Business Spans**:

  - User operations
  - API endpoint logic
  - External service calls
  - Cache operations

- **Correlation Support**:
  - Request correlation IDs
  - Trace context propagation
  - Cross-service correlation

### Frontend Tracing

- **Client-side Spans**:

  - Page navigation tracking
  - User interaction events
  - API call correlation
  - Performance metrics

- **Correlation Headers**:
  - `X-Correlation-ID`
  - `X-Session-ID`
  - `X-User-Agent`
  - `X-Timestamp`

### Infrastructure

- **Jaeger Components**:

  - All-in-one (development)
  - Collector + Query (production)
  - Elasticsearch storage
  - OTLP collector

- **Monitoring**:
  - Performance alerts
  - Error rate tracking
  - Latency monitoring
  - Resource usage

## Usage Examples

### Backend Custom Spans

```typescript
import { tracer } from './utils/tracer';

// Business operation span
app.post('/api/orders', async (req, res) => {
  const order = await tracer.withBusinessSpan(
    'create_order',
    async (span) => {
      span.setAttributes({
        'user.id': req.body.userId,
        'order.items_count': req.body.items.length,
        'order.total_amount': req.body.total,
      });

      // Business logic here
      const order = await createOrder(req.body);

      span.addEvent('order_created', {
        'order.id': order.id,
        'order.status': order.status,
      });

      return order;
    },
    {
      'user.id': req.body.userId,
      'operation.type': 'order_management',
    }
  );

  res.json({ order });
});

// Database operation span
async function getUserById(id: string) {
  return tracer.withDatabaseSpan(
    'select',
    'users',
    async (span) => {
      span.setAttributes({
        'user.id': id,
        'db.query_type': 'point_lookup',
      });

      const user = await prisma.user.findUnique({
        where: { id },
      });

      span.setAttributes({
        'db.rows_returned': user ? 1 : 0,
      });

      return user;
    },
    'SELECT * FROM users WHERE id = $1'
  );
}

// HTTP client span
async function fetchExternalData(url: string) {
  return tracer.withHttpSpan(
    'GET',
    url,
    async (span) => {
      const response = await fetch(url);

      span.setAttributes({
        'http.status_code': response.status,
        'http.response_size': response.headers.get('content-length') || 0,
      });

      return response.json();
    },
    'external-api'
  );
}
```

### Frontend Correlation

```typescript
import { tracer } from './utils/tracing';

// API call with automatic correlation
const fetchUsers = async () => {
  const users = await tracer.trackAPICall('/api/users', { method: 'GET' }, 'users.fetch');
  return users;
};

// Track user interactions
const handleButtonClick = (buttonId: string) => {
  tracer.trackInteraction('button', 'click', {
    'button.id': buttonId,
    'page.route': window.location.pathname,
  });

  // Business logic
  performAction();
};

// Custom client span
const processData = async (data: any[]) => {
  const span = tracer.startClientSpan('data.process', {
    'data.items_count': data.length,
    'process.type': 'batch',
  });

  try {
    const results = await Promise.all(data.map((item) => processItem(item)));

    span.setAttributes({
      'process.success_count': results.filter((r) => r.success).length,
      'process.error_count': results.filter((r) => !r.success).length,
    });

    span.end();
    return results;
  } catch (error) {
    span.endWithError(error);
    throw error;
  }
};
```

## Configuration

### Sampling Configuration

```typescript
// Adjust in backend/src/config/tracing.ts
const samplingConfig = {
  // 100% in dev, 10% in production
  ratio: ENVIRONMENT === 'development' ? 1.0 : 0.1,
  maxTracesPerSecond: 1000,
  excludeHealthChecks: true,
  excludeStaticAssets: true,
  highVolumeOperations: ['GET /health', 'GET /metrics', 'GET /static/*'],
};
```

### Alert Configuration

```yaml
# config/monitoring/jaeger/alerts.yml
- alert: HighErrorRate
  expr: (error_rate) > 5%
  for: 2m
  labels:
    severity: warning

- alert: HighLatency
  expr: (p95_latency) > 1s
  for: 3m
  labels:
    severity: warning

- alert: CriticalLatency
  expr: (p95_latency) > 5s
  for: 1m
  labels:
    severity: critical
```

## Performance Optimization

### Sampling Strategies

1. **Head-based Sampling**: Sample at trace start
2. **Tail-based Sampling**: Sample after trace completion
3. **Probabilistic Sampling**: Random percentage
4. **Rate Limiting**: Maximum spans per second

### Batch Configuration

```typescript
// Optimize span export performance
spanProcessor: new BatchSpanProcessor(exporter, {
  maxExportBatchSize: 100,
  maxQueueSize: 1000,
  exportTimeoutMillis: 30000,
  scheduledDelayMillis: 5000,
});
```

### Memory Management

- Use memory ballast for stable performance
- Configure span retention policies
- Monitor collector resource usage
- Implement proper cleanup

## Troubleshooting

### Common Issues

1. **No traces appearing**:

   - Check collector endpoint connectivity
   - Verify OTLP/Jaeger exporter configuration
   - Ensure sampling rate > 0

2. **High memory usage**:

   - Reduce sampling rate
   - Optimize batch size
   - Check for span leaks

3. **Missing spans**:
   - Verify instrumentation is loaded
   - Check span processor configuration
   - Ensure proper context propagation

### Debug Commands

```bash
# Check collector health
curl http://localhost:8888/

# View collector metrics
curl http://localhost:8889/metrics

# Test span submission
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[...]}'
```

## Production Deployment

### Docker Compose

```yaml
# Production setup with Elasticsearch
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

  jaeger-collector:
    image: jaegertracing/jaeger-collector:1.50
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200

  jaeger-query:
    image: jaegertracing/jaeger-query:1.50
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
```

### Kubernetes Deployment

Use Jaeger Operator for production Kubernetes deployments:

```yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: observe-jaeger
spec:
  strategy: production
  storage:
    type: elasticsearch
    elasticsearch:
      nodeCount: 3
      redundancyPolicy: SingleRedundancy
```

## Security Considerations

1. **Sensitive Data**: Avoid tracing sensitive information
2. **Network Security**: Use TLS for collector communication
3. **Access Control**: Restrict Jaeger UI access
4. **Data Retention**: Configure appropriate trace retention policies

## Monitoring and Alerting

- Set up alerts for high error rates
- Monitor trace collection performance
- Track collector resource usage
- Alert on service availability issues

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OTLP Specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/otlp.md)
