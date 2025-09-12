import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';

import { AuthHelper } from './helpers/auth';

/**
 * Comprehensive YouTube Download User Journey E2E Tests
 * Tests the complete YouTube download functionality including:
 * - URL validation and parsing
 * - Video metadata extraction
 * - Download queue management
 * - Progress tracking
 * - Format selection and quality options
 * - Download history and status
 * - Rate limiting and error handling
 */

test.describe('YouTube Download User Journey', () => {
  let page: Page;
  let context: BrowserContext;
  let authHelper: AuthHelper;

  const mockVideoMetadata = {
    id: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
    description: 'The official video for "Never Gonna Give You Up" by Rick Astley',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    duration: 212,
    uploader: 'Rick Astley',
    uploadDate: '2009-10-25',
    viewCount: 1234567890,
    likeCount: 12345678,
    channel: 'Rick Astley',
    channelUrl: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    formats: [
      {
        formatId: '140',
        ext: 'mp3',
        quality: 'Audio Only',
        abr: 128,
        filesize: 3456789,
      },
      {
        formatId: '18',
        ext: 'mp4',
        quality: '360p',
        width: 640,
        height: 360,
        filesize: 12345678,
      },
      {
        formatId: '22',
        ext: 'mp4',
        quality: '720p',
        width: 1280,
        height: 720,
        filesize: 23456789,
      },
      {
        formatId: '137',
        ext: 'mp4',
        quality: '1080p',
        width: 1920,
        height: 1080,
        filesize: 45678901,
      },
    ],
  };

  const mockDownloads = [
    {
      id: 'dl-123',
      videoId: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'completed',
      quality: '720p',
      format: 'mp4',
      progress: 100,
      fileSize: 23456789,
      downloadPath: '/downloads/rick-astley-never-gonna-give-you-up.mp4',
      createdAt: '2024-01-15T10:30:00Z',
      completedAt: '2024-01-15T10:35:00Z',
      duration: 300000, // 5 minutes
    },
    {
      id: 'dl-456',
      videoId: 'abcd1234567',
      title: 'Another Video Title',
      url: 'https://www.youtube.com/watch?v=abcd1234567',
      status: 'downloading',
      quality: '1080p',
      format: 'mp4',
      progress: 45,
      fileSize: 45678901,
      downloadPath: null,
      createdAt: '2024-01-15T11:00:00Z',
      completedAt: null,
      duration: null,
      eta: 300, // 5 minutes remaining
      downloadSpeed: 1024000, // 1 MB/s
    },
    {
      id: 'dl-789',
      videoId: 'xyz9876543',
      title: 'Failed Download Video',
      url: 'https://www.youtube.com/watch?v=xyz9876543',
      status: 'failed',
      quality: '720p',
      format: 'mp4',
      progress: 0,
      fileSize: 0,
      downloadPath: null,
      createdAt: '2024-01-15T12:00:00Z',
      completedAt: null,
      error: 'Video no longer available',
      duration: null,
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

    // Setup YouTube API mocks
    await page.route('**/api/v1/youtube/metadata**', async (route) => {
      const url = new URL(route.request().url());
      const videoUrl = url.searchParams.get('url');

      if (videoUrl && videoUrl.includes('dQw4w9WgXcQ')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockVideoMetadata),
        });
      } else if (videoUrl && videoUrl.includes('invalid')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid video URL',
            message: 'Unable to extract video information',
          }),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Video not found',
            message: 'Video may be private or deleted',
          }),
        });
      }
    });

    await page.route('**/api/v1/youtube/download', async (route) => {
      if (route.request().method() === 'POST') {
        const body = await route.request().postDataJSON();

        if (body.url.includes('rate-limit')) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Rate limit exceeded',
              message: 'You have exceeded the download rate limit (5 downloads per hour)',
              retryAfter: 3600,
            }),
          });
        } else {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'dl-new-' + Date.now(),
              success: true,
              message: 'Download started successfully',
            }),
          });
        }
      }
    });

    await page.route('**/api/v1/youtube/downloads**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloads: mockDownloads,
            totalCount: mockDownloads.length,
            activeCount: 1,
            completedCount: 1,
            failedCount: 1,
          }),
        });
      }
    });

    await page.route('**/api/v1/youtube/downloads/*/cancel', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Download cancelled successfully',
          }),
        });
      }
    });

    await page.route('**/api/v1/youtube/downloads/*/retry', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Download retry started',
          }),
        });
      }
    });

    // Login before each test
    await authHelper.loginWithPlex();
  });

  test('should validate YouTube URLs correctly', async () => {
    await page.goto('/youtube');

    // Verify YouTube download page loads
    await expect(page.locator('[data-testid="youtube-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('YouTube Downloads');

    // Verify URL input
    await expect(page.locator('[data-testid="url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="get-info-button"]')).toBeVisible();

    // Test valid YouTube URL formats
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
    ];

    for (const url of validUrls) {
      await page.fill('[data-testid="url-input"]', url);
      await expect(page.locator('[data-testid="url-input"]')).toHaveClass(/valid/);
      await expect(page.locator('[data-testid="url-error"]')).not.toBeVisible();
    }

    // Test invalid URLs
    const invalidUrls = [
      'not-a-url',
      'https://example.com',
      'https://vimeo.com/123456',
      'https://youtube.com', // Missing video ID
    ];

    for (const url of invalidUrls) {
      await page.fill('[data-testid="url-input"]', url);
      await expect(page.locator('[data-testid="url-input"]')).toHaveClass(/invalid/);
      await expect(page.locator('[data-testid="url-error"]')).toBeVisible();
    }
  });

  test('should extract video metadata successfully', async () => {
    await page.goto('/youtube');

    // Enter valid YouTube URL
    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('[data-testid="get-info-button"]');

    // Verify loading state
    await expect(page.locator('[data-testid="metadata-loading"]')).toBeVisible();

    // Verify video metadata is displayed
    await expect(page.locator('[data-testid="video-metadata"]')).toBeVisible();

    // Check video information
    await expect(page.locator('[data-testid="video-title"]')).toContainText(
      'Rick Astley - Never Gonna Give You Up',
    );
    await expect(page.locator('[data-testid="video-uploader"]')).toContainText('Rick Astley');
    await expect(page.locator('[data-testid="video-duration"]')).toContainText('3:32');
    await expect(page.locator('[data-testid="video-views"]')).toContainText('1.23B');
    await expect(page.locator('[data-testid="video-upload-date"]')).toContainText('Oct 25, 2009');

    // Verify thumbnail
    await expect(page.locator('[data-testid="video-thumbnail"]')).toBeVisible();
    await expect(page.locator('[data-testid="video-thumbnail"]')).toHaveAttribute(
      'src',
      /maxresdefault/,
    );

    // Verify description
    await expect(page.locator('[data-testid="video-description"]')).toContainText(
      'The official video',
    );
  });

  test('should display format selection options', async () => {
    await page.goto('/youtube');

    // Get video metadata
    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('[data-testid="get-info-button"]');

    // Verify format selection is available
    await expect(page.locator('[data-testid="format-selection"]')).toBeVisible();
    await expect(page.locator('[data-testid="format-title"]')).toContainText(
      'Choose Quality & Format',
    );

    // Check available formats
    const formatOptions = page.locator('[data-testid="format-option"]');
    await expect(formatOptions).toHaveCount(4);

    // Check audio format
    const audioFormat = formatOptions.first();
    await expect(audioFormat.locator('[data-testid="format-quality"]')).toContainText('Audio Only');
    await expect(audioFormat.locator('[data-testid="format-ext"]')).toContainText('mp3');
    await expect(audioFormat.locator('[data-testid="format-size"]')).toContainText('3.3 MB');

    // Check video formats
    const video360p = formatOptions.nth(1);
    await expect(video360p.locator('[data-testid="format-quality"]')).toContainText('360p');
    await expect(video360p.locator('[data-testid="format-ext"]')).toContainText('mp4');
    await expect(video360p.locator('[data-testid="format-size"]')).toContainText('11.8 MB');

    const video720p = formatOptions.nth(2);
    await expect(video720p.locator('[data-testid="format-quality"]')).toContainText('720p');
    await expect(video720p.locator('[data-testid="format-resolution"]')).toContainText('1280x720');

    const video1080p = formatOptions.nth(3);
    await expect(video1080p.locator('[data-testid="format-quality"]')).toContainText('1080p');
    await expect(video1080p.locator('[data-testid="format-resolution"]')).toContainText(
      '1920x1080',
    );
    await expect(video1080p.locator('[data-testid="format-size"]')).toContainText('43.6 MB');
  });

  test('should start download successfully', async () => {
    await page.goto('/youtube');

    // Get video metadata and select format
    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('[data-testid="get-info-button"]');

    await expect(page.locator('[data-testid="format-selection"]')).toBeVisible();

    // Select 720p format
    await page.locator('[data-testid="format-option"]').nth(2).click();
    await expect(page.locator('[data-testid="format-option"]').nth(2)).toHaveClass(/selected/);

    // Start download
    await page.click('[data-testid="download-button"]');

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Download started successfully',
    );

    // Verify download appears in queue
    await expect(page.locator('[data-testid="download-queue"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1);
  });

  test('should display download history and status', async () => {
    await page.goto('/youtube/downloads');

    // Verify downloads page loads
    await expect(page.locator('[data-testid="downloads-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Download History');

    // Verify download statistics
    await expect(page.locator('[data-testid="download-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-downloads"]')).toContainText('3');
    await expect(page.locator('[data-testid="active-downloads"]')).toContainText('1');
    await expect(page.locator('[data-testid="completed-downloads"]')).toContainText('1');
    await expect(page.locator('[data-testid="failed-downloads"]')).toContainText('1');

    // Verify download list
    const downloadItems = page.locator('[data-testid="download-item"]');
    await expect(downloadItems).toHaveCount(3);

    // Check completed download
    const completedDownload = downloadItems.first();
    await expect(completedDownload.locator('[data-testid="download-title"]')).toContainText(
      'Rick Astley',
    );
    await expect(completedDownload.locator('[data-testid="download-status"]')).toContainText(
      'Completed',
    );
    await expect(completedDownload.locator('[data-testid="download-progress"]')).toContainText(
      '100%',
    );
    await expect(completedDownload.locator('[data-testid="download-size"]')).toContainText(
      '22.4 MB',
    );
    await expect(completedDownload.locator('[data-testid="download-quality"]')).toContainText(
      '720p',
    );
    await expect(completedDownload.locator('[data-testid="download-button"]')).toBeVisible();

    // Check active download
    const activeDownload = downloadItems.nth(1);
    await expect(activeDownload.locator('[data-testid="download-title"]')).toContainText(
      'Another Video Title',
    );
    await expect(activeDownload.locator('[data-testid="download-status"]')).toContainText(
      'Downloading',
    );
    await expect(activeDownload.locator('[data-testid="download-progress"]')).toContainText('45%');
    await expect(activeDownload.locator('[data-testid="progress-bar"]')).toHaveAttribute(
      'value',
      '45',
    );
    await expect(activeDownload.locator('[data-testid="download-speed"]')).toContainText(
      '1.0 MB/s',
    );
    await expect(activeDownload.locator('[data-testid="eta"]')).toContainText('5m');
    await expect(activeDownload.locator('[data-testid="cancel-button"]')).toBeVisible();

    // Check failed download
    const failedDownload = downloadItems.nth(2);
    await expect(failedDownload.locator('[data-testid="download-title"]')).toContainText(
      'Failed Download Video',
    );
    await expect(failedDownload.locator('[data-testid="download-status"]')).toContainText('Failed');
    await expect(failedDownload.locator('[data-testid="error-message"]')).toContainText(
      'Video no longer available',
    );
    await expect(failedDownload.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should cancel active download', async () => {
    await page.goto('/youtube/downloads');

    // Find active download and cancel it
    const activeDownload = page.locator('[data-testid="download-item"]').nth(1);
    await activeDownload.locator('[data-testid="cancel-button"]').click();

    // Confirm cancellation
    await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-message"]')).toContainText(
      'Are you sure you want to cancel this download?',
    );
    await page.click('[data-testid="confirm-cancel"]');

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Download cancelled successfully',
    );
  });

  test('should retry failed download', async () => {
    await page.goto('/youtube/downloads');

    // Find failed download and retry it
    const failedDownload = page.locator('[data-testid="download-item"]').nth(2);
    await failedDownload.locator('[data-testid="retry-button"]').click();

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Download retry started',
    );
  });

  test('should download completed file', async () => {
    await page.goto('/youtube/downloads');

    // Mock file download
    const downloadPromise = page.waitForEvent('download');

    // Click download button on completed item
    const completedDownload = page.locator('[data-testid="download-item"]').first();
    await completedDownload.locator('[data-testid="download-button"]').click();

    // Verify file download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('rick-astley');
    expect(download.suggestedFilename()).toContain('.mp4');
  });

  test('should handle rate limiting', async () => {
    await page.goto('/youtube');

    // Enter URL that will trigger rate limit
    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=rate-limit');
    await page.click('[data-testid="get-info-button"]');

    // Mock metadata response for rate-limited URL
    await page.route('**/api/v1/youtube/metadata**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockVideoMetadata,
          id: 'rate-limit',
          url: 'https://www.youtube.com/watch?v=rate-limit',
        }),
      });
    });

    await expect(page.locator('[data-testid="video-metadata"]')).toBeVisible();

    // Try to download - should be rate limited
    await page.locator('[data-testid="format-option"]').first().click();
    await page.click('[data-testid="download-button"]');

    // Verify rate limit error
    await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-notification"]')).toContainText(
      'Rate limit exceeded',
    );
    await expect(page.locator('[data-testid="error-notification"]')).toContainText(
      '5 downloads per hour',
    );

    // Verify rate limit info is displayed
    await expect(page.locator('[data-testid="rate-limit-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-after"]')).toContainText('1 hour');
  });

  test('should handle invalid video URLs gracefully', async () => {
    await page.goto('/youtube');

    // Enter invalid video URL
    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=invalid');
    await page.click('[data-testid="get-info-button"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-notification"]')).toContainText(
      'Video not found',
    );

    // Verify metadata section is not shown
    await expect(page.locator('[data-testid="video-metadata"]')).not.toBeVisible();

    // Verify URL input is cleared and ready for retry
    await expect(page.locator('[data-testid="url-input"]')).toHaveValue('');
  });

  test('should handle network errors gracefully', async () => {
    // Mock network error
    await page.route('**/api/v1/youtube/metadata**', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/youtube');

    await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('[data-testid="get-info-button"]');

    // Verify network error handling
    await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-notification"]')).toContainText('Network error');
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large download history efficiently', async () => {
      // Mock large download history
      const largeDownloadList = Array.from({ length: 100 }, (_, i) => ({
        id: `dl-${i + 1}`,
        videoId: `video-${i + 1}`,
        title: `Video Title ${i + 1}`,
        url: `https://www.youtube.com/watch?v=video-${i + 1}`,
        status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'downloading' : 'failed',
        quality: ['360p', '720p', '1080p'][i % 3],
        format: 'mp4',
        progress: i % 3 === 0 ? 100 : i % 3 === 1 ? Math.floor(Math.random() * 100) : 0,
        fileSize: Math.floor(Math.random() * 50000000),
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      }));

      await page.route('**/api/v1/youtube/downloads**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloads: largeDownloadList,
            totalCount: largeDownloadList.length,
            activeCount: 33,
            completedCount: 34,
            failedCount: 33,
          }),
        });
      });

      const startTime = Date.now();
      await page.goto('/youtube/downloads');

      await expect(page.locator('[data-testid="download-item"]').first()).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Should implement pagination or virtualization
      const downloadItems = page.locator('[data-testid="download-item"]');
      const visibleCount = await downloadItems.count();

      expect(visibleCount).toBeLessThanOrEqual(50); // Pagination/virtualization

      // Verify pagination controls
      if (visibleCount === 50) {
        await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/youtube');

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-youtube-layout"]')).toBeVisible();

      // Test URL input on mobile
      await expect(page.locator('[data-testid="url-input"]')).toBeVisible();
      await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.click('[data-testid="get-info-button"]');

      // Verify mobile metadata display
      await expect(page.locator('[data-testid="mobile-video-info"]')).toBeVisible();

      // Test mobile format selection
      await expect(page.locator('[data-testid="mobile-format-selector"]')).toBeVisible();
      await page.click('[data-testid="mobile-format-dropdown"]');
      await expect(page.locator('[data-testid="mobile-format-menu"]')).toBeVisible();
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
