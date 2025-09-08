# MediaNest API Gateway Design Specification

## Overview

This document outlines the comprehensive API Gateway architecture for MediaNest, providing centralized request routing, authentication, rate limiting, and protocol transformation capabilities.

## Current State Assessment

### Existing API Structure
MediaNest currently implements a direct Express.js REST API with:
- Basic CORS and helmet security
- Simple rate limiting with express-rate-limit
- Direct service-to-service communication
- Basic authentication middleware
- Manual route management

### Identified Limitations
1. **No Centralized Routing**: Each service exposes endpoints directly
2. **Limited Protocol Support**: Only HTTP/REST
3. **Basic Rate Limiting**: Simple IP-based limiting
4. **No Request Transformation**: Direct passthrough of requests
5. **Manual Load Balancing**: No intelligent traffic distribution
6. **Basic Monitoring**: Limited request analytics

## API Gateway Architecture

### 1. Gateway Core Components

```typescript
interface APIGatewayCore {
  router: IntelligentRouter;
  authenticator: AuthenticationManager;
  rateLimiter: RateLimitingEngine;
  transformer: RequestResponseTransformer;
  loadBalancer: LoadBalancingManager;
  monitor: APIMonitoringService;
}

class MediaNestAPIGateway implements APIGatewayCore {
  constructor(config: GatewayConfig) {
    this.router = new IntelligentRouter(config.routing);
    this.authenticator = new AuthenticationManager(config.auth);
    this.rateLimiter = new RateLimitingEngine(config.rateLimit);
    this.transformer = new RequestResponseTransformer(config.transform);
    this.loadBalancer = new LoadBalancingManager(config.loadBalancing);
    this.monitor = new APIMonitoringService(config.monitoring);
  }
  
  async processRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const span = this.monitor.startTrace('gateway_request');
    
    try {
      // 1. Authentication & Authorization
      const authResult = await this.authenticator.authenticate(request);
      if (!authResult.success) {
        return this.createErrorResponse(401, 'Unauthorized');
      }
      
      // 2. Rate Limiting
      const rateLimitResult = await this.rateLimiter.checkLimit(request, authResult.user);
      if (!rateLimitResult.allowed) {
        return this.createErrorResponse(429, 'Rate limit exceeded', rateLimitResult.headers);
      }
      
      // 3. Request Transformation
      const transformedRequest = await this.transformer.transformRequest(request);
      
      // 4. Route Resolution
      const route = await this.router.resolveRoute(transformedRequest);
      if (!route) {
        return this.createErrorResponse(404, 'Route not found');
      }
      
      // 5. Load Balancing
      const targetInstance = await this.loadBalancer.selectInstance(route.service);
      
      // 6. Forward Request
      const response = await this.forwardRequest(transformedRequest, targetInstance);
      
      // 7. Response Transformation
      const transformedResponse = await this.transformer.transformResponse(response, request);
      
      this.monitor.recordSuccess(span, response.status);
      return transformedResponse;
    } catch (error) {
      this.monitor.recordError(span, error);
      return this.createErrorResponse(500, 'Internal gateway error');
    } finally {
      this.monitor.finishTrace(span);
    }
  }
}
```

### 2. Intelligent Routing Engine

```typescript
interface RouteRule {
  id: string;
  pattern: string;
  method: string[];
  service: string;
  priority: number;
  conditions: RouteCondition[];
  transformations: RouteTransformation[];
  rateLimit?: RateLimitOverride;
  cache?: CacheConfig;
}

interface RouteCondition {
  type: 'header' | 'query' | 'body' | 'ip' | 'user' | 'time';
  operator: 'equals' | 'contains' | 'regex' | 'range';
  value: any;
}

class IntelligentRouter {
  private routes: Map<string, RouteRule[]> = new Map();
  private routeStats: Map<string, RouteStats> = new Map();
  
  async resolveRoute(request: GatewayRequest): Promise<ResolvedRoute | null> {
    // Sort routes by priority and success rate
    const candidateRoutes = this.findCandidateRoutes(request);
    const sortedRoutes = this.prioritizeRoutes(candidateRoutes);
    
    for (const route of sortedRoutes) {
      if (await this.evaluateConditions(route.conditions, request)) {
        return {
          rule: route,
          service: route.service,
          targetPath: this.transformPath(request.path, route.pattern),
          metadata: this.extractRouteMetadata(route, request)
        };
      }
    }
    
    return null;
  }
  
  private prioritizeRoutes(routes: RouteRule[]): RouteRule[] {
    return routes.sort((a, b) => {
      const statsA = this.routeStats.get(a.id) || { successRate: 1, avgResponseTime: 0 };
      const statsB = this.routeStats.get(b.id) || { successRate: 1, avgResponseTime: 0 };
      
      // Priority by: 1) Rule priority, 2) Success rate, 3) Response time
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (statsA.successRate !== statsB.successRate) return statsB.successRate - statsA.successRate;
      return statsA.avgResponseTime - statsB.avgResponseTime;
    });
  }
}
```

