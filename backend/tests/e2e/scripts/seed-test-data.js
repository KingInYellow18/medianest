#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Hash a token for storage (same logic as the app)
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate test JWT token (simplified for testing)
 */
function generateTestJWT(userId) {
  const header = Buffer.from(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
    }),
  ).toString('base64url');

  const payload = Buffer.from(
    JSON.stringify({
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
    }),
  ).toString('base64url');

  return `${header}.${payload}.test-signature`;
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Load test data
    const testDataPath = path.join(__dirname, '../fixtures/test-users.json');
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

    // Clear existing data
    console.log('🧹 Clearing existing test data...');
    await prisma.mediaRequest.deleteMany({});
    await prisma.serviceConfig.deleteMany({});
    await prisma.sessionToken.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed users
    console.log('👥 Seeding users...');
    for (const userData of testData.users) {
      await prisma.user.create({
        data: userData,
      });
    }

    // Seed sessions with proper token handling
    console.log('🔑 Seeding session tokens...');
    for (const sessionData of testData.sessions) {
      const plainToken = generateTestJWT(sessionData.userId);
      const hashedToken = hashToken(plainToken);

      await prisma.sessionToken.create({
        data: {
          ...sessionData,
          token: hashedToken,
        },
      });

      // Store plain tokens for E2E tests to use
      const tokensFile = path.join(__dirname, '../fixtures/test-tokens.json');
      const existingTokens = fs.existsSync(tokensFile)
        ? JSON.parse(fs.readFileSync(tokensFile, 'utf8'))
        : { tokens: {} };

      existingTokens.tokens[sessionData.userId] = plainToken;

      fs.writeFileSync(tokensFile, JSON.stringify(existingTokens, null, 2));
    }

    // Seed service configurations
    console.log('⚙️ Seeding service configurations...');
    for (const configData of testData.serviceConfigs) {
      await prisma.serviceConfig.create({
        data: {
          ...configData,
          config: JSON.stringify(configData.config), // Prisma expects JSON as string
        },
      });
    }

    // Seed media requests
    console.log('🎬 Seeding media requests...');
    for (const requestData of testData.mediaRequests) {
      await prisma.mediaRequest.create({
        data: {
          ...requestData,
          metadata: JSON.stringify(requestData.metadata),
        },
      });
    }

    // Create additional test data for specific scenarios
    console.log('📊 Creating scenario-specific test data...');

    // Rate limiting test user (with many requests)
    const rateLimitUser = await prisma.user.create({
      data: {
        id: 'rate-limit-test-user',
        username: 'ratelimituser',
        email: 'ratelimit@example.com',
        plexId: '88888',
        plexUsername: 'ratelimituser',
        role: 'USER',
        isActive: true,
      },
    });

    // Create multiple requests for rate limiting tests
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push({
        id: `rate-limit-request-${i}`,
        userId: rateLimitUser.id,
        title: `Rate Limit Test Movie ${i}`,
        type: 'MOVIE',
        tmdbId: 100000 + i,
        status: 'PENDING',
        requestedAt: new Date(),
        metadata: JSON.stringify({
          year: 2023,
          genre: 'Test',
          overview: `Rate limiting test movie ${i}`,
        }),
      });
    }

    await prisma.mediaRequest.createMany({ data: requests });

    // Error logging test data
    await prisma.errorLog.createMany({
      data: [
        {
          id: 'test-error-1',
          level: 'ERROR',
          message: 'Test error for E2E testing',
          stack: 'Error: Test error\n    at TestFunction (test.js:1:1)',
          metadata: JSON.stringify({ testCase: 'error-handling' }),
          correlationId: 'test-correlation-1',
          createdAt: new Date(),
        },
        {
          id: 'test-warning-1',
          level: 'WARN',
          message: 'Test warning for E2E testing',
          stack: null,
          metadata: JSON.stringify({ testCase: 'warning-handling' }),
          correlationId: 'test-correlation-2',
          createdAt: new Date(),
        },
      ],
    });

    // YouTube download test data
    await prisma.youTubeDownload.createMany({
      data: [
        {
          id: 'test-youtube-1',
          userId: 'test-user-1',
          videoId: 'dQw4w9WgXcQ',
          title: 'Test Video 1',
          status: 'COMPLETED',
          filePath: '/test/downloads/video1.mp4',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-youtube-2',
          userId: 'test-user-1',
          videoId: 'jNQXAC9IVRw',
          title: 'Test Video 2',
          status: 'IN_PROGRESS',
          filePath: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // Service status test data
    await prisma.serviceStatus.createMany({
      data: [
        {
          id: 'test-status-plex',
          serviceName: 'plex',
          status: 'ONLINE',
          lastChecked: new Date(),
          responseTime: 150,
          metadata: JSON.stringify({ version: '1.0.0' }),
        },
        {
          id: 'test-status-overseerr',
          serviceName: 'overseerr',
          status: 'ONLINE',
          lastChecked: new Date(),
          responseTime: 200,
          metadata: JSON.stringify({ version: '2.0.0' }),
        },
      ],
    });

    console.log('✅ Test data seeding completed successfully!');
    console.log('📊 Data summary:');
    console.log(`   Users: ${await prisma.user.count()}`);
    console.log(`   Sessions: ${await prisma.sessionToken.count()}`);
    console.log(`   Service Configs: ${await prisma.serviceConfig.count()}`);
    console.log(`   Media Requests: ${await prisma.mediaRequest.count()}`);
    console.log(`   Error Logs: ${await prisma.errorLog.count()}`);
    console.log(`   YouTube Downloads: ${await prisma.youTubeDownload.count()}`);
    console.log(`   Service Status: ${await prisma.serviceStatus.count()}`);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Self-cleanup function
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');

  try {
    await prisma.serviceStatus.deleteMany({});
    await prisma.youTubeDownload.deleteMany({});
    await prisma.errorLog.deleteMany({});
    await prisma.mediaRequest.deleteMany({});
    await prisma.serviceConfig.deleteMany({});
    await prisma.sessionToken.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle process signals for cleanup
process.on('SIGINT', async () => {
  await cleanupTestData();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupTestData();
  process.exit(0);
});

// Export for use in other scripts
module.exports = { seedTestData, cleanupTestData };

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'cleanup') {
    cleanupTestData();
  } else {
    seedTestData();
  }
}
