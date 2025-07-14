# Task 03: Performance Testing Implementation

**Priority:** ⚡ High  
**Effort:** 1-2 days  
**Dependencies:** Current test suite, PRD requirements  
**Status:** Not Started  

## Overview

Implement performance testing to validate MediaNest meets PRD requirements for 10-20 concurrent users. The current test suite lacks performance validation, which is critical for ensuring the application meets the specified performance criteria.

## PRD Performance Requirements

From `MediaNest.PRD` - Section 3.2 & 4.2:
- **API response time** < 1 second for 95% of requests
- **Page load time** < 2 seconds on 3G connection  
- **Database queries** optimized to < 100ms
- **Support** 50 concurrent users
- **Handle** 1000 requests per minute
- **WebSocket connections** stable with automatic reconnection

## Current Gap Analysis

### ❌ Missing Performance Validation:
- No API response time validation
- No concurrent user capacity testing
- No WebSocket load testing  
- No database query performance monitoring
- No frontend performance metrics

### ✅ Existing Foundation:
- Vitest infrastructure for test execution
- Real database testing environment
- Comprehensive API test coverage
- WebSocket integration tests

## Implementation Strategy

### Approach: Lightweight Performance Testing
Rather than complex tools like k6 or Artillery, we'll enhance existing Vitest tests with performance assertions and add simple concurrent testing.

### Phase 1: API Response Time Validation (4 hours)

**Enhance existing API tests with performance assertions:**

```typescript
// backend/tests/integration/api/performance.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '@/app'
import { createTestJWT } from '../helpers/auth'

describe('API Performance Requirements', () => {
  const authToken = createTestJWT('test-user-id')
  
  describe('Response Time Requirements (<1s)', () => {
    it('should handle authentication requests quickly', async () => {
      const startTime = Date.now()
      
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .expect(200)
      
      const duration = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000) // <1s requirement
    })
    
    it('should handle media requests quickly', async () => {
      const startTime = Date.now()
      
      const response = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603'
        })
        .expect(201)
      
      const duration = Date.now() - startTime
      
      expect(response.status).toBe(201)
      expect(duration).toBeLessThan(1000) // <1s requirement
      console.log(`Media request took ${duration}ms`)
    })
    
    it('should handle dashboard status requests quickly', async () => {
      const startTime = Date.now()
      
      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      const duration = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000) // <1s requirement
      expect(response.body.services).toBeDefined()
    })
  })
})
```

### Phase 2: Concurrent User Testing (4 hours)

**Test 20 concurrent requests (PRD requirement):**

