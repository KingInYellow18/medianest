# Task 04: Test Maintenance & Optimization

**Priority:** 📋 Medium  
**Effort:** 1 day  
**Dependencies:** Completion of Tasks 01-03  
**Status:** Not Started  

## Overview

Optimize and maintain the existing test suite for long-term sustainability. With 37 test files and 6,500+ lines of test code, proper maintenance strategies are essential to prevent technical debt and ensure continued effectiveness.

## Current Test Suite Analysis

### ✅ Strengths Identified:
- 37 test files with comprehensive coverage
- Modern tooling (Vitest, MSW v2.1.0, React Testing Library)
- Real database testing with proper isolation
- Automated test environment setup
- 60% coverage enforcement

### ⚠️ Areas for Improvement:
- Test execution time optimization
- Test data management standardization  
- Flaky test prevention strategies
- Test documentation and discoverability
- Coverage gap analysis and improvement

## Implementation Plan

### Phase 1: Test Performance Optimization (3 hours)

#### 1.1 Analyze Current Test Execution Times
```bash
# Create performance baseline
npm run test:coverage 2>&1 | tee test-performance-baseline.log
npm run test --workspaces 2>&1 | tee workspace-performance.log
```

#### 1.2 Optimize Vitest Configuration
```typescript
// Root vitest.workspace.ts - Optimize for monorepo
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Backend tests - optimized for isolation
  {
    test: {
      name: 'backend',
      root: './backend',
      environment: 'node',
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,          // Database isolation
          minForks: 1,
          maxForks: 1
        }
      },
      testTimeout: 15000,           // Reduced from 30s
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/e2e/**']     // Exclude E2E from unit runs
    }
  },
  
  // Frontend tests - optimized for speed
  {
    test: {
      name: 'frontend', 
      root: './frontend',
      environment: 'jsdom',
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: true,       // Consistent execution
          minThreads: 1,
          maxThreads: 2
        }
      },
      testTimeout: 10000,           // Reduced timeout
      include: ['src/**/*.test.{ts,tsx}']
    }
  },
  
  // Shared package - lightweight
  {
    test: {
      name: 'shared',
      root: './shared',
      environment: 'node',
      pool: 'threads',
      testTimeout: 5000,            // Fast tests only
      include: ['tests/**/*.test.ts']
    }
  }
])
```

#### 1.3 Implement Parallel Test Strategies
```typescript
// backend/tests/helpers/parallel-setup.ts
export class ParallelTestManager {
  private static dbInstances = new Map<string, string>()
  
  static async getIsolatedDB(): Promise<string> {
    const testId = process.env.VITEST_WORKER_ID || 'main'
    
    if (!this.dbInstances.has(testId)) {
      const dbName = `medianest_test_${testId}`
      const dbUrl = `postgresql://test:test@localhost:5433/${dbName}`
      
      // Create isolated database for this test worker
      await this.createTestDatabase(dbName)
      this.dbInstances.set(testId, dbUrl)
    }
    
    return this.dbInstances.get(testId)!
  }
  
  private static async createTestDatabase(dbName: string) {
    // Implementation for creating isolated test databases
  }
}
```

### Phase 2: Test Data Management Standardization (2 hours)

#### 2.1 Create Centralized Test Data Factory
```typescript
// shared/tests/factories/index.ts
import { faker } from '@faker-js/faker'

export class TestDataFactory {
  static user(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      plexId: faker.string.numeric(6),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }
  
  static mediaRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      title: faker.lorem.words(3),
      mediaType: faker.helpers.arrayElement(['movie', 'tv']),
      tmdbId: faker.string.numeric(6),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }
  
  static youtubeDownload(overrides: Partial<YouTubeDownload> = {}): YouTubeDownload {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      playlistUrl: `https://youtube.com/playlist?list=${faker.string.alphanumeric(11)}`,
      title: faker.lorem.words(4),
      status: 'queued',
      createdAt: new Date(),
      ...overrides
    }
  }
}

// Usage in tests
const testUser = TestDataFactory.user({ role: 'admin' })
const testRequest = TestDataFactory.mediaRequest({ userId: testUser.id })
```

#### 2.2 Standardize Database Seeding
```typescript
// backend/tests/helpers/database-seeding.ts
export class DatabaseSeeder {
  constructor(private prisma: PrismaClient) {}
  
  async seedMinimalData(): Promise<{ users: User[], requests: MediaRequest[] }> {
    const users = await Promise.all([
      this.prisma.user.create({ data: TestDataFactory.user({ role: 'admin' }) }),
      this.prisma.user.create({ data: TestDataFactory.user({ role: 'user' }) })
    ])
    
    const requests = await Promise.all([
      this.prisma.mediaRequest.create({ 
        data: TestDataFactory.mediaRequest({ userId: users[1].id }) 
      })
    ])
    
    return { users, requests }
  }
  
