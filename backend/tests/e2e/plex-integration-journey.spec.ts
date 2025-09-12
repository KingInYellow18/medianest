import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from './helpers/auth';

/**
 * Comprehensive Plex Integration User Journey E2E Tests
 * Tests the complete Plex integration including:
 * - Library browsing and navigation
 * - Media playback and streaming
 * - Collection management
 * - Recently added content
 * - Search across Plex libraries
 * - Server status and connectivity
 */

test.describe('Plex Integration User Journey', () => {
  let page: Page;
  let context: BrowserContext;
  let authHelper: AuthHelper;

  const mockPlexServer = {
    name: 'MediaNest Plex Server',
    version: '1.32.5.7349',
    status: 'online',
    host: 'plex.medianest.local',
    port: 32400,
    secure: true,
  };

  const mockPlexLibraries = [
    {
      key: 'lib-1',
      title: 'Movies',
      type: 'movie',
      agent: 'com.plexapp.agents.themoviedb',
      scanner: 'Plex Movie Scanner',
      language: 'en',
      uuid: 'uuid-movies-1',
      updatedAt: 1704067200,
      createdAt: 1704067200,
      art: '/library/sections/1/art',
      composite: '/library/sections/1/composite',
      thumb: '/library/sections/1/thumb',
      refreshing: false,
      itemCount: 1247,
    },
    {
      key: 'lib-2',
      title: 'TV Shows',
      type: 'show',
      agent: 'com.plexapp.agents.themoviedb',
      scanner: 'Plex Series Scanner',
      language: 'en',
      uuid: 'uuid-shows-1',
      updatedAt: 1704067200,
      createdAt: 1704067200,
      art: '/library/sections/2/art',
      composite: '/library/sections/2/composite',
      thumb: '/library/sections/2/thumb',
      refreshing: false,
      itemCount: 342,
    },
    {
      key: 'lib-3',
      title: 'Music',
      type: 'artist',
      agent: 'com.plexapp.agents.lastfm',
      scanner: 'Plex Music Scanner',
      language: 'en',
      uuid: 'uuid-music-1',
      updatedAt: 1704067200,
      createdAt: 1704067200,
      art: '/library/sections/3/art',
      composite: '/library/sections/3/composite',
      thumb: '/library/sections/3/thumb',
      refreshing: false,
      itemCount: 5623,
    },
  ];

  const mockMovieItems = [
    {
      ratingKey: '1',
      key: '/library/metadata/1',
      guid: 'com.plexapp.agents.themoviedb://12345?lang=en',
      studio: 'Warner Bros.',
      type: 'movie',
      title: 'Inception',
      originalTitle: 'Inception',
      contentRating: 'PG-13',
      summary:
        'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
      rating: 8.8,
      audienceRating: 9.2,
      year: 2010,
      tagline: 'Your mind is the scene of the crime.',
      thumb: '/library/metadata/1/thumb/1704067200',
      art: '/library/metadata/1/art/1704067200',
      duration: 8880000,
      originallyAvailableAt: '2010-07-16',
      addedAt: 1704067200,
      updatedAt: 1704067200,
      Media: [
        {
          id: 1,
          duration: 8880000,
          bitrate: 5000,
          width: 1920,
          height: 1080,
          aspectRatio: 1.78,
          audioChannels: 6,
          audioCodec: 'ac3',
          videoCodec: 'h264',
          videoResolution: '1080p',
          container: 'mp4',
          videoFrameRate: '24p',
          Part: [
            {
              id: 1,
              key: '/library/parts/1/1704067200/file.mp4',
              duration: 8880000,
              file: '/media/Movies/Inception (2010)/Inception (2010).mp4',
              size: 5565721600,
              container: 'mp4',
              videoProfile: 'high',
            },
          ],
        },
      ],
      Genre: [{ tag: 'Action' }, { tag: 'Drama' }, { tag: 'Sci-Fi' }, { tag: 'Thriller' }],
      Director: [{ tag: 'Christopher Nolan' }],
      Writer: [{ tag: 'Christopher Nolan' }],
      Country: [{ tag: 'United States of America' }],
      Role: [{ tag: 'Leonardo DiCaprio' }, { tag: 'Marion Cotillard' }, { tag: 'Tom Hardy' }],
    },
  ];

  const mockTVShows = [
    {
      ratingKey: '100',
      key: '/library/metadata/100',
      guid: 'com.plexapp.agents.themoviedb://1396?lang=en',
      type: 'show',
      title: 'Breaking Bad',
      summary:
        "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
      index: 1,
      rating: 9.5,
      year: 2008,
      thumb: '/library/metadata/100/thumb/1704067200',
      art: '/library/metadata/100/art/1704067200',
      banner: '/library/metadata/100/banner/1704067200',
      theme: '/library/metadata/100/theme/1704067200',
      duration: 2700000,
      originallyAvailableAt: '2008-01-20',
      leafCount: 62,
      viewedLeafCount: 0,
      childCount: 5,
      addedAt: 1704067200,
      updatedAt: 1704067200,
      Genre: [{ tag: 'Crime' }, { tag: 'Drama' }, { tag: 'Thriller' }],
      Role: [{ tag: 'Bryan Cranston' }, { tag: 'Aaron Paul' }, { tag: 'Anna Gunn' }],
    },
  ];

  const mockRecentlyAdded = [
    {
      ...mockMovieItems[0],
      addedAt: Date.now() / 1000 - 86400, // 1 day ago
    },
    {
      ratingKey: '2',
      key: '/library/metadata/2',
      type: 'movie',
      title: 'The Dark Knight',
      year: 2008,
      thumb: '/library/metadata/2/thumb/1704067200',
      addedAt: Date.now() / 1000 - 172800, // 2 days ago
    },
  ];

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    authHelper = new AuthHelper(page);

    // Setup authentication mocks
    await page.route('**/api/v1/auth/plex/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'test-jwt-token-12345',
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@medianest.test',
            role: 'user',
          },
        }),
      });
    });

    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@medianest.test',
            role: 'user',
          },
          sessionValid: true,
        }),
      });
    });

    // Setup Plex API mocks
    await page.route('**/api/v1/plex/server', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlexServer),
      });
    });

    await page.route('**/api/v1/plex/libraries', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ libraries: mockPlexLibraries }),
      });
    });

    await page.route('**/api/v1/plex/libraries/lib-1/items**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockMovieItems,
          totalSize: mockMovieItems.length,
          size: mockMovieItems.length,
        }),
      });
    });

    await page.route('**/api/v1/plex/libraries/lib-2/items**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockTVShows,
          totalSize: mockTVShows.length,
          size: mockTVShows.length,
        }),
      });
    });

    await page.route('**/api/v1/plex/recently-added**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockRecentlyAdded,
          totalSize: mockRecentlyAdded.length,
        }),
      });
    });

    await page.route('**/api/v1/plex/search**', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query');

      let results = [];
      if (query?.toLowerCase().includes('inception')) {
        results = [mockMovieItems[0]];
      } else if (query?.toLowerCase().includes('breaking')) {
        results = [mockTVShows[0]];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results,
          totalResults: results.length,
        }),
      });
    });

    // Login before each test
    await authHelper.loginWithPlex();
  });

  test('should display Plex server information', async () => {
    await page.goto('/plex');

    // Verify Plex page loads
    await expect(page.locator('[data-testid="plex-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Plex Library');

    // Verify server info
    await expect(page.locator('[data-testid="server-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-name"]')).toContainText(
      'MediaNest Plex Server',
    );
    await expect(page.locator('[data-testid="server-status"]')).toContainText('Online');
    await expect(page.locator('[data-testid="server-version"]')).toContainText('1.32.5.7349');
  });

  test('should browse Plex libraries', async () => {
    await page.goto('/plex');

    // Verify libraries are displayed
    await expect(page.locator('[data-testid="libraries-section"]')).toBeVisible();

    const libraryCards = page.locator('[data-testid="library-card"]');
    await expect(libraryCards).toHaveCount(3);

    // Check Movies library
    const moviesLibrary = libraryCards.first();
    await expect(moviesLibrary.locator('[data-testid="library-name"]')).toContainText('Movies');
    await expect(moviesLibrary.locator('[data-testid="library-type"]')).toContainText('movie');
    await expect(moviesLibrary.locator('[data-testid="item-count"]')).toContainText('1,247');

    // Check TV Shows library
    const tvLibrary = libraryCards.nth(1);
    await expect(tvLibrary.locator('[data-testid="library-name"]')).toContainText('TV Shows');
    await expect(tvLibrary.locator('[data-testid="library-type"]')).toContainText('show');
    await expect(tvLibrary.locator('[data-testid="item-count"]')).toContainText('342');

    // Check Music library
    const musicLibrary = libraryCards.nth(2);
    await expect(musicLibrary.locator('[data-testid="library-name"]')).toContainText('Music');
    await expect(musicLibrary.locator('[data-testid="library-type"]')).toContainText('artist');
    await expect(musicLibrary.locator('[data-testid="item-count"]')).toContainText('5,623');
  });

  test('should browse movie library items', async () => {
    await page.goto('/plex');

    // Click on Movies library
    await page.locator('[data-testid="library-card"]').first().click();

    // Verify navigation to movies library
    await expect(page).toHaveURL('/plex/libraries/lib-1');
    await expect(page.locator('[data-testid="library-header"]')).toContainText('Movies');

    // Verify movie items are displayed
    const movieItems = page.locator('[data-testid="media-item"]');
    await expect(movieItems).toHaveCount(1);

    // Check Inception movie details
    const inceptionItem = movieItems.first();
    await expect(inceptionItem.locator('[data-testid="media-title"]')).toContainText('Inception');
    await expect(inceptionItem.locator('[data-testid="media-year"]')).toContainText('2010');
    await expect(inceptionItem.locator('[data-testid="media-rating"]')).toContainText('8.8');
    await expect(inceptionItem.locator('[data-testid="media-duration"]')).toContainText('2h 28m');
    await expect(inceptionItem.locator('[data-testid="media-poster"]')).toBeVisible();
  });

  test('should view movie details and metadata', async () => {
    await page.route('**/api/v1/plex/libraries/lib-1/items/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMovieItems[0]),
      });
    });

    await page.goto('/plex/libraries/lib-1');

    // Click on movie item
    await page.locator('[data-testid="media-item"]').first().click();

    // Verify movie details modal/page
    await expect(page.locator('[data-testid="media-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="detail-title"]')).toContainText('Inception');

    // Verify metadata
    await expect(page.locator('[data-testid="detail-year"]')).toContainText('2010');
    await expect(page.locator('[data-testid="detail-rating"]')).toContainText('8.8');
    await expect(page.locator('[data-testid="detail-duration"]')).toContainText('2h 28m');
    await expect(page.locator('[data-testid="detail-summary"]')).toContainText(
      'A thief who steals corporate secrets',
    );

    // Verify genres
    await expect(page.locator('[data-testid="genres"]')).toContainText('Action');
    await expect(page.locator('[data-testid="genres"]')).toContainText('Sci-Fi');

    // Verify cast
    await expect(page.locator('[data-testid="cast"]')).toContainText('Leonardo DiCaprio');
    await expect(page.locator('[data-testid="cast"]')).toContainText('Marion Cotillard');

    // Verify director
    await expect(page.locator('[data-testid="director"]')).toContainText('Christopher Nolan');

    // Verify media info
    await expect(page.locator('[data-testid="media-info"]')).toContainText('1080p');
    await expect(page.locator('[data-testid="media-info"]')).toContainText('H.264');
    await expect(page.locator('[data-testid="media-info"]')).toContainText('5.1');
  });

  test('should browse TV show library and episodes', async () => {
    await page.goto('/plex');

    // Click on TV Shows library
    await page.locator('[data-testid="library-card"]').nth(1).click();

    // Verify navigation to TV library
    await expect(page).toHaveURL('/plex/libraries/lib-2');
    await expect(page.locator('[data-testid="library-header"]')).toContainText('TV Shows');

    // Verify TV show items
    const tvItems = page.locator('[data-testid="media-item"]');
    await expect(tvItems).toHaveCount(1);

    // Check Breaking Bad details
    const breakingBadItem = tvItems.first();
    await expect(breakingBadItem.locator('[data-testid="media-title"]')).toContainText(
      'Breaking Bad',
    );
    await expect(breakingBadItem.locator('[data-testid="media-year"]')).toContainText('2008');
    await expect(breakingBadItem.locator('[data-testid="media-rating"]')).toContainText('9.5');
    await expect(breakingBadItem.locator('[data-testid="season-count"]')).toContainText(
      '5 seasons',
    );
    await expect(breakingBadItem.locator('[data-testid="episode-count"]')).toContainText(
      '62 episodes',
    );
  });

  test('should display recently added content', async () => {
    await page.goto('/plex');

    // Verify recently added section
    await expect(page.locator('[data-testid="recently-added"]')).toBeVisible();
    await expect(page.locator('[data-testid="section-title"]')).toContainText('Recently Added');

    const recentItems = page.locator('[data-testid="recent-item"]');
    await expect(recentItems).toHaveCount(2);

    // Check most recent item (Inception)
    const firstRecent = recentItems.first();
    await expect(firstRecent.locator('[data-testid="media-title"]')).toContainText('Inception');
    await expect(firstRecent.locator('[data-testid="added-date"]')).toContainText('1 day ago');

    // Check second recent item (The Dark Knight)
    const secondRecent = recentItems.nth(1);
    await expect(secondRecent.locator('[data-testid="media-title"]')).toContainText(
      'The Dark Knight',
    );
    await expect(secondRecent.locator('[data-testid="added-date"]')).toContainText('2 days ago');
  });

  test('should search across Plex libraries', async () => {
    await page.goto('/plex');

    // Verify search section
    await expect(page.locator('[data-testid="plex-search"]')).toBeVisible();

    // Search for movie
    await page.fill('[data-testid="plex-search-input"]', 'Inception');
    await page.click('[data-testid="plex-search-button"]');

    // Verify search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults).toHaveCount(1);

    // Check search result
    const result = searchResults.first();
    await expect(result.locator('[data-testid="result-title"]')).toContainText('Inception');
    await expect(result.locator('[data-testid="result-type"]')).toContainText('Movie');
    await expect(result.locator('[data-testid="result-library"]')).toContainText('Movies');
  });

  test('should search for TV shows', async () => {
    await page.goto('/plex');

    // Search for TV show
    await page.fill('[data-testid="plex-search-input"]', 'Breaking Bad');
    await page.click('[data-testid="plex-search-button"]');

    // Verify TV show in search results
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults).toHaveCount(1);

    const result = searchResults.first();
    await expect(result.locator('[data-testid="result-title"]')).toContainText('Breaking Bad');
    await expect(result.locator('[data-testid="result-type"]')).toContainText('TV Show');
    await expect(result.locator('[data-testid="result-library"]')).toContainText('TV Shows');
  });

  test('should handle no search results', async () => {
    await page.goto('/plex');

    // Search for non-existent content
    await page.fill('[data-testid="plex-search-input"]', 'NonExistentMovie123');
    await page.click('[data-testid="plex-search-button"]');

    // Verify no results message
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-results"]')).toContainText('No results found');
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
  });

  test('should handle Plex server connectivity issues', async () => {
    // Mock server error
    await page.route('**/api/v1/plex/server', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Plex server unreachable',
          message: 'Unable to connect to Plex server',
        }),
      });
    });

    await page.goto('/plex');

    // Verify error handling
    await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-error"]')).toContainText(
      'Plex server unreachable',
    );
    await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();

    // Test retry functionality
    await page.route('**/api/v1/plex/server', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlexServer),
      });
    });

    await page.click('[data-testid="retry-connection"]');

    // Verify successful reconnection
    await expect(page.locator('[data-testid="server-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-status"]')).toContainText('Online');
  });

  test('should handle library loading errors', async () => {
    // Mock library error
    await page.route('**/api/v1/plex/libraries/lib-1/items**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Library scan in progress',
          message: 'Library is currently being updated',
        }),
      });
    });

    await page.goto('/plex/libraries/lib-1');

    // Verify error handling
    await expect(page.locator('[data-testid="library-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="library-error"]')).toContainText(
      'Library scan in progress',
    );
    await expect(page.locator('[data-testid="refresh-library"]')).toBeVisible();
  });

  test.describe('Performance and Load Testing', () => {
    test('should load large libraries efficiently', async () => {
      // Mock large library
      const largeMovieList = Array.from({ length: 100 }, (_, i) => ({
        ratingKey: (i + 1).toString(),
        key: `/library/metadata/${i + 1}`,
        type: 'movie',
        title: `Movie ${i + 1}`,
        year: 2020 + (i % 5),
        thumb: `/library/metadata/${i + 1}/thumb/1704067200`,
        rating: 7.0 + (i % 3),
        duration: 7200000 + i * 60000,
        addedAt: 1704067200 - i * 86400,
      }));

      await page.route('**/api/v1/plex/libraries/lib-1/items**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: largeMovieList,
            totalSize: largeMovieList.length,
            size: largeMovieList.length,
          }),
        });
      });

      const startTime = Date.now();
      await page.goto('/plex/libraries/lib-1');

      await expect(page.locator('[data-testid="media-item"]').first()).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Verify pagination or virtualization
      const mediaItems = page.locator('[data-testid="media-item"]');
      const visibleCount = await mediaItems.count();

      // Should implement pagination/virtualization for large lists
      expect(visibleCount).toBeLessThanOrEqual(50);

      // Verify pagination controls if implemented
      if (visibleCount === 50) {
        await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plex');

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-plex-nav"]')).toBeVisible();

      // Verify libraries display in mobile grid
      const libraryCards = page.locator('[data-testid="library-card"]');
      await expect(libraryCards).toHaveCount(3);

      // Test mobile search
      await page.click('[data-testid="mobile-search-toggle"]');
      await expect(page.locator('[data-testid="mobile-search-panel"]')).toBeVisible();

      await page.fill('[data-testid="plex-search-input"]', 'Inception');
      await page.click('[data-testid="plex-search-button"]');

      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
