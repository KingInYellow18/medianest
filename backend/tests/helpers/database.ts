import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

export function getTestPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })
  }
  return prisma
}

export async function cleanDatabase() {
  const prisma = getTestPrismaClient()
  
  // Delete in correct order to respect foreign key constraints
  await prisma.sessionToken.deleteMany()
  await prisma.youtubeDownload.deleteMany()
  await prisma.mediaRequest.deleteMany()
  await prisma.serviceStatus.deleteMany()
  await prisma.serviceConfig.deleteMany()
  await prisma.user.deleteMany()
}

export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect()
  }
}

// Global test utilities for creating test users
export async function createTestUser(overrides: any = {}) {
  const prisma = getTestPrismaClient()
  
  const defaultUser = {
    plexId: `test-plex-${Date.now()}-${Math.random()}`,
    plexUsername: `testuser-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    role: 'user',
    status: 'active',
    ...overrides
  }

  return await prisma.user.create({
    data: defaultUser
  })
}

export async function createTestAdmin(overrides: any = {}) {
  return await createTestUser({
    role: 'admin',
    plexUsername: `admin-${Date.now()}`,
    email: `admin-${Date.now()}@example.com`,
    ...overrides
  })
}

export async function seedTestData() {
  const prisma = getTestPrismaClient()
  
  // Create test users
  const testUser = await createTestUser({
    plexId: 'test-plex-id-1',
    plexUsername: 'testuser1',
    email: 'test1@example.com'
  })

  const adminUser = await createTestUser({
    plexId: 'test-plex-id-admin',
    plexUsername: 'admin1',
    email: 'admin1@example.com',
    role: 'admin'
  })

  return { testUser, adminUser }
}

// Make createTestUser available globally for tests
declare global {
  var createTestUser: typeof createTestUser
}

global.createTestUser = createTestUser