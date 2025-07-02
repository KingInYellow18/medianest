import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

let prisma: PrismaClient

export const initializeDatabase = async (): Promise<PrismaClient> => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    })

    // Log database events
    prisma.$on('query', (e) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Query: ' + e.query, { duration: e.duration })
      }
    })

    prisma.$on('error', (e) => {
      logger.error('Database error:', e)
    })

    // Test connection
    await prisma.$connect()
  }

  return prisma
}

export const getDatabase = (): PrismaClient => {
  if (!prisma) {
    throw new Error('Database not initialized')
  }
  return prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma?.$disconnect()
})