  async seedLargeDataset(count: number = 100): Promise<void> {
    const batchSize = 20
    const batches = Math.ceil(count / batchSize)
    
    for (let i = 0; i < batches; i++) {
      const batchData = Array(Math.min(batchSize, count - i * batchSize))
        .fill(null)
        .map(() => TestDataFactory.mediaRequest())
      
      await this.prisma.mediaRequest.createMany({ data: batchData })
    }
  }
  
  async cleanup(): Promise<void> {
    // Order matters for foreign key constraints
    await this.prisma.mediaRequest.deleteMany()
    await this.prisma.youtubeDownload.deleteMany()
    await this.prisma.user.deleteMany()
  }
}
```

### Phase 3: Flaky Test Prevention (2 hours)

#### 3.1 Implement Test Stability Helpers
```typescript
// backend/tests/helpers/stability.ts
export class TestStabilityHelper {
  static async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error(`Condition not met within ${timeout}ms`)
  }
  
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      }
    }
    
    throw lastError!
  }
  
  static mockDateNow(fixedDate: Date = new Date('2025-01-01')): () => void {
    const originalNow = Date.now
    Date.now = () => fixedDate.getTime()
    
    return () => {
      Date.now = originalNow
    }
  }
}

// Usage example
it('should handle async operations reliably', async () => {
  await TestStabilityHelper.waitForCondition(async () => {
    const status = await serviceStatus.get('plex')
    return status === 'up'
  })
  
  const result = await TestStabilityHelper.retryOperation(async () => {
    return await plexClient.getLibraries()
  })
  
  expect(result).toBeDefined()
})
```

#### 3.2 Enhance MSW Reliability
```typescript
// backend/tests/mocks/enhanced-handlers.ts
export class ReliableMSWHandlers {
  static createDelayedHandler(
    handler: RequestHandler,
    minDelay: number = 0,
    maxDelay: number = 100
  ): RequestHandler {
    return async (info) => {
      const delay = Math.random() * (maxDelay - minDelay) + minDelay
      await new Promise(resolve => setTimeout(resolve, delay))
      return handler(info)
    }
  }
  
  static createFlakySuppression(
    handler: RequestHandler,
    successRate: number = 0.95
  ): RequestHandler {
    return async (info) => {
      if (Math.random() > successRate) {
        // Simulate network issues
        throw new Error('Network error (simulated)')
      }
      return handler(info)
    }
  }
}

// Apply to critical handlers
export const enhancedPlexHandlers = [
  ReliableMSWHandlers.createDelayedHandler(
    http.post('https://plex.tv/pins.xml', () => {
      return HttpResponse.text(`<pin><id>12345</id><code>ABCD</code></pin>`)
    }),
    50,  // 50-150ms delay to simulate real network
    150
  )
]
```

### Phase 4: Test Documentation & Discoverability (2 hours)

#### 4.1 Create Test Documentation
```markdown
# MediaNest Test Suite Guide

## Quick Start
```bash
# Run all tests
npm test

# Run specific workspace
npm run test:backend
npm run test:frontend  
npm run test:shared

# Run with coverage
npm run test:coverage

# Run specific test file
npm test backend/tests/integration/auth.test.ts
```

## Test Categories

### Unit Tests (`/tests/unit/`)
- Business logic validation
- Utility function testing
- Isolated component behavior

### Integration Tests (`/tests/integration/`)
- API endpoint testing with real databases
- External service mocking with MSW
- WebSocket communication testing

### E2E Tests (`/tests/e2e/`)
- Complete user journey validation
- Cross-browser compatibility
- Critical workflow testing

## Writing New Tests

### Test File Naming Convention
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- Component tests: `*.test.tsx`
- E2E tests: `*.spec.ts`

### Test Structure Template
```typescript
describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup for each test
    await databaseSeeder.seedMinimalData()
  })
  
  afterEach(async () => {
    // Cleanup after each test
    await databaseSeeder.cleanup()
  })
  
  describe('when valid input provided', () => {
    it('should return expected result', async () => {
      // Arrange
      const input = TestDataFactory.user()
      
      // Act
      const result = await service.process(input)
      
      // Assert
      expect(result).toEqual(expectedOutput)
    })
  })
})
```
```

#### 4.2 Create Test Discovery Tools
```typescript
// scripts/test-discovery.ts
import { glob } from 'glob'
import * as fs from 'fs'

interface TestFile {
  path: string
  type: 'unit' | 'integration' | 'component' | 'e2e'
  workspace: string
  testCount: number
  lastModified: Date
}