### 3. Authentication & Authorization Manager

```typescript
interface AuthenticationStrategy {
  name: string;
  authenticate(request: GatewayRequest): Promise<AuthResult>;
  validateToken(token: string): Promise<TokenValidation>;
}

class AuthenticationManager {
  private strategies: Map<string, AuthenticationStrategy> = new Map();
  private tokenCache: LRUCache<string, TokenValidation> = new LRUCache({ max: 1000, ttl: 300000 });
  
  constructor() {
    this.strategies.set('jwt', new JWTAuthStrategy());
    this.strategies.set('apikey', new APIKeyAuthStrategy());
    this.strategies.set('oauth', new OAuthAuthStrategy());
    this.strategies.set('plex', new PlexAuthStrategy());
  }
  
  async authenticate(request: GatewayRequest): Promise<AuthResult> {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return { success: false, error: 'No authorization header' };
    }
    
    // Determine auth strategy based on token format
    const strategy = this.detectAuthStrategy(authHeader);
    if (!strategy) {
      return { success: false, error: 'Unknown authentication method' };
    }
    
    // Check token cache first
    const cached = this.tokenCache.get(authHeader);
    if (cached && !this.isTokenExpired(cached)) {
      return { success: true, user: cached.user, permissions: cached.permissions };
    }
    
    // Authenticate using strategy
    const result = await strategy.authenticate(request);
    
    // Cache successful authentication
    if (result.success && result.user) {
      this.tokenCache.set(authHeader, {
        user: result.user,
        permissions: result.permissions,
        expires: new Date(Date.now() + 300000) // 5 minutes
      });
    }
    
    return result;
  }
}

class JWTAuthStrategy implements AuthenticationStrategy {
  name = 'jwt';
  
  async authenticate(request: GatewayRequest): Promise<AuthResult> {
    try {
      const token = this.extractTokenFromHeader(request.headers.authorization);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      
      return {
        success: true,
        user: decoded.user,
        permissions: decoded.permissions || []
      };
    } catch (error) {
      return { success: false, error: 'Invalid JWT token' };
    }
  }
  
  async validateToken(token: string): Promise<TokenValidation> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      return {
        valid: true,
        user: decoded.user,
        permissions: decoded.permissions,
        expires: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

### 4. Advanced Rate Limiting Engine

```typescript
interface RateLimitRule {
  id: string;
  scope: 'global' | 'user' | 'ip' | 'service' | 'endpoint';
  algorithm: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';
  limit: number;
  window: number; // in seconds
  burst?: number;
  priority: number;
}

