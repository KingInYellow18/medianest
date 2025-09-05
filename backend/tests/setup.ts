import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let pgClient: Client;
let redisClient: Redis;

beforeAll(async () => {
  // Initialize PostgreSQL connection
  pgClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/medianest_test'
  });
  
  try {
    await pgClient.connect();
    console.log('🐘 PostgreSQL test database connected');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL test database:', error);
    throw error;
  }
  
  // Initialize Redis connection
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  });
  
  try {
    await redisClient.ping();
    console.log('🔴 Redis test instance connected');
  } catch (error) {
    console.error('❌ Failed to connect to Redis test instance:', error);
    throw error;
  }
  
  // Run database migrations or setup if needed
  await setupTestDatabase();
});

afterAll(async () => {
  if (pgClient) {
    await cleanupTestDatabase();
    await pgClient.end();
    console.log('🐘 PostgreSQL test database disconnected');
  }
  
  if (redisClient) {
    await redisClient.flushall();
    redisClient.disconnect();
    console.log('🔴 Redis test instance disconnected');
  }
});

beforeEach(async () => {
  // Clear Redis cache before each test
  if (redisClient) {
    await redisClient.flushall();
  }
  
  // Clean up test data in PostgreSQL
  if (pgClient) {
    await pgClient.query('BEGIN');
  }
});

afterEach(async () => {
  // Rollback PostgreSQL transaction
  if (pgClient) {
    await pgClient.query('ROLLBACK');
  }
});

async function setupTestDatabase() {
  try {
    // Create test tables if they don't exist
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES test_users(id),
        data TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Test database schema initialized');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}

async function cleanupTestDatabase() {
  try {
    // Drop test tables
    await pgClient.query('DROP TABLE IF EXISTS test_sessions');
    await pgClient.query('DROP TABLE IF EXISTS test_users');
    
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error);
  }
}

// Export clients for use in tests
export { pgClient, redisClient };