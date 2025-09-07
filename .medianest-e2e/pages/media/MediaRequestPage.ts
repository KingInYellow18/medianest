import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for Media Request functionality
 * Handles media request creation, validation, and submission
 */
export class MediaRequestPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Request modal/form
    requestModal: '[data-testid="request-modal"]',
    requestForm: '[data-testid="request-form"]',
    requestButton: '[data-testid="request-button"]',
    
    // Search for media to request
    searchInput: '[data-testid="media-search-input"]',
    searchResults: '[data-testid="search-results"]',
    searchResultItem: '[data-testid="search-result-item"]',
    mediaTitle: '[data-testid="media-title"]',
    mediaYear: '[data-testid="media-year"]',
    mediaPoster: '[data-testid="media-poster"]',
    mediaDescription: '[data-testid="media-description"]',
    
    // Request form fields
    requestTypeSelect: '[data-testid="request-type-select"]',
    qualitySelect: '[data-testid="quality-select"]',
    languageSelect: '[data-testid="language-select"]',
    prioritySelect: '[data-testid="priority-select"]',
    
    // TV Show specific
    seasonSelector: '[data-testid="season-selector"]',
    episodeSelector: '[data-testid="episode-selector"]',
    allSeasonsCheckbox: '[data-testid="all-seasons-checkbox"]',
    selectedSeasons: '[data-testid="selected-seasons"]',
    
    // Request details
    requestNotes: '[data-testid="request-notes"]',
    requestReason: '[data-testid="request-reason"]',
    urgentRequest: '[data-testid="urgent-request"]',
    
    // Availability check
    availabilityStatus: '[data-testid="availability-status"]',
    availableBadge: '[data-testid="available-badge"]',
    partiallyAvailableBadge: '[data-testid="partially-available-badge"]',
    unavailableBadge: '[data-testid="unavailable-badge"]',
    requestedBadge: '[data-testid="requested-badge"]',
    
    // Form validation
    validationErrors: '[data-testid="validation-error"]',
    fieldError: '[data-testid="field-error"]',
    
    // Form actions
    submitRequestButton: '[data-testid="submit-request-button"]',
    cancelRequestButton: '[data-testid="cancel-request-button"]',
    saveAsDraftButton: '[data-testid="save-draft-button"]',
    
    // Success states
    requestSuccessMessage: '[data-testid="request-success"]',
    requestId: '[data-testid="request-id"]',
    estimatedTime: '[data-testid="estimated-time"]',
    
    // Loading states
    searchLoading: '[data-testid="search-loading"]',
    submittingRequest: '[data-testid="submitting-request"]',
    availabilityLoading: '[data-testid="availability-loading"]',
    
    // Error states
    requestError: '[data-testid="request-error"]',
    searchError: '[data-testid="search-error"]',
    unavailableError: '[data-testid="unavailable-error"]',
    
    // Media details
    mediaDetailsModal: '[data-testid="media-details-modal"]',
    mediaGenres: '[data-testid="media-genres"]',
    mediaRating: '[data-testid="media-rating"]',
    mediaRuntime: '[data-testid="media-runtime"]',
    mediaCast: '[data-testid="media-cast"]',
    
    // Request history
    previousRequests: '[data-testid="previous-requests"]',
    requestHistoryItem: '[data-testid="request-history-item"]',
    duplicateWarning: '[data-testid="duplicate-warning"]',
    
    // Bulk request
    bulkRequestMode: '[data-testid="bulk-request-mode"]',
    selectedItems: '[data-testid="selected-items"]',
    selectAllButton: '[data-testid="select-all-button"]',
    clearSelectionButton: '[data-testid="clear-selection-button"]',
    bulkSubmitButton: '[data-testid="bulk-submit-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/requests');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.requestForm) || 
           await this.isElementVisible(this.selectors.searchInput);
  }

  getPageTitle(): string {
    return 'Media Request';
  }

  protected getMainContentSelector(): string {
    return this.selectors.requestForm;
  }

  /**
   * Open request modal/form
   */
  async openRequestForm(): Promise<void> {
    if (await this.isElementVisible(this.selectors.requestButton)) {
      await this.clickElement(this.selectors.requestButton);
      await this.waitForElement(this.selectors.requestForm);
    }
  }

  /**
   * Search for media to request
   */
  async searchMedia(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query, { clear: true });
    
    // Wait for search results
    try {
      await this.waitForElementToHide(this.selectors.searchLoading, 10000);
    } catch {
      // Loading might not be visible
    }
    
    await this.waitForElement(this.selectors.searchResults, 5000);
  }

  /**
   * Get search results
   */
  async getSearchResults(): Promise<Array<{
    title: string;
    year: string;
    description?: string;
    available: boolean;
  }>> {
    const resultItems = this.page.locator(this.selectors.searchResultItem);
    const count = await resultItems.count();
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const item = resultItems.nth(i);
      
      const title = await item.locator(this.selectors.mediaTitle).textContent() || '';
      const year = await item.locator(this.selectors.mediaYear).textContent() || '';
      const description = await item.locator(this.selectors.mediaDescription).textContent() || undefined;
      
      // Check availability status
      const available = await item.locator(this.selectors.availableBadge).isVisible();
      
      results.push({ title, year, description, available });
    }
    
    return results;
  }

  /**
   * Select media item for request
   */
  async selectMediaForRequest(title: string): Promise<void> {
    const resultItem = this.page.locator(this.selectors.searchResultItem).filter({
      has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
    });
    
    await resultItem.click();
    
    // Wait for availability check
    try {
      await this.waitForElementToHide(this.selectors.availabilityLoading, 5000);
    } catch {
      // Availability check might not be visible
    }
  }

  /**
   * Check media availability status
   */
  async getAvailabilityStatus(): Promise<'available' | 'partially-available' | 'unavailable' | 'requested'> {
    if (await this.isElementVisible(this.selectors.availableBadge)) return 'available';
    if (await this.isElementVisible(this.selectors.partiallyAvailableBadge)) return 'partially-available';
    if (await this.isElementVisible(this.selectors.requestedBadge)) return 'requested';
    return 'unavailable';
  }

  /**
   * Fill request form
   */
  async fillRequestForm(options: {
    type?: 'movie' | 'tv' | 'music';
    quality?: '4K' | '1080p' | '720p' | 'any';
    language?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notes?: string;
    reason?: string;
    seasons?: number[] | 'all';
    urgent?: boolean;
  }): Promise<void> {
    if (options.type) {
      await this.selectOption(this.selectors.requestTypeSelect, options.type);
    }
    
    if (options.quality) {
      await this.selectOption(this.selectors.qualitySelect, options.quality);
    }
    
    if (options.language) {
      await this.selectOption(this.selectors.languageSelect, options.language);
    }
    
    if (options.priority) {
      await this.selectOption(this.selectors.prioritySelect, options.priority);
    }
    
    if (options.notes) {
      await this.fillInput(this.selectors.requestNotes, options.notes);
    }
    
    if (options.reason) {
      await this.fillInput(this.selectors.requestReason, options.reason);
    }
    
    if (options.urgent) {
      const urgentCheckbox = this.page.locator(this.selectors.urgentRequest);
      await urgentCheckbox.check();
    }
    
    // Handle TV show seasons
    if (options.type === 'tv' && options.seasons) {
      await this.selectSeasons(options.seasons);
    }
  }

  /**
   * Select seasons for TV show request
   */
  async selectSeasons(seasons: number[] | 'all'): Promise<void> {
    if (seasons === 'all') {
      const allSeasonsCheckbox = this.page.locator(this.selectors.allSeasonsCheckbox);
      await allSeasonsCheckbox.check();
    } else {
      for (const seasonNumber of seasons) {
        const seasonCheckbox = this.page.locator(`[data-testid="season-${seasonNumber}-checkbox"]`);
        await seasonCheckbox.check();
      }
    }
  }

  /**
   * Submit request
   */
  async submitRequest(): Promise<string> {
    await this.clickElement(this.selectors.submitRequestButton);
    
    // Wait for submission to complete
    try {
      await this.waitForElementToHide(this.selectors.submittingRequest, 15000);
    } catch {
      // Submitting indicator might not be visible
    }
    
    // Wait for success message
    await this.waitForElement(this.selectors.requestSuccessMessage, 10000);
    
    // Get request ID
    const requestId = await this.getTextContent(this.selectors.requestId);
    return requestId;
  }

  /**
   * Save request as draft
   */
  async saveAsDraft(): Promise<void> {
    if (await this.isElementVisible(this.selectors.saveAsDraftButton)) {
      await this.clickElement(this.selectors.saveAsDraftButton);
      await this.waitForLoading();
    }
  }

  /**
   * Cancel request
   */
  async cancelRequest(): Promise<void> {
    await this.clickElement(this.selectors.cancelRequestButton);
    
    // Modal should close
    try {
      await this.waitForElementToHide(this.selectors.requestModal, 3000);
    } catch {
      // Modal might not be present
    }
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errorElements = this.page.locator(this.selectors.validationErrors);
    return await errorElements.allTextContents();
  }

  /**
   * Get field-specific errors
   */
  async getFieldError(fieldName: string): Promise<string | null> {
    const fieldError = this.page.locator(`[data-testid="${fieldName}-error"]`);
    if (await fieldError.isVisible()) {
      return await fieldError.textContent();
    }
    return null;
  }

  /**
   * Check for duplicate requests
   */
  async hasDuplicateWarning(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.duplicateWarning);
  }

  async getPreviousRequests(): Promise<Array<{ title: string; status: string; date: string }>> {
    if (!(await this.isElementVisible(this.selectors.previousRequests))) {
      return [];
    }
    
    const requestItems = this.page.locator(this.selectors.requestHistoryItem);
    const count = await requestItems.count();
    const requests = [];
    
    for (let i = 0; i < count; i++) {
      const item = requestItems.nth(i);
      const title = await item.locator('[data-testid="request-title"]').textContent() || '';
      const status = await item.locator('[data-testid="request-status"]').textContent() || '';
      const date = await item.locator('[data-testid="request-date"]').textContent() || '';
      
      requests.push({ title, status, date });
    }
    
    return requests;
  }

  /**
   * View media details
   */
  async viewMediaDetails(title: string): Promise<void> {
    const resultItem = this.page.locator(this.selectors.searchResultItem).filter({
      has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
    });
    
    const detailsButton = resultItem.locator('[data-testid="view-details-button"]');
    await detailsButton.click();
    
    await this.waitForElement(this.selectors.mediaDetailsModal);
  }

  /**
   * Get media details
   */
  async getMediaDetails(): Promise<{
    genres: string[];
    rating: string;
    runtime: string;
    cast: string[];
  }> {
    const genres = await this.page.locator(this.selectors.mediaGenres).allTextContents();
    const rating = await this.getTextContent(this.selectors.mediaRating);
    const runtime = await this.getTextContent(this.selectors.mediaRuntime);
    const cast = await this.page.locator(this.selectors.mediaCast).allTextContents();
    
    return { genres, rating, runtime, cast };
  }

  /**
   * Bulk request functionality
   */
  async enableBulkRequestMode(): Promise<void> {
    const bulkToggle = this.page.locator(this.selectors.bulkRequestMode);
    if (await bulkToggle.isVisible()) {
      await bulkToggle.click();
    }
  }

  async selectMultipleItems(titles: string[]): Promise<void> {
    for (const title of titles) {
      const resultItem = this.page.locator(this.selectors.searchResultItem).filter({
        has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
      });
      
      const checkbox = resultItem.locator('[data-testid="select-item-checkbox"]');
      await checkbox.check();
    }
  }

  async selectAllItems(): Promise<void> {
    await this.clickElement(this.selectors.selectAllButton);
  }

  async clearSelection(): Promise<void> {
    await this.clickElement(this.selectors.clearSelectionButton);
  }

  async getSelectedItemsCount(): Promise<number> {
    const selectedText = await this.getTextContent(this.selectors.selectedItems);
    const match = selectedText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async submitBulkRequest(options: {
    quality?: string;
    priority?: string;
    notes?: string;
  }): Promise<void> {
    // Fill common options for bulk request
    if (options.quality) {
      await this.selectOption(this.selectors.qualitySelect, options.quality);
    }
    
    if (options.priority) {
      await this.selectOption(this.selectors.prioritySelect, options.priority);
    }
    
    if (options.notes) {
      await this.fillInput(this.selectors.requestNotes, options.notes);
    }
    
    await this.clickElement(this.selectors.bulkSubmitButton);
    await this.waitForLoading();
  }

  /**
   * Error handling
   */
  async hasRequestError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.requestError) ||
           await this.isElementVisible(this.selectors.searchError) ||
           await this.isElementVisible(this.selectors.unavailableError);
  }

  async getRequestError(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.requestError)) {
      return await this.getTextContent(this.selectors.requestError);
    }
    if (await this.isElementVisible(this.selectors.searchError)) {
      return await this.getTextContent(this.selectors.searchError);
    }
    if (await this.isElementVisible(this.selectors.unavailableError)) {
      return await this.getTextContent(this.selectors.unavailableError);
    }
    return null;
  }

  /**
   * Complete request workflow
   */
  async completeRequestWorkflow(
    searchQuery: string,
    mediaTitle: string,
    requestOptions: {
      type?: 'movie' | 'tv' | 'music';
      quality?: '4K' | '1080p' | '720p' | 'any';
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      notes?: string;
      seasons?: number[] | 'all';
    } = {}
  ): Promise<string> {
    await this.openRequestForm();
    
    // Search for media
    await this.searchMedia(searchQuery);
    
    const searchResults = await this.getSearchResults();
    expect(searchResults.length).toBeGreaterThan(0);
    
    // Select media
    await this.selectMediaForRequest(mediaTitle);
    
    // Check availability
    const availability = await this.getAvailabilityStatus();
    console.log(`Media availability: ${availability}`);
    
    // Fill request form
    await this.fillRequestForm(requestOptions);
    
    // Submit request
    const requestId = await this.submitRequest();
    
    console.log(`Request submitted with ID: ${requestId}`);
    return requestId;
  }

  /**
   * Test request validation
   */
  async testRequestValidation(): Promise<void> {
    await this.openRequestForm();
    
    // Try to submit empty form
    await this.clickElement(this.selectors.submitRequestButton);
    
    const errors = await this.getValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    // Test field-specific validation
    await this.searchMedia('test');
    const results = await this.getSearchResults();
    
    if (results.length > 0) {
      await this.selectMediaForRequest(results[0].title);
      
      // Test required fields
      await this.fillRequestForm({
        type: 'movie',
        quality: '1080p'
      });
      
      // Should be valid now
      const validationErrors = await this.getValidationErrors();
      expect(validationErrors.length).toBe(0);
    }
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test form accessibility
    const form = this.page.locator(this.selectors.requestForm);
    if (await form.isVisible()) {
      // Check form has proper labels
      const inputs = await form.locator('input, select, textarea').all();
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        if (id) {
          const label = this.page.locator(`label[for="${id}"]`);
          await expect(label).toBeVisible();
        }
      }
      
      // Check ARIA attributes
      expect(await form.getAttribute('role')).toBeTruthy();
    }
    
    // Test keyboard navigation
    await this.navigateWithTab();
    
    // Test that buttons are accessible
    const submitButton = this.page.locator(this.selectors.submitRequestButton);
    if (await submitButton.isVisible()) {
      expect(await submitButton.getAttribute('aria-label')).toBeTruthy();
    }
  }

  /**
   * Get estimated completion time
   */
  async getEstimatedTime(): Promise<string> {
    if (await this.isElementVisible(this.selectors.estimatedTime)) {
      return await this.getTextContent(this.selectors.estimatedTime);
    }
    return '';
  }
}