class RateLimitingEngine {
  private rules: RateLimitRule[] = [];
  private limiters: Map<string, RateLimiter> = new Map();
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeDefaultRules();
  }
  
  async checkLimit(request: GatewayRequest, user?: User): Promise<RateLimitResult> {
    const applicableRules = this.findApplicableRules(request, user);
    
    for (const rule of applicableRules.sort((a, b) => b.priority - a.priority)) {
      const key = this.generateLimitKey(rule, request, user);
      const limiter = this.getLimiter(rule);
      
      const result = await limiter.checkLimit(key);
      
      if (!result.allowed) {
        return {
          allowed: false,
          rule: rule.id,
          remaining: result.remaining,
          resetTime: result.resetTime,
          headers: this.generateRateLimitHeaders(result)
        };
      }
    }
    
    return { allowed: true };
  }
  
  private getLimiter(rule: RateLimitRule): RateLimiter {
    const key = `${rule.id}-${rule.algorithm}`;
    
    if (!this.limiters.has(key)) {
      switch (rule.algorithm) {
        case 'token_bucket':
          this.limiters.set(key, new TokenBucketLimiter(this.redis, rule));
          break;
        case 'sliding_window':
          this.limiters.set(key, new SlidingWindowLimiter(this.redis, rule));
          break;
        case 'fixed_window':
          this.limiters.set(key, new FixedWindowLimiter(this.redis, rule));
          break;
        default:
          throw new Error(`Unsupported rate limiting algorithm: ${rule.algorithm}`);
      }
    }
    
    return this.limiters.get(key)!;
  }
}

class TokenBucketLimiter implements RateLimiter {
  constructor(private redis: Redis, private rule: RateLimitRule) {}
  
  async checkLimit(key: string): Promise<LimitCheckResult> {
    const bucketKey = `rate_limit:token_bucket:${key}`;
    
    // Lua script for atomic token bucket check
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Refill tokens
      local elapsed = (now - last_refill) / 1000
      tokens = math.min(capacity, tokens + (elapsed * refill_rate))
      
      if tokens >= requested then
        tokens = tokens - requested
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, ${this.rule.window})
        return {1, tokens, now + ((capacity - tokens) / refill_rate) * 1000}
      else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, ${this.rule.window})
        return {0, tokens, now + ((capacity - tokens + requested) / refill_rate) * 1000}
      end
    `;
    
    const result = await this.redis.eval(
      luaScript,
      1,
      bucketKey,
      this.rule.limit,
      this.rule.limit / this.rule.window,
      1,
      Date.now()
    ) as [number, number, number];
    
    return {
      allowed: result[0] === 1,
      remaining: Math.floor(result[1]),
      resetTime: new Date(result[2])
    };
  }
}
```

### 5. Request/Response Transformation Engine

```typescript
interface TransformationRule {
  id: string;
  phase: 'request' | 'response';
  condition: TransformCondition;
  operations: TransformOperation[];
}

interface TransformOperation {
  type: 'add_header' | 'remove_header' | 'modify_path' | 'transform_body' | 'add_query' | 'modify_status';
  config: any;
}

class RequestResponseTransformer {
  private rules: TransformationRule[] = [];
  
  async transformRequest(request: GatewayRequest): Promise<GatewayRequest> {
    const applicableRules = this.rules.filter(rule => 
      rule.phase === 'request' && this.evaluateCondition(rule.condition, request)
    );
    
    let transformedRequest = { ...request };
    
    for (const rule of applicableRules) {
      for (const operation of rule.operations) {
        transformedRequest = await this.applyTransformation(transformedRequest, operation);
      }
    }
    
    return transformedRequest;
  }
  
  async transformResponse(response: GatewayResponse, originalRequest: GatewayRequest): Promise<GatewayResponse> {
    const applicableRules = this.rules.filter(rule => 
      rule.phase === 'response' && this.evaluateCondition(rule.condition, originalRequest)
    );
    
    let transformedResponse = { ...response };
    
    for (const rule of applicableRules) {
      for (const operation of rule.operations) {
        transformedResponse = await this.applyResponseTransformation(transformedResponse, operation);
      }
    }
    
    return transformedResponse;
  }
  
  private async applyTransformation(request: GatewayRequest, operation: TransformOperation): Promise<GatewayRequest> {
    switch (operation.type) {
      case 'add_header':
        return {
          ...request,
          headers: {
            ...request.headers,
            [operation.config.name]: operation.config.value
          }
        };
        
      case 'modify_path':
        return {
          ...request,
          path: request.path.replace(operation.config.pattern, operation.config.replacement)
        };
        
      case 'transform_body':
        if (operation.config.transformer === 'json_to_xml') {
          return {
            ...request,
            body: this.jsonToXml(request.body),
            headers: {
              ...request.headers,
              'Content-Type': 'application/xml'
            }
          };
        }
        break;
        
      default:
        return request;
    }
    
    return request;
  }
}
```

