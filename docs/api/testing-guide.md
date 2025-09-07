# API Testing Guide

This comprehensive guide covers testing strategies, tools, and examples for the MediaNest API. Whether you're developing integrations, debugging issues, or validating functionality, this guide has you covered.

## 🧪 Testing Approaches

### 1. Manual API Testing with cURL

#### Basic Health Check

```bash
# Test if the API is running
curl -X GET http://localhost:4000/api/v1/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "medianest-api",
#   "timestamp": "2024-01-25T10:30:00Z",
#   "version": "2.0.0",
#   "uptime": 86400
# }
```

#### Authentication Flow

```bash
# Step 1: Generate Plex PIN
curl -X POST http://localhost:4000/api/v1/auth/plex/pin \
  -H "Content-Type: application/json" \
  -d '{"clientName": "MediaNest Test"}'

# Response includes PIN code and auth URL
# {
#   "success": true,
#   "data": {
#     "id": "12345",
#     "code": "ABCD-EFGH-IJKL-MNOP",
#     "authUrl": "https://app.plex.tv/auth#?clientID=...",
#     "expiresIn": 900
#   }
# }

# Step 2: Verify PIN (after user authorization)
curl -X POST http://localhost:4000/api/v1/auth/plex/verify \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "pinId": "12345",
    "rememberMe": true
  }'

# Step 3: Use session cookie for authenticated requests
curl -X GET http://localhost:4000/api/v1/auth/session \
  -b cookies.txt

# Step 4: Get CSRF token for protected operations
curl -X GET http://localhost:4000/api/v1/csrf/token \
  -b cookies.txt

# Response:
# {
#   "success": true,
#   "data": {
#     "token": "csrf-abc123xyz",
#     "expiresIn": 3600
#   }
# }
```

#### Media Operations

```bash
# Search for media
curl -X GET "http://localhost:4000/api/v1/media/search?q=avengers&type=movie&limit=5" \
  -b cookies.txt

# Get detailed media information
curl -X GET http://localhost:4000/api/v1/media/movie/299534 \
  -b cookies.txt

# Submit media request
curl -X POST http://localhost:4000/api/v1/media/request \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: csrf-abc123xyz" \
  -b cookies.txt \
  -d '{
    "tmdbId": "299534",
    "mediaType": "movie",
    "quality": "1080p",
    "comment": "Test request from cURL"
  }'

# Get user requests
curl -X GET "http://localhost:4000/api/v1/media/requests?status=pending&limit=10" \
  -b cookies.txt
```

#### Plex Integration

```bash
# Get Plex server info
curl -X GET http://localhost:4000/api/v1/plex/server \
  -b cookies.txt

# List Plex libraries
curl -X GET http://localhost:4000/api/v1/plex/libraries \
  -b cookies.txt

# Get library items with pagination
curl -X GET "http://localhost:4000/api/v1/plex/libraries/1/items?page=1&limit=20&sort=addedAt:desc" \
  -b cookies.txt

# Search Plex content
curl -X GET "http://localhost:4000/api/v1/plex/search?q=matrix&limit=10" \
  -b cookies.txt

# Get recently added items
curl -X GET "http://localhost:4000/api/v1/plex/recently-added?limit=15&type=movie" \
  -b cookies.txt
```

#### YouTube Downloads

```bash
# Get video metadata without downloading
curl -X GET "http://localhost:4000/api/v1/youtube/metadata?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  -b cookies.txt

# Start a download
curl -X POST http://localhost:4000/api/v1/youtube/download \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: csrf-abc123xyz" \
  -b cookies.txt \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "quality": "720p",
    "format": "mp4"
  }'

# Monitor download progress
curl -X GET http://localhost:4000/api/v1/youtube/downloads/dl-123abc \
  -b cookies.txt

# Get download history
curl -X GET "http://localhost:4000/api/v1/youtube/downloads?status=completed&limit=10" \
  -b cookies.txt
```

### 2. Testing with Postman

#### Environment Setup

Create a Postman environment with these variables:

```json
{
  "baseUrl": "http://localhost:4000/api/v1",
  "csrfToken": "",
  "sessionCookie": "",
  "testTmdbId": "299534"
}
```

#### Pre-request Script for CSRF Token

Add this script to requests that need CSRF protection:

```javascript
// Pre-request Script
if (!pm.environment.get('csrfToken')) {
  pm.sendRequest(
    {
      url: pm.environment.get('baseUrl') + '/csrf/token',
      method: 'GET',
    },
    function (err, response) {
      if (response.json().success) {
        pm.environment.set('csrfToken', response.json().data.token);
      }
    }
  );
}
```

