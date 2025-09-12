import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Services Page Object for MediaNest service management
 */
export class ServicesPage extends BasePage {
  readonly servicesList: Locator;
  readonly addServiceButton: Locator;
  readonly serviceCards: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;
  readonly sortDropdown: Locator;
  readonly refreshButton: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.servicesList = page.getByTestId('services-list');
    this.addServiceButton = page.getByTestId('add-service-button');
    this.serviceCards = page.getByTestId(/^service-card-/);
    this.searchInput = page.getByTestId('services-search');
    this.filterDropdown = page.getByTestId('services-filter');
    this.sortDropdown = page.getByTestId('services-sort');
    this.refreshButton = page.getByTestId('refresh-services');
    this.emptyState = page.getByTestId('services-empty');
    this.loadingSpinner = page.getByTestId('services-loading');
  }

  async goto() {
    await this.navigate('/services');
  }

  /**
   * Verify services page is loaded
   */
  async expectServicesPageLoaded() {
    await expect(this.servicesList).toBeVisible();
    await expect(this.addServiceButton).toBeVisible();
  }

  /**
   * Get all service cards
   */
  async getServiceCards() {
    return await this.serviceCards.all();
  }

  /**
   * Get service card by ID
   */
  getServiceCard(serviceId: string) {
    return this.page.getByTestId(`service-card-${serviceId}`);
  }

  /**
   * Toggle service status
   */
  async toggleServiceStatus(serviceId: string) {
    const serviceCard = this.getServiceCard(serviceId);
    const toggleButton = serviceCard.getByTestId('toggle-status-btn');

    const initialStatus = await serviceCard.getAttribute('data-status');
    await this.clickWithRetry(toggleButton);

    // Wait for status change
    await expect(serviceCard).not.toHaveAttribute('data-status', initialStatus);

    return await serviceCard.getAttribute('data-status');
  }

  /**
   * Retry a failed service
   */
  async retryService(serviceId: string) {
    const serviceCard = this.getServiceCard(serviceId);
    const retryButton = serviceCard.getByTestId('retry-btn');

    await expect(retryButton).toBeVisible();
    await this.clickWithRetry(retryButton);

    // Wait for retry operation
    await this.waitForResponse('**/api/services/*/retry');
  }

  /**
   * Add new service
   */
  async addService(serviceData: { name: string; url: string; type: string; description?: string }) {
    await this.clickWithRetry(this.addServiceButton);

    // Wait for modal to appear
    const modal = this.page.getByTestId('add-service-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await this.fillField(modal.getByTestId('service-name'), serviceData.name);
    await this.fillField(modal.getByTestId('service-url'), serviceData.url);

    // Select service type
    await modal.getByTestId('service-type').selectOption(serviceData.type);

    if (serviceData.description) {
      await this.fillField(modal.getByTestId('service-description'), serviceData.description);
    }

    // Submit form
    await this.clickWithRetry(modal.getByTestId('submit-service'));

    // Wait for service to be added
    await this.waitForResponse('**/api/services');
    await expect(modal).toBeHidden();

    // Verify service appears in list
    await expect(
      this.getServiceCard(serviceData.name.toLowerCase().replace(/\s+/g, '-')),
    ).toBeVisible();
  }

  /**
   * Delete service
   */
  async deleteService(serviceId: string) {
    const serviceCard = this.getServiceCard(serviceId);
    const deleteButton = serviceCard.getByTestId('delete-service-btn');

    await this.hoverAndWait(serviceCard, '[data-testid="delete-service-btn"]');
    await this.clickWithRetry(deleteButton);

    // Confirm deletion
    const confirmDialog = this.page.getByTestId('confirm-delete-modal');
    await expect(confirmDialog).toBeVisible();
    await this.clickWithRetry(confirmDialog.getByTestId('confirm-delete'));

    // Wait for deletion
    await this.waitForResponse(`**/api/services/${serviceId}`);
    await expect(serviceCard).toBeHidden();
  }

  /**
   * Search services
   */
  async searchServices(query: string) {
    await this.fillField(this.searchInput, query);
    await this.searchInput.press('Enter');

    // Wait for filtered results
    await this.waitForAnimation();
  }

  /**
   * Filter services by status
   */
  async filterByStatus(status: 'all' | 'active' | 'inactive' | 'error') {
    await this.filterDropdown.selectOption(status);
    await this.waitForAnimation();
  }

  /**
   * Sort services
   */
  async sortServices(sortBy: 'name' | 'status' | 'uptime' | 'lastChecked') {
    await this.sortDropdown.selectOption(sortBy);
    await this.waitForAnimation();
  }

  /**
   * Refresh services list
   */
  async refreshServices() {
    await this.clickWithRetry(this.refreshButton);

    // Wait for loading to complete
    await expect(this.loadingSpinner).toBeVisible();
    await expect(this.loadingSpinner).toBeHidden();
  }

  /**
   * Verify service details
   */
  async verifyServiceDetails(
    serviceId: string,
    expectedData: {
      name?: string;
      status?: string;
      uptime?: string;
      responseTime?: string;
      errorCount?: string;
    },
  ) {
    const serviceCard = this.getServiceCard(serviceId);

    if (expectedData.name) {
      await expect(serviceCard.getByTestId('service-name')).toContainText(expectedData.name);
    }

    if (expectedData.status) {
      await expect(serviceCard.getByTestId('service-status')).toContainText(expectedData.status);
    }

    if (expectedData.uptime) {
      await expect(serviceCard.getByTestId('uptime')).toContainText(expectedData.uptime);
    }

    if (expectedData.responseTime) {
      await expect(serviceCard.getByTestId('response-time')).toContainText(
        expectedData.responseTime,
      );
    }

    if (expectedData.errorCount) {
      await expect(serviceCard.getByTestId('error-count')).toContainText(expectedData.errorCount);
    }
  }

  /**
   * Verify empty state
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.serviceCards.first()).toBeHidden();
  }

  /**
   * Verify services are sorted correctly
   */
  async verifySortOrder(sortBy: 'name' | 'status') {
    const cards = await this.serviceCards.all();
    const values: string[] = [];

    for (const card of cards) {
      const value = await card
        .getByTestId(sortBy === 'name' ? 'service-name' : 'service-status')
        .textContent();
      values.push(value || '');
    }

    const sortedValues = [...values].sort();
    expect(values).toEqual(sortedValues);
  }

  /**
   * Test bulk operations
   */
  async selectMultipleServices(serviceIds: string[]) {
    for (const id of serviceIds) {
      const checkbox = this.getServiceCard(id).getByTestId('service-checkbox');
      await checkbox.check();
    }

    // Verify bulk actions are available
    await expect(this.page.getByTestId('bulk-actions')).toBeVisible();
  }

  async performBulkAction(action: 'start' | 'stop' | 'delete') {
    const bulkActions = this.page.getByTestId('bulk-actions');
    const actionButton = bulkActions.getByTestId(`bulk-${action}`);

    await this.clickWithRetry(actionButton);

    if (action === 'delete') {
      // Confirm bulk deletion
      const confirmDialog = this.page.getByTestId('confirm-bulk-delete');
      await expect(confirmDialog).toBeVisible();
      await this.clickWithRetry(confirmDialog.getByTestId('confirm-bulk-delete'));
    }

    // Wait for operation to complete
    await this.waitForResponse('**/api/services/bulk');
  }
}
