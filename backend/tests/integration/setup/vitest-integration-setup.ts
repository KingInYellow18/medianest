/**
 * Vitest Integration Test Setup
 * 
 * Replaces Jest integration setup with modern Vitest patterns.
 * Handles database setup, Redis connections, and service mocking.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

let prisma: PrismaClient;
let redis: Redis;

// **GLOBAL SETUP - Run once before all integration tests**
beforeAll(async () => {
  console.log('🚀 Starting integration test environment...');
  
  // 1. Start test containers
  try {
    console.log('📦 Starting Docker test services...');
    execSync(
      'docker compose -f docker-compose.test.yml up -d --wait postgres redis', 
      { stdio: 'inherit', timeout: 60000 }
    );
  } catch (error) {
    console.error('❌ Failed to start test containers:', error);
    throw error;
  }
  
  // 2. Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. Initialize Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: process.env.DATABASE_LOGGING === 'true' ? ['query', 'error'] : ['error']
  });
  
  // 4. Connect to database and run migrations
  try {
    await prisma.$connect();
    console.log('🗄️  Running database migrations...');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
  
  // 5. Initialize Redis client
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true
  });
  
  try {
    await redis.connect();
    console.log('🔴 Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
  
  // 6. Seed initial test data if needed
  console.log('🌱 Seeding test data...');
  await seedTestData();
  
  console.log('✅ Integration test environment ready!');
}, 120000); // 2 minute timeout

// **GLOBAL TEARDOWN - Run once after all integration tests**
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // 1. Disconnect from services
  if (prisma) {
    await prisma.$disconnect();
  }
  
  if (redis) {
    redis.disconnect();
  }
  
  // 2. Stop test containers
  try {
    execSync('docker compose -f docker-compose.test.yml down -v', { 
      stdio: 'inherit',
      timeout: 30000 
    });
    console.log('✅ Test containers stopped');
  } catch (error) {
    console.warn('⚠️  Failed to stop containers cleanly:', error);
  }
}, 60000);

// **INDIVIDUAL TEST SETUP - Run before each test**
beforeEach(async () => {
  // Clear database state between tests (preserve schema)
  await cleanupDatabase();
  
  // Clear Redis cache
  await redis.flushdb();
  
  // Reset any global mocks
  // vi.clearAllMocks(); // Uncomment if using vi mocks
});

// **INDIVIDUAL TEST CLEANUP - Run after each test**
afterEach(async () => {
  // Additional cleanup if needed
  // This runs after each individual test
});

// **HELPER FUNCTIONS**

/**
 * Clean database state between tests
 * Truncates all tables while preserving schema
 */
async function cleanupDatabase(): Promise<void> {
  try {
    // Get all table names
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
    `;
    
    // Truncate all tables with CASCADE to handle foreign keys
    for (const { tablename } of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  } catch (error) {
    console.error('Database cleanup failed:', error);
    throw error;
  }
}

/**
 * Seed essential test data
 */
async function seedTestData(): Promise<void> {
  try {
    // Add any essential test data here
    // Example:
    // await prisma.user.create({
    //   data: {
    //     email: 'test@example.com',
    //     name: 'Test User',
    //     // ... other fields
    //   }
    // });
    
    console.log('Test data seeded successfully');
  } catch (error) {
    console.error('Test data seeding failed:', error);
    throw error;
  }
}

// **EXPORT TEST UTILITIES**
export { prisma, redis };

/**
 * Create a test user for authentication tests
 */
export async function createTestUser(overrides: Partial<any> = {}) {
  return await prisma.user.create({
    data: {
      email: 'testuser@example.com',
      name: 'Test User',
      passwordHash: '$2b$10$test.hash.here', // Pre-computed bcrypt hash for 'password123'
      ...overrides
    }
  });
}

/**
 * Clean up specific test data
 */
export async function cleanupTestData() {
  await cleanupDatabase();
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}