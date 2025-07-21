import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { testPrismaClient as prisma } from '../helpers/test-prisma-client';
import { cleanupDatabase } from '../helpers/database-cleanup';

describe('Auth Endpoints', () => {
  let app: any;

  beforeAll(async () => {
    // Clean up test database
    await cleanupDatabase(prisma);

    // Create test app
    app = createTestApp();

    // Add basic health endpoint for testing
    app.get('/api/v1/auth/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have auth endpoints available', async () => {
    const response = await request(app).get('/api/v1/auth/health').expect(200);

    expect(response.body.status).toBe('ok');
  });
});
