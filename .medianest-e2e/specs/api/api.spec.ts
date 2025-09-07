import { test, expect, testTags } from '../../fixtures/test-fixtures'

test.describe('API Testing', () => {
  let authToken: string

  test.beforeAll(async ({ request }) => {
    // Get authentication token for API tests
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'test@medianest.local',
        password: process.env.TEST_USER_PASSWORD || 'testpassword123'
      }
    })
    
    if (response.ok()) {
      const data = await response.json()
      authToken = data.token || data.accessToken
    }
  })

  test(`${testTags.api} ${testTags.auth} authentication endpoints should work correctly`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'

    await test.step('POST /api/auth/login - valid credentials', async () => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: process.env.TEST_USER_EMAIL || 'test@medianest.local',
          password: process.env.TEST_USER_PASSWORD || 'testpassword123'
        }
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data).toHaveProperty('token')
      expect(data.user).toHaveProperty('email')
    })

    await test.step('POST /api/auth/login - invalid credentials', async () => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: 'invalid@test.com',
          password: 'wrongpassword'
        }
      })

      expect(response.status()).toBe(401)
      const data = await response.json()
      expect(data).toHaveProperty('error')
    })

    await test.step('POST /api/auth/logout', async () => {
      const response = await request.post(`${baseURL}/api/auth/logout`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.ok()).toBeTruthy()
    })
  })

  test(`${testTags.api} media endpoints should return correct data`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }

    await test.step('GET /api/media/movies', async () => {
      const response = await request.get(`${baseURL}/api/media/movies`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(Array.isArray(data.movies || data)).toBeTruthy()
    })

    await test.step('GET /api/media/shows', async () => {
      const response = await request.get(`${baseURL}/api/media/shows`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(Array.isArray(data.shows || data)).toBeTruthy()
    })

    await test.step('GET /api/media/recent', async () => {
      const response = await request.get(`${baseURL}/api/media/recent`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(Array.isArray(data.recent || data)).toBeTruthy()
    })
  })

  test(`${testTags.api} requests endpoints should handle CRUD operations`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
    let requestId: string

    await test.step('POST /api/media/request - create new request', async () => {
      const requestData = {
        title: 'Test Movie Request',
        type: 'movie',
        year: 2024,
        description: 'A test movie request'
      }

      const response = await request.post(`${baseURL}/api/media/request`, {
        headers,
        data: requestData
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.title).toBe(requestData.title)
      requestId = data.id
    })

    await test.step('GET /api/media/requests - list all requests', async () => {
      const response = await request.get(`${baseURL}/api/media/requests`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(Array.isArray(data.requests || data)).toBeTruthy()
      
      // Should include our created request
      const requests = data.requests || data
      const ourRequest = requests.find((r: any) => r.id === requestId)
      expect(ourRequest).toBeTruthy()
    })

    await test.step('GET /api/media/requests/:id - get specific request', async () => {
      const response = await request.get(`${baseURL}/api/media/requests/${requestId}`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.id).toBe(requestId)
      expect(data.title).toBe('Test Movie Request')
    })

    await test.step('PUT /api/media/requests/:id - update request', async () => {
      const updateData = {
        status: 'approved',
        notes: 'Approved for download'
      }

      const response = await request.put(`${baseURL}/api/media/requests/${requestId}`, {
        headers,
        data: updateData
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.status).toBe('approved')
    })

    await test.step('DELETE /api/media/requests/:id - delete request', async () => {
      const response = await request.delete(`${baseURL}/api/media/requests/${requestId}`, { headers })

      expect(response.ok()).toBeTruthy()
      
      // Verify deletion
      const getResponse = await request.get(`${baseURL}/api/media/requests/${requestId}`, { headers })
      expect(getResponse.status()).toBe(404)
    })
  })

  test(`${testTags.api} plex integration endpoints should work`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }

    await test.step('GET /api/plex/status', async () => {
      const response = await request.get(`${baseURL}/api/plex/status`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(['online', 'offline']).toContain(data.status)
    })

    await test.step('GET /api/plex/libraries', async () => {
      const response = await request.get(`${baseURL}/api/plex/libraries`, { headers })

      if (response.ok()) {
        const data = await response.json()
        expect(Array.isArray(data.libraries || data)).toBeTruthy()
      } else {
        // Plex might not be available in test environment
        expect([200, 503, 404]).toContain(response.status())
      }
    })

    await test.step('GET /api/plex/search', async () => {
      const response = await request.get(`${baseURL}/api/plex/search?query=test`, { headers })

      if (response.ok()) {
        const data = await response.json()
        expect(data).toHaveProperty('results')
        expect(Array.isArray(data.results)).toBeTruthy()
      } else {
        expect([200, 503, 404]).toContain(response.status())
      }
    })
  })

  test(`${testTags.api} error handling should be consistent`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'

    await test.step('401 Unauthorized - no token', async () => {
      const response = await request.get(`${baseURL}/api/media/movies`)
      
      expect(response.status()).toBe(401)
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('unauthorized')
    })

    await test.step('403 Forbidden - insufficient permissions', async () => {
      // Try to access admin endpoint with regular user token
      const response = await request.get(`${baseURL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      expect([403, 404]).toContain(response.status()) // 404 if endpoint doesn't exist
    })

    await test.step('404 Not Found', async () => {
      const response = await request.get(`${baseURL}/api/nonexistent/endpoint`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      expect(response.status()).toBe(404)
    })

    await test.step('400 Bad Request - invalid data', async () => {
      const response = await request.post(`${baseURL}/api/media/request`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          // Missing required fields
          invalidField: 'invalid data'
        }
      })
      
      expect(response.status()).toBe(400)
      const data = await response.json()
      expect(data).toHaveProperty('error')
    })
  })

  test(`${testTags.api} ${testTags.performance} API response times should be acceptable`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    const headers = {
      'Authorization': `Bearer ${authToken}`
    }

    await test.step('Measure API response times', async () => {
      const endpoints = [
        '/api/media/movies',
        '/api/media/shows', 
        '/api/media/recent',
        '/api/media/requests'
      ]

      for (const endpoint of endpoints) {
        const startTime = Date.now()
        const response = await request.get(`${baseURL}${endpoint}`, { headers })
        const endTime = Date.now()
        
        const responseTime = endTime - startTime
        
        if (response.ok()) {
          expect(responseTime).toBeLessThan(5000) // Should respond within 5 seconds
          console.log(`${endpoint}: ${responseTime}ms`)
        }
      }
    })
  })

  test(`${testTags.api} pagination should work correctly`, async ({ 
    request 
  }) => {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001'
    const headers = {
      'Authorization': `Bearer ${authToken}`
    }

    await test.step('Test pagination parameters', async () => {
      const response = await request.get(`${baseURL}/api/media/movies?page=1&limit=10`, { headers })

      if (response.ok()) {
        const data = await response.json()
        
        // Check for pagination metadata
        if (data.pagination) {
          expect(data.pagination).toHaveProperty('page')
          expect(data.pagination).toHaveProperty('limit')
          expect(data.pagination).toHaveProperty('total')
        }
        
        // Check data array length
        const movies = data.movies || data
        if (Array.isArray(movies)) {
          expect(movies.length).toBeLessThanOrEqual(10)
        }
      }
    })
  })
})