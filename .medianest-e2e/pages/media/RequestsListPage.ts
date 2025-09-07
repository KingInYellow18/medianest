import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the Requests List page
 * Handles request viewing, filtering, status management, and bulk operations
 */
export class RequestsListPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Requests")',
    requestsList: '[data-testid="requests-list"]',
    
    // Request table/grid
    requestsTable: '[data-testid="requests-table"]',
    requestRow: '[data-testid="request-row"]',
    requestCard: '[data-testid="request-card"]',
    
    // Request columns/fields
    requestTitle: '[data-testid="request-title"]',
    requestType: '[data-testid="request-type"]',
    requestStatus: '[data-testid="request-status"]',
    requestDate: '[data-testid="request-date"]',
    requestUser: '[data-testid="request-user"]',
    requestPriority: '[data-testid="request-priority"]',
    requestProgress: '[data-testid="request-progress"]',
    
    // Status badges
    statusPending: '[data-status="pending"]',
    statusApproved: '[data-status="approved"]',
    statusInProgress: '[data-status="in-progress"]',
    statusCompleted: '[data-status="completed"]',
    statusRejected: '[data-status="rejected"]',
    statusFailed: '[data-status="failed"]',
    
    // Filters
    filtersPanel: '[data-testid="filters-panel"]',
    statusFilter: '[data-testid="status-filter"]',
    typeFilter: '[data-testid="type-filter"]',
    userFilter: '[data-testid="user-filter"]',
    dateRangeFilter: '[data-testid="date-range-filter"]',
    priorityFilter: '[data-testid="priority-filter"]',
    
    // Filter controls
    applyFiltersButton: '[data-testid="apply-filters-button"]',
    clearFiltersButton: '[data-testid="clear-filters-button"]',
    filtersToggle: '[data-testid="filters-toggle"]',
    activeFiltersCount: '[data-testid="active-filters-count"]',
    
    // Search
    searchInput: '[data-testid="search-input"]',
    searchButton: '[data-testid="search-button"]',
    clearSearchButton: '[data-testid="clear-search-button"]',
    
    // Sorting
    sortSelect: '[data-testid="sort-select"]',
    sortDirection: '[data-testid="sort-direction"]',
    
    // Pagination
    pagination: '[data-testid="pagination"]',
    prevPage: '[data-testid="prev-page"]',
    nextPage: '[data-testid="next-page"]',
    pageNumber: '[data-testid="page-number"]',
    currentPage: '[data-testid="current-page"]',
    totalPages: '[data-testid="total-pages"]',
    itemsPerPage: '[data-testid="items-per-page"]',
    
    // View controls
    viewToggle: '[data-testid="view-toggle"]',
    tableView: '[data-testid="table-view"]',
    cardView: '[data-testid="card-view"]',
    
    // Request actions
    requestActions: '[data-testid="request-actions"]',
    approveButton: '[data-testid="approve-button"]',
    rejectButton: '[data-testid="reject-button"]',
    retryButton: '[data-testid="retry-button"]',
    cancelButton: '[data-testid="cancel-button"]',
    deleteButton: '[data-testid="delete-button"]',
    editButton: '[data-testid="edit-button"]',
    
    // Bulk operations
    bulkActions: '[data-testid="bulk-actions"]',
    selectAllCheckbox: '[data-testid="select-all-checkbox"]',
    requestCheckbox: '[data-testid="request-checkbox"]',
    selectedCount: '[data-testid="selected-count"]',
    bulkApproveButton: '[data-testid="bulk-approve-button"]',
    bulkRejectButton: '[data-testid="bulk-reject-button"]',
    bulkDeleteButton: '[data-testid="bulk-delete-button"]',
    
    // Request details modal
    requestDetailsModal: '[data-testid="request-details-modal"]',
    requestDetailsTitle: '[data-testid="request-details-title"]',
    requestDetailsDescription: '[data-testid="request-details-description"]',
    requestDetailsNotes: '[data-testid="request-details-notes"]',
    requestDetailsHistory: '[data-testid="request-details-history"]',
    
    // Comments/Notes
    commentsSection: '[data-testid="comments-section"]',
    commentInput: '[data-testid="comment-input"]',
    addCommentButton: '[data-testid="add-comment-button"]',
    commentItem: '[data-testid="comment-item"]',
    
    // Statistics
    requestsStats: '[data-testid="requests-stats"]',
    totalRequests: '[data-testid="total-requests"]',
    pendingCount: '[data-testid="pending-count"]',
    completedCount: '[data-testid="completed-count"]',
    rejectedCount: '[data-testid="rejected-count"]',
    
    // Export/Import
    exportButton: '[data-testid="export-button"]',
    exportModal: '[data-testid="export-modal"]',
    exportFormatSelect: '[data-testid="export-format-select"]',
    exportRangeSelect: '[data-testid="export-range-select"]',
    downloadExportButton: '[data-testid="download-export-button"]',
    
    // Loading states
    requestsLoading: '[data-testid="requests-loading"]',
    tableLoading: '[data-testid="table-loading"]',
    actionLoading: '[data-testid="action-loading"]',
    
    // Error states
    requestsError: '[data-testid="requests-error"]',
    noRequests: '[data-testid="no-requests"]',
    loadError: '[data-testid="load-error"]',
    retryLoadButton: '[data-testid="retry-load-button"]',
    
    // Notifications
    successNotification: '[data-testid="success-notification"]',
    errorNotification: '[data-testid="error-notification"]',
    warningNotification: '[data-testid="warning-notification"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/requests');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.requestsList);
  }

  getPageTitle(): string {
    return 'Requests List';
  }

  protected getMainContentSelector(): string {
    return this.selectors.requestsList;
  }

  /**
   * Verify page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.requestsList)).toBeVisible();
  }

  /**
   * Wait for requests to load
   */
  async waitForRequestsLoad(): Promise<void> {
    try {
      await this.waitForElementToHide(this.selectors.requestsLoading, 10000);
    } catch {
      // Loading might not be visible
    }

    try {
      await this.waitForElementToHide(this.selectors.tableLoading, 5000);
    } catch {
      // Table loading might not be present
    }

    // Wait for either requests or empty state
    try {
      await this.waitForElement(this.selectors.requestsTable, 5000);
    } catch {
      // Check for empty state
      if (!(await this.isElementVisible(this.selectors.noRequests))) {
        throw new Error('Requests failed to load - no table or empty state message');
      }
    }
  }

  /**
   * Get requests list
   */
  async getRequests(): Promise<Array<{
    title: string;
    type: string;
    status: string;
    date: string;
    user: string;
    priority: string;
  }>> {
    await this.waitForRequestsLoad();
    
    const requestRows = this.page.locator(this.selectors.requestRow);
    const count = await requestRows.count();
    const requests = [];
    
    for (let i = 0; i < count; i++) {
      const row = requestRows.nth(i);
      
      const title = await row.locator(this.selectors.requestTitle).textContent() || '';
      const type = await row.locator(this.selectors.requestType).textContent() || '';
      const status = await row.locator(this.selectors.requestStatus).textContent() || '';
      const date = await row.locator(this.selectors.requestDate).textContent() || '';
      const user = await row.locator(this.selectors.requestUser).textContent() || '';
      const priority = await row.locator(this.selectors.requestPriority).textContent() || '';
      
      requests.push({ title, type, status, date, user, priority });
    }
    
    return requests;
  }

  /**
   * Search requests
   */
  async searchRequests(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query, { clear: true });
    
    if (await this.isElementVisible(this.selectors.searchButton)) {
      await this.clickElement(this.selectors.searchButton);
    } else {
      await this.pressEnter();
    }
    
    await this.waitForRequestsLoad();
  }

  async clearSearch(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearSearchButton)) {
      await this.clickElement(this.selectors.clearSearchButton);
    } else {
      await this.fillInput(this.selectors.searchInput, '', { clear: true });
    }
    
    await this.waitForRequestsLoad();
  }

  /**
   * Apply filters
   */
  async filterByStatus(status: 'pending' | 'approved' | 'in-progress' | 'completed' | 'rejected' | 'failed' | 'all'): Promise<void> {
    await this.selectOption(this.selectors.statusFilter, status);
    await this.waitForRequestsLoad();
  }

  async filterByType(type: 'movie' | 'tv' | 'music' | 'all'): Promise<void> {
    await this.selectOption(this.selectors.typeFilter, type);
    await this.waitForRequestsLoad();
  }

  async filterByUser(username: string): Promise<void> {
    await this.selectOption(this.selectors.userFilter, username);
    await this.waitForRequestsLoad();
  }

  async filterByPriority(priority: 'low' | 'normal' | 'high' | 'urgent' | 'all'): Promise<void> {
    await this.selectOption(this.selectors.priorityFilter, priority);
    await this.waitForRequestsLoad();
  }

  async setDateRangeFilter(fromDate: string, toDate: string): Promise<void> {
    const dateRangeFilter = this.page.locator(this.selectors.dateRangeFilter);
    
    const fromInput = dateRangeFilter.locator('[data-testid="date-from"]');
    const toInput = dateRangeFilter.locator('[data-testid="date-to"]');
    
    await this.fillInput(fromInput.toString(), fromDate);
    await this.fillInput(toInput.toString(), toDate);
    
    await this.waitForRequestsLoad();
  }

  async applyFilters(): Promise<void> {
    if (await this.isElementVisible(this.selectors.applyFiltersButton)) {
      await this.clickElement(this.selectors.applyFiltersButton);
      await this.waitForRequestsLoad();
    }
  }

  async clearAllFilters(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearFiltersButton)) {
      await this.clickElement(this.selectors.clearFiltersButton);
      await this.waitForRequestsLoad();
    }
  }

  async getActiveFiltersCount(): Promise<number> {
    if (await this.isElementVisible(this.selectors.activeFiltersCount)) {
      const countText = await this.getTextContent(this.selectors.activeFiltersCount);
      return parseInt(countText) || 0;
    }
    return 0;
  }

  /**
   * Sort requests
   */
  async sortBy(sortBy: 'title' | 'date' | 'status' | 'priority' | 'user'): Promise<void> {
    await this.selectOption(this.selectors.sortSelect, sortBy);
    await this.waitForRequestsLoad();
  }

  async toggleSortDirection(): Promise<void> {
    await this.clickElement(this.selectors.sortDirection);
    await this.waitForRequestsLoad();
  }

  /**
   * View modes
   */
  async switchToTableView(): Promise<void> {
    const tableToggle = this.page.locator(this.selectors.viewToggle).locator('[data-view="table"]');
    await tableToggle.click();
    await expect(this.page.locator(this.selectors.tableView)).toBeVisible();
  }

  async switchToCardView(): Promise<void> {
    const cardToggle = this.page.locator(this.selectors.viewToggle).locator('[data-view="card"]');
    await cardToggle.click();
    await expect(this.page.locator(this.selectors.cardView)).toBeVisible();
  }

  /**
   * Request actions
   */
  async approveRequest(requestTitle: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    const approveButton = requestRow.locator(this.selectors.approveButton);
    
    await approveButton.click();
    await this.waitForActionComplete();
  }

  async rejectRequest(requestTitle: string, reason?: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    const rejectButton = requestRow.locator(this.selectors.rejectButton);
    
    await rejectButton.click();
    
    // Fill rejection reason if modal appears
    if (reason) {
      const reasonInput = this.page.locator('[data-testid="rejection-reason"]');
      if (await reasonInput.isVisible()) {
        await this.fillInput(reasonInput.toString(), reason);
        await this.clickElement('[data-testid="confirm-reject-button"]');
      }
    }
    
    await this.waitForActionComplete();
  }

  async retryRequest(requestTitle: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    const retryButton = requestRow.locator(this.selectors.retryButton);
    
    await retryButton.click();
    await this.waitForActionComplete();
  }

  async cancelRequest(requestTitle: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    const cancelButton = requestRow.locator(this.selectors.cancelButton);
    
    await cancelButton.click();
    
    // Confirm cancellation
    const confirmButton = this.page.locator('[data-testid="confirm-cancel-button"]');
    await confirmButton.click();
    
    await this.waitForActionComplete();
  }

  async deleteRequest(requestTitle: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    const deleteButton = requestRow.locator(this.selectors.deleteButton);
    
    await deleteButton.click();
    
    // Confirm deletion
    const confirmButton = this.page.locator('[data-testid="confirm-delete-button"]');
    await confirmButton.click();
    
    await this.waitForActionComplete();
  }

  /**
   * View request details
   */
  async viewRequestDetails(requestTitle: string): Promise<void> {
    const requestRow = await this.findRequestRow(requestTitle);
    await requestRow.click();
    
    await this.waitForElement(this.selectors.requestDetailsModal);
  }

  async getRequestDetails(): Promise<{
    title: string;
    description: string;
    notes: string;
    history: Array<{ status: string; date: string; comment?: string }>;
  }> {
    const title = await this.getTextContent(this.selectors.requestDetailsTitle);
    const description = await this.getTextContent(this.selectors.requestDetailsDescription);
    const notes = await this.getTextContent(this.selectors.requestDetailsNotes);
    
    // Get history
    const historyItems = this.page.locator(this.selectors.requestDetailsHistory).locator('[data-testid="history-item"]');
    const historyCount = await historyItems.count();
    const history = [];
    
    for (let i = 0; i < historyCount; i++) {
      const item = historyItems.nth(i);
      const status = await item.locator('[data-testid="history-status"]').textContent() || '';
      const date = await item.locator('[data-testid="history-date"]').textContent() || '';
      const comment = await item.locator('[data-testid="history-comment"]').textContent() || undefined;
      
      history.push({ status, date, comment });
    }
    
    return { title, description, notes, history };
  }

  /**
   * Comments
   */
  async addComment(requestTitle: string, comment: string): Promise<void> {
    await this.viewRequestDetails(requestTitle);
    
    await this.fillInput(this.selectors.commentInput, comment);
    await this.clickElement(this.selectors.addCommentButton);
    
    await this.waitForLoading();
  }

  async getComments(): Promise<Array<{ user: string; date: string; text: string }>> {
    const commentItems = this.page.locator(this.selectors.commentItem);
    const count = await commentItems.count();
    const comments = [];
    
    for (let i = 0; i < count; i++) {
      const item = commentItems.nth(i);
      const user = await item.locator('[data-testid="comment-user"]').textContent() || '';
      const date = await item.locator('[data-testid="comment-date"]').textContent() || '';
      const text = await item.locator('[data-testid="comment-text"]').textContent() || '';
      
      comments.push({ user, date, text });
    }
    
    return comments;
  }

  /**
   * Bulk operations
   */
  async selectAllRequests(): Promise<void> {
    await this.clickElement(this.selectors.selectAllCheckbox);
  }

  async selectRequests(requestTitles: string[]): Promise<void> {
    for (const title of requestTitles) {
      const requestRow = await this.findRequestRow(title);
      const checkbox = requestRow.locator(this.selectors.requestCheckbox);
      await checkbox.check();
    }
  }

  async getSelectedCount(): Promise<number> {
    const countText = await this.getTextContent(this.selectors.selectedCount);
    const match = countText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async bulkApprove(): Promise<void> {
    await this.clickElement(this.selectors.bulkApproveButton);
    await this.waitForActionComplete();
  }

  async bulkReject(reason?: string): Promise<void> {
    await this.clickElement(this.selectors.bulkRejectButton);
    
    if (reason) {
      const reasonInput = this.page.locator('[data-testid="bulk-rejection-reason"]');
      await this.fillInput(reasonInput.toString(), reason);
      await this.clickElement('[data-testid="confirm-bulk-reject-button"]');
    }
    
    await this.waitForActionComplete();
  }

  async bulkDelete(): Promise<void> {
    await this.clickElement(this.selectors.bulkDeleteButton);
    
    // Confirm bulk deletion
    const confirmButton = this.page.locator('[data-testid="confirm-bulk-delete-button"]');
    await confirmButton.click();
    
    await this.waitForActionComplete();
  }

  /**
   * Statistics
   */
  async getRequestsStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    rejected: number;
  }> {
    const totalText = await this.getTextContent(this.selectors.totalRequests);
    const pendingText = await this.getTextContent(this.selectors.pendingCount);
    const completedText = await this.getTextContent(this.selectors.completedCount);
    const rejectedText = await this.getTextContent(this.selectors.rejectedCount);
    
    return {
      total: parseInt(totalText) || 0,
      pending: parseInt(pendingText) || 0,
      completed: parseInt(completedText) || 0,
      rejected: parseInt(rejectedText) || 0,
    };
  }

  /**
   * Export functionality
   */
  async exportRequests(format: 'csv' | 'json' | 'excel', range: 'all' | 'filtered' | 'selected'): Promise<void> {
    await this.clickElement(this.selectors.exportButton);
    await this.waitForElement(this.selectors.exportModal);
    
    await this.selectOption(this.selectors.exportFormatSelect, format);
    await this.selectOption(this.selectors.exportRangeSelect, range);
    
    // Start download
    const downloadPromise = this.page.waitForDownload();
    await this.clickElement(this.selectors.downloadExportButton);
    const download = await downloadPromise;
    
    // Return download for further processing if needed
    return download;
  }

  /**
   * Pagination
   */
  async goToNextPage(): Promise<boolean> {
    if (await this.isElementVisible(this.selectors.nextPage)) {
      const isDisabled = await this.page.locator(this.selectors.nextPage).isDisabled();
      if (!isDisabled) {
        await this.clickElement(this.selectors.nextPage);
        await this.waitForRequestsLoad();
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
        await this.waitForRequestsLoad();
        return true;
      }
    }
    return false;
  }

  async goToPage(pageNumber: number): Promise<void> {
    const pageLink = this.page.locator(this.selectors.pageNumber).filter({ hasText: pageNumber.toString() });
    await pageLink.click();
    await this.waitForRequestsLoad();
  }

  async getCurrentPage(): Promise<number> {
    const currentPageText = await this.getTextContent(this.selectors.currentPage);
    return parseInt(currentPageText) || 1;
  }

  async getTotalPages(): Promise<number> {
    const totalPagesText = await this.getTextContent(this.selectors.totalPages);
    return parseInt(totalPagesText) || 1;
  }

  async setItemsPerPage(itemsCount: number): Promise<void> {
    await this.selectOption(this.selectors.itemsPerPage, itemsCount.toString());
    await this.waitForRequestsLoad();
  }

  /**
   * Helper methods
   */
  private async findRequestRow(requestTitle: string): Promise<Locator> {
    return this.page.locator(this.selectors.requestRow).filter({
      has: this.page.locator(this.selectors.requestTitle).filter({ hasText: requestTitle })
    });
  }

  private async waitForActionComplete(): Promise<void> {
    try {
      await this.waitForElementToHide(this.selectors.actionLoading, 10000);
    } catch {
      // Action loading might not be visible
    }
    
    await this.waitForLoading();
  }

  /**
   * Error handling
   */
  async hasRequestsError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.requestsError) ||
           await this.isElementVisible(this.selectors.loadError);
  }

  async retryLoadRequests(): Promise<void> {
    if (await this.isElementVisible(this.selectors.retryLoadButton)) {
      await this.clickElement(this.selectors.retryLoadButton);
      await this.waitForRequestsLoad();
    }
  }

  /**
   * Complete requests management workflow
   */
  async completeRequestsWorkflow(): Promise<void> {
    await this.verifyPageElements();
    await this.waitForRequestsLoad();
    
    // Get statistics
    const stats = await this.getRequestsStats();
    console.log('Requests stats:', stats);
    
    // Get requests list
    const requests = await this.getRequests();
    console.log(`Found ${requests.length} requests`);
    
    if (requests.length === 0) {
      expect(await this.isElementVisible(this.selectors.noRequests)).toBe(true);
      return;
    }
    
    // Test filtering
    await this.filterByStatus('pending');
    const pendingRequests = await this.getRequests();
    
    await this.clearAllFilters();
    
    // Test sorting
    await this.sortBy('date');
    
    // Test view modes
    await this.switchToCardView();
    await this.switchToTableView();
    
    // Test request details
    if (requests.length > 0) {
      await this.viewRequestDetails(requests[0].title);
      const details = await this.getRequestDetails();
      console.log(`Request details for "${details.title}"`);
      
      await this.closeModal();
    }
    
    // Test search
    if (requests.length > 0) {
      await this.searchRequests(requests[0].title.substring(0, 3));
      await this.clearSearch();
    }
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Test table accessibility
    const table = this.page.locator(this.selectors.requestsTable);
    if (await table.isVisible()) {
      // Check table headers
      const headers = await table.locator('th').all();
      for (const header of headers) {
        const text = await header.textContent();
        expect(text).toBeTruthy();
      }
      
      // Check table rows are accessible
      const rows = await table.locator('tr').all();
      for (const row of rows.slice(0, 3)) {
        const ariaLabel = await row.getAttribute('aria-label');
        expect(ariaLabel || await row.textContent()).toBeTruthy();
      }
    }
    
    // Test filter accessibility
    const statusFilter = this.page.locator(this.selectors.statusFilter);
    if (await statusFilter.isVisible()) {
      const label = this.page.locator('label[for*="status"]');
      await expect(label).toBeVisible();
    }
    
    // Test keyboard navigation
    await this.navigateWithTab();
  }
}