#### Test Scripts for Validation

```javascript
// Test Script for search endpoint
pm.test('Status code is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Response has success field', function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('success');
  pm.expect(jsonData.success).to.be.true;
});

pm.test('Response has data with results', function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData.data).to.have.property('results');
  pm.expect(jsonData.data.results).to.be.an('array');
});

pm.test('Pagination info is present', function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData.data).to.have.property('pagination');
  pm.expect(jsonData.data.pagination).to.have.property('page');
  pm.expect(jsonData.data.pagination).to.have.property('totalPages');
});

pm.test('Response time is less than 2000ms', function () {
  pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

### 3. Automated Testing with Jest

#### Test Environment Setup

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};

// tests/setup.js
const nock = require('nock');

// Mock the base URL
const API_BASE = 'http://localhost:4000';

beforeEach(() => {
  // Clean up any pending mocks
  nock.cleanAll();
});

afterAll(() => {
  nock.restore();
});

module.exports = { API_BASE };
```

#### Unit Tests for API Client

```javascript
// tests/api-client.test.js
const { MediaNestClient } = require('../src/medianest-client');
const nock = require('nock');
const { API_BASE } = require('./setup');

describe('MediaNestClient', () => {
  let client;

  beforeEach(() => {
    client = new MediaNestClient(`${API_BASE}/api/v1`);
  });

  describe('Authentication', () => {
    test('should generate Plex PIN successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: '12345',
          code: 'ABCD-EFGH-IJKL-MNOP',
          authUrl: 'https://app.plex.tv/auth#?clientID=test',
          expiresIn: 900,
        },
      };

      nock(API_BASE).post('/api/v1/auth/plex/pin').reply(200, mockResponse);

      const result = await client.generatePlexPin();

      expect(result.success).toBe(true);
      expect(result.data.code).toBe('ABCD-EFGH-IJKL-MNOP');
      expect(result.data.expiresIn).toBe(900);
    });

    test('should verify PIN and authenticate', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            role: 'user',
          },
          csrfToken: 'csrf-test-token',
        },
      };

      nock(API_BASE)
        .post('/api/v1/auth/plex/verify')
        .reply(200, mockResponse, {
          'Set-Cookie': ['medianest_session=jwt-token; HttpOnly; Secure'],
        });

      const result = await client.verifyPlexPin('12345');

      expect(result.success).toBe(true);
      expect(result.data.user.username).toBe('testuser');
      expect(result.data.csrfToken).toBe('csrf-test-token');
    });
  });

  describe('Media Search', () => {
    test('should search for media with valid query', async () => {
      const mockResponse = {
        success: true,
        data: {
          results: [
            {
              id: '299534',
              title: 'Avengers: Endgame',
              type: 'movie',
              year: 2019,
              rating: 8.4,
              availability: {
                plex: false,
                requested: false,
              },
            },
          ],
          pagination: {
            page: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 20,
          },
        },
      };

      nock(API_BASE)
        .get('/api/v1/media/search')
        .query({ q: 'avengers', type: 'movie' })
        .reply(200, mockResponse);

      const result = await client.searchMedia('avengers', 'movie');

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].title).toBe('Avengers: Endgame');
    });

    test('should handle empty search results', async () => {
      const mockResponse = {
        success: true,
        data: {
          results: [],
          pagination: {
            page: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: 20,
          },
        },
      };

      nock(API_BASE)
        .get('/api/v1/media/search')
        .query({ q: 'nonexistentmovie123456', type: 'all' })
        .reply(200, mockResponse);

      const result = await client.searchMedia('nonexistentmovie123456');

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(0);
      expect(result.data.pagination.totalItems).toBe(0);
    });

    test('should handle API errors gracefully', async () => {
      const mockError = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter is required',
          details: 'The "q" parameter must not be empty',
        },
      };

      nock(API_BASE)
        .get('/api/v1/media/search')
        .query({ q: '', type: 'all' })
        .reply(400, mockError);

      await expect(client.searchMedia('')).rejects.toThrow('Query parameter is required');
    });
  });

  describe('Media Requests', () => {
    test('should submit media request successfully', async () => {
      const mockCSRFResponse = {
        success: true,
        data: { token: 'csrf-test-token', expiresIn: 3600 },
      };

      const mockRequestResponse = {
        success: true,
        data: {
          id: 'req-123abc',
          tmdbId: '299534',
          mediaType: 'movie',
          title: 'Avengers: Endgame',
          status: 'pending',
          quality: '1080p',
          userId: 'user-123',
          createdAt: '2024-01-25T10:30:00Z',
        },
      };

      nock(API_BASE).get('/api/v1/csrf/token').reply(200, mockCSRFResponse);

      nock(API_BASE)
        .post('/api/v1/media/request')
        .matchHeader('X-CSRF-Token', 'csrf-test-token')
        .reply(201, mockRequestResponse);

      await client.init(); // Get CSRF token
      const result = await client.requestMedia('299534', 'movie', '1080p', 'Test request');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.tmdbId).toBe('299534');
    });

    test('should prevent duplicate requests', async () => {
      const mockError = {
        success: false,
        error: {
          code: 'DUPLICATE_REQUEST',
          message: 'Media has already been requested',
          details: 'You have already submitted a request for this media',
        },
      };

      nock(API_BASE)
        .get('/api/v1/csrf/token')
        .reply(200, { success: true, data: { token: 'csrf-test-token' } });

      nock(API_BASE).post('/api/v1/media/request').reply(409, mockError);

      await client.init();
      await expect(
        client.requestMedia('299534', 'movie', '1080p', 'Duplicate request')
      ).rejects.toThrow('Media has already been requested');
    });
  });

  describe('Plex Integration', () => {
    test('should get Plex server information', async () => {
      const mockResponse = {
        success: true,
        data: {
          name: 'Test Plex Server',
          version: '1.40.0.7775',
          platform: 'Linux',
          libraries: 4,
          users: 2,
          transcoding: true,
        },
      };

      nock(API_BASE).get('/api/v1/plex/server').reply(200, mockResponse);

      const result = await client.getPlexServerInfo();

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Plex Server');
      expect(result.data.libraries).toBe(4);
    });

    test('should handle Plex server offline', async () => {
      const mockError = {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Plex server is not responding',
          details: 'Connection timeout after 5 seconds',
        },
      };

      nock(API_BASE).get('/api/v1/plex/server').reply(503, mockError);

      await expect(client.getPlexServerInfo()).rejects.toThrow('Plex server is not responding');
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rate limit errors', async () => {
      const mockError = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          details: 'You have exceeded the rate limit of 100 requests per hour',
        },
      };

      nock(API_BASE).get('/api/v1/media/search').query({ q: 'test' }).reply(429, mockError, {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1706180400',
        'Retry-After': '3600',
      });

      await expect(client.searchMedia('test')).rejects.toThrow('Too many requests');
    });
  });
});
```

