import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Admin Dashboard Page Object Model
 */
export class AdminDashboardPage extends BasePage {
  readonly adminHeader: Locator;
  readonly navUsers: Locator;
  readonly navServices: Locator;
  readonly navStats: Locator;
  readonly navLogs: Locator;
  readonly mobileNavToggle: Locator;
  readonly mobileNavMenu: Locator;
  readonly accessDenied: Locator;

  constructor(page: Page) {
    super(page);
    
    this.adminHeader = page.locator('[data-testid="admin-header"]');
    this.navUsers = page.locator('[data-testid="nav-users"]');
    this.navServices = page.locator('[data-testid="nav-services"]');
    this.navStats = page.locator('[data-testid="nav-system-stats"]');
    this.navLogs = page.locator('[data-testid="nav-activity-logs"]');
    this.mobileNavToggle = page.locator('[data-testid="mobile-nav-toggle"]');
    this.mobileNavMenu = page.locator('[data-testid="mobile-nav-menu"]');
    this.accessDenied = page.locator('[data-testid="access-denied"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
  }

  /**
   * Navigate to users management
   */
  async goToUsers(): Promise<void> {
    await this.navUsers.click();
  }

  /**
   * Navigate to services monitoring
   */
  async goToServices(): Promise<void> {
    await this.navServices.click();
  }

  /**
   * Navigate to system statistics
   */
  async goToStats(): Promise<void> {
    await this.navStats.click();
  }

  /**
   * Navigate to activity logs
   */
  async goToLogs(): Promise<void> {
    await this.navLogs.click();
  }

  /**
   * Verify admin dashboard is loaded
   */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(this.adminHeader).toContainText('Admin Dashboard');
  }

  /**
   * Verify admin navigation is visible
   */
  async verifyAdminNavigation(): Promise<void> {
    await expect(this.navUsers).toBeVisible();
    await expect(this.navServices).toBeVisible();
    await expect(this.navStats).toBeVisible();
    await expect(this.navLogs).toBeVisible();
  }

  /**
   * Verify access denied for non-admin users
   */
  async verifyAccessDenied(): Promise<void> {
    await expect(this.accessDenied).toBeVisible();
  }

  /**
   * Open mobile navigation (for mobile viewport)
   */
  async openMobileNav(): Promise<void> {
    await this.mobileNavToggle.click();
    await expect(this.mobileNavMenu).toBeVisible();
  }
}

/**
 * Admin Users Page Object Model
 */
export class AdminUsersPage extends BasePage {
  readonly usersTable: Locator;
  readonly userRows: Locator;
  readonly userSearch: Locator;
  readonly roleFilter: Locator;
  readonly editRoleModal: Locator;
  readonly deleteUserModal: Locator;
  readonly pagination: Locator;

