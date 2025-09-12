import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dashboard Page Object for MediaNest main dashboard
 */
export class DashboardPage extends BasePage {
  readonly welcomeMessage: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly navigationMenu: Locator;
  readonly servicesSection: Locator;
  readonly mediaSection: Locator;
  readonly statsCards: Locator;
  readonly searchInput: Locator;
  readonly notificationBell: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeMessage = page.getByTestId('welcome-message');
    this.userMenu = page.getByTestId('user-menu');
    this.logoutButton = page.getByTestId('logout-button');
    this.navigationMenu = page.getByTestId('nav-menu');
    this.servicesSection = page.getByTestId('services-section');
    this.mediaSection = page.getByTestId('media-section');
    this.statsCards = page.getByTestId('stats-card');
    this.searchInput = page.getByTestId('search-input');
    this.notificationBell = page.getByTestId('notification-bell');
    this.settingsButton = page.getByTestId('settings-button');
  }

  async goto() {
    await this.navigate('/dashboard');
  }

  /**
   * Verify dashboard is loaded and accessible
   */
  async expectDashboardLoaded() {
    await expect(this.welcomeMessage).toBeVisible();
    await expect(this.userMenu).toBeVisible();
    await expect(this.navigationMenu).toBeVisible();
  }

  /**
   * Perform logout
   */
  async logout() {
    await this.clickWithRetry(this.userMenu);
    await this.clickWithRetry(this.logoutButton);
    
    // Verify redirect to login
    await expect(this.page).toHaveURL(/.*\/login/);
    
    // Verify auth token is cleared
    const authToken = await this.getLocalStorage('authToken');
    expect(authToken).toBeFalsy();
  }

  /**
   * Navigate to services page
   */
  async goToServices() {
    const servicesLink = this.navigationMenu.getByRole('link', { name: /services/i });
    await this.clickWithRetry(servicesLink);
    await expect(this.page).toHaveURL(/.*\/services/);
  }

  /**
   * Navigate to media page
   */
  async goToMedia() {
    const mediaLink = this.navigationMenu.getByRole('link', { name: /media/i });
    await this.clickWithRetry(mediaLink);
    await expect(this.page).toHaveURL(/.*\/media/);
  }

  /**
   * Navigate to settings
   */
  async goToSettings() {
    await this.clickWithRetry(this.settingsButton);
    await expect(this.page).toHaveURL(/.*\/settings/);
  }

  /**
   * Get dashboard statistics
   */
  async getStats() {
    const stats = await this.statsCards.all();
    const data = [];

    for (const card of stats) {
      const title = await card.getByTestId('stat-title').textContent();
      const value = await card.getByTestId('stat-value').textContent();
      const change = await card.getByTestId('stat-change').textContent();
      data.push({ title, value, change });
    }

    return data;
  }

  /**
   * Perform search
   */
  async search(query: string) {
    await this.fillField(this.searchInput, query);
    await this.searchInput.press('Enter');
    
    // Wait for search results
    await this.waitForResponse('**/api/search**');
    await expect(this.page.getByTestId('search-results')).toBeVisible();
  }

  /**
   * Check notifications
   */
  async checkNotifications() {
    const notificationCount = await this.notificationBell.getAttribute('data-count');
    
    await this.clickWithRetry(this.notificationBell);
    await expect(this.page.getByTestId('notifications-panel')).toBeVisible();
    
    return parseInt(notificationCount || '0', 10);
  }

  /**
   * Verify services are displayed
   */
  async expectServicesVisible(minCount = 1) {
    await expect(this.servicesSection).toBeVisible();
    
    const serviceCards = this.servicesSection.getByTestId(/^service-card-/);
    const count = await serviceCards.count();
    
    expect(count).toBeGreaterThanOrEqual(minCount);
    return count;
  }

  /**
   * Verify media items are displayed
   */
  async expectMediaVisible(minCount = 1) {
    await expect(this.mediaSection).toBeVisible();
    
    const mediaItems = this.mediaSection.getByTestId(/^media-item-/);
    const count = await mediaItems.count();
    
    expect(count).toBeGreaterThanOrEqual(minCount);
    return count;
  }

  /**
   * Test responsive behavior
   */
  async testResponsiveLayout() {
    // Test mobile view
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    // Should show mobile menu
    await expect(this.page.getByTestId('mobile-menu-toggle')).toBeVisible();
    await expect(this.navigationMenu).toBeHidden();
    
    // Test tablet view
    await this.page.setViewportSize({ width: 768, height: 1024 });
    
    // Test desktop view
    await this.page.setViewportSize({ width: 1280, height: 720 });
    await expect(this.navigationMenu).toBeVisible();
  }

  /**
   * Verify real-time updates work
   */
  async expectRealTimeUpdates() {
    // Get initial stats
    const initialStats = await this.getStats();
    
    // Simulate data change (mock WebSocket message)
    await this.executeScript(() => {
      const mockEvent = new CustomEvent('statsUpdate', {
        detail: { services: 5, media: 150, uptime: 99.5 }
      });
      window.dispatchEvent(mockEvent);
    });
    
    // Wait for updates
    await this.waitForAnimation();
    
    // Verify stats changed
    const updatedStats = await this.getStats();
    expect(updatedStats).not.toEqual(initialStats);
  }
}