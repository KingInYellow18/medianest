import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the YouTube Downloader page
 * Handles URL submission, download management, and queue monitoring
 */
export class YouTubeDownloaderPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("YouTube Downloader")',
    downloaderContainer: '[data-testid="youtube-downloader"]',
    
    // URL submission form
    urlSubmissionForm: '[data-testid="url-submission-form"]',
    urlInput: '[data-testid="url-input"]',
    submitUrlButton: '[data-testid="submit-url-button"]',
    pasteButton: '[data-testid="paste-button"]',
    clearUrlButton: '[data-testid="clear-url-button"]',
    
    // URL validation
    urlValidation: '[data-testid="url-validation"]',
    validUrl: '[data-testid="valid-url"]',
    invalidUrl: '[data-testid="invalid-url"]',
    urlError: '[data-testid="url-error"]',
    
    // Download options
    downloadOptions: '[data-testid="download-options"]',
    qualitySelect: '[data-testid="quality-select"]',
    formatSelect: '[data-testid="format-select"]',
    audioOnlyCheckbox: '[data-testid="audio-only-checkbox"]',
    subtitlesCheckbox: '[data-testid="subtitles-checkbox"]',
    thumbnailCheckbox: '[data-testid="thumbnail-checkbox"]',
    
    // Metadata preview
    metadataPreview: '[data-testid="metadata-preview"]',
    videoTitle: '[data-testid="video-title"]',
    videoDuration: '[data-testid="video-duration"]',
    videoThumbnail: '[data-testid="video-thumbnail"]',
    videoDescription: '[data-testid="video-description"]',
    channelName: '[data-testid="channel-name"]',
    videoViews: '[data-testid="video-views"]',
    uploadDate: '[data-testid="upload-date"]',
    
    // Download queue
    downloadQueue: '[data-testid="download-queue"]',
    queueItem: '[data-testid="queue-item"]',
    queueTitle: '[data-testid="queue-title"]',
    queueStatus: '[data-testid="queue-status"]',
    queueProgress: '[data-testid="queue-progress"]',
    queueSize: '[data-testid="queue-size"]',
    
    // Queue status badges
    statusPending: '[data-status="pending"]',
    statusDownloading: '[data-status="downloading"]',
    statusCompleted: '[data-status="completed"]',
    statusFailed: '[data-status="failed"]',
    statusPaused: '[data-status="paused"]',
    
    // Queue controls
    pauseButton: '[data-testid="pause-button"]',
    resumeButton: '[data-testid="resume-button"]',
    cancelButton: '[data-testid="cancel-button"]',
    retryButton: '[data-testid="retry-button"]',
    removeButton: '[data-testid="remove-button"]',
    clearCompletedButton: '[data-testid="clear-completed-button"]',
    clearAllButton: '[data-testid="clear-all-button"]',
    
    // Bulk operations
    selectAllCheckbox: '[data-testid="select-all-checkbox"]',
    itemCheckbox: '[data-testid="item-checkbox"]',
    selectedCount: '[data-testid="selected-count"]',
    bulkPauseButton: '[data-testid="bulk-pause-button"]',
    bulkResumeButton: '[data-testid="bulk-resume-button"]',
    bulkCancelButton: '[data-testid="bulk-cancel-button"]',
    bulkRemoveButton: '[data-testid="bulk-remove-button"]',
    
    // Progress indicators
    overallProgress: '[data-testid="overall-progress"]',
    downloadSpeed: '[data-testid="download-speed"]',
    eta: '[data-testid="eta"]',
    activeDownloads: '[data-testid="active-downloads"]',
    
    // Quota display
    quotaDisplay: '[data-testid="quota-display"]',
    quotaUsed: '[data-testid="quota-used"]',
    quotaRemaining: '[data-testid="quota-remaining"]',
    quotaReset: '[data-testid="quota-reset"]',
    quotaWarning: '[data-testid="quota-warning"]',
    
    // History
    downloadHistory: '[data-testid="download-history"]',
    historyItem: '[data-testid="history-item"]',
    historyToggle: '[data-testid="history-toggle"]',
    clearHistoryButton: '[data-testid="clear-history-button"]',
    
    // Filters
    queueFilters: '[data-testid="queue-filters"]',
    statusFilter: '[data-testid="status-filter"]',
    dateFilter: '[data-testid="date-filter"]',
    sizeFilter: '[data-testid="size-filter"]',
    clearFiltersButton: '[data-testid="clear-filters-button"]',
    
    // Settings
    settingsButton: '[data-testid="settings-button"]',
    settingsModal: '[data-testid="settings-modal"]',
    maxConcurrentDownloads: '[data-testid="max-concurrent-downloads"]',
    downloadPath: '[data-testid="download-path"]',
    autoDownload: '[data-testid="auto-download"]',
    saveSettings: '[data-testid="save-settings"]',
    
    // Download results
    downloadCompleteModal: '[data-testid="download-complete-modal"]',
    downloadedFile: '[data-testid="downloaded-file"]',
    fileSize: '[data-testid="file-size"]',
    downloadTime: '[data-testid="download-time"]',
    openFileButton: '[data-testid="open-file-button"]',
    openFolderButton: '[data-testid="open-folder-button"]',
    
    // Loading states
    metadataLoading: '[data-testid="metadata-loading"]',
    queueLoading: '[data-testid="queue-loading"]',
    urlProcessing: '[data-testid="url-processing"]',
    
    // Error states
    downloadError: '[data-testid="download-error"]',
    networkError: '[data-testid="network-error"]',
    quotaExceeded: '[data-testid="quota-exceeded"]',
    unsupportedUrl: '[data-testid="unsupported-url"]',
    
    // Notifications
    successNotification: '[data-testid="success-notification"]',
    errorNotification: '[data-testid="error-notification"]',
    warningNotification: '[data-testid="warning-notification"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/youtube');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.downloaderContainer);
  }

  getPageTitle(): string {
    return 'YouTube Downloader';
  }

  protected getMainContentSelector(): string {
    return this.selectors.downloaderContainer;
  }

  /**
   * Verify page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.urlSubmissionForm)).toBeVisible();
    await expect(this.page.locator(this.selectors.urlInput)).toBeVisible();
  }

  /**
   * Submit URL for download
   */
  async submitUrl(url: string, autoSubmit: boolean = true): Promise<void> {
    await this.fillInput(this.selectors.urlInput, url, { clear: true });
    
    // Wait for URL validation
    await this.waitForUrlValidation();
    
    if (autoSubmit) {
      await this.clickElement(this.selectors.submitUrlButton);
      await this.waitForMetadataLoad();
    }
  }

  /**
   * Wait for URL validation
   */
  async waitForUrlValidation(): Promise<void> {
    // Wait for validation to complete
    await this.page.waitForTimeout(1000);
    
    // Check if URL is valid or invalid
    const isValid = await this.isElementVisible(this.selectors.validUrl);
    const isInvalid = await this.isElementVisible(this.selectors.invalidUrl);
    
    expect(isValid || isInvalid).toBe(true);
  }

  /**
   * Check if URL is valid
   */
  async isUrlValid(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.validUrl);
  }

  async getUrlError(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.urlError)) {
      return await this.getTextContent(this.selectors.urlError);
    }
    return null;
  }

  /**
   * Paste URL from clipboard
   */
  async pasteUrl(): Promise<void> {
    await this.clickElement(this.selectors.pasteButton);
    await this.waitForUrlValidation();
  }

  async clearUrl(): Promise<void> {
    await this.clickElement(this.selectors.clearUrlButton);
  }

  /**
   * Wait for metadata to load
   */
  async waitForMetadataLoad(): Promise<void> {
    try {
      await this.waitForElementToHide(this.selectors.metadataLoading, 15000);
    } catch {
      // Loading might not be visible
    }

    await this.waitForElement(this.selectors.metadataPreview, 10000);
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(): Promise<{
    title: string;
    duration: string;
    description: string;
    channel: string;
    views: string;
    uploadDate: string;
  }> {
    await this.waitForMetadataLoad();
    
    const title = await this.getTextContent(this.selectors.videoTitle);
    const duration = await this.getTextContent(this.selectors.videoDuration);
    const description = await this.getTextContent(this.selectors.videoDescription);
    const channel = await this.getTextContent(this.selectors.channelName);
    const views = await this.getTextContent(this.selectors.videoViews);
    const uploadDate = await this.getTextContent(this.selectors.uploadDate);
    
    return { title, duration, description, channel, views, uploadDate };
  }

  /**
   * Configure download options
   */
  async setDownloadOptions(options: {
    quality?: '4K' | '1080p' | '720p' | '480p' | 'best' | 'worst';
    format?: 'mp4' | 'webm' | 'mkv' | 'best';
    audioOnly?: boolean;
    subtitles?: boolean;
    thumbnail?: boolean;
  }): Promise<void> {
    if (options.quality) {
      await this.selectOption(this.selectors.qualitySelect, options.quality);
    }
    
    if (options.format) {
      await this.selectOption(this.selectors.formatSelect, options.format);
    }
    
    if (options.audioOnly) {
      const audioCheckbox = this.page.locator(this.selectors.audioOnlyCheckbox);
      await audioCheckbox.check();
    }
    
    if (options.subtitles) {
      const subtitlesCheckbox = this.page.locator(this.selectors.subtitlesCheckbox);
      await subtitlesCheckbox.check();
    }
    
    if (options.thumbnail) {
      const thumbnailCheckbox = this.page.locator(this.selectors.thumbnailCheckbox);
      await thumbnailCheckbox.check();
    }
  }

  /**
   * Start download
   */
  async startDownload(): Promise<void> {
    const downloadButton = this.page.locator('[data-testid="start-download-button"]');
    await downloadButton.click();
    
    // Wait for download to be added to queue
    await this.waitForElement(this.selectors.downloadQueue);
  }

  /**
   * Get download queue items
   */
  async getQueueItems(): Promise<Array<{
    title: string;
    status: string;
    progress: number;
    size: string;
  }>> {
    const queueItems = this.page.locator(this.selectors.queueItem);
    const count = await queueItems.count();
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const item = queueItems.nth(i);
      
      const title = await item.locator(this.selectors.queueTitle).textContent() || '';
      const status = await item.locator(this.selectors.queueStatus).textContent() || '';
      const progressElement = item.locator(this.selectors.queueProgress);
      const progressValue = await progressElement.getAttribute('value');
      const progress = progressValue ? parseFloat(progressValue) : 0;
      const size = await item.locator(this.selectors.queueSize).textContent() || '';
      
      items.push({ title, status, progress, size });
    }
    
    return items;
  }

  /**
   * Queue management
   */
  async pauseDownload(title: string): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    const pauseButton = queueItem.locator(this.selectors.pauseButton);
    await pauseButton.click();
  }

  async resumeDownload(title: string): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    const resumeButton = queueItem.locator(this.selectors.resumeButton);
    await resumeButton.click();
  }

  async cancelDownload(title: string): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    const cancelButton = queueItem.locator(this.selectors.cancelButton);
    await cancelButton.click();
    
    // Confirm cancellation
    const confirmButton = this.page.locator('[data-testid="confirm-cancel-button"]');
    await confirmButton.click();
  }

  async retryDownload(title: string): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    const retryButton = queueItem.locator(this.selectors.retryButton);
    await retryButton.click();
  }

  async removeFromQueue(title: string): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    const removeButton = queueItem.locator(this.selectors.removeButton);
    await removeButton.click();
    
    // Confirm removal
    const confirmButton = this.page.locator('[data-testid="confirm-remove-button"]');
    await confirmButton.click();
  }

  async clearCompleted(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearCompletedButton)) {
      await this.clickElement(this.selectors.clearCompletedButton);
    }
  }

  async clearAllQueue(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearAllButton)) {
      await this.clickElement(this.selectors.clearAllButton);
      
      // Confirm clear all
      const confirmButton = this.page.locator('[data-testid="confirm-clear-all-button"]');
      await confirmButton.click();
    }
  }

  /**
   * Bulk operations
   */
  async selectAllQueueItems(): Promise<void> {
    await this.clickElement(this.selectors.selectAllCheckbox);
  }

  async selectQueueItems(titles: string[]): Promise<void> {
    for (const title of titles) {
      const queueItem = await this.findQueueItem(title);
      const checkbox = queueItem.locator(this.selectors.itemCheckbox);
      await checkbox.check();
    }
  }

  async getSelectedCount(): Promise<number> {
    const countText = await this.getTextContent(this.selectors.selectedCount);
    const match = countText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async bulkPause(): Promise<void> {
    await this.clickElement(this.selectors.bulkPauseButton);
  }

  async bulkResume(): Promise<void> {
    await this.clickElement(this.selectors.bulkResumeButton);
  }

  async bulkCancel(): Promise<void> {
    await this.clickElement(this.selectors.bulkCancelButton);
    
    // Confirm bulk cancel
    const confirmButton = this.page.locator('[data-testid="confirm-bulk-cancel-button"]');
    await confirmButton.click();
  }

  async bulkRemove(): Promise<void> {
    await this.clickElement(this.selectors.bulkRemoveButton);
    
    // Confirm bulk remove
    const confirmButton = this.page.locator('[data-testid="confirm-bulk-remove-button"]');
    await confirmButton.click();
  }

  /**
   * Monitor download progress
   */
  async getOverallProgress(): Promise<{
    progress: number;
    speed: string;
    eta: string;
    activeDownloads: number;
  }> {
    const progressElement = this.page.locator(this.selectors.overallProgress);
    const progressValue = await progressElement.getAttribute('value');
    const progress = progressValue ? parseFloat(progressValue) : 0;
    
    const speed = await this.getTextContent(this.selectors.downloadSpeed);
    const eta = await this.getTextContent(this.selectors.eta);
    const activeText = await this.getTextContent(this.selectors.activeDownloads);
    const activeDownloads = parseInt(activeText) || 0;
    
    return { progress, speed, eta, activeDownloads };
  }

  /**
   * Wait for download completion
   */
  async waitForDownloadComplete(title: string, timeout: number = 300000): Promise<void> {
    const queueItem = await this.findQueueItem(title);
    
    // Wait for status to become completed
    await this.page.waitForFunction(
      (element) => {
        const statusElement = element.querySelector('[data-testid="queue-status"]');
        return statusElement?.textContent?.includes('completed');
      },
      queueItem,
      { timeout }
    );
  }

  /**
   * Quota management
   */
  async getQuotaInfo(): Promise<{
    used: number;
    remaining: number;
    resetTime: string;
    hasWarning: boolean;
  }> {
    const usedText = await this.getTextContent(this.selectors.quotaUsed);
    const remainingText = await this.getTextContent(this.selectors.quotaRemaining);
    const resetTime = await this.getTextContent(this.selectors.quotaReset);
    const hasWarning = await this.isElementVisible(this.selectors.quotaWarning);
    
    return {
      used: parseInt(usedText) || 0,
      remaining: parseInt(remainingText) || 0,
      resetTime,
      hasWarning
    };
  }

  /**
   * History management
   */
  async toggleHistory(): Promise<void> {
    await this.clickElement(this.selectors.historyToggle);
  }

  async getDownloadHistory(): Promise<Array<{
    title: string;
    date: string;
    size: string;
    status: string;
  }>> {
    const historyItems = this.page.locator(this.selectors.historyItem);
    const count = await historyItems.count();
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const item = historyItems.nth(i);
      
      const title = await item.locator('[data-testid="history-title"]').textContent() || '';
      const date = await item.locator('[data-testid="history-date"]').textContent() || '';
      const size = await item.locator('[data-testid="history-size"]').textContent() || '';
      const status = await item.locator('[data-testid="history-status"]').textContent() || '';
      
      items.push({ title, date, size, status });
    }
    
    return items;
  }

  async clearHistory(): Promise<void> {
    await this.clickElement(this.selectors.clearHistoryButton);
    
    // Confirm clear history
    const confirmButton = this.page.locator('[data-testid="confirm-clear-history-button"]');
    await confirmButton.click();
  }

  /**
   * Settings management
   */
  async openSettings(): Promise<void> {
    await this.clickElement(this.selectors.settingsButton);
    await this.waitForElement(this.selectors.settingsModal);
  }

  async updateSettings(settings: {
    maxConcurrentDownloads?: number;
    downloadPath?: string;
    autoDownload?: boolean;
  }): Promise<void> {
    await this.openSettings();
    
    if (settings.maxConcurrentDownloads) {
      await this.fillInput(this.selectors.maxConcurrentDownloads, settings.maxConcurrentDownloads.toString());
    }
    
    if (settings.downloadPath) {
      await this.fillInput(this.selectors.downloadPath, settings.downloadPath);
    }
    
    if (settings.autoDownload !== undefined) {
      const checkbox = this.page.locator(this.selectors.autoDownload);
      if (settings.autoDownload) {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
    }
    
    await this.clickElement(this.selectors.saveSettings);
    await this.waitForLoading();
  }

  /**
   * Error handling
   */
  async hasDownloadError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.downloadError) ||
           await this.isElementVisible(this.selectors.networkError) ||
           await this.isElementVisible(this.selectors.quotaExceeded) ||
           await this.isElementVisible(this.selectors.unsupportedUrl);
  }

  async getDownloadError(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.downloadError)) {
      return await this.getTextContent(this.selectors.downloadError);
    }
    if (await this.isElementVisible(this.selectors.networkError)) {
      return await this.getTextContent(this.selectors.networkError);
    }
    if (await this.isElementVisible(this.selectors.quotaExceeded)) {
      return await this.getTextContent(this.selectors.quotaExceeded);
    }
    if (await this.isElementVisible(this.selectors.unsupportedUrl)) {
      return await this.getTextContent(this.selectors.unsupportedUrl);
    }
    return null;
  }

  /**
   * Helper methods
   */
  private async findQueueItem(title: string): Promise<Locator> {
    return this.page.locator(this.selectors.queueItem).filter({
      has: this.page.locator(this.selectors.queueTitle).filter({ hasText: title })
    });
  }

  /**
   * Complete download workflow
   */
  async completeDownloadWorkflow(
    url: string,
    options: {
      quality?: string;
      format?: string;
      audioOnly?: boolean;
    } = {}
  ): Promise<void> {
    await this.verifyPageElements();
    
    // Submit URL
    await this.submitUrl(url);
    
    // Verify URL is valid
    const isValid = await this.isUrlValid();
    expect(isValid).toBe(true);
    
    // Get metadata
    const metadata = await this.getVideoMetadata();
    console.log(`Video title: ${metadata.title}`);
    
    // Set download options
    await this.setDownloadOptions(options);
    
    // Start download
    await this.startDownload();
    
    // Monitor progress
    const queueItems = await this.getQueueItems();
    expect(queueItems.length).toBeGreaterThan(0);
    
    console.log(`Download started for: ${queueItems[0].title}`);
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test form accessibility
    const urlInput = this.page.locator(this.selectors.urlInput);
    expect(await urlInput.getAttribute('aria-label')).toBeTruthy();
    
    const submitButton = this.page.locator(this.selectors.submitUrlButton);
    expect(await submitButton.getAttribute('aria-label')).toBeTruthy();
    
    // Test queue item accessibility
    const queueItems = await this.page.locator(this.selectors.queueItem).all();
    for (const item of queueItems.slice(0, 3)) {
      const ariaLabel = await item.getAttribute('aria-label');
      expect(ariaLabel || await item.textContent()).toBeTruthy();
    }
    
    // Test keyboard navigation
    await this.navigateWithTab();
  }
}