  constructor(page: Page) {
    super(page);
    
    this.usersTable = page.locator('[data-testid="users-table"]');
    this.userRows = page.locator('[data-testid="user-row"]');
    this.userSearch = page.locator('[data-testid="user-search"]');
    this.roleFilter = page.locator('[data-testid="role-filter"]');
    this.editRoleModal = page.locator('[data-testid="edit-role-modal"]');
    this.deleteUserModal = page.locator('[data-testid="delete-user-modal"]');
    this.pagination = page.locator('[data-testid="pagination"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/users');
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<void> {
    await this.userSearch.fill(query);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Filter users by role
   */
  async filterByRole(role: string): Promise<void> {
    await this.roleFilter.selectOption(role);
  }

  /**
   * Edit user role
   */
  async editUserRole(userIndex: number, newRole: string): Promise<void> {
    const userRow = this.userRows.nth(userIndex);
    await userRow.locator('[data-testid="edit-role-btn"]').click();
    
    await expect(this.editRoleModal).toBeVisible();
    await this.page.selectOption('[data-testid="new-role-select"]', newRole);
    await this.page.click('[data-testid="save-role-btn"]');
  }

  /**
   * Delete user
   */
  async deleteUser(userIndex: number): Promise<void> {
    const userRow = this.userRows.nth(userIndex);
    await userRow.locator('[data-testid="delete-user-btn"]').click();
    
    await expect(this.deleteUserModal).toBeVisible();
    await this.page.fill('[data-testid="delete-confirmation"]', 'DELETE');
    await this.page.click('[data-testid="confirm-delete-btn"]');
  }

  /**
   * Verify user data in table
   */
  async verifyUserData(userIndex: number, data: {
    username?: string;
    email?: string;
    role?: string;
    requestCount?: string;
  }): Promise<void> {
    const userRow = this.userRows.nth(userIndex);
    
    if (data.username) {
      await expect(userRow.locator('[data-testid="username"]')).toContainText(data.username);
    }
    if (data.email) {
      await expect(userRow.locator('[data-testid="email"]')).toContainText(data.email);
    }
    if (data.role) {
      await expect(userRow.locator('[data-testid="role-badge"]')).toContainText(data.role);
    }
    if (data.requestCount) {
      await expect(userRow.locator('[data-testid="request-count"]')).toContainText(data.requestCount);
    }
  }

  /**
   * Verify success message
   */
  async verifySuccess(message: string): Promise<void> {
    const successLocator = this.page.locator('[data-testid*="success"]');
    await expect(successLocator).toBeVisible();
    await expect(successLocator).toContainText(message);
  }
}

/**
 * Admin Services Page Object Model
 */
export class AdminServicesPage extends BasePage {
  readonly servicesGrid: Locator;
  readonly serviceCards: Locator;
  readonly refreshButton: Locator;
  readonly servicesLoading: Locator;
  readonly serviceDetailModal: Locator;

  constructor(page: Page) {
    super(page);
    
    this.servicesGrid = page.locator('[data-testid="services-grid"]');
    this.serviceCards = page.locator('[data-testid="service-card"]');
    this.refreshButton = page.locator('[data-testid="refresh-services"]');
    this.servicesLoading = page.locator('[data-testid="services-loading"]');
    this.serviceDetailModal = page.locator('[data-testid="service-detail-modal"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/services');
  }

  /**
   * Refresh service status
   */
  async refreshServices(): Promise<void> {
    await this.refreshButton.click();
    await expect(this.servicesLoading).toBeVisible();
  }

  /**
   * View service details
   */
  async viewServiceDetails(serviceName: string): Promise<void> {
    await this.page.click(`[data-testid="service-card-${serviceName}"]`);
    await expect(this.serviceDetailModal).toBeVisible();
  }

  /**
   * Verify service status
   */
  async verifyServiceStatus(serviceName: string, status: 'healthy' | 'unhealthy'): Promise<void> {
    const serviceCard = this.page.locator(`[data-testid="service-card-${serviceName}"]`);
    const statusIndicator = serviceCard.locator('[data-testid="status-indicator"]');
    
    await expect(statusIndicator).toHaveClass(new RegExp(status));
  }

  /**
   * Verify service response time
   */
  async verifyResponseTime(serviceName: string, expectedTime: string): Promise<void> {
    const serviceCard = this.page.locator(`[data-testid="service-card-${serviceName}"]`);
    await expect(serviceCard.locator('[data-testid="response-time"]')).toContainText(expectedTime);
  }

  /**
   * Verify service error message
   */
  async verifyServiceError(serviceName: string, errorMessage: string): Promise<void> {
    const serviceCard = this.page.locator(`[data-testid="service-card-${serviceName}"]`);
    await expect(serviceCard.locator('[data-testid="error-message"]')).toContainText(errorMessage);
  }
}

/**
 * Admin Stats Page Object Model
 */
export class AdminStatsPage extends BasePage {
  readonly statsGrid: Locator;
  readonly usersStatsCard: Locator;
  readonly requestsStatsCard: Locator;
  readonly downloadsStatsCard: Locator;
  readonly usageChart: Locator;
  readonly activityTimeline: Locator;
  readonly timePeriodSelect: Locator;
  readonly statsLoading: Locator;

  constructor(page: Page) {
    super(page);
    
    this.statsGrid = page.locator('[data-testid="stats-grid"]');
    this.usersStatsCard = page.locator('[data-testid="users-stats-card"]');
    this.requestsStatsCard = page.locator('[data-testid="requests-stats-card"]');
    this.downloadsStatsCard = page.locator('[data-testid="downloads-stats-card"]');
    this.usageChart = page.locator('[data-testid="usage-chart"]');
    this.activityTimeline = page.locator('[data-testid="activity-timeline"]');
    this.timePeriodSelect = page.locator('[data-testid="time-period-select"]');
    this.statsLoading = page.locator('[data-testid="stats-loading"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/stats');
  }

  /**
   * Change time period
   */
  async changeTimePeriod(period: string): Promise<void> {
    await this.timePeriodSelect.selectOption(period);
    await expect(this.statsLoading).toBeVisible();
  }

  /**
   * Verify stats values
   */
  async verifyStats(stats: {
    totalUsers?: string;
    activeUsers?: string;
    totalRequests?: string;
    pendingRequests?: string;
    totalDownloads?: string;
    activeDownloads?: string;
  }): Promise<void> {
    if (stats.totalUsers) {
      await expect(this.usersStatsCard.locator('[data-testid="total-users"]'))
        .toContainText(stats.totalUsers);
    }
    if (stats.activeUsers) {
      await expect(this.usersStatsCard.locator('[data-testid="active-users"]'))
        .toContainText(stats.activeUsers);
    }
    if (stats.totalRequests) {
      await expect(this.requestsStatsCard.locator('[data-testid="total-requests"]'))
        .toContainText(stats.totalRequests);
    }
    if (stats.pendingRequests) {
      await expect(this.requestsStatsCard.locator('[data-testid="pending-requests"]'))
        .toContainText(stats.pendingRequests);
    }
    if (stats.totalDownloads) {
      await expect(this.downloadsStatsCard.locator('[data-testid="total-downloads"]'))
        .toContainText(stats.totalDownloads);
    }
    if (stats.activeDownloads) {
      await expect(this.downloadsStatsCard.locator('[data-testid="active-downloads"]'))
        .toContainText(stats.activeDownloads);
    }
  }

  /**
   * Verify charts are visible and interactive
   */
  async verifyCharts(): Promise<void> {
    await expect(this.usageChart).toBeVisible();
    await expect(this.activityTimeline).toBeVisible();
    
    // Test chart interactivity
    await this.usageChart.hover();
    await expect(this.page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
  }
}

/**
 * Admin Broadcast Page Object Model
 */
export class AdminBroadcastPage extends BasePage {
  readonly messageTitle: Locator;
  readonly messageContent: Locator;
  readonly messageType: Locator;
  readonly sendButton: Locator;
  readonly previewButton: Locator;
  readonly messagePreview: Locator;
  readonly broadcastSuccess: Locator;

  constructor(page: Page) {
    super(page);
    
    this.messageTitle = page.locator('[data-testid="message-title"]');
    this.messageContent = page.locator('[data-testid="message-content"]');
    this.messageType = page.locator('[data-testid="message-type"]');
    this.sendButton = page.locator('[data-testid="send-broadcast"]');
    this.previewButton = page.locator('[data-testid="preview-message"]');
    this.messagePreview = page.locator('[data-testid="message-preview"]');
    this.broadcastSuccess = page.locator('[data-testid="broadcast-success"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/broadcast');
  }

  /**
   * Create and send broadcast message
   */
  async sendBroadcast(title: string, content: string, type: string = 'info'): Promise<void> {
    await this.messageTitle.fill(title);
    await this.messageContent.fill(content);
    await this.messageType.selectOption(type);
    await this.sendButton.click();
  }

  /**
   * Preview message before sending
   */
  async previewMessage(title: string, content: string): Promise<void> {
    await this.messageTitle.fill(title);
    await this.messageContent.fill(content);
    await this.previewButton.click();
    
    await expect(this.messagePreview).toBeVisible();
  }

  /**
   * Verify broadcast success
   */
  async verifyBroadcastSent(): Promise<void> {
    await expect(this.broadcastSuccess).toBeVisible();
    await expect(this.broadcastSuccess).toContainText(/sent successfully/i);
  }

  /**
   * Verify preview content
   */
  async verifyPreviewContent(title: string, content: string): Promise<void> {
    await expect(this.page.locator('[data-testid="preview-title"]')).toContainText(title);
    await expect(this.page.locator('[data-testid="preview-content"]')).toContainText(content);
  }
}