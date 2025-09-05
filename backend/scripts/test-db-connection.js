#!/usr/bin/env node

const { Client } = require('pg');
const Redis = require('ioredis');
require('dotenv').config({ path: '.env.test' });

async function testDatabaseConnections() {
  console.log('🧪 Testing MediaNest Test Environment Connections...\n');
  
  // Test PostgreSQL connection
  console.log('🐘 Testing PostgreSQL connection...');
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/medianest_test'
  });
  
  try {
    await pgClient.connect();
    const result = await pgClient.query('SELECT version()');
    console.log('✅ PostgreSQL connected successfully');
    console.log(`   Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    
    // Test table creation
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgClient.query('INSERT INTO test_connection DEFAULT VALUES');
    const testResult = await pgClient.query('SELECT COUNT(*) as count FROM test_connection');
    console.log(`   Test table operations: ${testResult.rows[0].count} records`);
    
    await pgClient.query('DROP TABLE IF EXISTS test_connection');
    await pgClient.end();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
  
  // Test Redis connection
  console.log('\n🔴 Testing Redis connection...');
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6380,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 1
  });
  
  try {
    const pong = await redisClient.ping();
    console.log('✅ Redis connected successfully');
    console.log(`   Ping response: ${pong}`);
    
    // Test Redis operations
    await redisClient.set('test:connection', 'success');
    const value = await redisClient.get('test:connection');
    console.log(`   Test key operations: ${value}`);
    
    await redisClient.del('test:connection');
    redisClient.disconnect();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1);
  }
  
  console.log('\n🎉 All test database connections successful!');
  console.log('\nEnvironment Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL}`);
  console.log(`   PORT: ${process.env.PORT}`);
}

if (require.main === module) {
  testDatabaseConnections().catch(console.error);
}

module.exports = { testDatabaseConnections };