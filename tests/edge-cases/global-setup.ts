/**
 * Global Setup for Edge Case Testing
 * Prepares test environment and infrastructure
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export default async function globalSetup() {
  console.log('🔧 Setting up edge case testing environment...');

  try {
    // Ensure test directories exist
    const testDirs = [
      './test-results/edge-cases',
      './coverage/edge-cases',
      './logs/edge-case-tests'
    ];

    for (const dir of testDirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Initialize test database
    const testDbUrl = process.env.TEST_DATABASE_URL || 
      'postgresql://medianest:test_password@localhost:5432/medianest_test';
    
    console.log('📊 Preparing test database...');
    
    const prisma = new PrismaClient({
      datasources: {
        db: { url: testDbUrl }
      }
    });

    try {
      // Test database connection
      await prisma.$connect();
      
      // Run database migrations for test environment
      process.env.DATABASE_URL = testDbUrl;
      execSync('npx prisma db push --force-reset', { 
        stdio: 'pipe',
        cwd: path.resolve(__dirname, '../../backend')
      });
      
      console.log('✅ Test database initialized');
      
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }

    // Initialize Redis test environment
    console.log('🔴 Preparing Redis test environment...');
    
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 1 // Use separate DB for tests
    });

    try {
      await redis.ping();
      await redis.flushdb(); // Clear test database
      console.log('✅ Redis test environment ready');
    } catch (error) {
      console.error('❌ Redis setup failed:', error);
      throw error;
    } finally {
      await redis.disconnect();
    }

    // Create test configuration
    const testConfig = {
      environment: 'edge-case-testing',
      timestamp: new Date().toISOString(),
      databaseUrl: testDbUrl,
      redisConfig: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 1
      },
      testCategories: [
        'boundary-values',
        'error-conditions', 
        'concurrent-access',
        'security-edge-cases',
        'performance-limits',
        'data-consistency'
      ]
    };

    await fs.writeFile(
      './test-results/edge-cases/test-config.json',
      JSON.stringify(testConfig, null, 2)
    );

    console.log('🧪 Edge case testing environment ready');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}