#### Integration Tests

```javascript
// tests/integration.test.js
const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');

describe('API Integration Tests', () => {
  let serverProcess;
  let baseURL;

  beforeAll(async () => {
    // Start the server for integration tests
    baseURL = 'http://localhost:4001'; // Use different port for tests

    // You could start your actual server here or use a test database
    // serverProcess = spawn('node', ['server.js'], {
    //   env: { ...process.env, PORT: 4001, NODE_ENV: 'test' }
    // });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 10000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(baseURL).get('/api/v1/health').expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('medianest-api');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Authentication Required', () => {
    test('should require authentication for protected endpoints', async () => {
      const response = await request(baseURL).get('/api/v1/media/search?q=test').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should allow access to public endpoints', async () => {
      const response = await request(baseURL).get('/api/v1/csrf/token').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(baseURL).get('/api/v1/nonexistent').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should validate request bodies', async () => {
      const response = await request(baseURL)
        .post('/api/v1/auth/plex/verify')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### 4. Load Testing with Artillery

#### Artillery Configuration

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
  payload:
    path: "test-data.csv"
    fields:
      - "query"
      - "mediaType"

scenarios:
  - name: "Health Check"
    weight: 10
    flow:
      - get:
          url: "/api/v1/health"

  - name: "Search Media"
    weight: 70
    flow:
      - get:
          url: "/api/v1/media/search"
          qs:
            q: "{{ query }}"
            type: "{{ mediaType }}"
          headers:
            Cookie: "medianest_session=test-session-token"

  - name: "Get Plex Libraries"
    weight: 20
    flow:
      - get:
          url: "/api/v1/plex/libraries"
          headers:
            Cookie: "medianest_session=test-session-token"

# test-data.csv
query,mediaType
avengers,movie
spider-man,movie
breaking bad,tv
game of thrones,tv
matrix,movie
batman,movie
friends,tv
office,tv
```

Run the load test:

```bash
artillery run artillery-config.yml
```

### 5. Testing with Newman (Postman CLI)

