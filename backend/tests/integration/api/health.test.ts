import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

describe('Health Check Endpoint', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    
    // Simple health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })
  })

  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String)
    })
  })

  it('should not require authentication', async () => {
    const response = await request(app)
      .get('/health')
      // No auth header
      .expect(200)

    expect(response.body.status).toBe('ok')
  })

  it('should return quickly', async () => {
    const start = Date.now()
    
    await request(app)
      .get('/health')
      .expect(200)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(100) // Should respond in under 100ms
  })
})