export class TestDiscovery {
  static async analyzeTestSuite(): Promise<{
    summary: {
      totalFiles: number
      totalTests: number
      byWorkspace: Record<string, number>
      byType: Record<string, number>
    }
    files: TestFile[]
  }> {
    const testFiles = await glob('**/tests/**/*.test.{ts,tsx}', { 
      ignore: ['node_modules/**'] 
    })
    
    const files: TestFile[] = []
    let totalTests = 0
    
    for (const filePath of testFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const testCount = (content.match(/\b(it|test)\(/g) || []).length
      
      totalTests += testCount
      
      files.push({
        path: filePath,
        type: this.getTestType(filePath),
        workspace: this.getWorkspace(filePath),
        testCount,
        lastModified: fs.statSync(filePath).mtime
      })
    }
    
    return {
      summary: {
        totalFiles: files.length,
        totalTests,
        byWorkspace: this.groupBy(files, 'workspace'),
        byType: this.groupBy(files, 'type')
      },
      files
    }
  }
  
  private static getTestType(filePath: string): TestFile['type'] {
    if (filePath.includes('/e2e/')) return 'e2e'
    if (filePath.includes('/integration/')) return 'integration'
    if (filePath.includes('/unit/')) return 'unit'
    if (filePath.endsWith('.test.tsx')) return 'component'
    return 'unit'
  }
  
  private static getWorkspace(filePath: string): string {
    if (filePath.startsWith('backend/')) return 'backend'
    if (filePath.startsWith('frontend/')) return 'frontend'
    if (filePath.startsWith('shared/')) return 'shared'
    return 'root'
  }
  
  private static groupBy(items: TestFile[], key: keyof TestFile): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key] as string
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}

// Usage
TestDiscovery.analyzeTestSuite().then(analysis => {
  console.log('Test Suite Analysis:', analysis.summary)
})
```

### Phase 5: Coverage Gap Analysis (1 hour)

#### 5.1 Create Coverage Analysis Tool
```typescript
// scripts/coverage-analysis.ts
export class CoverageAnalyzer {
  static async analyzeCoverageGaps(): Promise<{
    uncoveredFiles: string[]
    lowCoverageFiles: Array<{ file: string, coverage: number }>
    recommendations: string[]
  }> {
    // Parse coverage reports from v8
    const coverageData = await this.parseCoverageReport()
    
    const uncoveredFiles = coverageData
      .filter(file => file.coverage === 0)
      .map(file => file.path)
    
    const lowCoverageFiles = coverageData
      .filter(file => file.coverage < 60 && file.coverage > 0)
      .map(file => ({ file: file.path, coverage: file.coverage }))
    
    const recommendations = this.generateRecommendations(coverageData)
    
    return {
      uncoveredFiles,
      lowCoverageFiles,
      recommendations
    }
  }
  
  private static generateRecommendations(coverageData: any[]): string[] {
    const recommendations: string[] = []
    
    // Analyze patterns
    const totalFiles = coverageData.length
    const coveredFiles = coverageData.filter(f => f.coverage > 0).length
    const wellCoveredFiles = coverageData.filter(f => f.coverage >= 60).length
    
    if (coveredFiles / totalFiles < 0.8) {
      recommendations.push('Consider adding tests for uncovered utility files')
    }
    
    if (wellCoveredFiles / coveredFiles < 0.8) {
      recommendations.push('Focus on improving coverage for existing test files')
    }
    
    return recommendations
  }
}
```

## Maintenance Procedures

### 5.1 Weekly Test Health Check
```bash
#!/bin/bash
# scripts/weekly-test-health.sh

echo "MediaNest Test Suite Health Check"
echo "================================="

# Run all tests and capture metrics
npm test 2>&1 | tee test-results.log

# Generate coverage report
npm run test:coverage

# Analyze test discovery
npm run script:test-discovery

# Check for flaky tests (run tests 3 times)
for i in {1..3}; do
  echo "Test run $i/3"
  npm test --reporter=json > "test-run-$i.json"
done

# Report summary
echo "Health check complete. Review test-results.log for details."
```

### 5.2 Monthly Test Optimization Review
- Review test execution times
- Analyze coverage trends
- Update dependencies (Vitest, MSW, etc.)
- Remove obsolete tests
- Refactor duplicated test code

## Acceptance Criteria

### ✅ Done When:
- [ ] Test execution time optimized (target: <3 minutes total)
- [ ] Test data management standardized across workspaces
- [ ] Flaky test prevention strategies implemented
- [ ] Test documentation and discovery tools created
- [ ] Coverage gap analysis tools implemented
- [ ] Maintenance procedures documented

### ✅ Quality Gates:
- Test suite runs faster than before optimization
- No flaky tests in CI/CD pipeline
- Test documentation is comprehensive and up-to-date
- Coverage analysis tools provide actionable insights

## Success Metrics

- **Performance**: 20%+ reduction in test execution time
- **Reliability**: Zero flaky tests over 1 week period
- **Maintainability**: Standardized test patterns across workspaces
- **Documentation**: Complete test suite documentation
- **Coverage**: Actionable insights for coverage improvements

---

**Estimated Total Effort: 8 hours (1 day)**  
**Assigned To:** _TBD_  
**Start Date:** _TBD_  
**Target Completion:** _TBD_