#### Export Collection and Environment

1. Export your Postman collection as `medianest-api.postman_collection.json`
2. Export your environment as `medianest-env.postman_environment.json`

#### Run Tests

```bash
# Install Newman
npm install -g newman newman-reporter-htmlextra

# Run tests with HTML report
newman run medianest-api.postman_collection.json \
  -e medianest-env.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export newman-report.html

# Run specific folder
newman run medianest-api.postman_collection.json \
  -e medianest-env.postman_environment.json \
  --folder "Authentication Tests"

# Run with data file
newman run medianest-api.postman_collection.json \
  -e medianest-env.postman_environment.json \
  -d test-data.json \
  --iteration-count 10
```

## 🛠️ Testing Tools and Scripts

### API Test Script

```bash
#!/bin/bash
# test-api.sh - Comprehensive API test script

set -e

BASE_URL="http://localhost:4000/api/v1"
COOKIE_JAR="cookies.txt"
CSRF_TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local headers=$6

    log_info "Testing: $description"

    local curl_cmd="curl -s -w '%{http_code}' -o response.json"
    curl_cmd="$curl_cmd -X $method"

    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -d '$data' -H 'Content-Type: application/json'"
    fi

    if [ ! -z "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi

    if [ -f "$COOKIE_JAR" ]; then
        curl_cmd="$curl_cmd -b $COOKIE_JAR"
    fi

    curl_cmd="$curl_cmd $BASE_URL$endpoint"

    local status_code=$(eval $curl_cmd)

    if [ "$status_code" = "$expected_status" ]; then
        log_info "✓ $description - Status: $status_code"
        return 0
    else
        log_error "✗ $description - Expected: $expected_status, Got: $status_code"
        if [ -f response.json ]; then
            cat response.json | jq '.' 2>/dev/null || cat response.json
        fi
        return 1
    fi
}

# Test health endpoint
test_endpoint "GET" "/health" "200" "Health check"

# Test CSRF token generation
test_endpoint "GET" "/csrf/token" "200" "CSRF token generation"
if [ -f response.json ]; then
    CSRF_TOKEN=$(cat response.json | jq -r '.data.token' 2>/dev/null || echo "")
fi

# Test authentication endpoints
test_endpoint "POST" "/auth/plex/pin" "200" "Generate Plex PIN" '{"clientName": "Test Client"}'

# Test protected endpoints without auth (should fail)
test_endpoint "GET" "/auth/session" "401" "Get session without auth"
test_endpoint "GET" "/media/search?q=test" "401" "Search media without auth"

# Test invalid endpoints
test_endpoint "GET" "/nonexistent" "404" "Non-existent endpoint"

# Test rate limiting (if enabled)
log_info "Testing rate limiting..."
for i in {1..10}; do
    test_endpoint "GET" "/health" "200" "Rate limit test $i"
    sleep 0.1
done

# Cleanup
rm -f response.json
log_info "All tests completed!"
```

### Performance Monitoring Script

```javascript
// performance-monitor.js
const axios = require('axios');
const fs = require('fs');

class APIPerformanceMonitor {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async testEndpoint(method, endpoint, data = null, headers = {}) {
    const startTime = Date.now();

    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        data,
        timeout: 10000,
      };

      const response = await axios(config);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const result = {
        endpoint,
        method,
        status: response.status,
        responseTime,
        success: true,
        timestamp: new Date().toISOString(),
      };

      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const result = {
        endpoint,
        method,
        status: error.response?.status || 0,
        responseTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      this.results.push(result);
      return result;
    }
  }

  async runPerformanceTests() {
    console.log('Starting performance tests...\n');

    // Test various endpoints
    const tests = [
      { method: 'GET', endpoint: '/health' },
      { method: 'GET', endpoint: '/csrf/token' },
      { method: 'POST', endpoint: '/auth/plex/pin', data: { clientName: 'Test' } },
      // Add more endpoints as needed
    ];

    for (const test of tests) {
      console.log(`Testing ${test.method} ${test.endpoint}...`);

      // Run each test multiple times
      for (let i = 0; i < 10; i++) {
        await this.testEndpoint(test.method, test.endpoint, test.data);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
      }
    }

    this.generateReport();
  }

  generateReport() {
    const report = {
      testSummary: {
        totalRequests: this.results.length,
        successfulRequests: this.results.filter((r) => r.success).length,
        failedRequests: this.results.filter((r) => !r.success).length,
      },
      performanceMetrics: {},
      timestamp: new Date().toISOString(),
    };

    // Group results by endpoint
    const groupedResults = this.results.reduce((acc, result) => {
      const key = `${result.method} ${result.endpoint}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(result);
      return acc;
    }, {});

    // Calculate metrics for each endpoint
    Object.keys(groupedResults).forEach((endpoint) => {
      const results = groupedResults[endpoint];
      const responseTimes = results.map((r) => r.responseTime);
      const successRate = (results.filter((r) => r.success).length / results.length) * 100;

      report.performanceMetrics[endpoint] = {
        requestCount: results.length,
        successRate: `${successRate.toFixed(2)}%`,
        avgResponseTime: `${(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        ).toFixed(2)}ms`,
        minResponseTime: `${Math.min(...responseTimes)}ms`,
        maxResponseTime: `${Math.max(...responseTimes)}ms`,
        p95ResponseTime: `${this.percentile(responseTimes, 0.95).toFixed(2)}ms`,
      };
    });

    // Save report
    fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));

    console.log('\nPerformance Test Results:');
    console.log('========================');
    console.log(JSON.stringify(report, null, 2));

    return report;
  }

  percentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index];
  }
}

