import { Page, Locator, expect } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Media Page Object for MediaNest media browsing and playback
 */
export class MediaPage extends BasePage {
  readonly mediaGrid: Locator;
  readonly mediaItems: Locator;
  readonly searchInput: Locator;
  readonly filterPanel: Locator;
  readonly sortDropdown: Locator;
  readonly viewModeToggle: Locator;
  readonly playerModal: Locator;
  readonly videoPlayer: Locator;
  readonly audioPlayer: Locator;
  readonly playButton: Locator;
  readonly pauseButton: Locator;
  readonly volumeSlider: Locator;
  readonly progressSlider: Locator;
  readonly fullscreenButton: Locator;
  readonly closePlayerButton: Locator;
  readonly uploadButton: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.mediaGrid = page.getByTestId('media-grid');
    this.mediaItems = page.getByTestId(/^media-item-/);
    this.searchInput = page.getByTestId('media-search');
    this.filterPanel = page.getByTestId('media-filters');
    this.sortDropdown = page.getByTestId('media-sort');
    this.viewModeToggle = page.getByTestId('view-mode-toggle');
    this.playerModal = page.getByTestId('media-player-modal');
    this.videoPlayer = page.getByTestId('video-player');
    this.audioPlayer = page.getByTestId('audio-player');
    this.playButton = page.getByTestId('play-button');
    this.pauseButton = page.getByTestId('pause-button');
    this.volumeSlider = page.getByTestId('volume-slider');
    this.progressSlider = page.getByTestId('progress-slider');
    this.fullscreenButton = page.getByTestId('fullscreen-button');
    this.closePlayerButton = page.getByTestId('close-player');
    this.uploadButton = page.getByTestId('upload-media');
    this.loadingSpinner = page.getByTestId('media-loading');
  }

  async goto() {
    await this.navigate('/media');
  }

  /**
   * Verify media page is loaded
   */
  async expectMediaPageLoaded() {
    await expect(this.mediaGrid).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  /**
   * Get all media items
   */
  async getMediaItems() {
    await this.waitForElementStable(this.mediaGrid);
    return await this.mediaItems.all();
  }

  /**
   * Get media item by ID
   */
  getMediaItem(itemId: string) {
    return this.page.getByTestId(`media-item-${itemId}`);
  }

  /**
   * Play media item
   */
  async playMediaItem(itemId: string) {
    const mediaItem = this.getMediaItem(itemId);

    await this.clickWithRetry(mediaItem);

    // Wait for player modal to open
    await expect(this.playerModal).toBeVisible();

    // Start playback
    await expect(this.playButton).toBeVisible();
    await this.clickWithRetry(this.playButton);

    // Verify playback started
    await expect(this.pauseButton).toBeVisible();
  }

  /**
   * Pause media playback
   */
  async pausePlayback() {
    await expect(this.pauseButton).toBeVisible();
    await this.clickWithRetry(this.pauseButton);

    // Verify playback paused
    await expect(this.playButton).toBeVisible();
  }

  /**
   * Control volume
   */
  async setVolume(level: number) {
    // level should be between 0 and 1
    const volumeControl = this.volumeSlider;

    await volumeControl.fill(level.toString());

    // Verify volume changed
    const currentVolume = await volumeControl.inputValue();
    expect(parseFloat(currentVolume)).toBeCloseTo(level, 1);
  }

  /**
   * Seek to specific time
   */
  async seekTo(position: number) {
    // position should be between 0 and 1 (percentage of total duration)
    const progressControl = this.progressSlider;

    await progressControl.fill(position.toString());

    // Verify position changed
    const currentPosition = await progressControl.inputValue();
    expect(parseFloat(currentPosition)).toBeCloseTo(position, 1);
  }

  /**
   * Toggle fullscreen
   */
  async toggleFullscreen() {
    await this.clickWithRetry(this.fullscreenButton);

    // Wait for fullscreen change
    await this.waitForAnimation();

    // Check if in fullscreen mode
    const isFullscreen = await this.executeScript(() => {
      return document.fullscreenElement !== null;
    });

    return isFullscreen;
  }

  /**
   * Close media player
   */
  async closePlayer() {
    await this.clickWithRetry(this.closePlayerButton);
    await expect(this.playerModal).toBeHidden();
  }

  /**
   * Search media
   */
  async searchMedia(query: string) {
    await this.fillField(this.searchInput, query);
    await this.searchInput.press('Enter');

    // Wait for search results
    await this.waitForAnimation();
    await this.waitForResponse('**/api/media/search**');
  }

  /**
   * Filter media by type
   */
  async filterByType(type: 'all' | 'video' | 'audio' | 'image') {
    const typeFilter = this.filterPanel.getByTestId(`filter-${type}`);
    await this.clickWithRetry(typeFilter);

    await this.waitForAnimation();
  }

  /**
   * Sort media
   */
  async sortMedia(sortBy: 'name' | 'date' | 'size' | 'duration') {
    await this.sortDropdown.selectOption(sortBy);
    await this.waitForAnimation();
  }

  /**
   * Change view mode (grid/list)
   */
  async toggleViewMode() {
    const currentMode = await this.viewModeToggle.getAttribute('data-mode');

    await this.clickWithRetry(this.viewModeToggle);
    await this.waitForAnimation();

    // Verify view mode changed
    const newMode = await this.viewModeToggle.getAttribute('data-mode');
    expect(newMode).not.toBe(currentMode);

    return newMode;
  }

  /**
   * Upload media file
   */
  async uploadMedia(filePath: string) {
    // Set up file chooser
    const fileChooserPromise = this.page.waitForEvent('filechooser');

    await this.clickWithRetry(this.uploadButton);

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    // Wait for upload to complete
    await this.waitForResponse('**/api/media/upload');

    // Verify upload success notification
    await expect(this.page.getByTestId('upload-success')).toBeVisible();
  }

  /**
   * Verify media playback quality
   */
  async verifyPlaybackQuality() {
    // Play a video item
    const firstVideo = this.mediaItems.first();
    await this.clickWithRetry(firstVideo);
    await expect(this.playerModal).toBeVisible();

    // Start playback
    await this.clickWithRetry(this.playButton);

    // Wait for video to load and start playing
    await this.page.waitForTimeout(2000);

    // Check if video is actually playing
    const isPlaying = await this.executeScript(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && !video.paused && video.currentTime > 0;
    });

    expect(isPlaying).toBeTruthy();

    // Check for playback errors
    const hasErrors = await this.executeScript(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && video.error !== null;
    });

    expect(hasErrors).toBeFalsy();
  }

  /**
   * Test video controls functionality
   */
  async testVideoControls() {
    // Assume video is already playing

    // Test pause/play
    await this.pausePlayback();
    await this.page.waitForTimeout(500);
    await this.clickWithRetry(this.playButton);

    // Test volume control
    await this.setVolume(0.5);
    await this.setVolume(0.8);

    // Test seeking
    await this.seekTo(0.3);
    await this.page.waitForTimeout(1000);
    await this.seekTo(0.6);

    // Test mute/unmute
    const muteButton = this.playerModal.getByTestId('mute-button');
    if (await muteButton.isVisible()) {
      await this.clickWithRetry(muteButton);
      await this.page.waitForTimeout(500);
      await this.clickWithRetry(muteButton);
    }
  }

  /**
   * Verify media metadata
   */
  async verifyMediaMetadata(
    itemId: string,
    expectedData: {
      title?: string;
      duration?: string;
      fileSize?: string;
      resolution?: string;
      format?: string;
    },
  ) {
    const mediaItem = this.getMediaItem(itemId);

    if (expectedData.title) {
      await expect(mediaItem.getByTestId('media-title')).toContainText(expectedData.title);
    }

    if (expectedData.duration) {
      await expect(mediaItem.getByTestId('media-duration')).toContainText(expectedData.duration);
    }

    if (expectedData.fileSize) {
      await expect(mediaItem.getByTestId('media-size')).toContainText(expectedData.fileSize);
    }

    if (expectedData.resolution) {
      await expect(mediaItem.getByTestId('media-resolution')).toContainText(
        expectedData.resolution,
      );
    }

    if (expectedData.format) {
      await expect(mediaItem.getByTestId('media-format')).toContainText(expectedData.format);
    }
  }

  /**
   * Test responsive media grid
   */
  async testResponsiveGrid() {
    // Desktop view - should show grid
    await this.page.setViewportSize({ width: 1280, height: 720 });
    await expect(this.mediaGrid).toHaveClass(/grid/);

    // Tablet view - should adapt grid
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.waitForAnimation();

    // Mobile view - should show list or smaller grid
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.waitForAnimation();

    // Restore desktop view
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  /**
   * Test keyboard navigation for accessibility
   */
  async testKeyboardNavigation() {
    // Focus first media item
    await this.mediaItems.first().focus();

    // Navigate with arrow keys
    await this.page.keyboard.press('ArrowRight');
    await this.page.keyboard.press('ArrowDown');

    // Press Enter to select/play
    await this.page.keyboard.press('Enter');
    await expect(this.playerModal).toBeVisible();

    // Test player keyboard controls
    await this.page.keyboard.press('Space'); // Play/pause
    await this.page.keyboard.press('ArrowLeft'); // Seek backward
    await this.page.keyboard.press('ArrowRight'); // Seek forward
    await this.page.keyboard.press('Escape'); // Close player

    await expect(this.playerModal).toBeHidden();
  }
}
