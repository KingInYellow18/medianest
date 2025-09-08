# MediaNest Service Mesh Architecture

## Executive Summary

This document outlines the service mesh architecture for MediaNest, providing advanced microservices communication, security, and observability through a dedicated infrastructure layer.

## Current Communication Architecture

### Existing Patterns
- **Direct HTTP calls** between services
- **Basic Express.js routing** within monolithic backend
- **Simple WebSocket connections** for real-time updates
- **Redis pub/sub** for basic messaging
- **Docker networking** for container communication

### Identified Limitations
1. **No Traffic Management**: Basic request routing without intelligent load balancing
2. **Limited Security**: No mTLS or advanced authentication between services
3. **Basic Observability**: Limited distributed tracing and metrics collection
4. **Manual Configuration**: Service discovery through environment variables
5. **No Fault Tolerance**: Basic circuit breaker without sophisticated patterns
6. **Configuration Complexity**: Manual service configuration management

## Service Mesh Technology Evaluation

### 1. Istio Service Mesh (Recommended)

#### Advantages
- **Complete Feature Set**: Traffic management, security, observability
- **Kubernetes Native**: Excellent integration with container orchestration
- **Mature Ecosystem**: Extensive documentation and community support
- **Enterprise Ready**: Production-tested at scale

#### Architecture Components
```yaml
# Istio Components for MediaNest
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: medianest-istio
spec:
  values:
    global:
      meshID: medianest-mesh
      network: medianest-network
  components:
    pilot:
      k8s:
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
    ingressGateways:
    - name: istio-ingressgateway
      enabled: true
      k8s:
        service:
          ports:
          - port: 80
            targetPort: 8080
            name: http2
          - port: 443
            targetPort: 8443
            name: https
    egressGateways:
    - name: istio-egressgateway
      enabled: true
```

### 2. Linkerd (Lightweight Alternative)

#### Advantages
- **Simplicity**: Easier to deploy and manage
- **Performance**: Lower resource overhead
- **Security First**: Built-in mTLS by default
- **Rust-based**: Memory safe and fast

#### Configuration
```yaml
# Linkerd configuration for MediaNest
apiVersion: v1
kind: ConfigMap
metadata:
  name: linkerd-config
  namespace: linkerd
data:
  global: |
    {
      "linkerdNamespace": "linkerd",
      "cniEnabled": false,
      "identityContext": {
        "trustDomain": "medianest.local",
        "trustAnchorsPem": "...",
        "issuanceLifetime": "24h0m0s",
        "clockSkewAllowance": "20s"
      }
    }
```

### 3. Consul Connect (HashiCorp)

#### Advantages
- **Service Discovery**: Integrated with Consul service registry
- **Multi-Platform**: Supports VMs and containers
- **Intention-Based Security**: Declarative service communication policies
- **Connect Native**: Support for non-proxy integration

## MediaNest Service Mesh Implementation

### 1. Service Definitions

```typescript
// Service registry for MediaNest components
interface ServiceDefinition {
  name: string;
  namespace: string;
  version: string;
  ports: ServicePort[];
  dependencies: ServiceDependency[];
  policies: ServicePolicy[];
  metrics: MetricsConfig;
}

const MEDIANEST_SERVICES: ServiceDefinition[] = [
  {
    name: 'medianest-backend',
    namespace: 'medianest',
    version: '2.0.0',
    ports: [
      { name: 'http', port: 4000, protocol: 'HTTP' },
      { name: 'websocket', port: 4001, protocol: 'WS' }
    ],
    dependencies: [
      { name: 'postgres', type: 'database' },
      { name: 'redis', type: 'cache' },
      { name: 'plex-service', type: 'integration' }
    ],
    policies: [
      { type: 'rate-limit', config: { rpm: 1000 } },
      { type: 'circuit-breaker', config: { threshold: 0.5 } }
    ],
    metrics: {
      enabled: true,
      path: '/metrics',
      interval: '30s'
    }
  },
  
  {
    name: 'medianest-frontend',
    namespace: 'medianest',
    version: '2.0.0',
    ports: [
      { name: 'http', port: 3000, protocol: 'HTTP' }
    ],
    dependencies: [
      { name: 'medianest-backend', type: 'api' }
    ],
    policies: [
      { type: 'cors', config: { origins: ['*'] } }
    ],
    metrics: {
      enabled: true,
      path: '/api/metrics',
      interval: '30s'
    }
  },
  
  {
    name: 'integration-service',
    namespace: 'medianest',
    version: '1.0.0',
    ports: [
      { name: 'grpc', port: 5000, protocol: 'GRPC' }
    ],
    dependencies: [
      { name: 'plex-api', type: 'external' },
      { name: 'overseerr-api', type: 'external' },
      { name: 'uptime-kuma', type: 'external' }
    ],
    policies: [
      { type: 'retry', config: { attempts: 3, backoff: 'exponential' } },
      { type: 'timeout', config: { request: '30s' } }
    ],
    metrics: {
      enabled: true,
      path: '/metrics',
      interval: '15s'
    }
  }
];
```