// Usage
const monitor = new APIPerformanceMonitor('http://localhost:4000/api/v1');
monitor.runPerformanceTests().catch(console.error);
```

## 📊 Test Data and Scenarios

### Test Data Sets

```json
// test-data.json
{
  "mediaQueries": [
    { "query": "avengers", "type": "movie", "expectedResults": true },
    { "query": "breaking bad", "type": "tv", "expectedResults": true },
    { "query": "nonexistent12345", "type": "all", "expectedResults": false },
    { "query": "the", "type": "all", "expectedResults": true },
    { "query": "", "type": "movie", "expectedError": "VALIDATION_ERROR" }
  ],
  "youtubeUrls": [
    {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "description": "Valid YouTube URL",
      "shouldSucceed": true
    },
    {
      "url": "https://invalid-url.com/watch?v=123",
      "description": "Invalid URL",
      "shouldSucceed": false
    },
    {
      "url": "https://www.youtube.com/watch?v=invalid_video",
      "description": "Invalid video ID",
      "shouldSucceed": false
    }
  ],
  "plexLibraryTests": [
    { "libraryKey": "1", "expectedType": "movie" },
    { "libraryKey": "2", "expectedType": "show" },
    { "libraryKey": "999", "expectError": true }
  ]
}
```

## 🚀 Continuous Integration Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379

      - name: Start server
        run: npm start &
        env:
          NODE_ENV: test
          PORT: 4000
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test

      - name: Wait for server
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:4000/api/v1/health; do sleep 2; done'

      - name: Run integration tests
        run: npm run test:integration

      - name: Run API tests with Newman
        run: |
          npm install -g newman
          newman run postman/medianest-api.postman_collection.json \
            -e postman/test-environment.postman_environment.json \
            --reporters cli,junit \
            --reporter-junit-export newman-results.xml

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            coverage/
            newman-results.xml
            performance-report.json
```

## 🔍 Debugging and Troubleshooting

### Common Issues and Solutions

1. **Authentication Failures**

   ```bash
   # Check if session cookie is set
   curl -c cookies.txt -X POST /api/v1/auth/plex/verify -d '{"pinId": "123"}'
   cat cookies.txt

   # Verify session is valid
   curl -b cookies.txt -X GET /api/v1/auth/session
   ```

2. **CSRF Token Issues**

   ```bash
   # Get fresh CSRF token
   curl -b cookies.txt /api/v1/csrf/token

   # Use token in request
   curl -b cookies.txt -H "X-CSRF-Token: your-token" -X POST /api/v1/media/request
   ```

3. **Rate Limiting**

   ```bash
   # Check rate limit headers
   curl -I /api/v1/media/search?q=test
   # Look for X-RateLimit-* headers
   ```

4. **Service Connectivity**

   ```bash
   # Test Plex connectivity
   curl -b cookies.txt /api/v1/plex/server

   # Check dashboard status
   curl -b cookies.txt /api/v1/dashboard/status
   ```

### Test Coverage and Quality Metrics

```bash
# Generate coverage report
npm run test:coverage

# Run linting
npm run lint

# Check API response times
npm run test:performance

# Validate OpenAPI spec
swagger-codegen validate -i docs/api/openapi-enhanced.yaml
```

This comprehensive testing guide covers all aspects of MediaNest API testing, from manual verification to automated CI/CD pipelines. Use these examples as a foundation for your own testing strategy.
