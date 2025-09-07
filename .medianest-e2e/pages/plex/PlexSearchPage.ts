import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the Plex Search page
 * Handles advanced search functionality and search filters
 */
export class PlexSearchPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Plex Search")',
    searchHomepage: '[data-testid="search-homepage"]',
    
    // Search bar
    searchBar: '[data-testid="search-bar"]',
    searchInput: '[data-testid="search-input"]',
    searchButton: '[data-testid="search-button"]',
    clearSearchButton: '[data-testid="clear-search-button"]',
    searchSuggestions: '[data-testid="search-suggestions"]',
    suggestion: '[data-testid="suggestion"]',
    
    // Advanced search
    advancedSearchToggle: '[data-testid="advanced-search-toggle"]',
    advancedFilters: '[data-testid="advanced-search-filters"]',
    
    // Search filters
    contentTypeFilter: '[data-testid="content-type-filter"]',
    libraryFilter: '[data-testid="library-filter"]',
    genreFilter: '[data-testid="genre-filter"]',
    yearRangeFilter: '[data-testid="year-range-filter"]',
    ratingFilter: '[data-testid="rating-filter"]',
    resolutionFilter: '[data-testid="resolution-filter"]',
    
    // Year range inputs
    yearFromInput: '[data-testid="year-from"]',
    yearToInput: '[data-testid="year-to"]',
    
    // Rating inputs
    ratingMinInput: '[data-testid="rating-min"]',
    ratingMaxInput: '[data-testid="rating-max"]',
    
    // Search results
    searchResults: '[data-testid="search-results"]',
    resultsCount: '[data-testid="results-count"]',
    noResults: '[data-testid="no-results"]',
    searchResultCard: '[data-testid="search-result-card"]',
    
    // Result sorting
    sortControls: '[data-testid="sort-controls"]',
    sortSelect: '[data-testid="sort-select"]',
    sortDirection: '[data-testid="sort-direction"]',
    
    // Recently searched
    recentSearches: '[data-testid="recent-searches"]',
    recentSearchItem: '[data-testid="recent-search-item"]',
    clearRecentButton: '[data-testid="clear-recent-button"]',
    
    // Popular searches
    popularSearches: '[data-testid="popular-searches"]',
    popularSearchItem: '[data-testid="popular-search-item"]',
    
    // Search history
    searchHistory: '[data-testid="search-history"]',
    historyItem: '[data-testid="history-item"]',
    removeHistoryItem: '[data-testid="remove-history-item"]',
    
    // Media details in results
    mediaTitle: '[data-testid="media-title"]',
    mediaYear: '[data-testid="media-year"]',
    mediaGenre: '[data-testid="media-genre"]',
    mediaRating: '[data-testid="media-rating"]',
    mediaPoster: '[data-testid="media-poster"]',
    mediaDescription: '[data-testid="media-description"]',
    
    // Result actions
    playButton: '[data-testid="play-button"]',
    addToPlaylistButton: '[data-testid="add-to-playlist-button"]',
    viewDetailsButton: '[data-testid="view-details-button"]',
    
    // Filters panel
    filtersPanel: '[data-testid="filters-panel"]',
    filtersPanelToggle: '[data-testid="filters-panel-toggle"]',
    applyFiltersButton: '[data-testid="apply-filters-button"]',
    resetFiltersButton: '[data-testid="reset-filters-button"]',
    activeFiltersCount: '[data-testid="active-filters-count"]',
    
    // Loading states
    searchLoading: '[data-testid="search-loading"]',
    resultsSkeleton: '[data-testid="results-skeleton"]',
    
    // Error states
    searchError: '[data-testid="search-error"]',
    noConnectionError: '[data-testid="no-connection-error"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/plex/search');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.searchHomepage);
  }

  getPageTitle(): string {
    return 'Plex Search';
  }

  protected getMainContentSelector(): string {
    return this.selectors.searchHomepage;
  }

  /**
   * Verify page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.searchBar)).toBeVisible();
    await expect(this.page.locator(this.selectors.searchInput)).toBeVisible();
  }

  /**
   * Perform basic search
   */
  async search(query: string, useButton: boolean = false): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query, { clear: true });
    
    if (useButton) {
      await this.clickElement(this.selectors.searchButton);
    } else {
      await this.pressEnter();
    }
    
    // Wait for results to load
    await this.waitForSearchResults();
  }

  /**
   * Wait for search results to load
   */
  async waitForSearchResults(): Promise<void> {
    // Wait for loading to disappear
    try {
      await this.waitForElementToHide(this.selectors.searchLoading, 10000);
    } catch {
      // Loading might not be visible
    }

    try {
      await this.waitForElementToHide(this.selectors.resultsSkeleton, 5000);
    } catch {
      // Skeleton might not be present
    }

    // Wait for either results or no results message
    try {
      await this.waitForElement(this.selectors.searchResults, 5000);
    } catch {
      // Check for no results message
      if (!(await this.isElementVisible(this.selectors.noResults))) {
        throw new Error('Search results failed to load');
      }
    }
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearSearchButton)) {
      await this.clickElement(this.selectors.clearSearchButton);
    } else {
      await this.fillInput(this.selectors.searchInput, '', { clear: true });
    }
    
    // Should return to homepage
    await expect(this.page.locator(this.selectors.searchHomepage)).toBeVisible();
  }

  /**
   * Get search results count
   */
  async getResultsCount(): Promise<number> {
    if (await this.isElementVisible(this.selectors.resultsCount)) {
      const countText = await this.getTextContent(this.selectors.resultsCount);
      const match = countText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    
    // Count cards if no explicit count
    const cards = this.page.locator(this.selectors.searchResultCard);
    return await cards.count();
  }

  /**
   * Get search results
   */
  async getSearchResults(): Promise<Array<{
    title: string;
    year?: string;
    genre?: string;
    rating?: string;
    description?: string;
  }>> {
    const resultCards = this.page.locator(this.selectors.searchResultCard);
    const count = await resultCards.count();
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const card = resultCards.nth(i);
      
      const title = await card.locator(this.selectors.mediaTitle).textContent() || '';
      const year = await card.locator(this.selectors.mediaYear).textContent() || undefined;
      const genre = await card.locator(this.selectors.mediaGenre).textContent() || undefined;
      const rating = await card.locator(this.selectors.mediaRating).textContent() || undefined;
      const description = await card.locator(this.selectors.mediaDescription).textContent() || undefined;
      
      results.push({ title, year, genre, rating, description });
    }
    
    return results;
  }

  /**
   * Advanced search functionality
   */
  async toggleAdvancedSearch(): Promise<void> {
    await this.clickElement(this.selectors.advancedSearchToggle);
    
    const isVisible = await this.isElementVisible(this.selectors.advancedFilters);
    expect(isVisible).toBe(true);
  }

  async setContentTypeFilter(type: 'movies' | 'shows' | 'music' | 'all'): Promise<void> {
    await this.selectOption(this.selectors.contentTypeFilter, type);
  }

  async setLibraryFilter(libraryName: string): Promise<void> {
    await this.selectOption(this.selectors.libraryFilter, libraryName);
  }

  async setGenreFilter(genre: string): Promise<void> {
    await this.selectOption(this.selectors.genreFilter, genre);
  }

  async setYearRange(fromYear: number, toYear: number): Promise<void> {
    await this.fillInput(this.selectors.yearFromInput, fromYear.toString());
    await this.fillInput(this.selectors.yearToInput, toYear.toString());
  }

  async setRatingRange(minRating: number, maxRating: number): Promise<void> {
    await this.fillInput(this.selectors.ratingMinInput, minRating.toString());
    await this.fillInput(this.selectors.ratingMaxInput, maxRating.toString());
  }

  async setResolutionFilter(resolution: '4K' | '1080p' | '720p' | 'SD'): Promise<void> {
    await this.selectOption(this.selectors.resolutionFilter, resolution);
  }

  /**
   * Apply advanced search filters
   */
  async applyAdvancedSearch(filters: {
    contentType?: 'movies' | 'shows' | 'music' | 'all';
    library?: string;
    genre?: string;
    yearFrom?: number;
    yearTo?: number;
    ratingMin?: number;
    ratingMax?: number;
    resolution?: '4K' | '1080p' | '720p' | 'SD';
  }): Promise<void> {
    await this.toggleAdvancedSearch();
    
    if (filters.contentType) {
      await this.setContentTypeFilter(filters.contentType);
    }
    
    if (filters.library) {
      await this.setLibraryFilter(filters.library);
    }
    
    if (filters.genre) {
      await this.setGenreFilter(filters.genre);
    }
    
    if (filters.yearFrom && filters.yearTo) {
      await this.setYearRange(filters.yearFrom, filters.yearTo);
    }
    
    if (filters.ratingMin && filters.ratingMax) {
      await this.setRatingRange(filters.ratingMin, filters.ratingMax);
    }
    
    if (filters.resolution) {
      await this.setResolutionFilter(filters.resolution);
    }
    
    await this.clickElement(this.selectors.applyFiltersButton);
    await this.waitForSearchResults();
  }

  /**
   * Reset all filters
   */
  async resetFilters(): Promise<void> {
    if (await this.isElementVisible(this.selectors.resetFiltersButton)) {
      await this.clickElement(this.selectors.resetFiltersButton);
    }
  }

  /**
   * Get active filters count
   */
  async getActiveFiltersCount(): Promise<number> {
    if (await this.isElementVisible(this.selectors.activeFiltersCount)) {
      const countText = await this.getTextContent(this.selectors.activeFiltersCount);
      return parseInt(countText) || 0;
    }
    return 0;
  }

  /**
   * Sort search results
   */
  async sortResults(sortBy: 'relevance' | 'title' | 'year' | 'rating' | 'dateAdded'): Promise<void> {
    await this.selectOption(this.selectors.sortSelect, sortBy);
    await this.waitForSearchResults();
  }

  async toggleSortDirection(): Promise<void> {
    await this.clickElement(this.selectors.sortDirection);
    await this.waitForSearchResults();
  }

  /**
   * Search suggestions
   */
  async getSearchSuggestions(partialQuery: string): Promise<string[]> {
    await this.fillInput(this.selectors.searchInput, partialQuery, { clear: true });
    
    // Wait for suggestions to appear
    try {
      await this.waitForElement(this.selectors.searchSuggestions, 3000);
      const suggestions = await this.page.locator(this.selectors.suggestion).allTextContents();
      return suggestions;
    } catch {
      return [];
    }
  }

  async selectSuggestion(suggestionText: string): Promise<void> {
    const suggestion = this.page.locator(this.selectors.suggestion).filter({ hasText: suggestionText });
    await suggestion.click();
    await this.waitForSearchResults();
  }

  /**
   * Recent and popular searches
   */
  async getRecentSearches(): Promise<string[]> {
    if (await this.isElementVisible(this.selectors.recentSearches)) {
      return await this.page.locator(this.selectors.recentSearchItem).allTextContents();
    }
    return [];
  }

  async selectRecentSearch(searchText: string): Promise<void> {
    const recentItem = this.page.locator(this.selectors.recentSearchItem).filter({ hasText: searchText });
    await recentItem.click();
    await this.waitForSearchResults();
  }

  async clearRecentSearches(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearRecentButton)) {
      await this.clickElement(this.selectors.clearRecentButton);
    }
  }

  async getPopularSearches(): Promise<string[]> {
    if (await this.isElementVisible(this.selectors.popularSearches)) {
      return await this.page.locator(this.selectors.popularSearchItem).allTextContents();
    }
    return [];
  }

  async selectPopularSearch(searchText: string): Promise<void> {
    const popularItem = this.page.locator(this.selectors.popularSearchItem).filter({ hasText: searchText });
    await popularItem.click();
    await this.waitForSearchResults();
  }

  /**
   * Result interactions
   */
  async playFromSearch(title: string): Promise<void> {
    const resultCard = this.page.locator(this.selectors.searchResultCard).filter({
      has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
    });
    
    const playButton = resultCard.locator(this.selectors.playButton);
    await playButton.click();
  }

  async viewDetailsFromSearch(title: string): Promise<void> {
    const resultCard = this.page.locator(this.selectors.searchResultCard).filter({
      has: this.page.locator(this.selectors.mediaTitle).filter({ hasText: title })
    });
    
    const detailsButton = resultCard.locator(this.selectors.viewDetailsButton);
    await detailsButton.click();
  }

  /**
   * Error handling
   */
  async hasSearchError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.searchError) ||
           await this.isElementVisible(this.selectors.noConnectionError);
  }

  async getSearchErrorMessage(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.searchError)) {
      return await this.getTextContent(this.selectors.searchError);
    }
    if (await this.isElementVisible(this.selectors.noConnectionError)) {
      return await this.getTextContent(this.selectors.noConnectionError);
    }
    return null;
  }

  /**
   * Test comprehensive search workflow
   */
  async completeSearchWorkflow(): Promise<void> {
    await this.verifyPageElements();
    
    // Test basic search
    await this.search('Matrix');
    const resultsCount = await this.getResultsCount();
    expect(resultsCount).toBeGreaterThan(0);
    
    const results = await this.getSearchResults();
    console.log(`Found ${results.length} results for "Matrix"`);
    
    // Test advanced search
    await this.applyAdvancedSearch({
      contentType: 'movies',
      yearFrom: 2000,
      yearTo: 2010
    });
    
    // Test sorting
    await this.sortResults('year');
    
    // Test filters reset
    await this.resetFilters();
    
    // Test clear search
    await this.clearSearch();
    
    // Test recent searches
    const recentSearches = await this.getRecentSearches();
    expect(recentSearches).toContain('Matrix');
  }

  /**
   * Test search performance
   */
  async measureSearchPerformance(): Promise<{
    basicSearchTime: number;
    advancedSearchTime: number;
    suggestionTime: number;
  }> {
    // Measure basic search
    const basicStart = Date.now();
    await this.search('test');
    const basicSearchTime = Date.now() - basicStart;
    
    await this.clearSearch();
    
    // Measure advanced search
    const advancedStart = Date.now();
    await this.applyAdvancedSearch({
      contentType: 'movies',
      yearFrom: 2000,
      yearTo: 2020
    });
    const advancedSearchTime = Date.now() - advancedStart;
    
    await this.clearSearch();
    
    // Measure suggestion response time
    const suggestionStart = Date.now();
    await this.getSearchSuggestions('mov');
    const suggestionTime = Date.now() - suggestionStart;
    
    return {
      basicSearchTime,
      advancedSearchTime,
      suggestionTime
    };
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test search input accessibility
    const searchInput = this.page.locator(this.selectors.searchInput);
    expect(await searchInput.getAttribute('aria-label')).toBeTruthy();
    
    // Test keyboard navigation
    await searchInput.focus();
    await this.navigateWithTab();
    
    // Test that search button is accessible
    const searchButton = this.page.locator(this.selectors.searchButton);
    if (await searchButton.isVisible()) {
      expect(await searchButton.getAttribute('aria-label')).toBeTruthy();
    }
    
    // Test that results are properly labeled
    await this.search('test');
    const firstResult = this.page.locator(this.selectors.searchResultCard).first();
    if (await firstResult.isVisible()) {
      const title = await firstResult.locator(this.selectors.mediaTitle).textContent();
      expect(title).toBeTruthy();
    }
  }
}