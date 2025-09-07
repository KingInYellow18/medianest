import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the Plex Collections page
 * Handles collection browsing, filtering, and management
 */
export class PlexCollectionsPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Collections")',
    collectionsHeader: '[data-testid="collections-header"]',
    
    // Collections browser
    collectionsBrowser: '[data-testid="collections-browser"]',
    collectionGrid: '[data-testid="collection-grid"]',
    collectionCard: '[data-testid="collection-card"]',
    collectionTitle: '[data-testid="collection-title"]',
    collectionDescription: '[data-testid="collection-description"]',
    collectionPoster: '[data-testid="collection-poster"]',
    collectionCount: '[data-testid="collection-count"]',
    
    // Collection filters
    collectionFilters: '[data-testid="collection-filters"]',
    libraryFilter: '[data-testid="library-filter"]',
    typeFilter: '[data-testid="type-filter"]',
    sortSelect: '[data-testid="sort-select"]',
    
    // Search functionality
    searchInput: '[data-testid="search-input"]',
    searchResults: '[data-testid="search-results"]',
    noResults: '[data-testid="no-results"]',
    
    // Collection detail modal/page
    collectionDetail: '[data-testid="collection-detail"]',
    collectionDetailTitle: '[data-testid="collection-detail-title"]',
    collectionDetailDescription: '[data-testid="collection-detail-description"]',
    collectionItems: '[data-testid="collection-items"]',
    collectionItem: '[data-testid="collection-item"]',
    
    // Collection actions
    playAllButton: '[data-testid="play-all-button"]',
    shuffleButton: '[data-testid="shuffle-button"]',
    editCollectionButton: '[data-testid="edit-collection-button"]',
    deleteCollectionButton: '[data-testid="delete-collection-button"]',
    
    // Item actions within collection
    playItemButton: '[data-testid="play-item-button"]',
    removeFromCollectionButton: '[data-testid="remove-from-collection-button"]',
    itemDetails: '[data-testid="item-details"]',
    
    // Create/Edit collection
    createCollectionButton: '[data-testid="create-collection-button"]',
    collectionForm: '[data-testid="collection-form"]',
    collectionNameInput: '[data-testid="collection-name-input"]',
    collectionDescriptionInput: '[data-testid="collection-description-input"]',
    saveCollectionButton: '[data-testid="save-collection-button"]',
    cancelEditButton: '[data-testid="cancel-edit-button"]',
    
    // Add to collection
    addToCollectionButton: '[data-testid="add-to-collection-button"]',
    addItemsModal: '[data-testid="add-items-modal"]',
    availableItems: '[data-testid="available-items"]',
    selectItemCheckbox: '[data-testid="select-item-checkbox"]',
    addSelectedButton: '[data-testid="add-selected-button"]',
    
    // View options
    viewToggle: '[data-testid="view-toggle"]',
    gridView: '[data-testid="grid-view"]',
    listView: '[data-testid="list-view"]',
    
    // Loading states
    collectionsSkeleton: '[data-testid="collections-skeleton"]',
    collectionDetailSkeleton: '[data-testid="collection-detail-skeleton"]',
    
    // Empty states
    noCollections: '[data-testid="no-collections"]',
    emptyCollection: '[data-testid="empty-collection"]',
    
    // Error states
    collectionsError: '[data-testid="collections-error"]',
    loadError: '[data-testid="load-error"]',
    retryButton: '[data-testid="retry-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/plex/collections');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.collectionsBrowser);
  }

  getPageTitle(): string {
    return 'Plex Collections';
  }

  protected getMainContentSelector(): string {
    return this.selectors.collectionsBrowser;
  }

  /**
   * Verify page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.collectionsBrowser)).toBeVisible();
  }

  /**
   * Wait for collections to load
   */
  async waitForCollectionsLoad(): Promise<void> {
    // Wait for skeleton loaders to disappear
    try {
      await this.waitForElementToHide(this.selectors.collectionsSkeleton, 10000);
    } catch {
      // Skeletons might not be present
    }

    // Wait for either collections or empty state
    try {
      await this.waitForElement(this.selectors.collectionGrid, 5000);
    } catch {
      // Check for empty state
      if (!(await this.isElementVisible(this.selectors.noCollections))) {
        throw new Error('Collections failed to load - no grid or empty state message');
      }
    }
  }

  /**
   * Get collections list
   */
  async getCollections(): Promise<Array<{
    title: string;
    description?: string;
    itemCount: number;
  }>> {
    await this.waitForCollectionsLoad();
    
    const collectionCards = this.page.locator(this.selectors.collectionCard);
    const count = await collectionCards.count();
    const collections = [];
    
    for (let i = 0; i < count; i++) {
      const card = collectionCards.nth(i);
      
      const title = await card.locator(this.selectors.collectionTitle).textContent() || '';
      const description = await card.locator(this.selectors.collectionDescription).textContent() || undefined;
      const countText = await card.locator(this.selectors.collectionCount).textContent() || '0';
      const itemCount = parseInt(countText.match(/\d+/)?.[0] || '0');
      
      collections.push({ title, description, itemCount });
    }
    
    return collections;
  }

  /**
   * Search collections
   */
  async searchCollections(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query, { clear: true });
    await this.waitForCollectionsLoad();
  }

  async clearSearch(): Promise<void> {
    await this.fillInput(this.selectors.searchInput, '', { clear: true });
    await this.waitForCollectionsLoad();
  }

  /**
   * Filter collections
   */
  async filterByLibrary(libraryName: string): Promise<void> {
    await this.selectOption(this.selectors.libraryFilter, libraryName);
    await this.waitForCollectionsLoad();
  }

  async filterByType(type: 'movies' | 'shows' | 'music' | 'all'): Promise<void> {
    await this.selectOption(this.selectors.typeFilter, type);
    await this.waitForCollectionsLoad();
  }

  /**
   * Sort collections
   */
  async sortCollections(sortBy: 'name' | 'dateCreated' | 'itemCount' | 'lastUpdated'): Promise<void> {
    await this.selectOption(this.selectors.sortSelect, sortBy);
    await this.waitForCollectionsLoad();
  }

  /**
   * View collection details
   */
  async viewCollectionDetails(collectionTitle: string): Promise<void> {
    const collectionCard = this.page.locator(this.selectors.collectionCard).filter({
      has: this.page.locator(this.selectors.collectionTitle).filter({ hasText: collectionTitle })
    });
    
    await collectionCard.click();
    await this.waitForElement(this.selectors.collectionDetail);
  }

  /**
   * Get collection items
   */
  async getCollectionItems(): Promise<Array<{
    title: string;
    type: string;
    year?: string;
  }>> {
    const items = this.page.locator(this.selectors.collectionItem);
    const count = await items.count();
    const itemsList = [];
    
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const title = await item.locator('[data-testid="item-title"]').textContent() || '';
      const type = await item.locator('[data-testid="item-type"]').textContent() || '';
      const year = await item.locator('[data-testid="item-year"]').textContent() || undefined;
      
      itemsList.push({ title, type, year });
    }
    
    return itemsList;
  }

  /**
   * Collection playback actions
   */
  async playCollection(): Promise<void> {
    await this.clickElement(this.selectors.playAllButton);
    // Wait for player to initialize
    await this.page.waitForTimeout(2000);
  }

  async shuffleCollection(): Promise<void> {
    await this.clickElement(this.selectors.shuffleButton);
    // Wait for shuffle to apply and playback to start
    await this.page.waitForTimeout(2000);
  }

  /**
   * Play specific item from collection
   */
  async playItemFromCollection(itemTitle: string): Promise<void> {
    const item = this.page.locator(this.selectors.collectionItem).filter({
      has: this.page.locator('[data-testid="item-title"]').filter({ hasText: itemTitle })
    });
    
    const playButton = item.locator(this.selectors.playItemButton);
    await playButton.click();
  }

  /**
   * Collection management
   */
  async createCollection(name: string, description?: string): Promise<void> {
    await this.clickElement(this.selectors.createCollectionButton);
    await this.waitForElement(this.selectors.collectionForm);
    
    await this.fillInput(this.selectors.collectionNameInput, name);
    
    if (description) {
      await this.fillInput(this.selectors.collectionDescriptionInput, description);
    }
    
    await this.clickElement(this.selectors.saveCollectionButton);
    await this.waitForCollectionsLoad();
  }

  async editCollection(name: string, newDescription?: string): Promise<void> {
    await this.clickElement(this.selectors.editCollectionButton);
    await this.waitForElement(this.selectors.collectionForm);
    
    if (newDescription) {
      await this.fillInput(this.selectors.collectionDescriptionInput, newDescription, { clear: true });
    }
    
    await this.clickElement(this.selectors.saveCollectionButton);
    await this.waitForLoading();
  }

  async deleteCollection(): Promise<void> {
    await this.clickElement(this.selectors.deleteCollectionButton);
    
    // Confirm deletion in modal/dialog
    const confirmButton = this.page.locator('[data-testid="confirm-delete-button"]');
    await confirmButton.click();
    
    await this.waitForLoading();
  }

  /**
   * Add items to collection
   */
  async addItemsToCollection(itemTitles: string[]): Promise<void> {
    await this.clickElement(this.selectors.addToCollectionButton);
    await this.waitForElement(this.selectors.addItemsModal);
    
    // Select items
    for (const title of itemTitles) {
      const item = this.page.locator(this.selectors.availableItems).filter({
        has: this.page.locator('[data-testid="item-title"]').filter({ hasText: title })
      });
      
      const checkbox = item.locator(this.selectors.selectItemCheckbox);
      await checkbox.check();
    }
    
    await this.clickElement(this.selectors.addSelectedButton);
    await this.waitForLoading();
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(itemTitle: string): Promise<void> {
    const item = this.page.locator(this.selectors.collectionItem).filter({
      has: this.page.locator('[data-testid="item-title"]').filter({ hasText: itemTitle })
    });
    
    const removeButton = item.locator(this.selectors.removeFromCollectionButton);
    await removeButton.click();
    
    // Confirm removal
    const confirmButton = this.page.locator('[data-testid="confirm-remove-button"]');
    await confirmButton.click();
    
    await this.waitForLoading();
  }

  /**
   * View modes
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
   * Error handling
   */
  async hasCollectionsError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.collectionsError) ||
           await this.isElementVisible(this.selectors.loadError);
  }

  async retryLoadCollections(): Promise<void> {
    if (await this.isElementVisible(this.selectors.retryButton)) {
      await this.clickElement(this.selectors.retryButton);
      await this.waitForCollectionsLoad();
    }
  }

  /**
   * Check for empty states
   */
  async hasCollections(): Promise<boolean> {
    await this.waitForCollectionsLoad();
    return !(await this.isElementVisible(this.selectors.noCollections));
  }

  async isCollectionEmpty(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.emptyCollection);
  }

  /**
   * Navigation helpers
   */
  async goBackToCollections(): Promise<void> {
    await this.page.goBack();
    await this.waitForCollectionsLoad();
  }

  /**
   * Test comprehensive collections workflow
   */
  async completeCollectionsWorkflow(): Promise<void> {
    await this.verifyPageElements();
    await this.waitForCollectionsLoad();
    
    // Get collections
    const collections = await this.getCollections();
    console.log(`Found ${collections.length} collections`);
    
    if (collections.length === 0) {
      // Test empty state
      expect(await this.isElementVisible(this.selectors.noCollections)).toBe(true);
      return;
    }
    
    // Test search
    await this.searchCollections(collections[0].title.substring(0, 3));
    const searchResults = await this.getCollections();
    expect(searchResults.length).toBeGreaterThan(0);
    
    await this.clearSearch();
    
    // Test sorting
    await this.sortCollections('name');
    
    // Test view modes
    await this.switchToListView();
    await this.switchToGridView();
    
    // Test collection details
    if (collections.length > 0) {
      await this.viewCollectionDetails(collections[0].title);
      
      const items = await this.getCollectionItems();
      console.log(`Collection "${collections[0].title}" has ${items.length} items`);
      
      if (items.length > 0) {
        // Test playback
        await this.playCollection();
      }
    }
  }

  /**
   * Test collection management workflow
   */
  async testCollectionManagement(): Promise<void> {
    const testCollectionName = `Test Collection ${Date.now()}`;
    
    // Create collection
    await this.createCollection(testCollectionName, 'Test collection description');
    
    // Verify creation
    const collections = await this.getCollections();
    expect(collections.some(c => c.title === testCollectionName)).toBe(true);
    
    // View collection details
    await this.viewCollectionDetails(testCollectionName);
    
    // Edit collection
    await this.editCollection(testCollectionName, 'Updated description');
    
    // Delete collection
    await this.deleteCollection();
    
    // Verify deletion
    await this.waitForCollectionsLoad();
    const updatedCollections = await this.getCollections();
    expect(updatedCollections.some(c => c.title === testCollectionName)).toBe(false);
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test collection cards accessibility
    const collectionCards = await this.page.locator(this.selectors.collectionCard).all();
    for (const card of collectionCards.slice(0, 3)) {
      const title = await card.locator(this.selectors.collectionTitle).textContent();
      expect(title).toBeTruthy();
      
      // Cards should be keyboard accessible
      const tabIndex = await card.getAttribute('tabindex');
      expect(tabIndex).not.toBe('-1');
      
      // Should have proper ARIA labels
      const ariaLabel = await card.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
    
    // Test keyboard navigation
    await this.navigateWithTab();
    
    // Test that action buttons are accessible
    const createButton = this.page.locator(this.selectors.createCollectionButton);
    if (await createButton.isVisible()) {
      expect(await createButton.getAttribute('aria-label')).toBeTruthy();
    }
  }

  /**
   * Test performance
   */
  async measureCollectionsPerformance(): Promise<{
    loadTime: number;
    searchTime: number;
    detailLoadTime: number;
  }> {
    // Measure initial load time
    const loadStart = Date.now();
    await this.waitForCollectionsLoad();
    const loadTime = Date.now() - loadStart;
    
    // Measure search time
    const searchStart = Date.now();
    await this.searchCollections('test');
    const searchTime = Date.now() - searchStart;
    
    await this.clearSearch();
    
    // Measure detail load time
    const collections = await this.getCollections();
    if (collections.length > 0) {
      const detailStart = Date.now();
      await this.viewCollectionDetails(collections[0].title);
      const detailLoadTime = Date.now() - detailStart;
      
      await this.goBackToCollections();
      
      return { loadTime, searchTime, detailLoadTime };
    }
    
    return { loadTime, searchTime, detailLoadTime: 0 };
  }
}