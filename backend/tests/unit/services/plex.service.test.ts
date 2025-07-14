import { describe, it, expect, beforeEach, vi } from 'vitest';
import { plexService } from '@/services/plex.service';
import { userRepository, serviceConfigRepository } from '@/repositories/instances';
import { redisClient } from '@/config/redis';
import { encryptionService } from '@/services/encryption.service';
import { AppError } from '@medianest/shared';

// Mock dependencies
vi.mock('@/repositories/instances');
vi.mock('@/config/redis');
vi.mock('@/services/encryption.service');
vi.mock('@/integrations/plex/plex.client');

describe('PlexService', () => {
  const mockUserId = 'user-123';
  const mockPlexToken = 'encrypted-token';
  const mockDecryptedToken = 'decrypted-token';
  const mockServerUrl = 'http://localhost:32400';

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear client cache
    plexService['clients'].clear();

    // Setup default mocks
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: mockUserId,
      plexId: 'plex-123',
      plexUsername: 'testuser',
      email: 'test@example.com',
      plexToken: mockPlexToken,
      role: 'user',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      status: 'active',
    });

    vi.mocked(serviceConfigRepository.findByName).mockResolvedValue({
      id: 1,
      serviceName: 'plex',
      serviceUrl: mockServerUrl,
      enabled: true,
      updatedAt: new Date(),
    });

    vi.mocked(encryptionService.decrypt).mockResolvedValue(mockDecryptedToken);
    vi.mocked(redisClient.get).mockResolvedValue(null);
    vi.mocked(redisClient.setex).mockResolvedValue('OK');
  });

  describe('getClientForUser', () => {
    it('should create and cache a new client for user', async () => {
      const client = await plexService.getClientForUser(mockUserId);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUserId);
      expect(serviceConfigRepository.findByName).toHaveBeenCalledWith('plex');
      expect(encryptionService.decrypt).toHaveBeenCalledWith(mockPlexToken);
      expect(plexService['clients'].has(mockUserId)).toBe(true);
    });

    it('should return cached client for subsequent calls', async () => {
      const client1 = await plexService.getClientForUser(mockUserId);
      const client2 = await plexService.getClientForUser(mockUserId);

      expect(client1).toBe(client2);
      expect(userRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user has no Plex token', async () => {
      vi.mocked(userRepository.findById).mockResolvedValueOnce({
        id: mockUserId,
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: null,
        role: 'user',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        status: 'active',
      });

      await expect(plexService.getClientForUser(mockUserId)).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if Plex server not configured', async () => {
      vi.mocked(serviceConfigRepository.findByName).mockResolvedValueOnce(null);

      await expect(plexService.getClientForUser(mockUserId)).rejects.toThrow(
        new AppError('Plex server not configured', 500),
      );
    });
  });

  describe('getLibraries', () => {
    const mockLibraries = [
      { key: '1', type: 'movie' as const, title: 'Movies', uuid: 'uuid1', updatedAt: 123 },
      { key: '2', type: 'show' as const, title: 'TV Shows', uuid: 'uuid2', updatedAt: 456 },
    ];

    it('should return cached libraries if available', async () => {
      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(mockLibraries));

      const result = await plexService.getLibraries(mockUserId);

      expect(result).toEqual(mockLibraries);
      expect(redisClient.get).toHaveBeenCalledWith('plex:libraries:user-123');
    });

    it('should fetch and cache libraries if not cached', async () => {
      // Mock PlexClient
      const mockGetLibraries = vi.fn().mockResolvedValue(mockLibraries);
      vi.doMock('@/integrations/plex/plex.client', () => ({
        PlexClient: vi.fn(() => ({
          testConnection: vi.fn().mockResolvedValue({}),
          getLibraries: mockGetLibraries,
        })),
      }));

      const result = await plexService.getLibraries(mockUserId);

      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:libraries:user-123',
        300,
        JSON.stringify(mockLibraries),
      );
    });
  });

  describe('search', () => {
    const mockSearchResults = [
      {
        ratingKey: '123',
        key: '/library/metadata/123',
        guid: 'plex://movie/123',
        type: 'movie' as const,
        title: 'Test Movie',
        addedAt: 1234567890,
      },
    ];

    it('should return cached search results if available', async () => {
      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(mockSearchResults));

      const result = await plexService.search(mockUserId, 'Test Movie');

      expect(result).toEqual(mockSearchResults);
      expect(redisClient.get).toHaveBeenCalledWith('plex:search:user-123:Test Movie');
    });

    it('should cache search results', async () => {
      // Mock PlexClient
      const mockSearch = vi.fn().mockResolvedValue(mockSearchResults);
      vi.doMock('@/integrations/plex/plex.client', () => ({
        PlexClient: vi.fn(() => ({
          testConnection: vi.fn().mockResolvedValue({}),
          search: mockSearch,
        })),
      }));

      await plexService.search(mockUserId, 'Test Movie');

      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:search:user-123:Test Movie',
        60,
        JSON.stringify(mockSearchResults),
      );
    });
  });
});
