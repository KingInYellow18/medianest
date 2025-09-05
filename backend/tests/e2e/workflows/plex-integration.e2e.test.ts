/**
 * E2E Tests: Plex Integration Workflows
 * 
 * Tests comprehensive Plex integration functionality including:
 * - Browse Plex libraries and sections
 * - Search within Plex content
 * - View Plex collection details
 * - Check media availability status
 * - Sync with Plex metadata
 * - Handle Plex authentication and connection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
  mockExternalResponses
} from '../utils/e2e-helpers';
import { 
  mockPlexLibraries,
  mockPlexContent
} from '../fixtures/media-data';

describe('E2E: Plex Integration Workflows', () => {
  let context: E2ETestContext;

  beforeAll(async () => {
    context = await setupE2EEnvironment();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Plex Library Browsing', () => {
    it('should list available Plex libraries', async () => {
      const { app, users } = context;

      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(librariesResponse.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      const libraries = librariesResponse.body.data;
      
      // Validate library structure
      libraries.forEach((library: any) => {
        expect(library).toMatchObject({
          id: expect.any(String),
          key: expect.any(String),
          title: expect.any(String),
          type: expect.stringMatching(/^(movie|show|artist)$/),
          agent: expect.any(String),
          scanner: expect.any(String),
          language: expect.any(String)
        });
      });

      // Should have at least Movies and TV Shows libraries
      const libraryTypes = libraries.map((lib: any) => lib.type);
      expect(libraryTypes).toContain('movie');
      expect(libraryTypes).toContain('show');
    });

    it('should browse specific library content', async () => {
      const { app, users } = context;

      // First get available libraries
      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const libraries = librariesResponse.body.data;
      expect(libraries.length).toBeGreaterThan(0);

      // Browse first library
      const firstLibrary = libraries[0];
      const libraryContentResponse = await request(app)
        .get(`/api/v1/plex/libraries/${firstLibrary.id}/content`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(libraryContentResponse.body).toMatchObject({
        success: true,
        data: {
          library: expect.objectContaining({
            id: firstLibrary.id,
            title: firstLibrary.title,
            type: firstLibrary.type
          }),
          content: expect.any(Array),
          totalCount: expect.any(Number)
        }
      });

      const content = libraryContentResponse.body.data.content;
      
      // Validate content structure based on library type
      content.forEach((item: any) => {
        expect(item).toMatchObject({
          ratingKey: expect.any(String),
          title: expect.any(String),
          type: expect.any(String)
        });

        // Type should match library type or be a related type
        if (firstLibrary.type === 'movie') {
          expect(item.type).toBe('movie');
        } else if (firstLibrary.type === 'show') {
          expect(item.type).toBe('show');
        }
      });
    });

    it('should handle library content pagination', async () => {
      const { app, users } = context;

      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const libraries = librariesResponse.body.data;
      if (libraries.length > 0) {
        const library = libraries[0];

        // Test pagination
        const page1Response = await request(app)
          .get(`/api/v1/plex/libraries/${library.id}/content`)
          .query({ page: 1, pageSize: 10 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(page1Response.body.data.content.length).toBeLessThanOrEqual(10);

        // If there's a second page, test it
        if (page1Response.body.data.totalCount > 10) {
          const page2Response = await request(app)
            .get(`/api/v1/plex/libraries/${library.id}/content`)
            .query({ page: 2, pageSize: 10 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          const page1Ids = page1Response.body.data.content.map((item: any) => item.ratingKey);
          const page2Ids = page2Response.body.data.content.map((item: any) => item.ratingKey);

          // No duplicates between pages
          const duplicates = page1Ids.filter((id: string) => page2Ids.includes(id));
          expect(duplicates).toHaveLength(0);
        }
      }
    });

    it('should filter library content by type and other criteria', async () => {
      const { app, users } = context;

      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const libraries = librariesResponse.body.data;
      const tvLibrary = libraries.find((lib: any) => lib.type === 'show');

      if (tvLibrary) {
        // Filter by genre if supported
        const genreFilterResponse = await request(app)
          .get(`/api/v1/plex/libraries/${tvLibrary.id}/content`)
          .query({ genre: 'Action' })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(genreFilterResponse.body.success).toBe(true);

        // Filter by year if supported
        const yearFilterResponse = await request(app)
          .get(`/api/v1/plex/libraries/${tvLibrary.id}/content`)
          .query({ year: 2020 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(yearFilterResponse.body.success).toBe(true);

        // Sort by different criteria
        const sortedResponse = await request(app)
          .get(`/api/v1/plex/libraries/${tvLibrary.id}/content`)
          .query({ sortBy: 'addedAt', sortOrder: 'desc' })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(sortedResponse.body.success).toBe(true);
      }
    });
  });

  describe('Plex Content Search', () => {
    it('should search across all Plex libraries', async () => {
      const { app, users } = context;

      const searchQueries = ['Matrix', 'Breaking Bad', 'Batman', 'Office'];

      for (const query of searchQueries) {
        const searchResponse = await request(app)
          .get('/api/v1/plex/search')
          .query({ query })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(searchResponse.body).toMatchObject({
          success: true,
          data: {
            results: expect.any(Array),
            query,
            totalCount: expect.any(Number)
          }
        });

        const results = searchResponse.body.data.results;
        
        // Results should match the search query
        results.forEach((result: any) => {
          expect(result).toMatchObject({
            ratingKey: expect.any(String),
            title: expect.any(String),
            type: expect.any(String),
            libraryId: expect.any(String)
          });

          // Title should contain the search term (case-insensitive)
          expect(result.title.toLowerCase()).toContain(query.toLowerCase());
        });
      }
    });

    it('should search within specific library', async () => {
      const { app, users } = context;

      // Get libraries first
      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const libraries = librariesResponse.body.data;
      const movieLibrary = libraries.find((lib: any) => lib.type === 'movie');

      if (movieLibrary) {
        const searchResponse = await request(app)
          .get(`/api/v1/plex/libraries/${movieLibrary.id}/search`)
          .query({ query: 'Action' })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(searchResponse.body).toMatchObject({
          success: true,
          data: {
            results: expect.any(Array),
            query: 'Action',
            libraryId: movieLibrary.id
          }
        });

        // All results should be from movie library
        searchResponse.body.data.results.forEach((result: any) => {
          expect(result.type).toBe('movie');
          expect(result.libraryId).toBe(movieLibrary.id);
        });
      }
    });

    it('should handle advanced search with multiple criteria', async () => {
      const { app, users } = context;

      const advancedSearchResponse = await request(app)
        .get('/api/v1/plex/search/advanced')
        .query({
          title: 'Batman',
          year: 2008,
          genre: 'Action',
          type: 'movie'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(advancedSearchResponse.body).toMatchObject({
        success: true,
        data: {
          results: expect.any(Array),
          criteria: expect.objectContaining({
            title: 'Batman',
            year: 2008,
            genre: 'Action',
            type: 'movie'
          })
        }
      });

      // Verify results match all criteria
      advancedSearchResponse.body.data.results.forEach((result: any) => {
        expect(result.type).toBe('movie');
        expect(result.title.toLowerCase()).toContain('batman');
        if (result.year) {
          expect(result.year).toBe(2008);
        }
      });
    });

    it('should handle search with no results gracefully', async () => {
      const { app, users } = context;

      const noResultsResponse = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: 'XYZ123NonExistentContent999' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(noResultsResponse.body).toMatchObject({
        success: true,
        data: {
          results: [],
          query: 'XYZ123NonExistentContent999',
          totalCount: 0
        }
      });
    });
  });

  describe('Plex Media Details and Metadata', () => {
    it('should retrieve detailed information for Plex content', async () => {
      const { app, users } = context;

      // First search for content to get a rating key
      const searchResponse = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: 'movie', type: 'movie' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const results = searchResponse.body.data.results;
      
      if (results.length > 0) {
        const firstResult = results[0];
        
        const detailsResponse = await request(app)
          .get(`/api/v1/plex/content/${firstResult.ratingKey}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(detailsResponse.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            ratingKey: firstResult.ratingKey,
            title: expect.any(String),
            type: expect.any(String),
            summary: expect.any(String)
          })
        });

        const details = detailsResponse.body.data;

        // Movie-specific fields
        if (details.type === 'movie') {
          expect(details).toMatchObject({
            year: expect.any(Number),
            duration: expect.any(Number),
            contentRating: expect.any(String),
            rating: expect.any(Number)
          });
        }

        // TV show-specific fields
        if (details.type === 'show') {
          expect(details).toMatchObject({
            year: expect.any(Number),
            leafCount: expect.any(Number),
            childCount: expect.any(Number)
          });
        }

        // Common metadata
        expect(details).toHaveProperty('addedAt');
        expect(details).toHaveProperty('updatedAt');
        
        if (details.genres) {
          expect(details.genres).toBeInstanceOf(Array);
        }
      }
    });

    it('should retrieve TV show seasons and episodes', async () => {
      const { app, users } = context;

      // Find a TV show
      const searchResponse = await request(app)
        .get('/api/v1/plex/search')
        .query({ type: 'show' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const shows = searchResponse.body.data.results;

      if (shows.length > 0) {
        const show = shows[0];

        // Get show seasons
        const seasonsResponse = await request(app)
          .get(`/api/v1/plex/content/${show.ratingKey}/seasons`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(seasonsResponse.body).toMatchObject({
          success: true,
          data: {
            showId: show.ratingKey,
            seasons: expect.any(Array)
          }
        });

        const seasons = seasonsResponse.body.data.seasons;

        if (seasons.length > 0) {
          // Validate season structure
          seasons.forEach((season: any) => {
            expect(season).toMatchObject({
              ratingKey: expect.any(String),
              title: expect.any(String),
              index: expect.any(Number),
              leafCount: expect.any(Number)
            });
          });

          // Get episodes for first season
          const firstSeason = seasons[0];
          const episodesResponse = await request(app)
            .get(`/api/v1/plex/content/${firstSeason.ratingKey}/episodes`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(episodesResponse.body).toMatchObject({
            success: true,
            data: {
              seasonId: firstSeason.ratingKey,
              episodes: expect.any(Array)
            }
          });

          const episodes = episodesResponse.body.data.episodes;
          
          episodes.forEach((episode: any) => {
            expect(episode).toMatchObject({
              ratingKey: expect.any(String),
              title: expect.any(String),
              index: expect.any(Number),
              duration: expect.any(Number)
            });
          });
        }
      }
    });

    it('should provide availability status for media', async () => {
      const { app, users } = context;

      // Check availability for a specific TMDB ID
      const availabilityResponse = await request(app)
        .get('/api/v1/plex/availability')
        .query({ tmdbId: 550, mediaType: 'movie' }) // Fight Club
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(availabilityResponse.body).toMatchObject({
        success: true,
        data: {
          tmdbId: 550,
          mediaType: 'movie',
          isAvailable: expect.any(Boolean)
        }
      });

      const availability = availabilityResponse.body.data;

      if (availability.isAvailable) {
        expect(availability).toMatchObject({
          plexItem: expect.objectContaining({
            ratingKey: expect.any(String),
            title: expect.any(String)
          }),
          libraryId: expect.any(String)
        });
      }

      // Batch availability check
      const batchAvailabilityResponse = await request(app)
        .post('/api/v1/plex/availability/batch')
        .send({
          items: [
            { tmdbId: 550, mediaType: 'movie' },
            { tmdbId: 1396, mediaType: 'tv' },
            { tmdbId: 155, mediaType: 'movie' }
          ]
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(batchAvailabilityResponse.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      const batchResults = batchAvailabilityResponse.body.data;
      expect(batchResults).toHaveLength(3);

      batchResults.forEach((result: any) => {
        expect(result).toMatchObject({
          tmdbId: expect.any(Number),
          mediaType: expect.stringMatching(/^(movie|tv)$/),
          isAvailable: expect.any(Boolean)
        });
      });
    });
  });

  describe('Plex Server Connection and Authentication', () => {
    it('should verify Plex server connection', async () => {
      const { app, users } = context;

      const connectionResponse = await request(app)
        .get('/api/v1/plex/server/status')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(connectionResponse.body).toMatchObject({
        success: true,
        data: {
          connected: expect.any(Boolean),
          serverInfo: expect.objectContaining({
            friendlyName: expect.any(String),
            version: expect.any(String),
            platform: expect.any(String)
          })
        }
      });

      const serverData = connectionResponse.body.data;
      
      if (serverData.connected) {
        expect(serverData.serverInfo).toMatchObject({
          machineIdentifier: expect.any(String),
          updatedAt: expect.any(Number),
          createdAt: expect.any(Number)
        });
      }
    });

    it('should handle Plex authentication token validation', async () => {
      const { app, users } = context;

      const tokenValidationResponse = await request(app)
        .get('/api/v1/plex/auth/validate')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(tokenValidationResponse.body).toMatchObject({
        success: true,
        data: {
          tokenValid: expect.any(Boolean),
          user: expect.objectContaining({
            id: expect.any(Number),
            plexUsername: expect.any(String)
          })
        }
      });

      if (tokenValidationResponse.body.data.tokenValid) {
        expect(tokenValidationResponse.body.data.user).toMatchObject({
          plexId: expect.any(String),
          email: expect.any(String)
        });
      }
    });

    it('should refresh Plex libraries and metadata', async () => {
      const { app, users } = context;

      // Trigger library refresh (admin-only operation typically)
      const refreshResponse = await request(app)
        .post('/api/v1/plex/libraries/refresh')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(refreshResponse.body).toMatchObject({
        success: true,
        data: {
          refreshTriggered: true,
          message: expect.any(String)
        }
      });

      // Check refresh status
      const statusResponse = await request(app)
        .get('/api/v1/plex/libraries/refresh/status')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(statusResponse.body).toMatchObject({
        success: true,
        data: {
          isRefreshing: expect.any(Boolean),
          lastRefresh: expect.any(String),
          progress: expect.objectContaining({
            total: expect.any(Number),
            completed: expect.any(Number)
          })
        }
      });
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle Plex server errors gracefully', async () => {
      const { app, users } = context;

      // Test handling of server unavailable
      // This would typically be done with mock handlers in a real test
      const serverErrorResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .set('X-Mock-Error', 'server-unavailable'); // Custom header to trigger mock error

      // Should handle gracefully regardless of server state
      expect([200, 503, 502]).toContain(serverErrorResponse.status);

      if (serverErrorResponse.status >= 500) {
        expect(serverErrorResponse.body).toMatchObject({
          success: false,
          error: {
            message: expect.stringMatching(/server.*unavailable|connection/i)
          }
        });
      }
    });

    it('should measure Plex library loading performance', async () => {
      const { app, users } = context;

      const performanceTest = async () => {
        return request(app)
          .get('/api/v1/plex/libraries')
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);
      
      // Plex library loading should complete within 3 seconds
      expect(result.duration).toBeLessThan(3000);
      
      if (result.response.status === 200) {
        expect(result.response.body.success).toBe(true);
        expect(result.response.body.data).toBeInstanceOf(Array);
      }
    });

    it('should handle concurrent Plex operations', async () => {
      const { app, users } = context;

      const concurrentOperations = [
        request(app).get('/api/v1/plex/libraries').set('Authorization', `Bearer ${users.user.token}`),
        request(app).get('/api/v1/plex/search').query({ query: 'action' }).set('Authorization', `Bearer ${users.user.token}`),
        request(app).get('/api/v1/plex/server/status').set('Authorization', `Bearer ${users.user.token}`),
        request(app).get('/api/v1/plex/availability').query({ tmdbId: 550, mediaType: 'movie' }).set('Authorization', `Bearer ${users.user.token}`)
      ];

      const results = await Promise.allSettled(concurrentOperations);

      // At least some operations should succeed
      const successfulResults = results.filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successfulResults.length).toBeGreaterThanOrEqual(1);

      successfulResults.forEach(result => {
        expect(result.value.body.success).toBe(true);
      });
    });
  });

  describe('Visual Regression and Responsiveness', () => {
    it('should maintain consistent Plex library response structure', async () => {
      const { app, users } = context;

      const response = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'plex-libraries-structure',
        threshold: 0.95
      });

      expect(visualResult.match).toBe(true);
    });

    it('should adapt Plex content for different viewport sizes', async () => {
      const { app, users } = context;

      const testForViewport = async (viewport: any) => {
        const pageSize = viewport.name === 'mobile' ? 10 : 25;
        
        return request(app)
          .get('/api/v1/plex/search')
          .query({ query: 'movie', pageSize })
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('User-Agent', viewport.userAgent || '');
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testForViewport);

      // All viewports should receive responses
      Object.values(results).forEach((response) => {
        expect([200, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.results).toBeInstanceOf(Array);
        }
      });
    });
  });

  describe('Complex Plex Integration Scenarios', () => {
    it('should execute complete Plex workflow from search to availability check', async () => {
      const { app, users } = context;

      const plexWorkflow = new ScenarioBuilder()
        .step('getLibraries', async () => {
          return request(app)
            .get('/api/v1/plex/libraries')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('searchContent', async () => {
          return request(app)
            .get('/api/v1/plex/search')
            .query({ query: 'batman', type: 'movie' })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('getContentDetails', async (context) => {
          const searchResults = context.searchContent.body.data.results;
          
          if (searchResults.length > 0) {
            const firstResult = searchResults[0];
            
            return request(app)
              .get(`/api/v1/plex/content/${firstResult.ratingKey}`)
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200);
          }
          
          return null;
        })
        .step('checkAvailability', async (context) => {
          // Simulate checking availability for a known TMDB ID
          return request(app)
            .get('/api/v1/plex/availability')
            .query({ tmdbId: 155, mediaType: 'movie' }) // The Dark Knight
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('validateWorkflow', async (context) => {
          expect(context.getLibraries.body.success).toBe(true);
          expect(context.searchContent.body.success).toBe(true);
          expect(context.checkAvailability.body.success).toBe(true);
          
          return { workflowCompleted: true };
        });

      const result = await plexWorkflow.execute();
      expect(result.validateWorkflow.workflowCompleted).toBe(true);
    });

    it('should handle Plex metadata synchronization', async () => {
      const { app, users } = context;

      // Test metadata sync for specific content
      const syncResponse = await request(app)
        .post('/api/v1/plex/sync/metadata')
        .send({
          ratingKeys: ['1234', '5678'],
          forceRefresh: true
        })
        .set('Authorization', `Bearer ${users.admin.token}`);

      expect([200, 202, 404]).toContain(syncResponse.status);

      if (syncResponse.status === 200 || syncResponse.status === 202) {
        expect(syncResponse.body).toMatchObject({
          success: true,
          data: {
            syncInitiated: true,
            itemCount: 2
          }
        });

        // Check sync status
        const syncStatusResponse = await request(app)
          .get('/api/v1/plex/sync/status')
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);

        expect(syncStatusResponse.body).toMatchObject({
          success: true,
          data: {
            isSyncing: expect.any(Boolean),
            progress: expect.objectContaining({
              completed: expect.any(Number),
              total: expect.any(Number)
            })
          }
        });
      }
    });

    it('should handle edge cases in Plex integration', async () => {
      const { app, users } = context;

      // Test invalid rating key
      const invalidRatingKeyResponse = await request(app)
        .get('/api/v1/plex/content/invalid-rating-key')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(invalidRatingKeyResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/not found/i)
        }
      });

      // Test empty search
      const emptySearchResponse = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: '' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(emptySearchResponse.body.success).toBe(false);

      // Test invalid library ID
      const invalidLibraryResponse = await request(app)
        .get('/api/v1/plex/libraries/invalid-library-id/content')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(invalidLibraryResponse.body.success).toBe(false);
    });
  });
});