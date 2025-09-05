import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MediaRequestRepository, CreateMediaRequestInput, MediaRequestFilters } from '@/repositories/media-request.repository'
import { UserRepository } from '@/repositories/user.repository'
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database'
import { NotFoundError, ValidationError } from '@/utils/errors'

describe('MediaRequestRepository Integration Tests', () => {
  let repository: MediaRequestRepository
  let userRepository: UserRepository
  let testUserId: string
  let secondUserId: string
  
  beforeEach(async () => {
    const prisma = getTestPrismaClient()
    repository = new MediaRequestRepository(prisma)
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
    it('should create a media request with required fields', async () => {
      const requestData: CreateMediaRequestInput = {
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603'
      }

      const result = await repository.create(requestData)

      expect(result).toMatchObject({
        id: expect.any(String),
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603',
        status: 'pending',
        createdAt: expect.any(Date)
      })
      expect(result.user).toMatchObject({
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User'
      })
    })

    it('should create a media request without optional fields', async () => {
      const requestData: CreateMediaRequestInput = {
        userId: testUserId,
        title: 'Breaking Bad',
        mediaType: 'tv'
      }

      const result = await repository.create(requestData)

      expect(result).toMatchObject({
        userId: testUserId,
        title: 'Breaking Bad',
        mediaType: 'tv',
        tmdbId: null,
        overseerrId: null
      })
    })

    it('should fail with invalid userId', async () => {
      const requestData: CreateMediaRequestInput = {
        userId: 'invalid-user-id',
        title: 'The Matrix',
        mediaType: 'movie'
      }

      await expect(repository.create(requestData)).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('should find media request by id with user info', async () => {
      const created = await repository.create({
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603'
      })

      const result = await repository.findById(created.id)

      expect(result).toMatchObject({
        id: created.id,
        title: 'The Matrix',
        user: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User'
        }
      })
    })

    it('should return null for non-existent id', async () => {
      const result = await repository.findById('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('findByUser', () => {
    beforeEach(async () => {
      // Create test requests for first user
      await repository.create({
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie'
      })
      await repository.create({
        userId: testUserId,
        title: 'Breaking Bad',
        mediaType: 'tv'
      })
      
      // Create request for second user
      await repository.create({
        userId: secondUserId,
        title: 'Game of Thrones',
        mediaType: 'tv'
      })
    })

    it('should return only requests for specified user', async () => {
      const result = await repository.findByUser(testUserId)

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.items[0].userId).toBe(testUserId)
      expect(result.items[1].userId).toBe(testUserId)
    })

    it('should support pagination', async () => {
      const result = await repository.findByUser(testUserId, { 
        limit: 1, 
        page: 1 
      })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(2)
      expect(result.totalPages).toBe(2)
    })

    it('should return empty array for user with no requests', async () => {
      const emptyUser = await userRepository.create({
        email: 'empty@example.com',
        plexId: 'plex-empty',
        role: 'user'
      })

      const result = await repository.findByUser(emptyUser.id)

      expect(result.items).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('findByFilters', () => {
    beforeEach(async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Create various requests for filtering
      const request1 = await repository.create({
        userId: testUserId,
        title: 'Movie 1',
        mediaType: 'movie'
      })
      
      await repository.create({
        userId: testUserId,
        title: 'TV Show 1',
        mediaType: 'tv'
      })
      
      await repository.create({
        userId: secondUserId,
        title: 'Movie 2',
        mediaType: 'movie'
      })

      // Update status of first request
      await repository.updateStatus(request1.id, 'approved')
    })

    it('should filter by status', async () => {
      const filters: MediaRequestFilters = { status: 'approved' }
      const result = await repository.findByFilters(filters)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].status).toBe('approved')
      expect(result.items[0].title).toBe('Movie 1')
    })

    it('should filter by mediaType', async () => {
      const filters: MediaRequestFilters = { mediaType: 'movie' }
      const result = await repository.findByFilters(filters)

      expect(result.items).toHaveLength(2)
      result.items.forEach(request => {
        expect(request.mediaType).toBe('movie')
      })
    })

    it('should filter by userId', async () => {
      const filters: MediaRequestFilters = { userId: testUserId }
      const result = await repository.findByFilters(filters)

      expect(result.items).toHaveLength(2)
      result.items.forEach(request => {
        expect(request.userId).toBe(testUserId)
      })
    })

    it('should combine multiple filters', async () => {
      const filters: MediaRequestFilters = { 
        userId: testUserId,
        mediaType: 'movie'
      }
      const result = await repository.findByFilters(filters)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].userId).toBe(testUserId)
      expect(result.items[0].mediaType).toBe('movie')
    })

    it('should filter by date range', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const filters: MediaRequestFilters = { 
        createdBefore: tomorrow
      }
      const result = await repository.findByFilters(filters)

      expect(result.items.length).toBeGreaterThan(0)
      result.items.forEach(request => {
        expect(request.createdAt.getTime()).toBeLessThan(tomorrow.getTime())
      })
    })
  })

  describe('update', () => {
    let requestId: string

    beforeEach(async () => {
      const request = await repository.create({
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie'
      })
      requestId = request.id
    })

    it('should update status', async () => {
      const result = await repository.update(requestId, { status: 'approved' })

      expect(result.status).toBe('approved')
      expect(result.updatedAt).not.toEqual(result.createdAt)
    })

    it('should update overseerrId', async () => {
      const result = await repository.update(requestId, { overseerrId: 'overseerr-123' })

      expect(result.overseerrId).toBe('overseerr-123')
    })

    it('should fail for non-existent request', async () => {
      await expect(repository.update('non-existent', { status: 'approved' }))
        .rejects.toThrow(NotFoundError)
    })
  })

  describe('updateStatus', () => {
    let requestId: string

    beforeEach(async () => {
      const request = await repository.create({
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie'
      })
      requestId = request.id
    })

    it('should update status to approved', async () => {
      const result = await repository.updateStatus(requestId, 'approved')

      expect(result.status).toBe('approved')
      expect(result.completedAt).toBeNull()
    })

    it('should set completedAt when status is completed', async () => {
      const result = await repository.updateStatus(requestId, 'completed')

      expect(result.status).toBe('completed')
      expect(result.completedAt).toBeInstanceOf(Date)
    })

    it('should set completedAt when status is available', async () => {
      const result = await repository.updateStatus(requestId, 'available')

      expect(result.status).toBe('available')
      expect(result.completedAt).toBeInstanceOf(Date)
    })
  })

  describe('bulkUpdateStatus', () => {
    let requestIds: string[]

    beforeEach(async () => {
      const request1 = await repository.create({
        userId: testUserId,
        title: 'Movie 1',
        mediaType: 'movie'
      })
      
      const request2 = await repository.create({
        userId: testUserId,
        title: 'Movie 2',
        mediaType: 'movie'
      })
      
      requestIds = [request1.id, request2.id]
    })

    it('should update multiple requests status', async () => {
      const count = await repository.bulkUpdateStatus(requestIds, 'approved')

      expect(count).toBe(2)
      
      // Verify updates
      const updated1 = await repository.findById(requestIds[0])
      const updated2 = await repository.findById(requestIds[1])
      
      expect(updated1?.status).toBe('approved')
      expect(updated2?.status).toBe('approved')
    })

    it('should set completedAt for completion statuses', async () => {
      const count = await repository.bulkUpdateStatus(requestIds, 'completed')

      expect(count).toBe(2)
      
      const updated = await repository.findById(requestIds[0])
      expect(updated?.completedAt).toBeInstanceOf(Date)
    })

    it('should return 0 for empty array', async () => {
      const count = await repository.bulkUpdateStatus([], 'approved')
      expect(count).toBe(0)
    })
  })

  describe('statistics methods', () => {
    beforeEach(async () => {
      // Create requests with different statuses
      const request1 = await repository.create({
        userId: testUserId,
        title: 'Movie 1',
        mediaType: 'movie'
      })
      
      await repository.create({
        userId: testUserId,
        title: 'Movie 2',
        mediaType: 'movie'
      })
      
      await repository.create({
        userId: secondUserId,
        title: 'TV Show 1',
        mediaType: 'tv'
      })

      await repository.updateStatus(request1.id, 'approved')
    })

    it('should count all requests', async () => {
      const count = await repository.countByStatus()
      expect(count).toBe(3)
    })

    it('should count by specific status', async () => {
      const pendingCount = await repository.countByStatus('pending')
      const approvedCount = await repository.countByStatus('approved')
      
      expect(pendingCount).toBe(2)
      expect(approvedCount).toBe(1)
    })

    it('should count by user', async () => {
      const userCount = await repository.countByUser(testUserId)
      const secondUserCount = await repository.countByUser(secondUserId)
      
      expect(userCount).toBe(2)
      expect(secondUserCount).toBe(1)
    })

    it('should get user request stats', async () => {
      const stats = await repository.getUserRequestStats(testUserId)
      
      expect(stats.pending).toBe(1)
      expect(stats.approved).toBe(1)
    })

    it('should get recent requests', async () => {
      const recent = await repository.getRecentRequests(2)
      
      expect(recent).toHaveLength(2)
      expect(recent[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        recent[1].createdAt.getTime()
      )
      expect(recent[0].user).toBeDefined()
    })
  })

  describe('delete', () => {
    it('should delete existing request', async () => {
      const request = await repository.create({
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie'
      })

      const deleted = await repository.delete(request.id)
      expect(deleted.id).toBe(request.id)

      const found = await repository.findById(request.id)
      expect(found).toBeNull()
    })

    it('should fail for non-existent request', async () => {
      await expect(repository.delete('non-existent'))
        .rejects.toThrow()
    })
  })
})