### 2. Traffic Management Configuration

```yaml
# Istio Traffic Management for MediaNest
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: medianest-backend
  namespace: medianest
spec:
  hosts:
  - medianest-backend
  http:
  - match:
    - uri:
        prefix: "/api/v1"
    route:
    - destination:
        host: medianest-backend
        subset: v1
      weight: 90
    - destination:
        host: medianest-backend
        subset: v2
      weight: 10
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: gateway-error,connect-failure,refused-stream
  - match:
    - uri:
        prefix: "/api/admin"
    route:
    - destination:
        host: medianest-backend
        subset: admin
    headers:
      request:
        add:
          admin-route: "true"
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: medianest-backend
  namespace: medianest
spec:
  host: medianest-backend
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 50
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 2
    circuitBreaker:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: admin
    labels:
      tier: admin
```

### 3. Security Policies

```yaml
# mTLS Policy
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: medianest-mtls
  namespace: medianest
spec:
  mtls:
    mode: STRICT
---
# Authorization Policies
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: medianest-authz
  namespace: medianest
spec:
  selector:
    matchLabels:
      app: medianest-backend
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/medianest/sa/frontend-service-account"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
  - when:
    - key: request.headers[authorization]
      values: ["Bearer *"]
---
# Service-to-Service Communication Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: integration-service-policy
  namespace: medianest
spec:
  selector:
    matchLabels:
      app: integration-service
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/medianest/sa/backend-service-account"]
  - to:
    - operation:
        methods: ["POST", "GET"]
        paths: ["/integration/*"]
```

### 4. Service Mesh Gateway Configuration

```yaml
# Ingress Gateway
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: medianest-gateway
  namespace: medianest
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "medianest.local"
    - "api.medianest.local"
    tls:
      httpsRedirect: true
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: medianest-tls-secret
    hosts:
    - "medianest.local"
    - "api.medianest.local"
---
# External Services Gateway
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: external-plex-api
  namespace: medianest
spec:
  hosts:
  - plex.tv
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: external-plex-routing
  namespace: medianest
spec:
  hosts:
  - plex.tv
  http:
  - timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
    route:
    - destination:
        host: plex.tv
```

## Observability Integration

### 1. Distributed Tracing

```typescript
// Jaeger Tracing Integration
class ServiceMeshTracing {
  private tracer: Tracer;
  
  constructor() {
    this.tracer = initTracerFromEnv({
      serviceName: 'medianest-service-mesh',
      sampler: {
        type: 'probabilistic',
        param: 0.1 // Sample 10% of traces
      },
      reporter: {
        agentHost: process.env.JAEGER_AGENT_HOST || 'jaeger-agent',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6832')
      }
    });
  }
  
  createSpan(operationName: string, parentSpan?: Span): Span {
    return this.tracer.startSpan(operationName, {
      childOf: parentSpan,
      tags: {
        'service.mesh': 'istio',
        'service.namespace': 'medianest',
        'service.version': process.env.SERVICE_VERSION
      }
    });
  }
  
  injectHeaders(span: Span): Record<string, string> {
    const headers: Record<string, string> = {};
    this.tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
    return headers;
  }
  
  extractSpan(headers: Record<string, string>): SpanContext | null {
    return this.tracer.extract(FORMAT_HTTP_HEADERS, headers);
  }
}

// Service-to-Service Tracing Middleware
class TracingMiddleware {
  static createExpressMiddleware(tracing: ServiceMeshTracing) {
    return (req: Request, res: Response, next: NextFunction) => {
      const parentSpanContext = tracing.extractSpan(req.headers as Record<string, string>);
      
      const span = tracing.createSpan(`${req.method} ${req.path}`, parentSpanContext || undefined);
      
      span.setTag('http.method', req.method);
      span.setTag('http.url', req.url);
      span.setTag('user.id', req.user?.id || 'anonymous');
      
      // Store span in request context
      (req as any).span = span;
      
      res.on('finish', () => {
        span.setTag('http.status_code', res.statusCode);
        span.setTag('response.size', res.get('content-length') || 0);
        
        if (res.statusCode >= 400) {
          span.setTag('error', true);
        }
        
        span.finish();
      });
      
      next();
    };
  }
}
```

