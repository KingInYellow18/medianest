import { Page, expect } from '@playwright/test';

import { BasePage } from './base.page';

export class MediaPage extends BasePage {
  // Search selectors
  private readonly searchInput = '[data-testid="search-input"]';
  private readonly searchButton = '[data-testid="search-button"]';
  private readonly searchResults = '[data-testid="search-results"]';
  private readonly mediaCards = '[data-testid="media-card"]';

  // Media card selectors
  private readonly requestButton = (tmdbId: string) => `[data-testid="request-button-${tmdbId}"]`;
  private readonly mediaTitle = '[data-testid="media-title"]';
  private readonly mediaYear = '[data-testid="media-year"]';
  private readonly mediaType = '[data-testid="media-type"]';

  // Request modal selectors
  private readonly requestModal = '[data-testid="request-modal"]';
  private readonly confirmRequestButton = '[data-testid="confirm-request"]';
  private readonly cancelRequestButton = '[data-testid="cancel-request"]';
  private readonly successMessage = '[data-testid="success-message"]';
  private readonly errorMessage = '[data-testid="error-message"]';

  // Filters
  private readonly mediaTypeFilter = '[data-testid="media-type-filter"]';
  private readonly yearFilter = '[data-testid="year-filter"]';

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/media');
    await this.waitForLoad();
  }

  /**
   * Search for media
   */
  async searchMedia(query: string): Promise<void> {
    await this.page.fill(this.searchInput, query);
    await this.page.click(this.searchButton);

    // Wait for search results to load
    await expect(this.page.locator(this.searchResults)).toBeVisible();
  }

  /**
   * Get search results count
   */
  async getSearchResultsCount(): Promise<number> {
    const cards = this.page.locator(this.mediaCards);
    return await cards.count();
  }

  /**
   * Request media by TMDB ID
   */
  async requestMedia(tmdbId: string): Promise<void> {
    // Click request button for specific media
    await this.page.click(this.requestButton(tmdbId));

    // Wait for request modal to appear
    await expect(this.page.locator(this.requestModal)).toBeVisible();

    // Confirm the request
    await this.page.click(this.confirmRequestButton);
  }

  /**
   * Check if request was successful
   */
  async isRequestSuccessful(): Promise<boolean> {
    try {
      await expect(this.page.locator(this.successMessage)).toBeVisible({ timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    const element = this.page.locator(this.successMessage);
    await element.waitFor({ state: 'visible' });
    return (await element.textContent()) || '';
  }

  /**
   * Check if request failed
   */
  async hasRequestError(): Promise<boolean> {
    return await this.isElementVisible(this.errorMessage);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const element = this.page.locator(this.errorMessage);
    await element.waitFor({ state: 'visible' });
    return (await element.textContent()) || '';
  }

  /**
   * Filter media by type
   */
  async filterByType(type: 'movie' | 'tv'): Promise<void> {
    await this.page.selectOption(this.mediaTypeFilter, type);
    await this.waitForLoad();
  }

  /**
   * Filter media by year
   */
  async filterByYear(year: string): Promise<void> {
    await this.page.selectOption(this.yearFilter, year);
    await this.waitForLoad();
  }

  /**
   * Get first search result details
   */
  async getFirstResultDetails(): Promise<{ title: string; year: string; type: string }> {
    const firstCard = this.page.locator(this.mediaCards).first();

    const title = (await firstCard.locator(this.mediaTitle).textContent()) || '';
    const year = (await firstCard.locator(this.mediaYear).textContent()) || '';
    const type = (await firstCard.locator(this.mediaType).textContent()) || '';

    return { title, year, type };
  }

  /**
   * Check if media is already requested
   */
  async isMediaRequested(tmdbId: string): Promise<boolean> {
    const button = this.page.locator(this.requestButton(tmdbId));
    const buttonText = (await button.textContent()) || '';
    return (
      buttonText.toLowerCase().includes('requested') ||
      buttonText.toLowerCase().includes('unavailable')
    );
  }

  /**
   * Cancel request modal
   */
  async cancelRequest(): Promise<void> {
    await this.page.click(this.cancelRequestButton);
    await expect(this.page.locator(this.requestModal)).not.toBeVisible();
  }
}