### 6. Load Balancing Manager

```typescript
interface LoadBalancingStrategy {
  name: string;
  selectInstance(instances: ServiceInstance[], request?: GatewayRequest): Promise<ServiceInstance>;
}

class LoadBalancingManager {
  private strategies: Map<string, LoadBalancingStrategy> = new Map();
  private serviceInstances: Map<string, ServiceInstance[]> = new Map();
  private instanceHealth: Map<string, HealthStatus> = new Map();
  
  constructor() {
    this.strategies.set('round_robin', new RoundRobinStrategy());
    this.strategies.set('weighted_round_robin', new WeightedRoundRobinStrategy());
    this.strategies.set('least_connections', new LeastConnectionsStrategy());
    this.strategies.set('response_time', new ResponseTimeStrategy());
    this.strategies.set('consistent_hash', new ConsistentHashStrategy());
  }
  
  async selectInstance(serviceName: string, strategy: string = 'round_robin', request?: GatewayRequest): Promise<ServiceInstance> {
    const instances = this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances available for service: ${serviceName}`);
    }
    
    const loadBalancer = this.strategies.get(strategy);
    if (!loadBalancer) {
      throw new Error(`Unknown load balancing strategy: ${strategy}`);
    }
    
    return await loadBalancer.selectInstance(instances, request);
  }
  
  private getHealthyInstances(serviceName: string): ServiceInstance[] {
    const allInstances = this.serviceInstances.get(serviceName) || [];
    
    return allInstances.filter(instance => {
      const health = this.instanceHealth.get(instance.id);
      return health && health.healthy;
    });
  }
}

class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  name = 'weighted_round_robin';
  private currentWeights: Map<string, number> = new Map();
  
  async selectInstance(instances: ServiceInstance[]): Promise<ServiceInstance> {
    let totalWeight = 0;
    let selected: ServiceInstance | null = null;
    
    for (const instance of instances) {
      const currentWeight = this.currentWeights.get(instance.id) || 0;
      const newWeight = currentWeight + instance.weight;
      
      this.currentWeights.set(instance.id, newWeight);
      totalWeight += instance.weight;
      
      if (!selected || newWeight > this.currentWeights.get(selected.id)!) {
        selected = instance;
      }
    }
    
    if (selected) {
      const selectedWeight = this.currentWeights.get(selected.id)! - totalWeight;
      this.currentWeights.set(selected.id, selectedWeight);
    }
    
    return selected!;
  }
}
```

## Protocol Support

### 1. HTTP/REST to gRPC Translation

```typescript
class HTTPToGRPCAdapter {
  private protoDefinitions: Map<string, any> = new Map();
  private grpcClients: Map<string, any> = new Map();
  
  async translateRequest(httpRequest: GatewayRequest, grpcService: string): Promise<any> {
    const protoDefinition = this.protoDefinitions.get(grpcService);
    if (!protoDefinition) {
      throw new Error(`No proto definition found for service: ${grpcService}`);
    }
    
    // Map HTTP methods to gRPC methods
    const grpcMethod = this.mapHTTPMethodToGRPC(httpRequest.method, httpRequest.path);
    
    // Transform JSON body to protobuf message
    const grpcMessage = this.jsonToProtobuf(httpRequest.body, protoDefinition, grpcMethod);
    
    return {
      service: grpcService,
      method: grpcMethod,
      message: grpcMessage,
      metadata: this.createGRPCMetadata(httpRequest.headers)
    };
  }
  
  async translateResponse(grpcResponse: any): Promise<GatewayResponse> {
    return {
      status: grpcResponse.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...this.grpcMetadataToHTTPHeaders(grpcResponse.metadata)
      },
      body: this.protobufToJson(grpcResponse.message)
    };
  }
}
```

### 2. GraphQL Query Translation

```typescript
class GraphQLAdapter {
  private schemas: Map<string, GraphQLSchema> = new Map();
  
