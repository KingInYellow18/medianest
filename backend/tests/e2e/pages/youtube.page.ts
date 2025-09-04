import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class YouTubePage extends BasePage {
  // Selectors
  private readonly selectors = {
    // YouTube URL input and validation
    youtubeUrlInput: '[data-testid="youtube-url-input"]',
    validateUrlButton: '[data-testid="validate-url-button"]',
    urlValidationStatus: '[data-testid="url-validation-status"]',
    
    // Video preview
    videoPreview: '[data-testid="video-preview"]',
    videoThumbnail: '[data-testid="video-thumbnail"]',
    videoTitle: '[data-testid="video-title"]',
    videoDuration: '[data-testid="video-duration"]',
    videoDescription: '[data-testid="video-description"]',
    channelName: '[data-testid="channel-name"]',
    
    // Download options
    downloadOptionsSection: '[data-testid="download-options-section"]',
    qualitySelect: '[data-testid="quality-select"]',
    formatSelect: '[data-testid="format-select"]',
    audioOnlyCheckbox: '[data-testid="audio-only-checkbox"]',
    
    // Time range selection
    timeRangeSection: '[data-testid="time-range-section"]',
    startTimeInput: '[data-testid="start-time-input"]',
    endTimeInput: '[data-testid="end-time-input"]',
    fullVideoCheckbox: '[data-testid="full-video-checkbox"]',
    previewTimeRange: '[data-testid="preview-time-range"]',
    
    // Advanced options
    advancedOptionsToggle: '[data-testid="advanced-options-toggle"]',
    advancedOptionsPanel: '[data-testid="advanced-options-panel"]',
    subtitlesCheckbox: '[data-testid="subtitles-checkbox"]',
    subtitlesLanguageSelect: '[data-testid="subtitles-language-select"]',
    thumbnailCheckbox: '[data-testid="thumbnail-checkbox"]',
    metadataCheckbox: '[data-testid="metadata-checkbox"]',
    
    // Download actions
    downloadButton: '[data-testid="download-button"]',
    addToQueueButton: '[data-testid="add-to-queue-button"]',
    
    // Progress and status
    downloadProgress: '[data-testid="download-progress"]',
    progressBar: '[data-testid="progress-bar"]',
    progressPercentage: '[data-testid="progress-percentage"]',
    downloadStatus: '[data-testid="download-status"]',
    estimatedTimeRemaining: '[data-testid="estimated-time-remaining"]',
    
    // Download history/queue
    downloadQueue: '[data-testid="download-queue"]',
    queueItem: '[data-testid="queue-item"]',
    downloadHistory: '[data-testid="download-history"]',
    historyItem: '[data-testid="history-item"]',
    
    // Error handling
    errorMessage: '[data-testid="error-message"]',
    warningMessage: '[data-testid="warning-message"]',
    
    // Common elements
    loadingSpinner: '[data-testid="loading-spinner"]',
    cancelButton: '[data-testid="cancel-button"]',
    retryButton: '[data-testid="retry-button"]'
  };
}