```typescript
// backend/tests/integration/api/concurrency.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '@/app'

describe('Concurrent User Capacity (20 users)', () => {
  it('should handle 20 concurrent health checks', async () => {
    const concurrentRequests = Array(20).fill(null).map(() =>
      request(app).get('/api/health')
    )
    
    const startTime = Date.now()
    const responses = await Promise.all(concurrentRequests)
    const duration = Date.now() - startTime
    
    // All requests should succeed
    const successfulResponses = responses.filter(r => r.status === 200)
    expect(successfulResponses.length).toBe(20)
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000) // 5s for 20 requests
    
    console.log(`20 concurrent requests took ${duration}ms`)
  })
  
  it('should handle 20 concurrent authenticated requests', async () => {
    const authTokens = Array(20).fill(null).map((_, i) => 
      createTestJWT(`test-user-${i}`)
    )
    
    const concurrentRequests = authTokens.map(token =>
      request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${token}`)
    )
    
    const startTime = Date.now()
    const responses = await Promise.all(concurrentRequests)
    const duration = Date.now() - startTime
    
    const successfulResponses = responses.filter(r => r.status === 200)
    expect(successfulResponses.length).toBe(20)
    expect(duration).toBeLessThan(10000) // 10s for authenticated requests
    
    console.log(`20 concurrent authenticated requests took ${duration}ms`)
  })
  
  it('should handle rate limiting under load', async () => {
    const authToken = createTestJWT('test-user-load')
    
    // Exceed rate limit (100 req/min = ~1.67 req/s)
    const rapidRequests = Array(50).fill(null).map(() =>
      request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${authToken}`)
    )
    
    const responses = await Promise.all(rapidRequests)
    
    const successResponses = responses.filter(r => r.status === 200)
    const rateLimitedResponses = responses.filter(r => r.status === 429)
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0)
    console.log(`${successResponses.length} succeeded, ${rateLimitedResponses.length} rate limited`)
  })
})
```

### Phase 3: Database Performance Testing (3 hours)

**Validate database query performance (<100ms requirement):**

```typescript
// backend/tests/integration/database/performance.test.ts
import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { performance } from 'perf_hooks'

describe('Database Performance Requirements (<100ms)', () => {
  let prisma: PrismaClient
  
  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.TEST_DATABASE_URL }
      }
    })
  })
  
  afterAll(async () => {
    await prisma.$disconnect()
  })
  
  it('should query users efficiently', async () => {
    const startTime = performance.now()
    
    const users = await prisma.user.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    })
    
    const duration = performance.now() - startTime
    
    expect(users).toBeDefined()
    expect(duration).toBeLessThan(100) // <100ms requirement
    console.log(`User query took ${duration.toFixed(2)}ms`)
  })
  
  it('should query media requests with pagination efficiently', async () => {
    // Seed test data first
    await seedMediaRequests(100) // Helper function
    
    const startTime = performance.now()
    
    const requests = await prisma.mediaRequest.findMany({
      take: 20,
      skip: 0,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    })
    
    const duration = performance.now() - startTime
    
    expect(requests).toBeDefined()
    expect(requests.length).toBeLessThanOrEqual(20)
    expect(duration).toBeLessThan(100) // <100ms requirement
    console.log(`Media request query took ${duration.toFixed(2)}ms`)
  })
  
  it('should handle concurrent database operations', async () => {
    const concurrentQueries = Array(10).fill(null).map(() =>
      prisma.user.findMany({ take: 5 })
    )
    
    const startTime = performance.now()
    const results = await Promise.all(concurrentQueries)
    const duration = performance.now() - startTime
    
    expect(results.length).toBe(10)
    expect(duration).toBeLessThan(500) // 10 queries in <500ms
    console.log(`10 concurrent queries took ${duration.toFixed(2)}ms`)
  })
})
```

### Phase 4: WebSocket Performance Testing (3 hours)

**Test WebSocket capacity and performance:**

```typescript
// backend/tests/integration/websocket/performance.test.ts
import { describe, it, expect } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client, Socket } from 'socket.io-client'

describe('WebSocket Performance (Multiple Connections)', () => {
  let httpServer: any
  let ioServer: Server
  let clients: Socket[] = []
  
  beforeAll((done) => {
    httpServer = createServer()
    ioServer = new Server(httpServer)
    
    httpServer.listen(() => {
      const port = httpServer.address().port
      
      // Create 20 concurrent connections (PRD requirement)
      const connectionPromises = Array(20).fill(null).map(() => {
        return new Promise<Socket>((resolve) => {
          const client = Client(`http://localhost:${port}`, {
            auth: { token: 'test-jwt' }
          })
          
          client.on('connect', () => {
            clients.push(client)
            resolve(client)
          })
        })
      })
      
      Promise.all(connectionPromises).then(() => done())
    })
  })
  
  afterAll(() => {
    clients.forEach(client => client.close())
    ioServer.close()
    httpServer.close()
  })
  
  it('should handle 20 concurrent WebSocket connections', () => {
    expect(clients.length).toBe(20)
    
    clients.forEach(client => {
      expect(client.connected).toBe(true)
    })
  })
  
  it('should broadcast status updates to all clients quickly', (done) => {
    let responseCount = 0
    const startTime = Date.now()
    
    clients.forEach(client => {
      client.on('service:status', (data) => {
        responseCount++
        
        if (responseCount === 20) {
          const duration = Date.now() - startTime
          expect(duration).toBeLessThan(1000) // Broadcast to 20 clients <1s
          console.log(`Broadcast to 20 clients took ${duration}ms`)
          done()
        }
      })
    })
    
    // Simulate status broadcast
    ioServer.emit('service:status', {
      service: 'plex',
      status: 'up',
      timestamp: Date.now()
    })
  })
  
  it('should handle message bursts without dropping connections', async () => {
    const messageCount = 50
    const messagePromises: Promise<any>[] = []
    
    clients.slice(0, 5).forEach(client => {
      for (let i = 0; i < messageCount; i++) {
        messagePromises.push(
          new Promise(resolve => {
            client.emit('test-message', { id: i })
            client.once('test-response', resolve)
          })
        )
      }
    })
    
    const startTime = Date.now()
    await Promise.all(messagePromises)
    const duration = Date.now() - startTime
    
    expect(duration).toBeLessThan(5000) // 250 messages in <5s
    console.log(`250 messages processed in ${duration}ms`)
  })
})
```

### Phase 5: Frontend Performance Assertions (2 hours)

**Add performance checks to component tests:**

```typescript
// frontend/src/components/__tests__/Dashboard.performance.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from '@/components/Dashboard'
import { performance } from 'perf_hooks'

