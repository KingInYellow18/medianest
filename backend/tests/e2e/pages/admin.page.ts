import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AdminPage extends BasePage {
  // Selectors
  private readonly selectors = {
    adminPanel: '[data-testid="admin-panel"]',
    adminNavigation: '[data-testid="admin-navigation"]',

    // Dashboard
    adminDashboard: '[data-testid="admin-dashboard"]',
    totalUsersCount: '[data-testid="total-users-count"]',
    activeRequestsCount: '[data-testid="active-requests-count"]',
    systemStatusIndicator: '[data-testid="system-status-indicator"]',

    // Users management
    usersTable: '[data-testid="users-table"]',
    userRow: '[data-testid="user-row"]',
    addUserButton: '[data-testid="add-user-button"]',
    editUserButton: '[data-testid="edit-user-button"]',
    deleteUserButton: '[data-testid="delete-user-button"]',
    userSearchInput: '[data-testid="user-search-input"]',
    userFilterSelect: '[data-testid="user-filter-select"]',

    // Requests management
    requestsTable: '[data-testid="requests-table"]',
    requestRow: '[data-testid="request-row"]',
    requestStatusSelect: '[data-testid="request-status-select"]',
    assignToUserSelect: '[data-testid="assign-to-user-select"]',
    requestSearchInput: '[data-testid="request-search-input"]',
    requestFilterSelect: '[data-testid="request-filter-select"]',
    bulkActionsButton: '[data-testid="bulk-actions-button"]',
    selectAllCheckbox: '[data-testid="select-all-checkbox"]',

    // System settings
    settingsForm: '[data-testid="settings-form"]',
    maxRequestsPerUserInput: '[data-testid="max-requests-per-user-input"]',
    allowedFileTypesInput: '[data-testid="allowed-file-types-input"]',
    maxFileSizeInput: '[data-testid="max-file-size-input"]',
    saveSettingsButton: '[data-testid="save-settings-button"]',

    // Analytics
    analyticsSection: '[data-testid="analytics-section"]',
    requestsChart: '[data-testid="requests-chart"]',
    usageStatsCard: '[data-testid="usage-stats-card"]',
    performanceMetrics: '[data-testid="performance-metrics"]',

    // Logs
    logsSection: '[data-testid="logs-section"]',
    logLevelFilter: '[data-testid="log-level-filter"]',
    logSearchInput: '[data-testid="log-search-input"]',
    logEntries: '[data-testid="log-entry"]',
    clearLogsButton: '[data-testid="clear-logs-button"]',
    exportLogsButton: '[data-testid="export-logs-button"]',

    // Common elements
    loadingSpinner: '[data-testid="loading-spinner"]',
    successMessage: '[data-testid="success-message"]',
    errorMessage: '[data-testid="error-message"]',
    confirmDialog: '[data-testid="confirm-dialog"]',
    confirmButton: '[data-testid="confirm-button"]',
    cancelButton: '[data-testid="cancel-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to admin panel
   */
  async navigate(): Promise<void> {
    await this.goto('/admin');
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.adminPanel);
  }

  /**
   * Navigate to specific admin section
   */
  async navigateToSection(
    section: 'dashboard' | 'users' | 'requests' | 'settings' | 'analytics' | 'logs',
  ): Promise<void> {
    const navLink = `[data-testid="admin-nav-${section}"]`;
    await this.clickElement(navLink);
    await this.waitForPageLoad();
  }

  /**
   * Verify user has admin access
   */
  async verifyAdminAccess(): Promise<void> {
    await expect(this.page.locator(this.selectors.adminPanel)).toBeVisible();
    await expect(this.page.locator(this.selectors.adminNavigation)).toBeVisible();
  }

  // Dashboard methods
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalUsers: number;
    activeRequests: number;
    systemStatus: string;
  }> {
    await this.navigateToSection('dashboard');

    const totalUsersText = await this.getTextContent(this.selectors.totalUsersCount);
    const activeRequestsText = await this.getTextContent(this.selectors.activeRequestsCount);
    const systemStatus = await this.getTextContent(this.selectors.systemStatusIndicator);

    return {
      totalUsers: parseInt(totalUsersText) || 0,
      activeRequests: parseInt(activeRequestsText) || 0,
      systemStatus: systemStatus.trim(),
    };
  }

  // User management methods
  /**
   * Navigate to users management
   */
  async navigateToUsers(): Promise<void> {
    await this.navigateToSection('users');
    await this.waitForElement(this.selectors.usersTable);
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<void> {
    await this.navigateToUsers();
    await this.fillInput(this.selectors.userSearchInput, query);
    await this.page.keyboard.press('Enter');
    await this.waitForNetworkIdle();
  }

  /**
   * Filter users by role/status
   */
  async filterUsers(filterValue: string): Promise<void> {
    await this.selectOption(this.selectors.userFilterSelect, filterValue);
    await this.waitForNetworkIdle();
  }

  /**
   * Get all users from the table
   */
  async getUsers(): Promise<any[]> {
    await this.navigateToUsers();
    const rows = await this.page.locator(this.selectors.userRow).all();
    const users = [];

    for (const row of rows) {
      const email = await row.locator('[data-testid="user-email"]').textContent();
      const name = await row.locator('[data-testid="user-name"]').textContent();
      const role = await row.locator('[data-testid="user-role"]').textContent();
      const status = await row.locator('[data-testid="user-status"]').textContent();

      users.push({
        email: email?.trim(),
        name: name?.trim(),
        role: role?.trim(),
        status: status?.trim(),
      });
    }

    return users;
  }

  /**
   * Add new user
   */
  async addUser(userData: { name: string; email: string; role: string }): Promise<void> {
    await this.navigateToUsers();
    await this.clickElement(this.selectors.addUserButton);

    // Fill user form (assuming modal or new page)
    await this.fillInput('[data-testid="user-name-input"]', userData.name);
    await this.fillInput('[data-testid="user-email-input"]', userData.email);
    await this.selectOption('[data-testid="user-role-select"]', userData.role);

    await this.clickElement('[data-testid="save-user-button"]');
    await this.waitForElement(this.selectors.successMessage);
  }

  /**
   * Edit user by email
   */
  async editUser(
    userEmail: string,
    updates: Partial<{ name: string; role: string; status: string }>,
  ): Promise<void> {
    await this.navigateToUsers();

    // Find user row and click edit
    const userRow = this.page.locator(this.selectors.userRow).filter({ hasText: userEmail });
    await userRow.locator(this.selectors.editUserButton).click();

    // Apply updates
    if (updates.name) {
      await this.fillInput('[data-testid="user-name-input"]', updates.name);
    }
    if (updates.role) {
      await this.selectOption('[data-testid="user-role-select"]', updates.role);
    }
    if (updates.status) {
      await this.selectOption('[data-testid="user-status-select"]', updates.status);
    }

    await this.clickElement('[data-testid="save-user-button"]');
    await this.waitForElement(this.selectors.successMessage);
  }

  /**
   * Delete user by email
   */
  async deleteUser(userEmail: string): Promise<void> {
    await this.navigateToUsers();

    const userRow = this.page.locator(this.selectors.userRow).filter({ hasText: userEmail });
    await userRow.locator(this.selectors.deleteUserButton).click();

    // Confirm deletion
    await this.waitForElement(this.selectors.confirmDialog);
    await this.clickElement(this.selectors.confirmButton);

    await this.waitForElement(this.selectors.successMessage);
  }

  // Request management methods
  /**
   * Navigate to requests management
   */
  async navigateToRequests(): Promise<void> {
    await this.navigateToSection('requests');
    await this.waitForElement(this.selectors.requestsTable);
  }

  /**
   * Get all requests
   */
  async getRequests(): Promise<any[]> {
    await this.navigateToRequests();
    const rows = await this.page.locator(this.selectors.requestRow).all();
    const requests = [];

    for (const row of rows) {
      const title = await row.locator('[data-testid="request-title"]').textContent();
      const user = await row.locator('[data-testid="request-user"]').textContent();
      const status = await row.locator('[data-testid="request-status"]').textContent();
      const date = await row.locator('[data-testid="request-date"]').textContent();

      requests.push({
        title: title?.trim(),
        user: user?.trim(),
        status: status?.trim(),
        date: date?.trim(),
      });
    }

    return requests;
  }

  /**
   * Update request status
   */
  async updateRequestStatus(requestTitle: string, newStatus: string): Promise<void> {
    await this.navigateToRequests();

    const requestRow = this.page
      .locator(this.selectors.requestRow)
      .filter({ hasText: requestTitle });
    const statusSelect = requestRow.locator(this.selectors.requestStatusSelect);

    await statusSelect.selectOption(newStatus);
    await this.waitForNetworkIdle();
  }

  /**
   * Assign request to user
   */
  async assignRequest(requestTitle: string, assigneeEmail: string): Promise<void> {
    await this.navigateToRequests();

    const requestRow = this.page
      .locator(this.selectors.requestRow)
      .filter({ hasText: requestTitle });
    const assignSelect = requestRow.locator(this.selectors.assignToUserSelect);

    await assignSelect.selectOption(assigneeEmail);
    await this.waitForNetworkIdle();
  }

  /**
   * Search requests
   */
  async searchRequests(query: string): Promise<void> {
    await this.navigateToRequests();
    await this.fillInput(this.selectors.requestSearchInput, query);
    await this.page.keyboard.press('Enter');
    await this.waitForNetworkIdle();
  }

  /**
   * Filter requests
   */
  async filterRequests(filterValue: string): Promise<void> {
    await this.selectOption(this.selectors.requestFilterSelect, filterValue);
    await this.waitForNetworkIdle();
  }

  // Settings methods
  /**
   * Navigate to settings
   */
  async navigateToSettings(): Promise<void> {
    await this.navigateToSection('settings');
    await this.waitForElement(this.selectors.settingsForm);
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: {
    maxRequestsPerUser?: number;
    allowedFileTypes?: string[];
    maxFileSize?: number;
  }): Promise<void> {
    await this.navigateToSettings();

    if (settings.maxRequestsPerUser) {
      await this.fillInput(
        this.selectors.maxRequestsPerUserInput,
        settings.maxRequestsPerUser.toString(),
      );
    }

    if (settings.allowedFileTypes) {
      await this.fillInput(
        this.selectors.allowedFileTypesInput,
        settings.allowedFileTypes.join(', '),
      );
    }

    if (settings.maxFileSize) {
      await this.fillInput(this.selectors.maxFileSizeInput, settings.maxFileSize.toString());
    }

    await this.clickElement(this.selectors.saveSettingsButton);
    await this.waitForElement(this.selectors.successMessage);
  }

  // Analytics methods
  /**
   * Navigate to analytics
   */
  async navigateToAnalytics(): Promise<void> {
    await this.navigateToSection('analytics');
    await this.waitForElement(this.selectors.analyticsSection);
  }

  /**
   * Get analytics data
   */
  async getAnalyticsData(): Promise<any> {
    await this.navigateToAnalytics();

    // Wait for charts to load
    await this.waitForElement(this.selectors.requestsChart);

    // Extract analytics data (this would depend on the specific implementation)
    const usageStats = await this.getTextContent(this.selectors.usageStatsCard);
    const performanceMetrics = await this.getTextContent(this.selectors.performanceMetrics);

    return {
      usageStats,
      performanceMetrics,
    };
  }

  // Logs methods
  /**
   * Navigate to logs
   */
  async navigateToLogs(): Promise<void> {
    await this.navigateToSection('logs');
    await this.waitForElement(this.selectors.logsSection);
  }

  /**
   * Filter logs by level
   */
  async filterLogs(level: string): Promise<void> {
    await this.navigateToLogs();
    await this.selectOption(this.selectors.logLevelFilter, level);
    await this.waitForNetworkIdle();
  }

  /**
   * Search logs
   */
  async searchLogs(query: string): Promise<void> {
    await this.navigateToLogs();
    await this.fillInput(this.selectors.logSearchInput, query);
    await this.page.keyboard.press('Enter');
    await this.waitForNetworkIdle();
  }

  /**
   * Get log entries
   */
  async getLogEntries(): Promise<string[]> {
    await this.navigateToLogs();
    const entries = await this.page.locator(this.selectors.logEntries).all();
    const logs = [];

    for (const entry of entries) {
      const text = await entry.textContent();
      if (text) {
        logs.push(text.trim());
      }
    }

    return logs;
  }

  /**
   * Clear logs
   */
  async clearLogs(): Promise<void> {
    await this.navigateToLogs();
    await this.clickElement(this.selectors.clearLogsButton);

    await this.waitForElement(this.selectors.confirmDialog);
    await this.clickElement(this.selectors.confirmButton);

    await this.waitForElement(this.selectors.successMessage);
  }

  /**
   * Export logs
   */
  async exportLogs(): Promise<void> {
    await this.navigateToLogs();
    await this.clickElement(this.selectors.exportLogsButton);

    // Handle file download (this would depend on test configuration)
    await this.waitForNetworkIdle();
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.successMessage)) {
      return await this.getTextContent(this.selectors.successMessage);
    }
    return '';
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getTextContent(this.selectors.errorMessage);
    }
    return '';
  }
}