### 2. Metrics Collection

```yaml
# Prometheus ServiceMonitor for MediaNest
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: medianest-service-monitor
  namespace: medianest
  labels:
    app: medianest
spec:
  selector:
    matchLabels:
      app: medianest-backend
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    honorLabels: true
---
apiVersion: v1
kind: Service
metadata:
  name: medianest-backend-metrics
  namespace: medianest
  labels:
    app: medianest-backend
spec:
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
  selector:
    app: medianest-backend
```

### 3. Custom Metrics

```typescript
// Service Mesh Metrics
class ServiceMeshMetrics {
  private registry = new prometheus.Registry();
  
  private serviceRequestCount = new prometheus.Counter({
    name: 'mesh_service_requests_total',
    help: 'Total number of service requests',
    labelNames: ['source_service', 'destination_service', 'method', 'status'],
    registers: [this.registry]
  });
  
  private serviceRequestDuration = new prometheus.Histogram({
    name: 'mesh_service_request_duration_seconds',
    help: 'Service request duration in seconds',
    labelNames: ['source_service', 'destination_service', 'method'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
    registers: [this.registry]
  });
  
  private circuitBreakerState = new prometheus.Gauge({
    name: 'mesh_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['service', 'destination'],
    registers: [this.registry]
  });
  
  recordRequest(source: string, destination: string, method: string, status: number, duration: number): void {
    this.serviceRequestCount.inc({
      source_service: source,
      destination_service: destination,
      method,
      status: status.toString()
    });
    
    this.serviceRequestDuration.observe({
      source_service: source,
      destination_service: destination,
      method
    }, duration / 1000);
  }
  
  updateCircuitBreakerState(service: string, destination: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateValue = { closed: 0, open: 1, 'half-open': 2 }[state];
    this.circuitBreakerState.set({ service, destination }, stateValue);
  }
  
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

## Traffic Management Patterns

### 1. Canary Deployments

```yaml
# Canary Deployment Configuration
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: medianest-backend-rollout
  namespace: medianest
spec:
  replicas: 5
  strategy:
    canary:
      canaryService: medianest-backend-canary
      stableService: medianest-backend-stable
      trafficRouting:
        istio:
          virtualService:
            name: medianest-backend
          destinationRule:
            name: medianest-backend
            canarySubsetName: canary
            stableSubsetName: stable
      steps:
      - setWeight: 10
      - pause: {duration: 2m}
      - setWeight: 20
      - pause: {duration: 2m}
      - setWeight: 50
      - pause: {duration: 2m}
      - setWeight: 100
      analysis:
        templates:
        - templateName: success-rate
        startingStep: 2
        args:
        - name: service-name
          value: medianest-backend
  selector:
    matchLabels:
      app: medianest-backend
  template:
    metadata:
      labels:
        app: medianest-backend
    spec:
      containers:
      - name: backend
        image: medianest/backend:2.0.0
        ports:
        - containerPort: 4000
```

### 2. Circuit Breaker Implementation

```typescript
// Enhanced Circuit Breaker for Service Mesh
class ServiceMeshCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures: number = 0;
  private lastFailureTime?: number;
  private metrics: ServiceMeshMetrics;
  
  constructor(
    private serviceName: string,
    private destination: string,
    private config: CircuitBreakerConfig,
    metrics: ServiceMeshMetrics
  ) {
    this.metrics = metrics;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.updateMetrics();
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.updateMetrics();
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
    
    this.updateMetrics();
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailureTime && 
           (Date.now() - this.lastFailureTime) > this.config.resetTimeout;
  }
  
  private updateMetrics(): void {
    this.metrics.updateCircuitBreakerState(this.serviceName, this.destination, this.state.toLowerCase() as any);
  }
}
```

### 3. Load Balancing Strategies

```yaml
# Advanced Load Balancing Configuration
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: medianest-advanced-lb
  namespace: medianest
