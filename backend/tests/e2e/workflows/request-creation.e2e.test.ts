/**
 * E2E Tests: Request Creation Workflows
 * 
 * Tests comprehensive request creation functionality including:
 * - Submit new media requests for movies and TV shows
 * - Fill and validate request forms
 * - Handle required field validation
 * - Submit requests successfully with proper data flow
 * - Verify requests appear in user history
 * - Test duplicate request handling
 * - Validate request data integrity
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  createAdditionalTestUser,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
  viewports
} from '../utils/e2e-helpers';
import { 
  mockMediaResults, 
  createMockRequest,
  requestStatusValues,
  errorScenarios
} from '../fixtures/media-data';

describe('E2E: Request Creation Workflows', () => {
  let context: E2ETestContext;

  beforeAll(async () => {
    context = await setupE2EEnvironment();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Movie Request Creation', () => {
    it('should complete full movie request workflow from search to submission', async () => {
      const { app, users } = context;

      const workflow = new ScenarioBuilder()
        .step('searchMovie', async () => {
          return request(app)
            .get('/api/v1/media/search')
            .query({ query: 'action movie', mediaType: 'movie', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('selectMovie', async (context) => {
          const searchResults = context.searchMovie.body.data;
          expect(searchResults.length).toBeGreaterThan(0);
          
          // Select first movie result
          const selectedMovie = searchResults[0];
          expect(selectedMovie.mediaType).toBe('movie');
          
          return selectedMovie;
        })
        .step('getMovieDetails', async (context) => {
          const movie = context.selectMovie;
          
          return request(app)
            .get(`/api/v1/media/movie/${movie.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('submitRequest', async (context) => {
          const movie = context.selectMovie;
          
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: movie.id,
              quality: 'HD', // Optional quality preference
              notes: 'E2E test request'
            })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);
        })
        .step('verifyRequestCreated', async (context) => {
          const requestResponse = context.submitRequest;
          
          expect(DataValidationHelper.validateRequestResponse(requestResponse)).toBe(true);
          
          const requestData = requestResponse.body.data;
          expect(requestData).toMatchObject({
            id: expect.any(Number),
            status: expect.any(Number),
            media: {
              id: expect.any(Number),
              tmdbId: context.selectMovie.id,
              mediaType: 'movie'
            },
            requestedBy: {
              id: users.user.id
            }
          });
          
          return requestData;
        })
        .step('verifyInHistory', async (context) => {
          const createdRequest = context.verifyRequestCreated;
          
          const historyResponse = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
          
          expect(DataValidationHelper.validateRequestListResponse(historyResponse)).toBe(true);
          
          const userRequests = historyResponse.body.data.requests;
          const foundRequest = userRequests.find((req: any) => req.id === createdRequest.id);
          
          expect(foundRequest).toBeDefined();
          expect(foundRequest.media.tmdbId).toBe(context.selectMovie.id);
          
          return { workflowCompleted: true, requestId: createdRequest.id };
        });

      const result = await workflow.execute();
      expect(result.verifyInHistory.workflowCompleted).toBe(true);
      expect(result.verifyInHistory.requestId).toBeDefined();
    });

    it('should validate movie request form fields', async () => {
      const { app, users } = context;

      // Test missing mediaType
      const missingTypeResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          tmdbId: 12345
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(missingTypeResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/mediaType.*required/i)
        }
      });

      // Test missing tmdbId
      const missingIdResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(missingIdResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/tmdbId.*required/i)
        }
      });

      // Test invalid mediaType
      const invalidTypeResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid-type',
          tmdbId: 12345
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidTypeResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/invalid.*media.*type/i)
        }
      });

      // Test invalid tmdbId format
      const invalidIdResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 'not-a-number'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidIdResponse.body.success).toBe(false);
    });

    it('should handle duplicate movie requests appropriately', async () => {
      const { app, users } = context;

      const requestData = {
        mediaType: 'movie',
        tmdbId: 98765,
        quality: 'HD'
      };

      // Submit first request
      const firstResponse = await request(app)
        .post('/api/v1/media/request')
        .send(requestData)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      expect(firstResponse.body.success).toBe(true);
      const firstRequestId = firstResponse.body.data.id;

      // Submit duplicate request
      const duplicateResponse = await request(app)
        .post('/api/v1/media/request')
        .send(requestData)
        .set('Authorization', `Bearer ${users.user.token}`);

      // Should handle gracefully - either return existing request or prevent duplicate
      expect([200, 201, 409]).toContain(duplicateResponse.status);

      if (duplicateResponse.status === 409) {
        expect(duplicateResponse.body).toMatchObject({
          success: false,
          error: {
            message: expect.stringMatching(/already.*requested|duplicate/i)
          }
        });
      } else if (duplicateResponse.status === 200) {
        // Returns existing request
        expect(duplicateResponse.body.data.id).toBe(firstRequestId);
      }
    });

    it('should measure movie request performance', async () => {
      const { app, users } = context;

      const performanceTest = async () => {
        return request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: Math.floor(Math.random() * 100000), // Random ID to avoid duplicates
            quality: 'HD'
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);
      
      // Request submission should complete within 3 seconds
      expect(result.duration).toBeLessThan(3000);
      expect(DataValidationHelper.validateRequestResponse(result.response)).toBe(true);
    });
  });

  describe('TV Show Request Creation', () => {
    it('should complete full TV show request workflow with season selection', async () => {
      const { app, users } = context;

      const workflow = new ScenarioBuilder()
        .step('searchTVShow', async () => {
          return request(app)
            .get('/api/v1/media/search')
            .query({ query: 'popular series', mediaType: 'tv', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('selectShow', async (context) => {
          const searchResults = context.searchTVShow.body.data;
          expect(searchResults.length).toBeGreaterThan(0);
          
          const selectedShow = searchResults[0];
          expect(selectedShow.mediaType).toBe('tv');
          
          return selectedShow;
        })
        .step('getShowDetails', async (context) => {
          const show = context.selectShow;
          
          return request(app)
            .get(`/api/v1/media/tv/${show.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('submitShowRequest', async (context) => {
          const show = context.selectShow;
          const details = context.getShowDetails.body.data;
          
          // Request specific seasons if available
          const seasonsToRequest = details.seasons 
            ? details.seasons.slice(0, 2).map((s: any) => s.seasonNumber) 
            : [1];
          
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'tv',
              tmdbId: show.id,
              seasons: seasonsToRequest,
              quality: 'HD',
              notes: 'E2E TV show test request'
            })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);
        })
        .step('verifyTVRequest', async (context) => {
          const requestResponse = context.submitShowRequest;
          
          expect(DataValidationHelper.validateRequestResponse(requestResponse)).toBe(true);
          
          const requestData = requestResponse.body.data;
          expect(requestData.media.mediaType).toBe('tv');
          expect(requestData.media.tmdbId).toBe(context.selectShow.id);
          
          return requestData;
        });

      const result = await workflow.execute();
      expect(result.verifyTVRequest).toBeDefined();
      expect(result.verifyTVRequest.media.mediaType).toBe('tv');
    });

    it('should validate TV show season selection', async () => {
      const { app, users } = context;

      // Test valid season selection
      const validResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 54321,
          seasons: [1, 2, 3]
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      expect(validResponse.body.success).toBe(true);

      // Test invalid season numbers
      const invalidSeasonsResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 54322,
          seasons: [0, -1, 999]
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidSeasonsResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/invalid.*season/i)
        }
      });

      // Test empty seasons array
      const emptySeasonsResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 54323,
          seasons: []
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(emptySeasonsResponse.body.success).toBe(false);
    });

    it('should handle all seasons request for TV shows', async () => {
      const { app, users } = context;

      const allSeasonsResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 11111,
          seasons: 'all', // Request all available seasons
          quality: 'HD'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      expect(allSeasonsResponse.body.success).toBe(true);
      expect(DataValidationHelper.validateRequestResponse(allSeasonsResponse)).toBe(true);
    });
  });

  describe('Request Form Validation and Error Handling', () => {
    it('should validate all required fields comprehensively', async () => {
      const { app, users } = context;

      // Test each error scenario from fixtures
      for (const [scenarioName, errorData] of Object.entries(errorScenarios)) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .send(errorData)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            message: expect.any(String)
          }
        });

        // Log the scenario for debugging
        console.log(`Scenario ${scenarioName}: ${response.body.error.message}`);
      }
    });

    it('should handle malformed request payloads', async () => {
      const { app, users } = context;

      // Malformed JSON (this would be caught by Express middleware)
      const invalidJsonResponse = await request(app)
        .post('/api/v1/media/request')
        .send('{"mediaType": "movie", "tmdbId":}') // Invalid JSON
        .set('Authorization', `Bearer ${users.user.token}`)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(invalidJsonResponse.body.success).toBe(false);

      // Extra unexpected fields
      const extraFieldsResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 12345,
          unexpectedField: 'should be ignored or cause error',
          anotherField: { nested: 'object' }
        })
        .set('Authorization', `Bearer ${users.user.token}`);

      // Should either ignore extra fields or return validation error
      expect([200, 201, 400]).toContain(extraFieldsResponse.status);
    });

    it('should validate data types and ranges', async () => {
      const { app, users } = context;

      // Test string instead of number for tmdbId
      const stringIdResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 'should-be-number'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(stringIdResponse.body.success).toBe(false);

      // Test negative tmdbId
      const negativeIdResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: -123
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(negativeIdResponse.body.success).toBe(false);

      // Test extremely large tmdbId
      const largeIdResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: Number.MAX_SAFE_INTEGER + 1
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(largeIdResponse.body.success).toBe(false);
    });

    it('should validate optional fields when provided', async () => {
      const { app, users } = context;

      // Valid optional fields
      const validOptionalResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 77777,
          quality: 'HD',
          notes: 'Test notes for validation',
          priority: 'normal'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      expect(validOptionalResponse.body.success).toBe(true);

      // Invalid quality value
      const invalidQualityResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 77778,
          quality: 'INVALID_QUALITY'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidQualityResponse.body.success).toBe(false);

      // Notes too long
      const longNotesResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 77779,
          notes: 'x'.repeat(1001) // Assuming 1000 char limit
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(longNotesResponse.body.success).toBe(false);
    });
  });

  describe('Request Creation with Authentication and Authorization', () => {
    it('should require valid authentication for request creation', async () => {
      const { app } = context;

      // No authentication
      const noAuthResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 88888
        })
        .expect(401);

      expect(noAuthResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/unauthorized|authentication/i)
        }
      });

      // Invalid token
      const invalidTokenResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 88889
        })
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(invalidTokenResponse.body.success).toBe(false);
    });

    it('should associate requests with correct user', async () => {
      const { app, users } = context;
      
      // Create second user for isolation testing
      const secondUser = await createAdditionalTestUser(context);

      // Create request with first user
      const user1RequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 99001
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      // Create request with second user  
      const user2RequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie', 
          tmdbId: 99002
        })
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(201);

      // Verify user associations
      expect(user1RequestResponse.body.data.requestedBy.id).toBe(users.user.id);
      expect(user2RequestResponse.body.data.requestedBy.id).toBe(secondUser.id);

      // Verify users can't see each other's requests
      const user1HistoryResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const user1Requests = user1HistoryResponse.body.data.requests;
      const user2RequestInUser1History = user1Requests.find(
        (req: any) => req.id === user2RequestResponse.body.data.id
      );
      
      expect(user2RequestInUser1History).toBeUndefined();
    });
  });

  describe('Visual Regression for Request Creation', () => {
    it('should maintain consistent request response structure', async () => {
      const { app, users } = context;

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 123456
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'request-creation-response',
        threshold: 0.95
      });

      expect(visualResult.match).toBe(true);
    });

    it('should maintain consistent error response structures', async () => {
      const { app, users } = context;

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'request-validation-error',
        threshold: 0.90
      });

      expect(visualResult.match).toBe(true);
    });
  });

  describe('Responsive Request Creation', () => {
    it('should handle request creation across different viewports', async () => {
      const { app, users } = context;

      const testRequestForViewport = async (viewport: any) => {
        return request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: Math.floor(Math.random() * 100000),
            quality: viewport.name === 'mobile' ? 'SD' : 'HD' // Adjust quality based on viewport
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('User-Agent', viewport.userAgent || '')
          .expect(201);
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testRequestForViewport);

      // All viewports should successfully create requests
      Object.values(results).forEach((response) => {
        expect(DataValidationHelper.validateRequestResponse(response)).toBe(true);
      });
    });
  });

  describe('Complex Request Creation Scenarios', () => {
    it('should handle bulk request creation', async () => {
      const { app, users } = context;

      const bulkRequests = [
        { mediaType: 'movie', tmdbId: 100001 },
        { mediaType: 'movie', tmdbId: 100002 },
        { mediaType: 'tv', tmdbId: 200001, seasons: [1, 2] },
        { mediaType: 'tv', tmdbId: 200002, seasons: [1] },
        { mediaType: 'movie', tmdbId: 100003 }
      ];

      const requestPromises = bulkRequests.map((requestData, index) =>
        request(app)
          .post('/api/v1/media/request')
          .send(requestData)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201)
      );

      const responses = await Promise.all(requestPromises);

      responses.forEach((response, index) => {
        expect(DataValidationHelper.validateRequestResponse(response)).toBe(true);
        expect(response.body.data.media.tmdbId).toBe(bulkRequests[index].tmdbId);
      });

      // Verify all requests appear in history
      const historyResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const createdRequestIds = responses.map(r => r.body.data.id);
      const historyRequestIds = historyResponse.body.data.requests.map((r: any) => r.id);

      createdRequestIds.forEach(id => {
        expect(historyRequestIds).toContain(id);
      });
    });

    it('should handle concurrent request submissions', async () => {
      const { app, users } = context;

      // Submit multiple requests simultaneously
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 300000 + i
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201)
      );

      const responses = await Promise.all(concurrentRequests);

      // Verify all requests were created successfully
      responses.forEach((response, index) => {
        expect(DataValidationHelper.validateRequestResponse(response)).toBe(true);
        expect(response.body.data.media.tmdbId).toBe(300000 + index);
      });

      // Verify no duplicate IDs were created
      const requestIds = responses.map(r => r.body.data.id);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(requestIds.length);
    });

    it('should handle request creation with external service failures', async () => {
      const { app, users } = context;

      // This test would simulate external service failures
      // In a real implementation, you might use mock service handlers
      // to simulate TMDB API failures, Overseerr failures, etc.
      
      const requestData = {
        mediaType: 'movie',
        tmdbId: 999999999 // Non-existent ID that might cause external lookup to fail
      };

      const response = await request(app)
        .post('/api/v1/media/request')
        .send(requestData)
        .set('Authorization', `Bearer ${users.user.token}`);

      // Should either succeed with local data or fail gracefully
      expect([200, 201, 400, 404, 503]).toContain(response.status);
      
      if (response.status >= 400) {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            message: expect.any(String)
          }
        });
      } else {
        expect(DataValidationHelper.validateRequestResponse(response)).toBe(true);
      }
    });
  });
});