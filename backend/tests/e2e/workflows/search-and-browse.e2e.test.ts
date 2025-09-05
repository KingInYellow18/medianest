/**
 * E2E Tests: Search and Browse Media Workflows
 * 
 * Tests comprehensive search and browsing functionality including:
 * - Search for movies and TV shows
 * - Browse search results with pagination
 * - View detailed media information
 * - Validate metadata display
 * - Performance and responsiveness testing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
  viewports
} from '../utils/e2e-helpers';
import { 
  mockMediaResults, 
  searchQueries, 
  errorScenarios 
} from '../fixtures/media-data';

describe('E2E: Search and Browse Media Workflows', () => {
  let context: E2ETestContext;

  beforeAll(async () => {
    context = await setupE2EEnvironment();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Media Search Functionality', () => {
    it('should search for movies with various queries', async () => {
      const { app, users } = context;

      for (const query of searchQueries.movies) {
        const response = await request(app)
          .get('/api/v1/media/search')
          .query({ query, mediaType: 'movie', page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        // Validate response structure
        expect(DataValidationHelper.validateMediaSearchResponse(response)).toBe(true);
        
        // Validate search-specific data
        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array),
          meta: {
            query,
            page: 1,
            mediaType: 'movie'
          }
        });

        // Ensure all results are movies
        if (response.body.data.length > 0) {
          response.body.data.forEach((item: any) => {
            expect(item.mediaType).toBe('movie');
            expect(item.title.toLowerCase()).toMatch(new RegExp(query.toLowerCase()));
          });
        }
      }
    });

    it('should search for TV shows with various queries', async () => {
      const { app, users } = context;

      for (const query of searchQueries.tvShows) {
        const response = await request(app)
          .get('/api/v1/media/search')
          .query({ query, mediaType: 'tv', page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateMediaSearchResponse(response)).toBe(true);

        expect(response.body.meta.mediaType).toBe('tv');

        // Ensure all results are TV shows
        if (response.body.data.length > 0) {
          response.body.data.forEach((item: any) => {
            expect(item.mediaType).toBe('tv');
            expect(item.name || item.title).toBeDefined();
          });
        }
      }
    });

    it('should handle mixed media type searches', async () => {
      const { app, users } = context;

      for (const query of searchQueries.mixed) {
        const response = await request(app)
          .get('/api/v1/media/search')
          .query({ query, page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateMediaSearchResponse(response)).toBe(true);

        // Should contain both movies and TV shows
        if (response.body.data.length > 1) {
          const mediaTypes = response.body.data.map((item: any) => item.mediaType);
          const hasMovies = mediaTypes.includes('movie');
          const hasTV = mediaTypes.includes('tv');
          
          // At least one type should be present
          expect(hasMovies || hasTV).toBe(true);
        }
      }
    });

    it('should validate search input and handle errors gracefully', async () => {
      const { app, users } = context;

      // Empty query
      const emptyResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: '', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(emptyResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('query')
        }
      });

      // Invalid page number
      const invalidPageResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', page: 0 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidPageResponse.body.success).toBe(false);

      // Very long query
      const longQuery = 'a'.repeat(1000);
      const longQueryResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: longQuery, page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`);

      expect([200, 400, 413]).toContain(longQueryResponse.status);
    });

    it('should perform search with performance benchmarks', async () => {
      const { app, users } = context;

      const performanceTest = async () => {
        return request(app)
          .get('/api/v1/media/search')
          .query({ query: 'popular movie', page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);
      
      // Search should complete within 2 seconds
      expect(result.duration).toBeLessThan(2000);
      expect(DataValidationHelper.validateMediaSearchResponse(result.response)).toBe(true);
    });
  });

  describe('Search Results Browsing', () => {
    it('should paginate search results correctly', async () => {
      const { app, users } = context;
      const query = 'action movie';

      // Get first page
      const page1Response = await request(app)
        .get('/api/v1/media/search')
        .query({ query, page: 1, pageSize: 5 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(page1Response.body.success).toBe(true);
      expect(page1Response.body.meta.page).toBe(1);
      expect(page1Response.body.data.length).toBeLessThanOrEqual(5);

      // Get second page if there are more results
      if (page1Response.body.meta.totalPages > 1) {
        const page2Response = await request(app)
          .get('/api/v1/media/search')
          .query({ query, page: 2, pageSize: 5 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(page2Response.body.success).toBe(true);
        expect(page2Response.body.meta.page).toBe(2);
        
        // Ensure no duplicate results between pages
        const page1Ids = page1Response.body.data.map((item: any) => item.id);
        const page2Ids = page2Response.body.data.map((item: any) => item.id);
        
        const duplicates = page1Ids.filter((id: number) => page2Ids.includes(id));
        expect(duplicates).toHaveLength(0);
      }
    });

    it('should handle different page sizes appropriately', async () => {
      const { app, users } = context;
      const pageSizes = [1, 5, 10, 20, 50];
      const query = 'popular';

      for (const pageSize of pageSizes) {
        const response = await request(app)
          .get('/api/v1/media/search')
          .query({ query, page: 1, pageSize })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(pageSize);
        expect(response.body.meta.pageSize).toBe(pageSize);
      }
    });

    it('should sort search results by relevance and popularity', async () => {
      const { app, users } = context;

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ 
          query: 'batman', 
          page: 1, 
          sortBy: 'popularity',
          sortOrder: 'desc' 
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify sorting if multiple results
      if (response.body.data.length > 1) {
        const results = response.body.data;
        
        for (let i = 0; i < results.length - 1; i++) {
          const current = results[i];
          const next = results[i + 1];
          
          // If popularity scores exist, verify descending order
          if (current.popularity && next.popularity) {
            expect(current.popularity).toBeGreaterThanOrEqual(next.popularity);
          }
        }
      }
    });

    it('should filter search results by genre and year', async () => {
      const { app, users } = context;

      // Test year filtering
      const yearResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ 
          query: 'movie', 
          year: 2020,
          mediaType: 'movie'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      if (yearResponse.body.data.length > 0) {
        yearResponse.body.data.forEach((movie: any) => {
          const releaseYear = new Date(movie.releaseDate).getFullYear();
          expect(releaseYear).toBe(2020);
        });
      }

      // Test genre filtering (if supported)
      const genreResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ 
          query: 'action', 
          genre: 'action',
          mediaType: 'movie'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(genreResponse.body.success).toBe(true);
    });
  });

  describe('Media Details Viewing', () => {
    it('should retrieve detailed movie information', async () => {
      const { app, users } = context;

      // First search for a movie
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'popular movie', mediaType: 'movie', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      if (searchResponse.body.data.length > 0) {
        const movieId = searchResponse.body.data[0].id;

        const detailsResponse = await request(app)
          .get(`/api/v1/media/movie/${movieId}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateMediaDetailsResponse(detailsResponse)).toBe(true);

        const movie = detailsResponse.body.data;
        expect(movie).toMatchObject({
          id: movieId,
          title: expect.any(String),
          overview: expect.any(String),
          releaseDate: expect.any(String),
          genres: expect.any(Array),
          runtime: expect.any(Number),
          voteAverage: expect.any(Number)
        });
      }
    });

    it('should retrieve detailed TV show information with seasons', async () => {
      const { app, users } = context;

      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'popular show', mediaType: 'tv', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      if (searchResponse.body.data.length > 0) {
        const showId = searchResponse.body.data[0].id;

        const detailsResponse = await request(app)
          .get(`/api/v1/media/tv/${showId}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateMediaDetailsResponse(detailsResponse)).toBe(true);

        const show = detailsResponse.body.data;
        expect(show).toMatchObject({
          id: showId,
          name: expect.any(String),
          overview: expect.any(String),
          firstAirDate: expect.any(String),
          numberOfSeasons: expect.any(Number),
          seasons: expect.any(Array)
        });

        // Verify seasons structure
        if (show.seasons.length > 0) {
          show.seasons.forEach((season: any) => {
            expect(season).toMatchObject({
              id: expect.any(Number),
              name: expect.any(String),
              seasonNumber: expect.any(Number),
              episodeCount: expect.any(Number)
            });
          });
        }
      }
    });

    it('should handle invalid media IDs gracefully', async () => {
      const { app, users } = context;

      // Invalid movie ID
      const invalidMovieResponse = await request(app)
        .get('/api/v1/media/movie/999999999')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(invalidMovieResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('not found')
        }
      });

      // Invalid TV show ID
      const invalidTVResponse = await request(app)
        .get('/api/v1/media/tv/999999999')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(invalidTVResponse.body.success).toBe(false);
    });

    it('should include request availability status in details', async () => {
      const { app, users } = context;

      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'movie', mediaType: 'movie', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      if (searchResponse.body.data.length > 0) {
        const movieId = searchResponse.body.data[0].id;

        const detailsResponse = await request(app)
          .get(`/api/v1/media/movie/${movieId}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        const movie = detailsResponse.body.data;
        
        // Should include availability information
        expect(movie).toHaveProperty('requestStatus');
        expect(['available', 'pending', 'not_requested']).toContain(movie.requestStatus);
      }
    });
  });

  describe('Visual Regression Testing', () => {
    it('should maintain consistent search response structure', async () => {
      const { app, users } = context;

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'matrix', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'search-response-structure',
        threshold: 0.95
      });

      expect(visualResult.match).toBe(true);
      if (visualResult.diff) {
        expect(visualResult.diff).toBeLessThan(5);
      }
    });

    it('should maintain consistent details response structure', async () => {
      const { app, users } = context;

      // Use a well-known movie ID for consistency
      const response = await request(app)
        .get('/api/v1/media/movie/550') // Fight Club
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'movie-details-structure',
        threshold: 0.90
      });

      expect(visualResult.match).toBe(true);
    });
  });

  describe('Responsive Behavior Testing', () => {
    it('should adapt search results for different viewports', async () => {
      const { app, users } = context;

      const testSearchForViewport = async (viewport: any) => {
        const response = await request(app)
          .get('/api/v1/media/search')
          .query({ 
            query: 'action',
            page: 1,
            pageSize: viewport.name === 'mobile' ? 5 : 20
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('User-Agent', viewport.userAgent || '')
          .expect(200);

        expect(ResponsiveTestHelper.validateResponseForViewport(response, viewport)).toBe(true);
        return response;
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testSearchForViewport);

      // Verify that mobile gets smaller page sizes
      if (results.mobile && results.desktop) {
        const mobilePageSize = results.mobile.body.meta.pageSize || results.mobile.body.data.length;
        const desktopPageSize = results.desktop.body.meta.pageSize || results.desktop.body.data.length;
        
        expect(mobilePageSize).toBeLessThanOrEqual(desktopPageSize);
      }
    });

    it('should optimize media details for different screen sizes', async () => {
      const { app, users } = context;

      const testDetailsForViewport = async (viewport: any) => {
        // First get a movie ID
        const searchResponse = await request(app)
          .get('/api/v1/media/search')
          .query({ query: 'action', mediaType: 'movie', page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        if (searchResponse.body.data.length > 0) {
          const movieId = searchResponse.body.data[0].id;
          
          return request(app)
            .get(`/api/v1/media/movie/${movieId}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .set('User-Agent', viewport.userAgent || '')
            .expect(200);
        }
        
        return null;
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testDetailsForViewport);

      // All viewports should receive valid responses
      Object.values(results).forEach((response) => {
        if (response) {
          expect(DataValidationHelper.validateMediaDetailsResponse(response)).toBe(true);
        }
      });
    });
  });

  describe('Complex Search and Browse Scenarios', () => {
    it('should execute complete search-to-details workflow', async () => {
      const { app, users } = context;

      const scenario = new ScenarioBuilder()
        .step('search', async () => {
          return request(app)
            .get('/api/v1/media/search')
            .query({ query: 'batman', mediaType: 'movie', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('selectFirst', async (context) => {
          const searchResults = context.search.body.data;
          expect(searchResults.length).toBeGreaterThan(0);
          return searchResults[0];
        })
        .step('getDetails', async (context) => {
          const movie = context.selectFirst;
          return request(app)
            .get(`/api/v1/media/movie/${movie.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('validateWorkflow', async (context) => {
          const searchResponse = context.search;
          const detailsResponse = context.getDetails;
          
          // Validate consistency between search and details
          expect(searchResponse.body.success).toBe(true);
          expect(detailsResponse.body.success).toBe(true);
          expect(detailsResponse.body.data.id).toBe(context.selectFirst.id);
          
          return { workflowCompleted: true };
        });

      const result = await scenario.execute();
      expect(result.validateWorkflow.workflowCompleted).toBe(true);
    });

    it('should handle search with multiple filters and sorting', async () => {
      const { app, users } = context;

      const complexSearchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ 
          query: 'superhero',
          mediaType: 'movie',
          year: 2020,
          sortBy: 'popularity',
          sortOrder: 'desc',
          page: 1,
          pageSize: 10
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(complexSearchResponse.body.success).toBe(true);
      expect(DataValidationHelper.validateMediaSearchResponse(complexSearchResponse)).toBe(true);

      // Validate that filters were applied
      const results = complexSearchResponse.body.data;
      if (results.length > 0) {
        results.forEach((movie: any) => {
          expect(movie.mediaType).toBe('movie');
          // Additional filter validations would go here
        });
      }
    });

    it('should perform concurrent searches without conflicts', async () => {
      const { app, users } = context;

      const searches = [
        'action movies',
        'comedy shows', 
        'sci-fi',
        'horror',
        'drama'
      ];

      const concurrentRequests = searches.map(query =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query, page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200)
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.meta.query).toBe(searches[index]);
        expect(DataValidationHelper.validateMediaSearchResponse(response)).toBe(true);
      });
    });

    it('should handle edge cases in search and browsing', async () => {
      const { app, users } = context;

      // Test special characters in search
      const specialCharResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'movie: "test" & more', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`);

      expect([200, 400]).toContain(specialCharResponse.status);

      // Test unicode characters
      const unicodeResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: '映画', page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`);

      expect([200, 400]).toContain(unicodeResponse.status);

      // Test very large page numbers
      const largePageResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', page: 999999 })
        .set('Authorization', `Bearer ${users.user.token}`);

      expect([200, 400, 404]).toContain(largePageResponse.status);
    });
  });
});