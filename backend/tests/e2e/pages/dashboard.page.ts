import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  // Selectors
  private readonly selectors = {
    dashboard: '[data-testid="dashboard"]',
    welcomeMessage: '[data-testid="welcome-message"]',
    userMenu: '[data-testid="user-menu"]',
    userMenuButton: '[data-testid="user-menu-button"]',
    logoutButton: '[data-testid="logout-button"]',
    profileLink: '[data-testid="profile-link"]',
    navigation: '[data-testid="main-navigation"]',
    mediaRequestsCard: '[data-testid="media-requests-card"]',
    recentRequestsSection: '[data-testid="recent-requests-section"]',
    statsCard: '[data-testid="stats-card"]',
    pendingRequestsCount: '[data-testid="pending-requests-count"]',
    completedRequestsCount: '[data-testid="completed-requests-count"]',
    newRequestButton: '[data-testid="new-request-button"]',
    searchBar: '[data-testid="search-bar"]',
    filterDropdown: '[data-testid="filter-dropdown"]',
    requestItem: '[data-testid="request-item"]',
    loadingSpinner: '[data-testid="loading-spinner"]',
    errorMessage: '[data-testid="error-message"]',
    refreshButton: '[data-testid="refresh-button"]',
    sidebar: '[data-testid="sidebar"]',
    mainContent: '[data-testid="main-content"]',
    notificationsButton: '[data-testid="notifications-button"]',
    notificationsBadge: '[data-testid="notifications-badge"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard
   */
  async navigate(): Promise<void> {
    await this.goto('/dashboard');
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.dashboard);
  }

  /**
   * Verify user is on dashboard
   */
  async verifyOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.page.locator(this.selectors.dashboard)).toBeVisible();
  }

  /**
   * Get welcome message text
   */
  async getWelcomeMessage(): Promise<string> {
    return await this.getTextContent(this.selectors.welcomeMessage);
  }

  /**
   * Click user menu button
   */
  async clickUserMenu(): Promise<void> {
    await this.clickElement(this.selectors.userMenuButton);
    await this.waitForElement(this.selectors.userMenu);
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.clickUserMenu();
    await this.clickElement(this.selectors.logoutButton);

    // Wait for redirect to login page
    await expect(this.page).toHaveURL(/\/login/);
  }

  /**
   * Go to profile page
   */
  async goToProfile(): Promise<void> {
    await this.clickUserMenu();
    await this.clickElement(this.selectors.profileLink);
  }

  /**
   * Click new request button
   */
  async clickNewRequest(): Promise<void> {
    await this.clickElement(this.selectors.newRequestButton);
  }

  /**
   * Get pending requests count
   */
  async getPendingRequestsCount(): Promise<number> {
    const countText = await this.getTextContent(this.selectors.pendingRequestsCount);
    return parseInt(countText) || 0;
  }

  /**
   * Get completed requests count
   */
  async getCompletedRequestsCount(): Promise<number> {
    const countText = await this.getTextContent(this.selectors.completedRequestsCount);
    return parseInt(countText) || 0;
  }

  /**
   * Search for requests
   */
  async searchRequests(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchBar, query);
    await this.page.keyboard.press('Enter');
    await this.waitForNetworkIdle();
  }

  /**
   * Apply filter
   */
  async applyFilter(filterValue: string): Promise<void> {
    await this.clickElement(this.selectors.filterDropdown);
    await this.clickElement(`[data-testid="filter-${filterValue}"]`);
    await this.waitForNetworkIdle();
  }

  /**
   * Get all request items
   */
  async getRequestItems(): Promise<any[]> {
    const items = await this.page.locator(this.selectors.requestItem).all();
    const requestData = [];

    for (const item of items) {
      const title = await item.locator('[data-testid="request-title"]').textContent();
      const status = await item.locator('[data-testid="request-status"]').textContent();
      const date = await item.locator('[data-testid="request-date"]').textContent();

      requestData.push({
        title: title?.trim(),
        status: status?.trim(),
        date: date?.trim(),
      });
    }

    return requestData;
  }

  /**
   * Click on specific request item
   */
  async clickRequestItem(index: number = 0): Promise<void> {
    const items = await this.page.locator(this.selectors.requestItem).all();
    if (items[index]) {
      await items[index].click();
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshData(): Promise<void> {
    await this.clickElement(this.selectors.refreshButton);
    await this.waitForNetworkIdle();
  }

  /**
   * Check if loading spinner is visible
   */
  async isLoadingSpinnerVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.loadingSpinner);
  }

  /**
   * Wait for data to load
   */
  async waitForDataLoad(): Promise<void> {
    // Wait for loading to start and then finish
    try {
      await this.waitForElement(this.selectors.loadingSpinner, 2000);
      await this.waitForElementToDisappear(this.selectors.loadingSpinner);
    } catch {
      // Loading might be too fast to catch
    }
    await this.waitForNetworkIdle();
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
   * Check if sidebar is visible
   */
  async isSidebarVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.sidebar);
  }

  /**
   * Toggle sidebar (if applicable)
   */
  async toggleSidebar(): Promise<void> {
    // Assuming there's a sidebar toggle button
    const toggleButton = '[data-testid="sidebar-toggle"]';
    if (await this.elementExists(toggleButton)) {
      await this.clickElement(toggleButton);
    }
  }

  /**
   * Click notifications button
   */
  async clickNotifications(): Promise<void> {
    await this.clickElement(this.selectors.notificationsButton);
  }

  /**
   * Get notifications count
   */
  async getNotificationsCount(): Promise<number> {
    if (await this.isElementVisible(this.selectors.notificationsBadge)) {
      const countText = await this.getTextContent(this.selectors.notificationsBadge);
      return parseInt(countText) || 0;
    }
    return 0;
  }

  /**
   * Verify dashboard elements are present
   */
  async verifyDashboardElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.welcomeMessage)).toBeVisible();
    await expect(this.page.locator(this.selectors.userMenuButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.mediaRequestsCard)).toBeVisible();
    await expect(this.page.locator(this.selectors.newRequestButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.searchBar)).toBeVisible();
  }

  /**
   * Navigate to specific section via navigation
   */
  async navigateToSection(sectionName: string): Promise<void> {
    const navLink = `[data-testid="nav-${sectionName}"]`;
    await this.clickElement(navLink);
    await this.waitForPageLoad();
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{ pending: number; completed: number; total: number }> {
    const pending = await this.getPendingRequestsCount();
    const completed = await this.getCompletedRequestsCount();

    return {
      pending,
      completed,
      total: pending + completed,
    };
  }

  /**
   * Check if user has any requests
   */
  async hasRequests(): Promise<boolean> {
    const stats = await this.getDashboardStats();
    return stats.total > 0;
  }
}