spec:
  host: medianest-backend
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpHeaderName: "user-id"  # Session affinity
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 30s
        keepalive:
          time: 7200s
          interval: 75s
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
        maxRequestsPerConnection: 10
        maxRetries: 3
        idleTimeout: 90s
        h2UpgradePolicy: UPGRADE
    circuitBreaker:
      consecutiveGatewayErrors: 5
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 30
  portLevelSettings:
  - port:
      number: 4000
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 50
```

## Fault Injection & Testing

### 1. Chaos Engineering

```yaml
# Fault Injection for Testing
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: medianest-fault-injection
  namespace: medianest
spec:
  hosts:
  - medianest-backend
  http:
  - match:
    - headers:
        test-scenario:
          exact: "fault-injection"
    fault:
      delay:
        percentage:
          value: 20.0  # 20% of requests
        fixedDelay: 5s
      abort:
        percentage:
          value: 10.0  # 10% of requests
        httpStatus: 503
    route:
    - destination:
        host: medianest-backend
  - route:
    - destination:
        host: medianest-backend
```

### 2. Resilience Testing

```typescript
// Service Mesh Resilience Tests
class ResilienceTests {
  async testCircuitBreaker(serviceName: string): Promise<TestResult> {
    const results = [];
    
    // Generate failing requests to trigger circuit breaker
    for (let i = 0; i < 10; i++) {
      try {
        await this.makeRequest(serviceName, { simulateFailure: true });
      } catch (error) {
        results.push({ request: i, failed: true });
      }
    }
    
    // Verify circuit breaker is open
    const circuitBreakerState = await this.getCircuitBreakerState(serviceName);
    
    return {
      test: 'circuit-breaker',
      passed: circuitBreakerState === 'OPEN',
      details: { requests: results, finalState: circuitBreakerState }
    };
  }
  
  async testRetryPolicy(serviceName: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest(serviceName, { 
        simulateIntermittentFailure: true,
        failureRate: 0.7 // 70% failure rate
      });
      
      const duration = Date.now() - startTime;
      
      return {
        test: 'retry-policy',
        passed: duration > 3000, // Should have retried multiple times
        details: { duration, expectedRetries: 3 }
      };
    } catch (error) {
      return {
        test: 'retry-policy',
        passed: false,
        details: { error: error.message }
      };
    }
  }
}
```

## Deployment Strategy

### 1. Kubernetes Deployment

```yaml
# MediaNest Service Mesh Deployment
apiVersion: v1
kind: Namespace
metadata:
  name: medianest
  labels:
    istio-injection: enabled
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: medianest-backend
  namespace: medianest
spec:
  replicas: 3
  selector:
    matchLabels:
      app: medianest-backend
      version: v1
  template:
    metadata:
      labels:
        app: medianest-backend
        version: v1
      annotations:
        sidecar.istio.io/inject: "true"
        prometheus.io/scrape: "true"
        prometheus.io/path: "/metrics"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: medianest-backend
      containers:
      - name: backend
        image: medianest/backend:2.0.0
        ports:
        - containerPort: 4000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: JAEGER_AGENT_HOST
          value: "jaeger-agent.istio-system"
        - name: JAEGER_AGENT_PORT
          value: "6832"
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. Monitoring Dashboard

```yaml
# Grafana Dashboard for Service Mesh
apiVersion: v1
kind: ConfigMap
metadata:
  name: medianest-service-mesh-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "MediaNest Service Mesh",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(istio_requests_total{destination_service_name=\"medianest-backend\"}[5m])",
                "legendFormat": "{{source_service_name}} -> {{destination_service_name}}"
              }
            ]
          },
          {
            "title": "Success Rate",
            "type": "singlestat",
            "targets": [
              {
                "expr": "rate(istio_requests_total{destination_service_name=\"medianest-backend\",response_code!~\"5.*\"}[5m]) / rate(istio_requests_total{destination_service_name=\"medianest-backend\"}[5m])"
              }
            ]
          },
          {
            "title": "Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(istio_request_duration_milliseconds_bucket{destination_service_name=\"medianest-backend\"}[5m]))",
                "legendFormat": "95th percentile"
              }
            ]
          }
        ]
      }
    }
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Install Istio service mesh
- [ ] Configure basic traffic management
- [ ] Implement mTLS security
- [ ] Set up observability stack

### Phase 2: Advanced Features (Week 3-4)
- [ ] Implement circuit breakers
- [ ] Configure retry policies
- [ ] Set up canary deployments
- [ ] Add fault injection testing

### Phase 3: Production Ready (Week 5-6)
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Monitoring and alerting
- [ ] Documentation and training

This service mesh architecture transforms MediaNest into a resilient, observable, and secure microservices platform with enterprise-grade service communication capabilities.