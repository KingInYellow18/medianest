import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SessionTokenRepository, CreateSessionTokenInput } from '@/repositories/session-token.repository'
import { UserRepository } from '@/repositories/user.repository'
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database'

describe('SessionTokenRepository Integration Tests', () => {
  let repository: SessionTokenRepository
  let userRepository: UserRepository
  let testUserId: string
  let secondUserId: string
  
  beforeEach(async () => {
    const prisma = getTestPrismaClient()
    repository = new SessionTokenRepository(prisma)
    userRepository = new UserRepository(prisma)
    
    await cleanDatabase()
    
    // Create test users
    const testUser = await userRepository.create({
      email: 'test@example.com',
      name: 'Test User',
      plexId: 'plex-123',
      plexUsername: 'testuser',
      role: 'user'
    })
    testUserId = testUser.id
    
    const secondUser = await userRepository.create({
      email: 'test2@example.com',
      name: 'Second User',
      plexId: 'plex-456',
      plexUsername: 'testuser2',
      role: 'user'
    })
    secondUserId = secondUser.id
  })
  
  afterEach(async () => {
    await cleanDatabase()
  })

  describe('create', () => {
    it('should create a session token with secure token generation', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const tokenData: CreateSessionTokenInput = {
        userId: testUserId,
        expiresAt: tomorrow
      }

      const result = await repository.create(tokenData)

      expect(result).toMatchObject({
        token: expect.any(String),
        sessionToken: {
          id: expect.any(String),
          userId: testUserId,
          tokenHash: expect.any(String),
          expiresAt: tomorrow,
          createdAt: expect.any(Date),
          lastUsedAt: null,
          user: {
            id: testUserId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active'
          }
        }
      })

      // Token hash should be present
      expect(result.sessionToken.tokenHash).toBeTruthy()
      expect(result.sessionToken.tokenHash).toMatch(/^[a-f0-9]{64}$/)
      
      // Token hash should be different from raw token
      expect(result.sessionToken.tokenHash).not.toBe(result.token)
      expect(result.sessionToken.tokenHash).toHaveLength(64) // SHA-256 hex
    })

    it('should generate unique tokens for each session', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const tokenData: CreateSessionTokenInput = {
        userId: testUserId,
        expiresAt: tomorrow
      }

      const result1 = await repository.create(tokenData)
      const result2 = await repository.create(tokenData)

      expect(result1.token).not.toBe(result2.token)
      expect(result1.sessionToken.tokenHash).not.toBe(result2.sessionToken.tokenHash)
    })

    it('should fail with invalid userId', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const tokenData: CreateSessionTokenInput = {
        userId: 'invalid-user-id',
        expiresAt: tomorrow
      }

      await expect(repository.create(tokenData)).rejects.toThrow()
    })
  })

  describe('findByToken', () => {
    let createdToken: string
    let sessionTokenId: string

    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      
      createdToken = result.token
      sessionTokenId = result.sessionToken.id
    })

    it('should find session token by raw token', async () => {
      const result = await repository.findByToken(createdToken)

      expect(result).toMatchObject({
        id: sessionTokenId,
        userId: testUserId,
        tokenHash: expect.any(String),
        user: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User'
        }
      })
    })

    it('should return null for invalid token', async () => {
      const result = await repository.findByToken('invalid-token')
      expect(result).toBeNull()
    })

    it('should return null for non-existent token', async () => {
      const result = await repository.findByToken('a'.repeat(64))
      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      // Create multiple sessions for user
      await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      
      await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      
      // Create session for different user
      await repository.create({
        userId: secondUserId,
        expiresAt: tomorrow
      })
    })

    it('should return all sessions for user ordered by creation date', async () => {
      const result = await repository.findByUserId(testUserId)

      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe(testUserId)
      expect(result[1].userId).toBe(testUserId)
      
      // Should be ordered by createdAt desc
      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        result[1].createdAt.getTime()
      )
    })

    it('should return empty array for user with no sessions', async () => {
      const emptyUser = await userRepository.create({
        email: 'empty@example.com',
        plexId: 'plex-empty',
        role: 'user'
      })

      const result = await repository.findByUserId(emptyUser.id)
      expect(result).toHaveLength(0)
    })
  })

  describe('validate', () => {
    let validToken: string
    let expiredToken: string
    let sessionTokenId: string

    beforeEach(async () => {
      // Create valid token
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const validResult = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      validToken = validResult.token
      sessionTokenId = validResult.sessionToken.id
      
      // Create expired token
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const expiredResult = await repository.create({
        userId: testUserId,
        expiresAt: yesterday
      })
      expiredToken = expiredResult.token
    })

    it('should validate and update lastUsedAt for valid token', async () => {
      const result = await repository.validate(validToken)

      expect(result).toMatchObject({
        id: sessionTokenId,
        userId: testUserId,
        lastUsedAt: expect.any(Date)
      })
      
      // lastUsedAt should be very recent
      const timeDiff = Date.now() - result!.lastUsedAt!.getTime()
      expect(timeDiff).toBeLessThan(1000) // Less than 1 second ago
    })

    it('should return null and delete expired token', async () => {
      // First verify the expired token exists
      const beforeValidation = await repository.findByToken(expiredToken)
      expect(beforeValidation).not.toBeNull()

      const result = await repository.validate(expiredToken)
      expect(result).toBeNull()

      // Verify the expired token was deleted
      const afterValidation = await repository.findByToken(expiredToken)
      expect(afterValidation).toBeNull()
    })

    it('should return null for non-existent token', async () => {
      const result = await repository.validate('non-existent-token')
      expect(result).toBeNull()
    })
  })

  describe('updateLastUsed', () => {
    let sessionTokenId: string

    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      sessionTokenId = result.sessionToken.id
    })

    it('should update lastUsedAt timestamp', async () => {
      const beforeUpdate = new Date()
      
      const result = await repository.updateLastUsed(sessionTokenId)

      expect(result.lastUsedAt).toBeInstanceOf(Date)
      expect(result.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    })

    it('should fail for non-existent session', async () => {
      await expect(repository.updateLastUsed('non-existent-id'))
        .rejects.toThrow()
    })
  })

  describe('delete operations', () => {
    let token1: string
    let token2: string
    let sessionId1: string
    let sessionId2: string

    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result1 = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      token1 = result1.token
      sessionId1 = result1.sessionToken.id
      
      const result2 = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      token2 = result2.token
      sessionId2 = result2.sessionToken.id
    })

    describe('delete by id', () => {
      it('should delete session by id', async () => {
        const deleted = await repository.delete(sessionId1)
        expect(deleted.id).toBe(sessionId1)

        const found = await repository.findByToken(token1)
        expect(found).toBeNull()
      })

      it('should fail for non-existent id', async () => {
        await expect(repository.delete('non-existent-id'))
          .rejects.toThrow()
      })
    })

    describe('deleteByToken', () => {
      it('should delete session by raw token', async () => {
        const deleted = await repository.deleteByToken(token1)
        expect(deleted.id).toBe(sessionId1)

        const found = await repository.findByToken(token1)
        expect(found).toBeNull()
      })

      it('should fail for non-existent token', async () => {
        await expect(repository.deleteByToken('non-existent-token'))
          .rejects.toThrow()
      })
    })

    describe('deleteByUserId', () => {
      it('should delete all sessions for user', async () => {
        const count = await repository.deleteByUserId(testUserId)
        expect(count).toBe(2)

        const remaining = await repository.findByUserId(testUserId)
        expect(remaining).toHaveLength(0)
      })

      it('should return 0 for user with no sessions', async () => {
        const emptyUser = await userRepository.create({
          email: 'empty@example.com',
          plexId: 'plex-empty',
          role: 'user'
        })

        const count = await repository.deleteByUserId(emptyUser.id)
        expect(count).toBe(0)
      })
    })
  })

  describe('deleteExpired', () => {
    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      // Create mix of valid and expired sessions
      await repository.create({
        userId: testUserId,
        expiresAt: tomorrow // Valid
      })
      
      await repository.create({
        userId: testUserId,
        expiresAt: yesterday // Expired
      })
      
      await repository.create({
        userId: secondUserId,
        expiresAt: yesterday // Expired
      })
    })

    it('should delete only expired sessions', async () => {
      const count = await repository.deleteExpired()
      expect(count).toBe(2)

      const remaining = await repository.findByUserId(testUserId)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('getActiveSessionCount', () => {
    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      // Create sessions for testUserId
      await repository.create({
        userId: testUserId,
        expiresAt: tomorrow // Active
      })
      
      await repository.create({
        userId: testUserId,
        expiresAt: tomorrow // Active
      })
      
      await repository.create({
        userId: testUserId,
        expiresAt: yesterday // Expired
      })
      
      // Create session for different user
      await repository.create({
        userId: secondUserId,
        expiresAt: tomorrow
      })
    })

    it('should count only active sessions for user', async () => {
      const count = await repository.getActiveSessionCount(testUserId)
      expect(count).toBe(2)
    })

    it('should return 0 for user with no active sessions', async () => {
      const emptyUser = await userRepository.create({
        email: 'empty@example.com',
        plexId: 'plex-empty',
        role: 'user'
      })

      const count = await repository.getActiveSessionCount(emptyUser.id)
      expect(count).toBe(0)
    })
  })

  describe('extendExpiry', () => {
    let sessionTokenId: string

    beforeEach(async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result = await repository.create({
        userId: testUserId,
        expiresAt: tomorrow
      })
      sessionTokenId = result.sessionToken.id
    })

    it('should extend session expiry', async () => {
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + 7) // One week from now
      
      const result = await repository.extendExpiry(sessionTokenId, newExpiry)

      expect(result.expiresAt.getTime()).toBe(newExpiry.getTime())
    })

    it('should fail for non-existent session', async () => {
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + 7)

      await expect(repository.extendExpiry('non-existent-id', newExpiry))
        .rejects.toThrow()
    })
  })
})