describe('Dashboard Performance', () => {
  it('should render quickly with service data', async () => {
    const mockServices = Array(10).fill(null).map((_, i) => ({
      id: `service-${i}`,
      name: `Service ${i}`,
      status: 'up',
      uptime: 99.9
    }))
    
    const startTime = performance.now()
    
    render(<Dashboard services={mockServices} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toBeInTheDocument()
    })
    
    const duration = performance.now() - startTime
    
    // Component should render quickly
    expect(duration).toBeLessThan(100) // <100ms render time
    console.log(`Dashboard rendered in ${duration.toFixed(2)}ms`)
  })
  
  it('should handle large datasets efficiently', async () => {
    const mockRequests = Array(100).fill(null).map((_, i) => ({
      id: `request-${i}`,
      title: `Movie ${i}`,
      status: 'pending',
      createdAt: new Date()
    }))
    
    const startTime = performance.now()
    
    render(<RequestHistory requests={mockRequests} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('request-list')).toBeInTheDocument()
    })
    
    const duration = performance.now() - startTime
    
    expect(duration).toBeLessThan(200) // <200ms for 100 items
    console.log(`Request history rendered in ${duration.toFixed(2)}ms`)
  })
})
```

## Performance Monitoring Utilities

### Create Performance Test Helpers

```typescript
// backend/tests/helpers/performance.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  async measureAsync<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    const result = await operation()
    const duration = performance.now() - startTime
    
    this.recordMetric(name, duration)
    return result
  }
  
  recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(duration)
  }
  
  getAverageTime(name: string): number {
    const times = this.metrics.get(name) || []
    return times.reduce((a, b) => a + b, 0) / times.length
  }
  
  getReport(): Record<string, { avg: number, max: number, min: number }> {
    const report: Record<string, any> = {}
    
    for (const [name, times] of this.metrics) {
      report[name] = {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        min: Math.min(...times),
        count: times.length
      }
    }
    
    return report
  }
}
```

## Test Scripts Integration

### Update Package.json Scripts
```json
{
  "scripts": {
    "test:performance": "vitest run tests/integration/performance",
    "test:load": "vitest run tests/integration/load",
    "test:all-with-perf": "npm test && npm run test:performance"
  }
}
```

## Acceptance Criteria

### ✅ Done When:
- [ ] API response time validation (<1s) implemented
- [ ] Concurrent user testing (20 users) working
- [ ] Database query performance (<100ms) validated
- [ ] WebSocket performance testing implemented
- [ ] Performance assertions integrated into existing tests
- [ ] Performance monitoring utilities created

### ✅ Quality Gates:
- All performance tests pass consistently
- Performance requirements from PRD are validated
- Tests complete within reasonable time (<5 minutes total)
- Clear performance metrics logged during test runs

## Risk Assessment

### Potential Issues:
1. **Environment Differences**: Test environment may not reflect production
2. **Flaky Performance Tests**: Network/system variations can cause inconsistency
3. **Resource Constraints**: Test environment may have limited resources

### Mitigation:
- Use relative performance assertions (not absolute)
- Run performance tests multiple times for consistency
- Focus on regression detection rather than absolute benchmarks
- Mock external services to eliminate network variables

## Success Metrics

- **Response Time**: 95% of API calls complete <1s in tests
- **Concurrency**: 20 concurrent users supported without errors
- **Database**: All queries complete <100ms
- **WebSocket**: 20 connections stable with <1s broadcast time
- **Regression Detection**: Performance degradation caught in CI

---

**Estimated Total Effort: 16 hours (1-2 days)**  
**Assigned To:** _TBD_  
**Start Date:** _TBD_  
**Target Completion:** _TBD_