// Type definitions
interface YouTubeDownloadOptions {
    quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p' | 'best';
    format: 'mp4' | 'webm' | 'mkv' | 'flv' | 'avi';
    audioOnly?: boolean;
    startTime?: string;
    endTime?: string;
    includeSubtitles?: boolean;
    subtitlesLanguage?: string;
    includeThumbnail?: boolean;
    includeMetadata?: boolean;
  }

  interface VideoInfo {
    title: string;
    duration: string;
    description: string;
    channelName: string;
    thumbnailUrl: string;
  }

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to YouTube download page
   */
  async navigate(): Promise<void> {
    await this.goto('/youtube');
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.youtubeUrlInput);
  }

  /**
   * Enter YouTube URL
   */
  async enterUrl(url: string): Promise<void> {
    await this.fillInput(this.selectors.youtubeUrlInput, url);
  }

  /**
   * Validate YouTube URL
   */
  async validateUrl(): Promise<boolean> {
    await this.clickElement(this.selectors.validateUrlButton);
    
    // Wait for validation to complete
    await this.waitForElement(this.selectors.urlValidationStatus);
    
    const status = await this.getTextContent(this.selectors.urlValidationStatus);
    return status.toLowerCase().includes('valid');
  }

  /**
   * Enter URL and validate
   */
  async enterAndValidateUrl(url: string): Promise<boolean> {
    await this.enterUrl(url);
    return await this.validateUrl();
  }

  /**
   * Get video information after URL validation
   */
  async getVideoInfo(): Promise<VideoInfo> {
    await this.waitForElement(this.selectors.videoPreview);
    
    return {
      title: await this.getTextContent(this.selectors.videoTitle),
      duration: await this.getTextContent(this.selectors.videoDuration),
      description: await this.getTextContent(this.selectors.videoDescription),
      channelName: await this.getTextContent(this.selectors.channelName),
      thumbnailUrl: await this.getAttributeValue(this.selectors.videoThumbnail, 'src') || ''
    };
  }

  /**
   * Set download quality
   */
  async setQuality(quality: string): Promise<void> {
    await this.waitForElement(this.selectors.qualitySelect);
    await this.selectOption(this.selectors.qualitySelect, quality);
  }

  /**
   * Set download format
   */
  async setFormat(format: string): Promise<void> {
    await this.waitForElement(this.selectors.formatSelect);
    await this.selectOption(this.selectors.formatSelect, format);
  }

  /**
   * Toggle audio-only download
   */
  async toggleAudioOnly(enable: boolean = true): Promise<void> {
    const checkbox = await this.waitForElement(this.selectors.audioOnlyCheckbox);
    const isChecked = await this.isElementChecked(this.selectors.audioOnlyCheckbox);
    
    if ((enable && !isChecked) || (!enable && isChecked)) {
      await checkbox.click();
    }
  }

  /**
   * Set time range for download
   */
  async setTimeRange(startTime?: string, endTime?: string): Promise<void> {
    if (startTime || endTime) {
      // Uncheck full video if setting custom time range
      const fullVideoChecked = await this.isElementChecked(this.selectors.fullVideoCheckbox);
      if (fullVideoChecked) {
        await this.clickElement(this.selectors.fullVideoCheckbox);
      }
      
      if (startTime) {
        await this.fillInput(this.selectors.startTimeInput, startTime);
      }
      
      if (endTime) {
        await this.fillInput(this.selectors.endTimeInput, endTime);
      }
    } else {
      // Check full video checkbox
      const fullVideoChecked = await this.isElementChecked(this.selectors.fullVideoCheckbox);
      if (!fullVideoChecked) {
        await this.clickElement(this.selectors.fullVideoCheckbox);
      }
    }
  }

  /**
   * Toggle advanced options panel
   */
  async toggleAdvancedOptions(): Promise<void> {
    await this.clickElement(this.selectors.advancedOptionsToggle);
    await this.waitForElement(this.selectors.advancedOptionsPanel);
  }

  /**
   * Configure subtitles options
   */
  async configureSubtitles(include: boolean, language?: string): Promise<void> {
    if (!(await this.isElementVisible(this.selectors.advancedOptionsPanel))) {
      await this.toggleAdvancedOptions();
    }
    
    const subtitlesChecked = await this.isElementChecked(this.selectors.subtitlesCheckbox);
    if ((include && !subtitlesChecked) || (!include && subtitlesChecked)) {
      await this.clickElement(this.selectors.subtitlesCheckbox);
    }
    
    if (include && language) {
      await this.selectOption(this.selectors.subtitlesLanguageSelect, language);
    }
  }

  /**
   * Toggle thumbnail download
   */
  async toggleThumbnail(include: boolean): Promise<void> {
    if (!(await this.isElementVisible(this.selectors.advancedOptionsPanel))) {
      await this.toggleAdvancedOptions();
    }
    
    const thumbnailChecked = await this.isElementChecked(this.selectors.thumbnailCheckbox);
    if ((include && !thumbnailChecked) || (!include && thumbnailChecked)) {
      await this.clickElement(this.selectors.thumbnailCheckbox);
    }
  }

  /**
   * Toggle metadata download
   */
  async toggleMetadata(include: boolean): Promise<void> {
    if (!(await this.isElementVisible(this.selectors.advancedOptionsPanel))) {
      await this.toggleAdvancedOptions();
    }
    
    const metadataChecked = await this.isElementChecked(this.selectors.metadataCheckbox);
    if ((include && !metadataChecked) || (!include && metadataChecked)) {
      await this.clickElement(this.selectors.metadataCheckbox);
    }
  }

  /**
   * Configure all download options
   */
  async configureDownloadOptions(options: YouTubeDownloadOptions): Promise<void> {
    await this.setQuality(options.quality);
    await this.setFormat(options.format);
    
    if (options.audioOnly) {
      await this.toggleAudioOnly(options.audioOnly);
    }
    
    if (options.startTime || options.endTime) {
      await this.setTimeRange(options.startTime, options.endTime);
    }
    
    if (options.includeSubtitles !== undefined || options.includeThumbnail !== undefined || options.includeMetadata !== undefined) {
      await this.toggleAdvancedOptions();
      
      if (options.includeSubtitles !== undefined) {
        await this.configureSubtitles(options.includeSubtitles, options.subtitlesLanguage);
      }
      
      if (options.includeThumbnail !== undefined) {
        await this.toggleThumbnail(options.includeThumbnail);
      }
      
      if (options.includeMetadata !== undefined) {
        await this.toggleMetadata(options.includeMetadata);
      }
    }
  }

  /**
   * Start download
   */
  async startDownload(): Promise<void> {
    await this.clickElement(this.selectors.downloadButton);
    
    // Wait for download to start
    await this.waitForElement(this.selectors.downloadProgress);
  }

  /**
   * Add to download queue
   */
  async addToQueue(): Promise<void> {
    await this.clickElement(this.selectors.addToQueueButton);
  }

  /**
   * Get download progress
   */
  async getDownloadProgress(): Promise<{ percentage: number; status: string; timeRemaining?: string }> {
    await this.waitForElement(this.selectors.downloadProgress);
    
    const percentageText = await this.getTextContent(this.selectors.progressPercentage);
    const status = await this.getTextContent(this.selectors.downloadStatus);
    
    let timeRemaining;
    if (await this.isElementVisible(this.selectors.estimatedTimeRemaining)) {
      timeRemaining = await this.getTextContent(this.selectors.estimatedTimeRemaining);
    }
    
    return {
      percentage: parseInt(percentageText.replace('%', '')) || 0,
      status: status.trim(),
      timeRemaining
    };
  }

  /**
   * Wait for download to complete
   */
  async waitForDownloadComplete(timeout: number = 300000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const progress = await this.getDownloadProgress();
      
      if (progress.percentage >= 100 || progress.status.toLowerCase().includes('completed')) {
        return;
      }
      
      if (progress.status.toLowerCase().includes('failed') || progress.status.toLowerCase().includes('error')) {
        throw new Error(`Download failed with status: ${progress.status}`);
      }
      
      await this.page.waitForTimeout(2000);
    }
    
    throw new Error(`Download did not complete within ${timeout}ms`);
  }

  /**
   * Cancel current download
   */
  async cancelDownload(): Promise<void> {
    if (await this.isElementVisible(this.selectors.cancelButton)) {
      await this.clickElement(this.selectors.cancelButton);
    }
  }

  /**
   * Retry failed download
   */
  async retryDownload(): Promise<void> {
    if (await this.isElementVisible(this.selectors.retryButton)) {
      await this.clickElement(this.selectors.retryButton);
    }
  }

  /**
   * Get download queue items
   */
  async getQueueItems(): Promise<string[]> {
    if (!(await this.isElementVisible(this.selectors.downloadQueue))) {
      return [];
    }
    
    const items = await this.page.locator(this.selectors.queueItem).all();
    const queueData = [];
    
    for (const item of items) {
      const title = await item.textContent();
      if (title) {
        queueData.push(title.trim());
      }
    }
    
    return queueData;
  }

  /**
   * Get download history
   */
  async getDownloadHistory(): Promise<string[]> {
    if (!(await this.isElementVisible(this.selectors.downloadHistory))) {
      return [];
    }
    
    const items = await this.page.locator(this.selectors.historyItem).all();
    const historyData = [];
    
    for (const item of items) {
      const title = await item.textContent();
      if (title) {
        historyData.push(title.trim());
      }
    }
    
    return historyData;
  }

  /**
   * Get error message if present
   */
  async getErrorMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getTextContent(this.selectors.errorMessage);
    }
    return '';
  }

  /**
   * Get warning message if present
   */
  async getWarningMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.warningMessage)) {
      return await this.getTextContent(this.selectors.warningMessage);
    }
    return '';
  }

  /**
   * Complete YouTube download flow
   */
  async downloadYouTubeVideo(url: string, options: YouTubeDownloadOptions): Promise<void> {
    // Enter and validate URL
    const isValid = await this.enterAndValidateUrl(url);
    if (!isValid) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Configure download options
    await this.configureDownloadOptions(options);
    
    // Start download
    await this.startDownload();
    
    // Wait for completion
    await this.waitForDownloadComplete();
  }

  /**
   * Check if URL input has validation error
   */
  async hasUrlValidationError(): Promise<boolean> {
    const status = await this.getTextContent(this.selectors.urlValidationStatus);
    return status.toLowerCase().includes('invalid') || status.toLowerCase().includes('error');
  }

  /**
   * Verify YouTube page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.youtubeUrlInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.validateUrlButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.qualitySelect)).toBeVisible();
    await expect(this.page.locator(this.selectors.formatSelect)).toBeVisible();
  }
}