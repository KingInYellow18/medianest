import { logger } from '../utils/logger'
import { getPrismaClient, disconnectPrisma } from '../db/prisma'
import { createRepositories, Repositories } from '../repositories'

let repositories: Repositories

export const initializeDatabase = async () => {
  const prisma = getPrismaClient()
  
  try {
    // Test connection
    await prisma.$connect()
    logger.info('Database connected successfully')
    
    // Create repositories
    repositories = createRepositories(prisma)
    logger.info('Repositories initialized')
    
    return prisma
  } catch (error) {
    logger.error('Failed to connect to database', error)
    throw error
  }
}

export const getDatabase = () => {
  return getPrismaClient()
}

export const getRepositories = (): Repositories => {
  if (!repositories) {
    throw new Error('Repositories not initialized. Call initializeDatabase first.')
  }
  return repositories
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectPrisma()
})