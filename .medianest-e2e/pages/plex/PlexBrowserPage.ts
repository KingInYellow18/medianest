import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the Plex Browser page
 * Handles library browsing, media selection, and content filtering
 */
export class PlexBrowserPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageHeader: '[data-testid="page-header"]',
    pageTitle: 'h1:has-text("Plex Library")',
    pageDescription: '[data-testid="page-description"]',
    
    // Library selector
    librarySelector: '[data-testid="library-selector"]',
    libraryOption: '[data-testid="library-option"]',
    selectedLibrary: '[data-testid="selected-library"]',
    
    // Collections navigation
    collectionsButton: '[data-testid="collections-button"]',
    
    // Media browser
    mediaBrowser: '[data-testid="media-browser"]',
    mediaGrid: '[data-testid="media-grid"]',
    mediaCard: '[data-testid="media-card"]',
    mediaTitle: '[data-testid="media-title"]',
    mediaYear: '[data-testid="media-year"]',
    mediaPoster: '[data-testid="media-poster"]',
    mediaRating: '[data-testid="media-rating"]',
    
    // Media filters
    mediaFilters: '[data-testid="media-filters"]',
    filterButton: '[data-testid="filter-button"]',
    sortSelect: '[data-testid="sort-select"]',
    viewToggle: '[data-testid="view-toggle"]',
    
    // Filter options
    genreFilter: '[data-testid="genre-filter"]',
    yearFilter: '[data-testid="year-filter"]',
    ratingFilter: '[data-testid="rating-filter"]',
    unwatchedFilter: '[data-testid="unwatched-filter"]',
    clearFiltersButton: '[data-testid="clear-filters-button"]',
    
    // Search functionality
    searchBar: '[data-testid="search-bar"]',
    searchInput: '[data-testid="search-input"]',
    searchResults: '[data-testid="search-results"]',
    noResults: '[data-testid="no-results"]',
    
    // Pagination
    pagination: '[data-testid="pagination"]',
    prevPage: '[data-testid="prev-page"]',
    nextPage: '[data-testid="next-page"]',
    pageNumber: '[data-testid="page-number"]',
    currentPage: '[data-testid="current-page"]',
    
    // Loading states
    mediaCardSkeleton: '[data-testid="media-card-skeleton"]',
    libraryLoading: '[data-testid="library-loading"]',
    
    // View modes
    gridView: '[data-testid="grid-view"]',
    listView: '[data-testid="list-view"]',
    
    // Media details
    mediaModal: '[data-testid="media-modal"]',
    mediaDetails: '[data-testid="media-details"]',
    playButton: '[data-testid="play-button"]',
    addToPlaylistButton: '[data-testid="add-to-playlist-button"]',
    
    // Error states
    libraryError: '[data-testid="library-error"]',
    connectionError: '[data-testid="connection-error"]',
    retryButton: '[data-testid="retry-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/plex');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.mediaBrowser);
  }

  getPageTitle(): string {
    return 'Plex Browser';
  }

  protected getMainContentSelector(): string {
    return this.selectors.mediaBrowser;
  }

  /**
   * Verify page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.mediaBrowser)).toBeVisible();
    await expect(this.page.locator(this.selectors.librarySelector)).toBeVisible();
  }

  /**
   * Wait for library to load
   */
  async waitForLibraryLoad(): Promise<void> {
    // Wait for skeleton loaders to disappear
    try {
      await this.waitForElementToHide(this.selectors.mediaCardSkeleton, 10000);
    } catch {
      // Skeletons might not be present
    }

    // Wait for media grid to be populated
    await this.waitForElement(this.selectors.mediaGrid);
    
    // Wait for at least one media card to be visible (unless library is empty)
    try {
      await this.waitForElement(this.selectors.mediaCard, 5000);
    } catch {
      // Library might be empty, check for no results message
      if (!(await this.isElementVisible(this.selectors.noResults))) {
        throw new Error('Library failed to load - no media cards or empty state message');
      }
    }
  }

  /**
   * Select a library
   */
  async selectLibrary(libraryName: string): Promise<void> {
    await this.clickElement(this.selectors.librarySelector);
    
    const libraryOption = this.page.locator(this.selectors.libraryOption).filter({ hasText: libraryName });
    await libraryOption.click();
    
    await this.waitForLibraryLoad();
    
    // Verify library is selected
    const selectedLibrary = await this.getTextContent(this.selectors.selectedLibrary);
    expect(selectedLibrary).toContain(libraryName);
  }

  /**
   * Get available libraries
   */
  async getAvailableLibraries(): Promise<string[]> {
    await this.clickElement(this.selectors.librarySelector);
    const libraries = await this.page.locator(this.selectors.libraryOption).allTextContents();
    
    // Close dropdown by clicking outside
    await this.clickElement(this.selectors.pageTitle);
    
    return libraries;
  }

  /**
   * Get current library
   */
  async getCurrentLibrary(): Promise<string> {
    return await this.getTextContent(this.selectors.selectedLibrary);
  }

  /**
   * Search for media
   */
  async searchMedia(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query, { clear: true });
    
    // Wait for search results
    await this.waitForElement(this.selectors.searchResults, 5000);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.fillInput(this.selectors.searchInput, '', { clear: true });
    await this.waitForLibraryLoad();
  }

  /**
   * Get search results count
   */
  async getSearchResultsCount(): Promise<number> {
    const mediaCards = this.page.locator(this.selectors.mediaCard);
    return await mediaCards.count();
  }

  /**
   * Apply filters
   */
  async applyGenreFilter(genre: string): Promise<void> {
    await this.clickElement(this.selectors.genreFilter);
    
    const genreOption = this.page.locator(`[data-testid="genre-option"][data-genre="${genre}"]`);
    await genreOption.click();
    
    await this.waitForLibraryLoad();
  }

  async applyYearFilter(year: string): Promise<void> {
    await this.clickElement(this.selectors.yearFilter);
    
    const yearOption = this.page.locator(`[data-testid="year-option"][data-year="${year}"]`);
    await yearOption.click();
    
    await this.waitForLibraryLoad();
  }

  async toggleUnwatchedFilter(): Promise<void> {
    await this.clickElement(this.selectors.unwatchedFilter);
    await this.waitForLibraryLoad();
  }

  async clearAllFilters(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearFiltersButton)) {
      await this.clickElement(this.selectors.clearFiltersButton);
      await this.waitForLibraryLoad();
    }
  }

  /**
   * Sort media
   */
  async sortBy(sortOption: 'title' | 'year' | 'rating' | 'dateAdded'): Promise<void> {
    await this.selectOption(this.selectors.sortSelect, sortOption);
    await this.waitForLibraryLoad();
  }

  /**
   * Change view mode
   */
  async switchToGridView(): Promise<void> {
    const gridToggle = this.page.locator(this.selectors.viewToggle).locator('[data-view="grid"]');
    await gridToggle.click();
    
    await expect(this.page.locator(this.selectors.gridView)).toBeVisible();
  }

  async switchToListView(): Promise<void> {
    const listToggle = this.page.locator(this.selectors.viewToggle).locator('[data-view="list"]');
    await listToggle.click();
    
    await expect(this.page.locator(this.selectors.listView)).toBeVisible();
  }

  /**
   * Get media items
   */
  async getMediaItems(): Promise<Array<{ title: string; year: string; rating?: string }>> {
    const mediaCards = this.page.locator(this.selectors.mediaCard);
    const count = await mediaCards.count();
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const card = mediaCards.nth(i);
      const title = await card.locator(this.selectors.mediaTitle).textContent() || '';
      const year = await card.locator(this.selectors.mediaYear).textContent() || '';
      const rating = await card.locator(this.selectors.mediaRating).textContent() || undefined;
      
      items.push({ title, year, rating });
    }
    
    return items;
  }

  /**
   * Select media item
   */
  async selectMediaItem(title: string): Promise<void> {
    const mediaCard = this.page.locator(this.selectors.mediaCard).filter({ 
      has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
    });
    
    await mediaCard.click();
    await this.waitForElement(this.selectors.mediaModal);
  }

  /**
   * Play media
   */
  async playMedia(title: string): Promise<void> {
    await this.selectMediaItem(title);
    
    await this.clickElement(this.selectors.playButton);
    
    // Wait for player to load (implementation dependent)
    await this.page.waitForTimeout(2000);
  }

  /**
   * Add to playlist
   */
  async addToPlaylist(title: string, playlistName?: string): Promise<void> {
    await this.selectMediaItem(title);
    
    await this.clickElement(this.selectors.addToPlaylistButton);
    
    if (playlistName) {
      const playlistOption = this.page.locator(`[data-testid="playlist-option"]`).filter({ hasText: playlistName });
      await playlistOption.click();
    }
    
    await this.waitForLoading();
  }

  /**
   * Pagination
   */
  async goToNextPage(): Promise<boolean> {
    if (await this.isElementVisible(this.selectors.nextPage)) {
      const isDisabled = await this.page.locator(this.selectors.nextPage).isDisabled();
      if (!isDisabled) {
        await this.clickElement(this.selectors.nextPage);
        await this.waitForLibraryLoad();
        return true;
      }
    }
    return false;
  }

  async goToPreviousPage(): Promise<boolean> {
    if (await this.isElementVisible(this.selectors.prevPage)) {
      const isDisabled = await this.page.locator(this.selectors.prevPage).isDisabled();
      if (!isDisabled) {
        await this.clickElement(this.selectors.prevPage);
        await this.waitForLibraryLoad();
        return true;
      }
    }
    return false;
  }

  async goToPage(pageNumber: number): Promise<void> {
    const pageLink = this.page.locator(this.selectors.pageNumber).filter({ hasText: pageNumber.toString() });
    await pageLink.click();
    await this.waitForLibraryLoad();
  }

  async getCurrentPage(): Promise<number> {
    const currentPageText = await this.getTextContent(this.selectors.currentPage);
    return parseInt(currentPageText) || 1;
  }

  /**
   * Navigate to collections
   */
  async navigateToCollections(): Promise<void> {
    await this.clickElement(this.selectors.collectionsButton);
    await this.page.waitForURL('/plex/collections');
  }

  /**
   * Error handling
   */
  async hasLibraryError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.libraryError) || 
           await this.isElementVisible(this.selectors.connectionError);
  }

  async retryLibraryLoad(): Promise<void> {
    if (await this.isElementVisible(this.selectors.retryButton)) {
      await this.clickElement(this.selectors.retryButton);
      await this.waitForLibraryLoad();
    }
  }

  /**
   * Test comprehensive browsing workflow
   */
  async completeBrowsingWorkflow(): Promise<void> {
    await this.verifyPageElements();
    
    // Test library selection
    const libraries = await this.getAvailableLibraries();
    expect(libraries.length).toBeGreaterThan(0);
    
    if (libraries.length > 0) {
      await this.selectLibrary(libraries[0]);
    }
    
    await this.waitForLibraryLoad();
    
    // Test search
    await this.searchMedia('test');
    await this.clearSearch();
    
    // Test filters
    await this.toggleUnwatchedFilter();
    await this.clearAllFilters();
    
    // Test sorting
    await this.sortBy('title');
    
    // Test view modes
    await this.switchToListView();
    await this.switchToGridView();
    
    // Get media items
    const items = await this.getMediaItems();
    console.log(`Found ${items.length} media items`);
    
    if (items.length > 0) {
      await this.selectMediaItem(items[0].title);
      await this.closeModal();
    }
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test keyboard navigation
    await this.navigateWithTab();
    
    // Test that media cards are accessible
    const mediaCards = await this.page.locator(this.selectors.mediaCard).all();
    for (const card of mediaCards.slice(0, 3)) { // Test first 3 cards
      const title = await card.locator(this.selectors.mediaTitle).textContent();
      expect(title).toBeTruthy();
      
      // Cards should be keyboard accessible
      const tabIndex = await card.getAttribute('tabindex');
      expect(tabIndex).not.toBe('-1');
    }
    
    // Test ARIA labels on filter elements
    const filterButton = this.page.locator(this.selectors.filterButton);
    if (await filterButton.isVisible()) {
      const ariaLabel = await filterButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  }

  /**
   * Test performance
   */
  async measureLoadPerformance(): Promise<{ libraryLoadTime: number; searchTime: number }> {
    // Measure library load time
    const libraryStart = Date.now();
    await this.waitForLibraryLoad();
    const libraryLoadTime = Date.now() - libraryStart;
    
    // Measure search time
    const searchStart = Date.now();
    await this.searchMedia('test');
    const searchTime = Date.now() - searchStart;
    
    await this.clearSearch();
    
    return { libraryLoadTime, searchTime };
  }
}