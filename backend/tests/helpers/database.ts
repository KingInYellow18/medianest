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

export async function seedTestData() {
  const prisma = getTestPrismaClient()
  
  // Create test users
  const testUser = await prisma.user.create({
    data: {
      plexId: 'test-plex-id-1',
      username: 'testuser1',
      email: 'test1@example.com',
      role: 'user',
      status: 'active'
    }
  })

  const adminUser = await prisma.user.create({
    data: {
      plexId: 'test-plex-id-admin',
      username: 'testadmin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active'
    }
  })

  return { testUser, adminUser }
}