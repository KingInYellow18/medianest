import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';

/**
 * E2E Tests for YouTube Download Functionality
 * 
 * Tests cover:
 * - URL validation and parsing
 * - Download queue management
 * - Progress monitoring
 * - Download history
 * - Cancel/retry operations
 * - Format selection
 * - Metadata extraction
 * - Error handling
 * - Performance metrics
 * - Mobile responsiveness
 * - Accessibility
 */

test.describe('YouTube Download E2E Tests', () => {
  let authHelper: AuthHelper;
  let context: BrowserContext;
  let page: Page;

  // Test data
  const validYouTubeUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw&amp;t=1m30s'
  ];

  const invalidUrls = [
    'https://www.google.com',
    'not-a-url',
    'https://www.youtube.com/watch?v=invalidvideoID123',
    'https://vimeo.com/123456789'
  ];

  const mockVideoMetadata = {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    channel: 'Rick Astley',
    duration: '3:32',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    description: 'The official video for "Never Gonna Give You Up" by Rick Astley',
    uploadDate: '2009-10-25',
    viewCount: 1500000000,
    availableQualities: ['144p', '240p', '360p', '480p', '720p', '1080p']
  };

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    authHelper = new AuthHelper(page);

    // Mock YouTube API responses
    await page.route('**/api/v1/youtube/metadata**', async (route) => {
      const url = new URL(route.request().url());
      const videoUrl = url.searchParams.get('url');
      
      if (validYouTubeUrls.some(validUrl => videoUrl?.includes(validUrl.split('v=')[1]))) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockVideoMetadata)
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid YouTube URL or video not found' })
        });
      }
    });

    // Mock download creation endpoint
    await page.route('**/api/v1/youtube/download', async (route) => {
      if (route.request().method() === 'POST') {
        const data = await route.request().postDataJSON();
        
        if (validYouTubeUrls.some(validUrl => data.url?.includes(validUrl.split('v=')[1]))) {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'download-123',
              videoId: mockVideoMetadata.id,
              title: mockVideoMetadata.title,
              channel: mockVideoMetadata.channel,
              duration: mockVideoMetadata.duration,
              thumbnail: mockVideoMetadata.thumbnail,
              status: 'queued',
              progress: 0,
              jobId: 'job-123',
              quality: data.quality || '1080p',
              format: data.format || 'mp4',
              userId: 'user-123',
              createdAt: new Date().toISOString()
            })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid YouTube URL' })
          });
        }
      }
    });

    // Mock download list endpoint
    await page.route('**/api/v1/youtube/downloads**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloads: [
              {
                id: 'download-123',
                url: validYouTubeUrls[0],
                title: mockVideoMetadata.title,
                status: 'completed',
                progress: 100,
                filePaths: ['/downloads/video.mp4'],
                fileSize: 52428800,
                quality: '1080p',
                format: 'mp4',
                error: null,
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString()
              }
            ],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1
          })
        });
      }
    });

    // Login before each test
    await authHelper.quickLogin();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('URL Validation and Parsing', () => {
    test('should validate YouTube URLs correctly', async () => {
      await page.goto('/youtube');
      
      const urlInput = page.locator('[data-testid="youtube-url-input"]');
      const submitButton = page.locator('[data-testid="submit-download"]');

      // Test valid URLs
      for (const validUrl of validYouTubeUrls) {
        await urlInput.fill(validUrl);
        await expect(urlInput).toHaveValue(validUrl);
        
        // URL should be parsed and metadata fetched
        await expect(page.locator('[data-testid="video-preview"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="video-title"]')).toContainText(mockVideoMetadata.title);
        await expect(submitButton).toBeEnabled();
        
        await urlInput.clear();
      }
    });

    test('should reject invalid URLs', async () => {
      await page.goto('/youtube');
      
      const urlInput = page.locator('[data-testid="youtube-url-input"]');
      const submitButton = page.locator('[data-testid="submit-download"]');
      const errorMessage = page.locator('[data-testid="url-error"]');

      // Test invalid URLs
      for (const invalidUrl of invalidUrls) {
        await urlInput.fill(invalidUrl);
        await submitButton.click();
        
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid/i);
        await expect(submitButton).toBeDisabled();
        
        await urlInput.clear();
      }
    });

    test('should extract video metadata correctly', async () => {
      await page.goto('/youtube');
      
      const urlInput = page.locator('[data-testid="youtube-url-input"]');
      await urlInput.fill(validYouTubeUrls[0]);

      // Wait for metadata to be fetched
      await expect(page.locator('[data-testid="video-preview"]')).toBeVisible();
      
      // Verify metadata display
      await expect(page.locator('[data-testid="video-title"]')).toContainText(mockVideoMetadata.title);
      await expect(page.locator('[data-testid="video-channel"]')).toContainText(mockVideoMetadata.channel);
      await expect(page.locator('[data-testid="video-duration"]')).toContainText(mockVideoMetadata.duration);
      await expect(page.locator('[data-testid="video-thumbnail"]')).toBeVisible();
    });
  });

  test.describe('Download Queue Management', () => {
    test('should add video to download queue', async () => {
      await page.goto('/youtube');
      
      // Fill URL and submit
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Verify download was added to queue
      await expect(page.locator('[data-testid="download-success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-queue"]')).toContainText(mockVideoMetadata.title);
    });

    test('should show download in queue with correct status', async () => {
      await page.goto('/youtube');
      
      // Add download
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Check queue item
      const queueItem = page.locator('[data-testid="queue-item-download-123"]');
      await expect(queueItem).toBeVisible();
      await expect(queueItem.locator('[data-testid="download-status"]')).toContainText('queued');
      await expect(queueItem.locator('[data-testid="download-progress"]')).toContainText('0%');
    });

    test('should prevent duplicate downloads', async () => {
      await page.goto('/youtube');
      
      // Add first download
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Try to add same video again
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Should show duplicate error
      await expect(page.locator('[data-testid="duplicate-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="duplicate-error"]')).toContainText(/already downloading/i);
    });
  });

  test.describe('Format Selection', () => {
    test('should allow quality selection', async () => {
      await page.goto('/youtube');
      
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      
      // Wait for metadata and quality options
      await expect(page.locator('[data-testid="quality-selector"]')).toBeVisible();
      
      // Test different quality options
      const qualities = ['720p', '1080p', '480p'];
      
      for (const quality of qualities) {
        await page.selectOption('[data-testid="quality-selector"]', quality);
        const selectedValue = await page.locator('[data-testid="quality-selector"]').inputValue();
        expect(selectedValue).toBe(quality);
      }
    });

    test('should allow format selection', async () => {
      await page.goto('/youtube');
      
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      
      // Wait for format options
      await expect(page.locator('[data-testid="format-selector"]')).toBeVisible();
      
      // Test different format options
      const formats = ['mp4', 'webm', 'mp3'];
      
      for (const format of formats) {
        await page.selectOption('[data-testid="format-selector"]', format);
        const selectedValue = await page.locator('[data-testid="format-selector"]').inputValue();
        expect(selectedValue).toBe(format);
      }
    });
  });

  test.describe('Download Progress Monitoring', () => {
    test('should show real-time download progress', async () => {
      await page.goto('/youtube');
      
      // Mock progressive updates
      const progressSteps = [0, 25, 50, 75, 100];
      let currentStep = 0;
      
      await page.route('**/api/v1/youtube/downloads/download-123', async (route) => {
        const progress = progressSteps[currentStep % progressSteps.length];
        const status = progress === 100 ? 'completed' : 'downloading';
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'download-123',
            status,
            progress,
            title: mockVideoMetadata.title
          })
        });
        
        currentStep++;
      });
      
      // Start download
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Monitor progress updates
      const progressBar = page.locator('[data-testid="download-progress-bar"]');
      const progressText = page.locator('[data-testid="download-progress-text"]');
      
      await expect(progressBar).toBeVisible();
      await expect(progressText).toContainText(/\d+%/);
    });

    test('should update download status correctly', async () => {
      await page.goto('/youtube');
      
      // Start download
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      const statusBadge = page.locator('[data-testid="download-status-badge"]');
      
      // Should start as queued
      await expect(statusBadge).toContainText('queued');
      
      // Should update to downloading (mocked progression)
      await page.waitForTimeout(1000);
      // Note: In real implementation, this would be updated via WebSocket
    });
  });

  test.describe('Download History', () => {
    test('should display download history', async () => {
      await page.goto('/youtube/history');
      
      // Should show previous downloads
      await expect(page.locator('[data-testid="download-history-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="history-item"]')).toHaveCount(1);
      
      // Verify history item details
      const historyItem = page.locator('[data-testid="history-item"]').first();
      await expect(historyItem.locator('[data-testid="item-title"]')).toContainText(mockVideoMetadata.title);
      await expect(historyItem.locator('[data-testid="item-status"]')).toContainText('completed');
      await expect(historyItem.locator('[data-testid="item-quality"]')).toContainText('1080p');
    });

    test('should filter download history', async () => {
      await page.goto('/youtube/history');
      
      // Test status filter
      await page.selectOption('[data-testid="status-filter"]', 'completed');
      await expect(page.locator('[data-testid="history-item"]')).toHaveCount(1);
      
      await page.selectOption('[data-testid="status-filter"]', 'failed');
      await expect(page.locator('[data-testid="history-item"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
    });

    test('should paginate download history', async () => {
      await page.goto('/youtube/history');
      
      // Check pagination controls
      const pagination = page.locator('[data-testid="pagination"]');
      await expect(pagination).toBeVisible();
      
      // Should show current page info
      await expect(page.locator('[data-testid="page-info"]')).toContainText('1 of 1');
    });
  });

  test.describe('Cancel and Retry Operations', () => {
    test('should cancel pending download', async () => {
      await page.goto('/youtube');
      
      // Start download
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Cancel download
      const cancelButton = page.locator('[data-testid="cancel-download-123"]');
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();
      
      // Confirm cancellation
      await page.locator('[data-testid="confirm-cancel"]').click();
      
      // Verify cancellation
      await expect(page.locator('[data-testid="download-status-badge"]')).toContainText('cancelled');
    });

    test('should retry failed download', async () => {
      // Mock failed download
      await page.route('**/api/v1/youtube/downloads', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              downloads: [{
                id: 'download-456',
                title: 'Failed Download',
                status: 'failed',
                error: 'Network timeout'
              }]
            })
          });
        }
      });
      
      await page.goto('/youtube/history');
      
      // Click retry button
      const retryButton = page.locator('[data-testid="retry-download-456"]');
      await expect(retryButton).toBeVisible();
      await retryButton.click();
      
      // Verify retry confirmation
      await expect(page.locator('[data-testid="retry-success"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle rate limit exceeded', async () => {
      // Mock rate limit response
      await page.route('**/api/v1/youtube/download', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Download rate limit exceeded',
            limit: 5,
            window: '1 hour',
            retryAfter: 3600
          })
        });
      });
      
      await page.goto('/youtube');
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Should show rate limit error
      await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText(/rate limit exceeded/i);
      await expect(page.locator('[data-testid="retry-after"]')).toContainText('1 hour');
    });

    test('should handle network errors gracefully', async () => {
      // Mock network failure
      await page.route('**/api/v1/youtube/metadata**', async (route) => {
        await route.abort('failed');
      });
      
      await page.goto('/youtube');
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      
      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-error"]')).toContainText(/network error/i);
    });

    test('should handle server errors', async () => {
      // Mock server error
      await page.route('**/api/v1/youtube/download', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      await page.goto('/youtube');
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Should show server error
      await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="server-error"]')).toContainText(/server error/i);
    });
  });

  test.describe('Performance Testing', () => {
    test('should load YouTube page within performance budget', async () => {
      const startTime = Date.now();
      await page.goto('/youtube');
      
      // Wait for page to be interactive
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large download lists efficiently', async () => {
      // Mock large dataset
      const largeDownloadList = Array.from({ length: 100 }, (_, i) => ({
        id: `download-${i}`,
        title: `Video ${i}`,
        status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'downloading' : 'failed',
        progress: Math.floor(Math.random() * 100)
      }));
      
      await page.route('**/api/v1/youtube/downloads', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloads: largeDownloadList,
            total: 100
          })
        });
      });
      
      const startTime = Date.now();
      await page.goto('/youtube/history');
      await page.waitForLoadState('networkidle');
      const renderTime = Date.now() - startTime;
      
      // Should render within 2 seconds even with large dataset
      expect(renderTime).toBeLessThan(2000);
      
      // Should show all items
      await expect(page.locator('[data-testid="history-item"]')).toHaveCount(100);
    });
  });

  test.describe('Accessibility Testing', () => {
    test('should be navigable by keyboard', async () => {
      await page.goto('/youtube');
      
      // Test tab navigation
      await page.keyboard.press('Tab'); // URL input
      await expect(page.locator('[data-testid="youtube-url-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Quality selector
      await expect(page.locator('[data-testid="quality-selector"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Format selector
      await expect(page.locator('[data-testid="format-selector"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Submit button
      await expect(page.locator('[data-testid="submit-download"]')).toBeFocused();
    });

    test('should have proper ARIA labels', async () => {
      await page.goto('/youtube');
      
      // Check ARIA labels
      await expect(page.locator('[data-testid="youtube-url-input"]')).toHaveAttribute('aria-label', /youtube url/i);
      await expect(page.locator('[data-testid="quality-selector"]')).toHaveAttribute('aria-label', /quality/i);
      await expect(page.locator('[data-testid="submit-download"]')).toHaveAttribute('aria-label', /download/i);
      
      // Check form accessibility
      await expect(page.locator('form')).toHaveAttribute('aria-labelledby');
    });

    test('should announce status changes to screen readers', async () => {
      await page.goto('/youtube');
      
      // Fill URL and submit
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.click('[data-testid="submit-download"]');
      
      // Check for live region updates
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await expect(page.locator('[aria-live="polite"]')).toContainText(/added to queue/i);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/youtube');
      
      // Elements should be visible and usable
      await expect(page.locator('[data-testid="youtube-url-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-download"]')).toBeVisible();
      
      // Test mobile interaction
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await page.tap('[data-testid="submit-download"]');
      
      await expect(page.locator('[data-testid="download-success-message"]')).toBeVisible();
    });

    test('should have touch-friendly button sizes', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/youtube');
      
      // Buttons should meet minimum touch target size (44px)
      const submitButton = page.locator('[data-testid="submit-download"]');
      const buttonSize = await submitButton.boundingBox();
      
      expect(buttonSize!.height).toBeGreaterThanOrEqual(44);
      expect(buttonSize!.width).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    // These tests would run across different browser projects in playwright.config.ts
    test('should work consistently across browsers', async () => {
      await page.goto('/youtube');
      
      // Basic functionality should work the same
      await page.fill('[data-testid="youtube-url-input"]', validYouTubeUrls[0]);
      await expect(page.locator('[data-testid="video-preview"]')).toBeVisible();
      
      await page.click('[data-testid="submit-download"]');
      await expect(page.locator('[data-testid="download-success-message"]')).toBeVisible();
    });
  });
});