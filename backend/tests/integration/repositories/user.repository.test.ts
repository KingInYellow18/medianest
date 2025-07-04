import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { UserRepository } from '@/repositories/user.repository'
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database'
import { NotFoundError, ConflictError } from '@/utils/errors'

describe('User Repository', () => {
  let prisma: ReturnType<typeof getTestPrismaClient>
  let userRepository: UserRepository

  beforeAll(async () => {
    prisma = getTestPrismaClient()
    userRepository = new UserRepository(prisma)
  })

  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user' as const
      }

      const user = await userRepository.create(userData)

      expect(user).toMatchObject({
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active'
      })
      expect(user.id).toBeTruthy()
      expect(user.createdAt).toBeInstanceOf(Date)
    })

    it('should store plex token as provided', async () => {
      const userData = {
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'secret-plex-token'
      }

      const user = await userRepository.create(userData)

      // Token should be stored as provided (encryption handled elsewhere)
      const rawUser = await prisma.user.findUnique({
        where: { id: user.id }
      })
      expect(rawUser?.plexToken).toBe('secret-plex-token')
    })

    it('should throw error for duplicate plexId', async () => {
      await userRepository.create({
        plexId: 'duplicate-plex',
        plexUsername: 'user1',
        email: 'user1@example.com'
      })

      await expect(
        userRepository.create({
          plexId: 'duplicate-plex',
          plexUsername: 'user2',
          email: 'user2@example.com'
        })
      ).rejects.toThrow('Duplicate entry')
    })
  })

  describe('findByPlexId', () => {
    it('should find user by Plex ID', async () => {
      const created = await userRepository.create({
        plexId: 'find-me-123',
        plexUsername: 'findme',
        email: 'findme@example.com'
      })

      const found = await userRepository.findByPlexId('find-me-123')

      expect(found).toMatchObject({
        id: created.id,
        plexId: 'find-me-123',
        plexUsername: 'findme'
      })
    })

    it('should return null for non-existent Plex ID', async () => {
      const found = await userRepository.findByPlexId('non-existent')
      expect(found).toBeNull()
    })

    it('should return plex token as stored', async () => {
      await userRepository.create({
        plexId: 'encrypted-123',
        plexUsername: 'encrypted',
        email: 'encrypted@example.com',
        plexToken: 'original-token'
      })

      const found = await userRepository.findByPlexId('encrypted-123')
      expect(found?.plexToken).toBe('original-token')
    })
  })

  describe('isFirstUser', () => {
    it('should return true when no users exist', async () => {
      const isFirst = await userRepository.isFirstUser()
      expect(isFirst).toBe(true)
    })

    it('should return false when users exist', async () => {
      await userRepository.create({
        plexId: 'first-user',
        plexUsername: 'first',
        email: 'first@example.com'
      })

      const isFirst = await userRepository.isFirstUser()
      expect(isFirst).toBe(false)
    })
  })

  describe('update', () => {
    it('should update user fields', async () => {
      const user = await userRepository.create({
        plexId: 'update-me',
        plexUsername: 'oldname',
        email: 'old@example.com'
      })

      const updated = await userRepository.update(user.id, {
        plexUsername: 'newname',
        email: 'new@example.com',
        role: 'admin'
      })

      expect(updated).toMatchObject({
        id: user.id,
        plexUsername: 'newname',
        email: 'new@example.com',
        role: 'admin'
      })
    })

    it('should update lastLoginAt', async () => {
      const user = await userRepository.create({
        plexId: 'login-test',
        plexUsername: 'logintest',
        email: 'login@example.com'
      })

      const loginTime = new Date()
      const updated = await userRepository.update(user.id, {
        lastLoginAt: loginTime
      })

      expect(updated.lastLoginAt).toEqual(loginTime)
    })

    it('should throw error for non-existent user', async () => {
      await expect(
        userRepository.update('non-existent-id', { plexUsername: 'new' })
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('findAll with pagination', () => {
    beforeEach(async () => {
      // Create test users
      for (let i = 1; i <= 15; i++) {
        await userRepository.create({
          plexId: `plex-${i}`,
          plexUsername: `user${i}`,
          email: `user${i}@example.com`,
          role: i <= 2 ? 'admin' : 'user'
        })
      }
    })

    it('should paginate results', async () => {
      const page1 = await userRepository.findAll({ limit: 10, page: 1 })
      const page2 = await userRepository.findAll({ limit: 10, page: 2 })

      expect(page1.items).toHaveLength(10)
      expect(page2.items).toHaveLength(5)
      expect(page1.total).toBe(15)
      expect(page2.total).toBe(15)
    })

    it('should filter by role', async () => {
      const admins = await userRepository.findByRole('admin')

      expect(admins.items).toHaveLength(2)
      expect(admins.items.every(u => u.role === 'admin')).toBe(true)
    })

    it('should filter by status', async () => {
      // Update one user to inactive
      const users = await userRepository.findAll({ limit: 1 })
      await userRepository.update(users.items[0].id, { status: 'inactive' })

      const activeUsers = await userRepository.findActiveUsers()

      expect(activeUsers.total).toBe(14)
    })
  })

  describe('delete', () => {
    it('should hard delete user', async () => {
      const user = await userRepository.create({
        plexId: 'delete-me',
        plexUsername: 'deleteme',
        email: 'delete@example.com'
      })

      await userRepository.delete(user.id)

      const found = await userRepository.findById(user.id)
      expect(found).toBeNull()
    })

    it('should throw error for non-existent user', async () => {
      await expect(
        userRepository.delete('non-existent-id')
      ).rejects.toThrow('Record not found')
    })
  })
})