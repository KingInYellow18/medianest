import { test, expect } from '@playwright/test';
import { MediaPage } from '../pages/MediaPage';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Media Browsing and Playback E2E Tests for MediaNest
 * Tests media browsing, searching, filtering, and playback functionality
 */
test.describe('Media Browsing and Playback', () => {
  let mediaPage: MediaPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page, context }) => {
    mediaPage = new MediaPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Grant media permissions
    await context.grantPermissions(['camera', 'microphone']);
    
    // Start from dashboard and navigate to media
    await dashboardPage.goto();
    await dashboardPage.goToMedia();
    
    // Mock media API responses
    await page.route('**/api/media**', route => {
      const url = route.request().url();
      
      if (url.includes('/search')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            items: [
              {
                id: 'search-video-1',
                title: 'Search Result Video',
                type: 'video',
                duration: '05:30',
                thumbnail: '/api/thumbnails/search-video-1.jpg',
                url: '/api/media/search-video-1/stream'
              }
            ],
            total: 1
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            items: [
              {
                id: 'test-video-1',
                title: 'Test Video 1',
                type: 'video',
                duration: '10:45',
                fileSize: '256MB',
                resolution: '1920x1080',
                format: 'MP4',
                thumbnail: '/api/thumbnails/test-video-1.jpg',
                url: '/api/media/test-video-1/stream'
              },
              {
                id: 'test-audio-1',
                title: 'Test Audio 1',
                type: 'audio',
                duration: '03:22',
                fileSize: '8.5MB',
                format: 'MP3',
                url: '/api/media/test-audio-1/stream'
              },
              {
                id: 'test-image-1',
                title: 'Test Image 1',
                type: 'image',
                fileSize: '2.1MB',
                resolution: '1920x1080',
                format: 'JPEG',
                url: '/api/media/test-image-1'
              }
            ],
            total: 3
          }),
        });
      }
    });
  });

  test('should display media grid correctly', async ({ page }) => {
    await mediaPage.expectMediaPageLoaded();
    
    // Verify media grid loads
    await expect(mediaPage.mediaGrid).toBeVisible();
    
    // Get all media items
    const mediaItems = await mediaPage.getMediaItems();
    expect(mediaItems.length).toBe(3);
    
    // Verify each media item has required elements
    for (const item of mediaItems) {
      await expect(item.getByTestId('media-title')).toBeVisible();
      await expect(item.getByTestId('media-thumbnail')).toBeVisible();
    }
  });

  test('should play video with full controls', async ({ page }) => {
    // Mock video element behavior
    await page.addScriptTag({
      content: `
        // Mock HTML5 video element
        HTMLVideoElement.prototype.play = function() {
          this.paused = false;
          this.currentTime = 0.1;
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        };
        
        HTMLVideoElement.prototype.pause = function() {
          this.paused = true;
          this.dispatchEvent(new Event('pause'));
        };
      `
    });
    
    // Play a video
    await mediaPage.playMediaItem('test-video-1');
    
    // Verify player modal opened
    await expect(mediaPage.playerModal).toBeVisible();
    await expect(mediaPage.videoPlayer).toBeVisible();
    
    // Test video controls
    await mediaPage.testVideoControls();
    
    // Test seeking
    await mediaPage.seekTo(0.5);
    
    // Test volume control
    await mediaPage.setVolume(0.7);
    
    // Close player
    await mediaPage.closePlayer();
    await expect(mediaPage.playerModal).toBeHidden();
  });

  test('should play audio content', async ({ page }) => {
    // Mock audio element behavior
    await page.addScriptTag({
      content: `
        HTMLAudioElement.prototype.play = function() {
          this.paused = false;
          this.currentTime = 0.1;
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        };
        
        HTMLAudioElement.prototype.pause = function() {
          this.paused = true;
          this.dispatchEvent(new Event('pause'));
        };
      `
    });
    
    // Play an audio file
    await mediaPage.playMediaItem('test-audio-1');
    
    // Verify audio player opened
    await expect(mediaPage.playerModal).toBeVisible();
    await expect(mediaPage.audioPlayer).toBeVisible();
    
    // Test playback controls
    await expect(mediaPage.pauseButton).toBeVisible();
    await mediaPage.pausePlayback();
    await expect(mediaPage.playButton).toBeVisible();
    
    // Test volume control
    await mediaPage.setVolume(0.6);
    
    // Close player
    await mediaPage.closePlayer();
  });

  test('should search media content', async ({ page }) => {
    // Perform search
    await mediaPage.searchMedia('Search Result');
    
    // Verify search results
    const mediaItems = await mediaPage.getMediaItems();
    expect(mediaItems.length).toBe(1);
    
    // Verify search result content
    await mediaPage.verifyMediaMetadata('search-video-1', {
      title: 'Search Result Video',
      duration: '05:30'
    });
  });

  test('should filter media by type', async ({ page }) => {
    // Filter by video
    await mediaPage.filterByType('video');
    await page.waitForTimeout(500);
    
    // Verify only videos are shown
    const videoItems = await mediaPage.getMediaItems();
    for (const item of videoItems) {
      const mediaType = await item.getAttribute('data-media-type');
      expect(mediaType).toBe('video');
    }
    
    // Filter by audio
    await mediaPage.filterByType('audio');
    await page.waitForTimeout(500);
    
    // Verify only audio items are shown
    const audioItems = await mediaPage.getMediaItems();
    for (const item of audioItems) {
      const mediaType = await item.getAttribute('data-media-type');
      expect(mediaType).toBe('audio');
    }
    
    // Reset filter
    await mediaPage.filterByType('all');
  });

  test('should sort media correctly', async ({ page }) => {
    // Sort by name
    await mediaPage.sortMedia('name');
    await page.waitForTimeout(500);
    
    // Verify sort order
    const mediaItems = await mediaPage.getMediaItems();
    const titles: string[] = [];
    
    for (const item of mediaItems) {
      const title = await item.getByTestId('media-title').textContent();
      if (title) titles.push(title);
    }
    
    const sortedTitles = [...titles].sort();
    expect(titles).toEqual(sortedTitles);
  });

  test('should toggle view modes', async ({ page }) => {
    // Test view mode toggle
    const newMode = await mediaPage.toggleViewMode();
    
    // Verify view mode changed
    expect(newMode).toBeTruthy();
    
    // Grid should adapt to new view mode
    await expect(mediaPage.mediaGrid).toBeVisible();
  });

  test('should handle fullscreen mode', async ({ page }) => {
    // Play a video
    await mediaPage.playMediaItem('test-video-1');
    
    // Mock fullscreen API
    await page.evaluate(() => {
      let isFullscreen = false;
      
      Document.prototype.exitFullscreen = function() {
        isFullscreen = false;
        Object.defineProperty(document, 'fullscreenElement', {
          value: null,
          writable: true
        });
        return Promise.resolve();
      };
      
      Element.prototype.requestFullscreen = function() {
        isFullscreen = true;
        Object.defineProperty(document, 'fullscreenElement', {
          value: this,
          writable: true
        });
        return Promise.resolve();
      };
    });
    
    // Toggle fullscreen
    const isFullscreen = await mediaPage.toggleFullscreen();
    expect(isFullscreen).toBe(true);
    
    // Exit fullscreen
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('should verify media metadata', async ({ page }) => {
    // Verify video metadata
    await mediaPage.verifyMediaMetadata('test-video-1', {
      title: 'Test Video 1',
      duration: '10:45',
      fileSize: '256MB',
      resolution: '1920x1080',
      format: 'MP4'
    });
    
    // Verify audio metadata
    await mediaPage.verifyMediaMetadata('test-audio-1', {
      title: 'Test Audio 1',
      duration: '03:22',
      fileSize: '8.5MB',
      format: 'MP3'
    });
  });

  test('should be responsive', async ({ page }) => {
    // Test responsive grid
    await mediaPage.testResponsiveGrid();
    
    // Verify media items adapt to screen size
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(mediaPage.mediaGrid).toBeVisible();
    
    // Mobile should show different layout
    const gridColumns = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="media-grid"]');
      return grid ? window.getComputedStyle(grid).gridTemplateColumns : null;
    });
    
    expect(gridColumns).toBeTruthy();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test keyboard navigation
    await mediaPage.testKeyboardNavigation();
    
    // Verify accessibility
    const firstMedia = await mediaPage.mediaItems.first();
    await expect(firstMedia).toBeFocused();
  });

  test('should handle upload functionality', async ({ page }) => {
    // Mock file upload API
    await page.route('**/api/media/upload', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          id: 'uploaded-file-1',
          message: 'File uploaded successfully'
        }),
      });
    });
    
    // Test file upload (mock file)
    const testFilePath = 'e2e/fixtures/test-video.mp4';
    
    // Create a mock file for testing
    await page.evaluate(() => {
      // Mock FileList for testing
      const mockFile = new File(['test video content'], 'test-video.mp4', {
        type: 'video/mp4'
      });
      
      // Store mock file for later use
      (window as any).mockTestFile = mockFile;
    });
    
    // Click upload button
    await mediaPage.uploadButton.click();
    
    // Verify upload interface appears
    await expect(page.getByTestId('upload-modal')).toBeVisible();
  });

  test('should handle playback errors gracefully', async ({ page }) => {
    // Mock video with error
    await page.addScriptTag({
      content: `
        HTMLVideoElement.prototype.play = function() {
          const error = new Error('Video playback failed');
          this.error = { code: 4, message: 'Video playback failed' };
          this.dispatchEvent(new Event('error'));
          return Promise.reject(error);
        };
      `
    });
    
    // Try to play video
    await mediaPage.playMediaItem('test-video-1');
    
    // Verify error message is shown
    await expect(page.getByTestId('playback-error')).toBeVisible();
    await expect(page.getByText('Video playback failed')).toBeVisible();
  });

  test('should load media thumbnails', async ({ page }) => {
    // Mock thumbnail API
    await page.route('**/api/thumbnails/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // Minimal JPEG header
      });
    });
    
    // Verify thumbnails are loaded
    const mediaItems = await mediaPage.getMediaItems();
    for (const item of mediaItems) {
      const thumbnail = item.getByTestId('media-thumbnail');
      if (await thumbnail.isVisible()) {
        await expect(thumbnail).toHaveAttribute('src');
      }
    }
  });

  test('should support media playlists', async ({ page }) => {
    // Mock playlist functionality
    await page.route('**/api/playlists', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'test-playlist-1',
          name: 'Test Playlist',
          items: ['test-video-1', 'test-audio-1'],
          created: new Date().toISOString()
        }),
      });
    });
    
    // Test playlist creation
    const createPlaylistBtn = page.getByTestId('create-playlist');
    if (await createPlaylistBtn.isVisible()) {
      await createPlaylistBtn.click();
      
      // Fill playlist details
      await page.fill('[data-testid="playlist-name"]', 'My Test Playlist');
      await page.click('[data-testid="save-playlist"]');
      
      // Verify playlist was created
      await expect(page.getByText('Playlist created successfully')).toBeVisible();
    }
  });

  test('should handle media streaming', async ({ page }) => {
    // Mock streaming endpoints
    await page.route('**/api/media/*/stream', route => {
      route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from('mock video stream data'),
      });
    });
    
    // Play streaming media
    await mediaPage.playMediaItem('test-video-1');
    
    // Verify streaming started
    await expect(mediaPage.videoPlayer).toBeVisible();
    await expect(mediaPage.playButton).toBeVisible();
    
    // Test streaming quality indicators
    const qualityIndicator = page.getByTestId('quality-indicator');
    if (await qualityIndicator.isVisible()) {
      await expect(qualityIndicator).toContainText(/\d+p/);
    }
  });
});