import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { plexService } from '@/services/plex.service';
import { overseerrService } from '@/services/overseerr.service';
import { statusService } from '@/services/status.service';
import { userRepository, serviceConfigRepository } from '@/repositories/instances';
import { encryptionService } from '@/services/encryption.service';

// MSW server for mocking external APIs
const server = setupServer(
  // Plex API mocks
  http.get('http://localhost:32400/', () => {
    return HttpResponse.json({
      MediaContainer: {
        friendlyName: 'Test Plex Server',
        machineIdentifier: 'test-machine-id',
        version: '1.32.0',
        platform: 'Linux',
        updatedAt: Date.now()
      }
    });
  }),
  
  http.get('http://localhost:32400/library/sections', () => {
    return HttpResponse.json({
      MediaContainer: {
        Directory: [
          { key: '1', type: 'movie', title: 'Movies', uuid: 'movie-uuid', updatedAt: Date.now() },
          { key: '2', type: 'show', title: 'TV Shows', uuid: 'show-uuid', updatedAt: Date.now() }
        ]
      }
    });
  }),

  // Overseerr API mocks
  http.get('http://localhost:5055/api/v1/status', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  http.get('http://localhost:5055/api/v1/search', () => {
    return HttpResponse.json({
      results: [{
        id: 123,
        mediaType: 'movie',
        title: 'Test Movie',
        releaseDate: '2023-01-01',
        tmdbId: 123
      }],
      totalPages: 1
    });
  }),

  http.post('http://localhost:5055/api/v1/request', () => {
    return HttpResponse.json({
      id: 1,
      status: 1,
      media: {
        tmdbId: 123,
        status: 2,
        type: 'movie'
      },
      requestedBy: {
        email: 'test@example.com',
        username: 'testuser'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  })
);

describe('External Services Integration', () => {
  const mockUserId = 'test-user-123';

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    
    // Mock user with Plex token
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: mockUserId,
      plexId: 'plex-123',
      plexUsername: 'testuser',
      email: 'test@example.com',
      plexToken: 'encrypted-token',
      role: 'user',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      status: 'active'
    });

    // Mock encryption service
    vi.mocked(encryptionService.decrypt).mockResolvedValue('decrypted-token');
    vi.mocked(encryptionService.encrypt).mockResolvedValue('encrypted-value');
  });

  describe('Plex Service Integration', () => {
    beforeEach(() => {
      vi.mocked(serviceConfigRepository.findByName).mockImplementation(async (name) => {
        if (name === 'plex') {
          return {
            id: 1,
            serviceName: 'plex',
            serviceUrl: 'http://localhost:32400',
            enabled: true,
            updatedAt: new Date()
          };
        }
        return null;
      });
    });

    it('should connect to Plex and fetch libraries', async () => {
      const libraries = await plexService.getLibraries(mockUserId);
      
      expect(libraries).toHaveLength(2);
      expect(libraries[0]).toMatchObject({
        key: '1',
        type: 'movie',
        title: 'Movies'
      });
    });

    it('should search media in Plex', async () => {
      server.use(
        rest.get('http://localhost:32400/search', (req, res, ctx) => {
          return res(ctx.json({
            MediaContainer: {
              Metadata: [{
                ratingKey: '123',
                key: '/library/metadata/123',
                guid: 'plex://movie/123',
                type: 'movie',
                title: 'Test Movie',
                year: 2023,
                addedAt: Date.now()
              }]
            }
          }));
        })
      );

      const results = await plexService.search(mockUserId, 'Test Movie');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Movie');
    });
  });

  describe('Overseerr Service Integration', () => {
    beforeEach(async () => {
      vi.mocked(serviceConfigRepository.findByName).mockImplementation(async (name) => {
        if (name === 'overseerr') {
          return {
            id: 2,
            serviceName: 'overseerr',
            serviceUrl: 'http://localhost:5055',
            apiKey: 'encrypted-api-key',
            enabled: true,
            updatedAt: new Date()
          };
        }
        return null;
      });

      await overseerrService.initialize();
    });

    it('should connect to Overseerr', async () => {
      expect(overseerrService.isServiceAvailable()).toBe(true);
    });

    it('should search media through Overseerr', async () => {
      const results = await overseerrService.searchMedia('Test Movie');
      
      expect(results.results).toHaveLength(1);
      expect(results.results[0].title).toBe('Test Movie');
    });

    it('should handle media request submission', async () => {
      const request = await overseerrService.requestMedia(mockUserId, {
        mediaType: 'movie',
        tmdbId: 123
      });
      
      expect(request).toMatchObject({
        userId: mockUserId,
        tmdbId: '123',
        mediaType: 'movie',
        status: 'pending'
      });
    });

    it('should handle webhook notifications', async () => {
      const mockWebhook = {
        notification_type: 'MEDIA_AVAILABLE',
        media: {
          tmdbId: 123,
          title: 'Test Movie',
          mediaType: 'movie'
        },
        request: {
          id: 1
        }
      };

      await overseerrService.handleWebhook(mockWebhook);
      // Verify the request was updated (would need repository mocks)
    });
  });

  describe('Status Service Integration', () => {
    beforeEach(async () => {
      vi.mocked(serviceConfigRepository.findByName).mockImplementation(async (name) => {
        if (name === 'uptime-kuma') {
          return {
            id: 3,
            serviceName: 'uptime-kuma',
            serviceUrl: 'http://localhost:3001',
            enabled: false, // Disabled to use fallback polling
            updatedAt: new Date()
          };
        }
        return null;
      });

      await statusService.initialize();
    });

    it('should use fallback polling when Uptime Kuma is disabled', async () => {
      const statuses = await statusService.getAllStatuses();
      
      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);
    });

    it('should get individual service status', async () => {
      const plexStatus = await statusService.getServiceStatus('plex');
      
      expect(plexStatus).toMatchObject({
        name: 'plex',
        displayName: 'Plex',
        status: expect.stringMatching(/up|down|degraded|unknown/)
      });
    });
  });

  describe('Service Error Handling', () => {
    it('should handle Plex connection failure gracefully', async () => {
      server.use(
        rest.get('http://localhost:32400/', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      await expect(plexService.getLibraries(mockUserId))
        .rejects.toThrow('Failed to connect to Plex server');
    });

    it('should handle Overseerr unavailability', async () => {
      server.use(
        rest.get('http://localhost:5055/api/v1/status', (req, res, ctx) => {
          return res(ctx.status(503));
        })
      );

      await overseerrService.initialize();
      
      expect(overseerrService.isServiceAvailable()).toBe(false);
      
      await expect(overseerrService.searchMedia('Test'))
        .rejects.toThrow('Overseerr service unavailable');
    });
  });
});