import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the MediaNest Dashboard
 * Handles service cards, status monitoring, and quick actions
 */
export class DashboardPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Dashboard")',
    dashboardLayout: '[data-testid="dashboard-layout"]',
    
    // Service cards
    serviceCardsContainer: '[data-testid="service-cards-container"]',
    serviceCard: '[data-testid="service-card"]',
    
    // Plex card
    plexCard: '[data-testid="plex-card"]',
    plexStatus: '[data-testid="plex-status"]',
    plexBrowseButton: '[data-testid="plex-browse-button"]',
    plexSearchButton: '[data-testid="plex-search-button"]',
    plexCollectionsButton: '[data-testid="plex-collections-button"]',
    plexLibraryCount: '[data-testid="plex-library-count"]',
    plexRecentlyAdded: '[data-testid="plex-recently-added"]',
    
    // Overseerr card
    overseerrCard: '[data-testid="overseerr-card"]',
    overseerrStatus: '[data-testid="overseerr-status"]',
    overseerrRequestsButton: '[data-testid="overseerr-requests-button"]',
    overseerrPendingCount: '[data-testid="overseerr-pending-count"]',
    overseerrRecentRequests: '[data-testid="overseerr-recent-requests"]',
    
    // UptimeKuma card
    uptimeKumaCard: '[data-testid="uptime-kuma-card"]',
    uptimeKumaStatus: '[data-testid="uptime-kuma-status"]',
    uptimeKumaMonitors: '[data-testid="uptime-kuma-monitors"]',
    uptimeUptimePercentage: '[data-testid="uptime-percentage"]',
    uptimeIncidents: '[data-testid="uptime-incidents"]',
    
    // Status indicators
    statusIndicator: '[data-testid="status-indicator"]',
    statusOnline: '[data-status="online"]',
    statusOffline: '[data-status="offline"]',
    statusLoading: '[data-status="loading"]',
    statusError: '[data-status="error"]',
    
    // Connection status
    connectionStatus: '[data-testid="connection-status"]',
    lastUpdated: '[data-testid="last-updated"]',
    refreshButton: '[data-testid="refresh-button"]',
    autoRefreshToggle: '[data-testid="auto-refresh-toggle"]',
    
    // Quick actions
    quickActions: '[data-testid="quick-actions"]',
    quickActionButton: '[data-testid="quick-action-button"]',
    
    // Navigation
    navbar: '[data-testid="navbar"]',
    navLink: '[data-testid="nav-link"]',
    userMenu: '[data-testid="user-menu"]',
    
    // Loading and error states
    skeletonLoader: '[data-testid="skeleton-loader"]',
    errorBoundary: '[data-testid="error-boundary"]',
    retryButton: '[data-testid="retry-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.dashboardLayout);
  }

  getPageTitle(): string {
    return 'Dashboard';
  }

  protected getMainContentSelector(): string {
    return this.selectors.dashboardLayout;
  }

  /**
   * Verify dashboard page elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.dashboardLayout)).toBeVisible();
    await expect(this.page.locator(this.selectors.serviceCardsContainer)).toBeVisible();
  }

  /**
   * Wait for all service cards to load
   */
  async waitForServiceCards(): Promise<void> {
    // Wait for skeleton loaders to disappear
    try {
      await this.waitForElementToHide(this.selectors.skeletonLoader, 10000);
    } catch {
      // Skeletons might not be present
    }

    // Verify service cards are visible
    await this.waitForElement(this.selectors.plexCard);
    await this.waitForElement(this.selectors.overseerrCard);
    await this.waitForElement(this.selectors.uptimeKumaCard);
  }

  /**
   * Get service status
   */
  async getServiceStatus(service: 'plex' | 'overseerr' | 'uptime-kuma'): Promise<'online' | 'offline' | 'loading' | 'error'> {
    const cardSelector = this.selectors[`${service.replace('-', '')}Card` as keyof typeof this.selectors] as string;
    const statusElement = this.page.locator(cardSelector).locator(this.selectors.statusIndicator);
    
    if (await statusElement.locator(this.selectors.statusOnline).isVisible()) return 'online';
    if (await statusElement.locator(this.selectors.statusOffline).isVisible()) return 'offline';
    if (await statusElement.locator(this.selectors.statusLoading).isVisible()) return 'loading';
    if (await statusElement.locator(this.selectors.statusError).isVisible()) return 'error';
    
    return 'loading';
  }

  /**
   * Get all service statuses
   */
  async getAllServiceStatuses(): Promise<Record<string, string>> {
    await this.waitForServiceCards();
    
    return {
      plex: await this.getServiceStatus('plex'),
      overseerr: await this.getServiceStatus('overseerr'),
      uptimeKuma: await this.getServiceStatus('uptime-kuma'),
    };
  }

  /**
   * Refresh service status
   */
  async refreshServices(): Promise<void> {
    await this.clickElement(this.selectors.refreshButton);
    await this.waitForServiceCards();
  }

  /**
   * Toggle auto-refresh
   */
  async toggleAutoRefresh(): Promise<boolean> {
    await this.clickElement(this.selectors.autoRefreshToggle);
    
    const toggle = this.page.locator(this.selectors.autoRefreshToggle);
    return await toggle.isChecked();
  }

  /**
   * Plex service interactions
   */
  async getPlexLibraryCount(): Promise<number> {
    const countElement = this.page.locator(this.selectors.plexLibraryCount);
    const countText = await countElement.textContent() || '0';
    return parseInt(countText.match(/\d+/)?.[0] || '0');
  }

  async navigateToPlexBrowser(): Promise<void> {
    await this.clickElement(this.selectors.plexBrowseButton);
    await this.page.waitForURL('/plex');
  }

  async navigateToPlexSearch(): Promise<void> {
    await this.clickElement(this.selectors.plexSearchButton);
    await this.page.waitForURL('/plex/search');
  }

  async navigateToPlexCollections(): Promise<void> {
    await this.clickElement(this.selectors.plexCollectionsButton);
    await this.page.waitForURL('/plex/collections');
  }

  async getPlexRecentlyAdded(): Promise<string[]> {
    const recentItems = this.page.locator(this.selectors.plexRecentlyAdded).locator('[data-testid="media-item"]');
    return await recentItems.allTextContents();
  }

  /**
   * Overseerr service interactions
   */
  async getPendingRequestsCount(): Promise<number> {
    const countElement = this.page.locator(this.selectors.overseerrPendingCount);
    const countText = await countElement.textContent() || '0';
    return parseInt(countText.match(/\d+/)?.[0] || '0');
  }

  async navigateToRequests(): Promise<void> {
    await this.clickElement(this.selectors.overseerrRequestsButton);
    await this.page.waitForURL('/requests');
  }

  async getRecentRequests(): Promise<string[]> {
    const recentRequests = this.page.locator(this.selectors.overseerrRecentRequests).locator('[data-testid="request-item"]');
    return await recentRequests.allTextContents();
  }

  /**
   * UptimeKuma service interactions
   */
  async getUptimePercentage(): Promise<number> {
    const percentageElement = this.page.locator(this.selectors.uptimeUptimePercentage);
    const percentageText = await percentageElement.textContent() || '0%';
    return parseFloat(percentageText.replace('%', ''));
  }

  async getMonitorCount(): Promise<number> {
    const monitors = this.page.locator(this.selectors.uptimeKumaMonitors).locator('[data-testid="monitor-item"]');
    return await monitors.count();
  }

  async getActiveIncidents(): Promise<string[]> {
    const incidents = this.page.locator(this.selectors.uptimeIncidents).locator('[data-testid="incident-item"]');
    return await incidents.allTextContents();
  }

  /**
   * Quick actions
   */
  async getQuickActions(): Promise<string[]> {
    const actions = this.page.locator(this.selectors.quickActionButton);
    return await actions.allTextContents();
  }

  async executeQuickAction(actionName: string): Promise<void> {
    const action = this.page.locator(this.selectors.quickActionButton).filter({ hasText: actionName });
    await action.click();
    await this.waitForLoading();
  }

  /**
   * Connection status monitoring
   */
  async getConnectionStatus(): Promise<string> {
    return await this.getTextContent(this.selectors.connectionStatus);
  }

  async getLastUpdatedTime(): Promise<string> {
    return await this.getTextContent(this.selectors.lastUpdated);
  }

  /**
   * Error handling
   */
  async hasServiceErrors(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.errorBoundary);
  }

  async retryFailedServices(): Promise<void> {
    if (await this.isElementVisible(this.selectors.retryButton)) {
      await this.clickElement(this.selectors.retryButton);
      await this.waitForServiceCards();
    }
  }

  /**
   * Navigation helpers
   */
  async navigateFromNavbar(destination: string): Promise<void> {
    const navLink = this.page.locator(this.selectors.navLink).filter({ hasText: destination });
    await navLink.click();
    await this.waitForLoading();
  }

  async openUserMenu(): Promise<void> {
    await this.clickElement(this.selectors.userMenu);
  }

  /**
   * Performance monitoring
   */
  async measureServiceLoadTimes(): Promise<Record<string, number>> {
    const startTime = Date.now();
    
    // Wait for each service to load
    const plexStart = Date.now();
    await this.waitForElement(this.selectors.plexStatus);
    const plexTime = Date.now() - plexStart;
    
    const overseerrStart = Date.now();
    await this.waitForElement(this.selectors.overseerrStatus);
    const overseerrTime = Date.now() - overseerrStart;
    
    const uptimeStart = Date.now();
    await this.waitForElement(this.selectors.uptimeKumaStatus);
    const uptimeTime = Date.now() - uptimeStart;
    
    const totalTime = Date.now() - startTime;
    
    return {
      plex: plexTime,
      overseerr: overseerrTime,
      uptimeKuma: uptimeTime,
      total: totalTime,
    };
  }

  /**
   * Test responsive behavior
   */
  async testResponsiveLayout(): Promise<void> {
    // Mobile view
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.verifyPageElements();
    
    // Tablet view
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.verifyPageElements();
    
    // Desktop view
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.verifyPageElements();
  }

  /**
   * Test real-time updates
   */
  async testRealTimeUpdates(duration: number = 30000): Promise<void> {
    const initialStatuses = await this.getAllServiceStatuses();
    
    // Enable auto-refresh
    await this.toggleAutoRefresh();
    
    // Wait for specified duration
    await this.page.waitForTimeout(duration);
    
    const updatedStatuses = await this.getAllServiceStatuses();
    
    // Verify at least one status update occurred
    expect(JSON.stringify(initialStatuses)).not.toBe(JSON.stringify(updatedStatuses));
  }

  /**
   * Test service card interactions
   */
  async testServiceCardInteractions(): Promise<void> {
    // Test Plex card
    await expect(this.page.locator(this.selectors.plexCard)).toBeVisible();
    await this.navigateToPlexBrowser();
    await this.page.goBack();
    
    // Test Overseerr card
    await expect(this.page.locator(this.selectors.overseerrCard)).toBeVisible();
    await this.navigateToRequests();
    await this.page.goBack();
    
    // Test UptimeKuma card
    await expect(this.page.locator(this.selectors.uptimeKumaCard)).toBeVisible();
  }

  /**
   * Verify dashboard accessibility
   */
  async verifyAccessibility(): Promise<void> {
    await super.verifyAccessibility();
    
    // Check service card accessibility
    const serviceCards = await this.page.locator(this.selectors.serviceCard).all();
    for (const card of serviceCards) {
      // Each card should have a heading
      const heading = card.locator('h1, h2, h3, h4, h5, h6');
      await expect(heading).toBeVisible();
      
      // Interactive elements should be keyboard accessible
      const buttons = card.locator('button, a[role="button"]');
      for (const button of await buttons.all()) {
        expect(await button.getAttribute('tabindex')).not.toBe('-1');
      }
    }
    
    // Test keyboard navigation through service cards
    await this.navigateWithTab();
    const focusedElement = await this.page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT'].includes(focusedElement || '')).toBe(true);
  }

  /**
   * Complete dashboard verification workflow
   */
  async completeDashboardVerification(): Promise<void> {
    await this.verifyPageElements();
    await this.waitForServiceCards();
    
    const statuses = await this.getAllServiceStatuses();
    console.log('Service statuses:', statuses);
    
    // Verify at least one service is online
    const onlineServices = Object.values(statuses).filter(status => status === 'online');
    expect(onlineServices.length).toBeGreaterThan(0);
    
    await this.testServiceCardInteractions();
    await this.verifyAccessibility();
  }
}