  async translateRESTToGraphQL(request: GatewayRequest): Promise<GraphQLRequest> {
    const { service, operation } = this.parseRESTEndpoint(request.path, request.method);
    const schema = this.schemas.get(service);
    
    if (!schema) {
      throw new Error(`No GraphQL schema found for service: ${service}`);
    }
    
    // Generate GraphQL query from REST request
    const query = this.generateGraphQLQuery(operation, request.query, request.body);
    const variables = this.extractVariables(request);
    
    return {
      query,
      variables,
      operationName: operation
    };
  }
  
  private generateGraphQLQuery(operation: string, queryParams: any, body: any): string {
    // Simplified GraphQL query generation
    if (operation === 'getMedia') {
      return `
        query GetMedia($id: ID!) {
          media(id: $id) {
            id
            title
            type
            metadata {
              duration
              resolution
              codec
            }
          }
        }
      `;
    }
    
    throw new Error(`Unsupported operation: ${operation}`);
  }
}
```

## Caching Strategy

### 1. Multi-Layer Caching

```typescript
class APIGatewayCaching {
  private l1Cache: LRUCache<string, any> = new LRUCache({ max: 1000 }); // In-memory
  private l2Cache: Redis; // Distributed cache
  private l3Cache: any; // CDN cache
  
  async get(key: string, options: CacheOptions = {}): Promise<any> {
    // L1: Memory cache
    const l1Result = this.l1Cache.get(key);
    if (l1Result) {
      return { data: l1Result, source: 'memory' };
    }
    
    // L2: Redis cache
    const l2Result = await this.l2Cache.get(key);
    if (l2Result) {
      const data = JSON.parse(l2Result);
      
      // Populate L1 cache
      this.l1Cache.set(key, data, { ttl: options.ttl || 300 });
      
      return { data, source: 'redis' };
    }
    
    // L3: CDN cache (for static content)
    if (options.cdnEnabled) {
      const l3Result = await this.fetchFromCDN(key);
      if (l3Result) {
        // Populate L1 and L2 caches
        this.l1Cache.set(key, l3Result);
        await this.l2Cache.setex(key, options.ttl || 300, JSON.stringify(l3Result));
        
        return { data: l3Result, source: 'cdn' };
      }
    }
    
    return null;
  }
  
  async set(key: string, data: any, options: CacheOptions = {}): Promise<void> {
    // Set in all cache layers
    this.l1Cache.set(key, data, { ttl: options.ttl || 300 });
    await this.l2Cache.setex(key, options.ttl || 300, JSON.stringify(data));
    
    if (options.cdnEnabled) {
      await this.pushToCDN(key, data);
    }
  }
}
```

## Performance Optimization

### 1. Connection Pooling

```typescript
class ConnectionPoolManager {
  private pools: Map<string, Pool> = new Map();
  
  getPool(service: string): Pool {
    if (!this.pools.has(service)) {
      this.pools.set(service, this.createPool(service));
    }
    
    return this.pools.get(service)!;
  }
  
  private createPool(service: string): Pool {
    const config = this.getServiceConfig(service);
    
    return new Pool({
      create: () => this.createConnection(service),
      destroy: (conn) => conn.close(),
      validate: (conn) => conn.isActive(),
      max: config.maxConnections || 10,
      min: config.minConnections || 2,
      acquireTimeoutMillis: config.acquireTimeout || 3000,
      idleTimeoutMillis: config.idleTimeout || 30000
    });
  }
}
```

### 2. Request Batching

```typescript
class RequestBatcher {
  private batches: Map<string, RequestBatch> = new Map();
  
  async addToBatch(request: GatewayRequest): Promise<BatchedResponse> {
    const batchKey = this.generateBatchKey(request);
    
    let batch = this.batches.get(batchKey);
    if (!batch) {
      batch = new RequestBatch(batchKey);
      this.batches.set(batchKey, batch);
      
      // Schedule batch execution
      setTimeout(() => this.executeBatch(batchKey), 10); // 10ms batch window
    }
    
    return batch.addRequest(request);
  }
  
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.isEmpty()) {
      return;
    }
    
    try {
      const batchedRequest = batch.createBatchedRequest();
      const response = await this.forwardBatchedRequest(batchedRequest);
      
      batch.distributeResponses(response);
    } catch (error) {
      batch.handleError(error);
    } finally {
      this.batches.delete(batchKey);
    }
  }
}
```

## Deployment Configuration

### 1. Kong Gateway Setup

```yaml
# kong.yml
_format_version: "3.0"

