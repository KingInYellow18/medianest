import { Page, Locator, expect } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * YouTube Download Page Object Model
 *
 * Encapsulates interactions with the YouTube download interface
 */
export class YouTubePage extends BasePage {
  // Locators
  readonly urlInput: Locator;
  readonly submitButton: Locator;
  readonly qualitySelector: Locator;
  readonly formatSelector: Locator;
  readonly videoPreview: Locator;
  readonly videoTitle: Locator;
  readonly videoChannel: Locator;
  readonly videoDuration: Locator;
  readonly videoThumbnail: Locator;
  readonly downloadQueue: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;
  readonly statusBadge: Locator;

  constructor(page: Page) {
    super(page);

    this.urlInput = page.locator('[data-testid="youtube-url-input"]');
    this.submitButton = page.locator('[data-testid="submit-download"]');
    this.qualitySelector = page.locator('[data-testid="quality-selector"]');
    this.formatSelector = page.locator('[data-testid="format-selector"]');
    this.videoPreview = page.locator('[data-testid="video-preview"]');
    this.videoTitle = page.locator('[data-testid="video-title"]');
    this.videoChannel = page.locator('[data-testid="video-channel"]');
    this.videoDuration = page.locator('[data-testid="video-duration"]');
    this.videoThumbnail = page.locator('[data-testid="video-thumbnail"]');
    this.downloadQueue = page.locator('[data-testid="download-queue"]');
    this.errorMessage = page.locator('[data-testid="url-error"]');
    this.successMessage = page.locator('[data-testid="download-success-message"]');
    this.progressBar = page.locator('[data-testid="download-progress-bar"]');
    this.progressText = page.locator('[data-testid="download-progress-text"]');
    this.statusBadge = page.locator('[data-testid="download-status-badge"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/youtube');
  }

  /**
   * Submit a YouTube URL for download
   */
  async submitDownload(
    url: string,
    options?: {
      quality?: string;
      format?: string;
    },
  ): Promise<void> {
    await this.urlInput.fill(url);

    if (options?.quality) {
      await this.qualitySelector.selectOption(options.quality);
    }

    if (options?.format) {
      await this.formatSelector.selectOption(options.format);
    }

    await this.submitButton.click();
  }

  /**
   * Wait for video metadata to be loaded
   */
  async waitForMetadata(timeout: number = 10000): Promise<void> {
    await this.videoPreview.waitFor({ state: 'visible', timeout });
  }

  /**
   * Verify video metadata display
   */
  async verifyMetadata(metadata: {
    title?: string;
    channel?: string;
    duration?: string;
  }): Promise<void> {
    if (metadata.title) {
      await expect(this.videoTitle).toContainText(metadata.title);
    }
    if (metadata.channel) {
      await expect(this.videoChannel).toContainText(metadata.channel);
    }
    if (metadata.duration) {
      await expect(this.videoDuration).toContainText(metadata.duration);
    }

    await expect(this.videoThumbnail).toBeVisible();
  }

  /**
   * Check if download was added to queue
   */
  async verifyDownloadQueued(title: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    await expect(this.downloadQueue).toContainText(title);
  }

  /**
   * Check download progress
   */
  async verifyProgress(expectedProgress: number): Promise<void> {
    await expect(this.progressBar).toBeVisible();
    await expect(this.progressText).toContainText(`${expectedProgress}%`);
  }

  /**
   * Check download status
   */
  async verifyStatus(status: string): Promise<void> {
    await expect(this.statusBadge).toContainText(status);
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId: string): Promise<void> {
    const cancelButton = this.page.locator(`[data-testid="cancel-download-${downloadId}"]`);
    await cancelButton.click();

    const confirmButton = this.page.locator('[data-testid="confirm-cancel"]');
    await confirmButton.click();
  }

  /**
   * Verify error message is displayed
   */
  async verifyError(expectedMessage: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(expectedMessage);
  }

  /**
   * Clear the URL input
   */
  async clearUrl(): Promise<void> {
    await this.urlInput.clear();
  }

  /**
   * Check if submit button is enabled/disabled
   */
  async verifySubmitEnabled(enabled: boolean = true): Promise<void> {
    if (enabled) {
      await expect(this.submitButton).toBeEnabled();
    } else {
      await expect(this.submitButton).toBeDisabled();
    }
  }

  /**
   * Get available quality options
   */
  async getQualityOptions(): Promise<string[]> {
    const options = await this.qualitySelector.locator('option').allTextContents();
    return options.filter((option) => option.trim() !== '');
  }

  /**
   * Get available format options
   */
  async getFormatOptions(): Promise<string[]> {
    const options = await this.formatSelector.locator('option').allTextContents();
    return options.filter((option) => option.trim() !== '');
  }
}

/**
 * YouTube History Page Object Model
 */
export class YouTubeHistoryPage extends BasePage {
  readonly historyTable: Locator;
  readonly historyItems: Locator;
  readonly statusFilter: Locator;
  readonly pagination: Locator;
  readonly pageInfo: Locator;
  readonly noResults: Locator;

  constructor(page: Page) {
    super(page);

    this.historyTable = page.locator('[data-testid="download-history-table"]');
    this.historyItems = page.locator('[data-testid="history-item"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.pagination = page.locator('[data-testid="pagination"]');
    this.pageInfo = page.locator('[data-testid="page-info"]');
    this.noResults = page.locator('[data-testid="no-results"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/youtube/history');
  }

  /**
   * Filter downloads by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  /**
   * Verify number of history items
   */
  async verifyItemCount(count: number): Promise<void> {
    await expect(this.historyItems).toHaveCount(count);
  }

  /**
   * Verify history item details
   */
  async verifyHistoryItem(
    index: number,
    details: {
      title?: string;
      status?: string;
      quality?: string;
    },
  ): Promise<void> {
    const item = this.historyItems.nth(index);

    if (details.title) {
      await expect(item.locator('[data-testid="item-title"]')).toContainText(details.title);
    }
    if (details.status) {
      await expect(item.locator('[data-testid="item-status"]')).toContainText(details.status);
    }
    if (details.quality) {
      await expect(item.locator('[data-testid="item-quality"]')).toContainText(details.quality);
    }
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId: string): Promise<void> {
    const retryButton = this.page.locator(`[data-testid="retry-download-${downloadId}"]`);
    await retryButton.click();
  }

  /**
   * Verify pagination info
   */
  async verifyPagination(currentPage: number, totalPages: number): Promise<void> {
    await expect(this.pagination).toBeVisible();
    await expect(this.pageInfo).toContainText(`${currentPage} of ${totalPages}`);
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.page.click('[data-testid="next-page"]');
  }

  /**
   * Go to previous page
   */
  async previousPage(): Promise<void> {
    await this.page.click('[data-testid="previous-page"]');
  }
}