services:
  - name: medianest-backend
    url: http://medianest-backend:4000
    plugins:
      - name: rate-limiting
        config:
          minute: 1000
          hour: 10000
      - name: cors
        config:
          origins: ["*"]
      - name: prometheus
        config:
          per_consumer: true

  - name: medianest-frontend
    url: http://medianest-frontend:3000
    
routes:
  - name: api-routes
    service: medianest-backend
    paths: ["/api"]
    
  - name: frontend-routes
    service: medianest-frontend
    paths: ["/"]

consumers:
  - username: medianest-admin
    plugins:
      - name: key-auth
        config:
          key: admin-api-key
```

### 2. Docker Compose Integration

```yaml
# docker-compose.gateway.yml
version: '3.8'

services:
  kong:
    image: kong:3.4-alpine
    container_name: medianest-gateway
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yml
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
    volumes:
      - ./config/kong.yml:/etc/kong/kong.yml:ro
    ports:
      - "8000:8000"  # Proxy port
      - "8001:8001"  # Admin API
    depends_on:
      - medianest-backend
      - medianest-frontend
    networks:
      - medianest-network

  medianest-backend:
    # Existing backend configuration
    expose:
      - "4000"
    # Remove external port mapping since traffic goes through gateway
    
  medianest-frontend:
    # Existing frontend configuration
    expose:
      - "3000"
```

## Monitoring & Analytics

### 1. Gateway Metrics

```typescript
class GatewayMetrics {
  private metrics = {
    requestCount: new prometheus.Counter({
      name: 'gateway_requests_total',
      help: 'Total number of requests',
      labelNames: ['method', 'route', 'status', 'service']
    }),
    
    requestDuration: new prometheus.Histogram({
      name: 'gateway_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'route', 'service'],
      buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0]
    }),
    
    rateLimitHits: new prometheus.Counter({
      name: 'gateway_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['rule', 'scope']
    })
  };
  
  recordRequest(method: string, route: string, service: string, status: number, duration: number): void {
    this.metrics.requestCount.inc({
      method,
      route,
      status: status.toString(),
      service
    });
    
    this.metrics.requestDuration.observe({
      method,
      route,
      service
    }, duration / 1000);
  }
  
  recordRateLimitHit(rule: string, scope: string): void {
    this.metrics.rateLimitHits.inc({ rule, scope });
  }
}
```

## Security Considerations

### 1. API Security Policies

```typescript
class APISecurityManager {
  private policies: SecurityPolicy[] = [];
  
  async validateRequest(request: GatewayRequest): Promise<SecurityValidation> {
    const violations: SecurityViolation[] = [];
    
    for (const policy of this.policies) {
      if (policy.appliesTo(request)) {
        const result = await policy.validate(request);
        if (!result.valid) {
          violations.push(result.violation!);
        }
      }
    }
    
    return {
      valid: violations.length === 0,
      violations,
      riskScore: this.calculateRiskScore(violations)
    };
  }
}

class SQLInjectionPolicy implements SecurityPolicy {
  appliesTo(request: GatewayRequest): boolean {
    return request.path.includes('/api/') && 
           (request.method === 'POST' || request.method === 'PUT');
  }
  
  async validate(request: GatewayRequest): Promise<PolicyValidation> {
    const suspiciousPatterns = [
      /('|(\-\-)|;|(\||\*)|(%)|(\+)|(\()).*((union|select|insert|delete|update|create|drop|exec|execute).*)/i,
      /\b(union|select|insert|delete|update|create|drop)\b/i
    ];
    
    const requestString = JSON.stringify(request.body) + request.query.toString();
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        return {
          valid: false,
          violation: {
            type: 'sql_injection',
            severity: 'high',
            description: 'Potential SQL injection detected'
          }
        };
      }
    }
    
    return { valid: true };
  }
}
```

This comprehensive API Gateway design provides MediaNest with enterprise-grade request management, security, and performance optimization capabilities, transforming it into a scalable integration platform ready for production environments.