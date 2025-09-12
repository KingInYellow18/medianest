import { Page, BrowserContext } from '@playwright/test';
import { prisma } from '@/db/prisma';

/**
 * E2E Authentication Test Helpers
 *
 * Utility functions to support E2E authentication testing
 */

export interface TestUser {
  plexId: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    plexId: 'e2e-admin-123',
    username: 'testadmin',
    email: 'admin@e2etest.local',
    role: 'admin',
  },
  user: {
    plexId: 'e2e-user-456',
    username: 'testuser',
    email: 'user@e2etest.local',
    role: 'user',
  },
  moderator: {
    plexId: 'e2e-mod-789',
    username: 'testmod',
    email: 'mod@e2etest.local',
    role: 'user', // Moderator is a user with additional permissions
  },
};

export class AuthTestHelpers {
  private page: Page;
  private baseUrl: string;
  private apiBaseUrl: string;

  constructor(page: Page, baseUrl: string = 'http://localhost:3001') {
    this.page = page;
    this.baseUrl = baseUrl;
    this.apiBaseUrl = `${baseUrl}/api/v1`;
  }

  /**
   * Set up mock Plex API responses for consistent testing
   */
  async setupMockPlexApi(): Promise<void> {
    // Mock PIN generation
    await this.page.route('https://plex.tv/pins.xml', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-123</id>
            <code>TEST</code>
          </pin>`,
      });
    });

    // Mock PIN verification - authorized
    await this.page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <authToken>mock-plex-token-12345</authToken>
          </pin>`,
      });
    });

    // Mock user account info
    await this.page.route('https://plex.tv/users/account.xml', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <user>
            <id>e2e-test-123</id>
            <username>e2etestuser</username>
            <email>e2e@test.local</email>
          </user>`,
      });
    });
  }

  /**
   * Set up mock Plex API for unauthorized PIN scenario
   */
  async setupMockPlexApiUnauthorized(): Promise<void> {
    await this.page.route('https://plex.tv/pins.xml', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-unauthorized</id>
            <code>UNAU</code>
          </pin>`,
      });
    });

    // Mock unauthorized PIN (no auth token)
    await this.page.route('https://plex.tv/pins/e2e-pin-unauthorized.xml', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-unauthorized</id>
          </pin>`,
      });
    });
  }

  /**
   * Set up mock Plex API for network failure scenarios
   */
  async setupMockPlexApiFailure(): Promise<void> {
    await this.page.route('https://plex.tv/pins.xml', async (route) => {
      await route.abort('failed');
    });

    await this.page.route('https://plex.tv/pins/*/xml', async (route) => {
      await route.abort('failed');
    });
  }

  /**
   * Create a test user in the database
   */
  async createTestUser(userType: keyof typeof TEST_USERS): Promise<void> {
    const userData = TEST_USERS[userType];

    await prisma.user.upsert({
      where: { plexId: userData.plexId },
      update: userData,
      create: {
        ...userData,
        plexToken: 'encrypted-test-token',
        status: 'active',
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Set up authenticated session by creating cookies
   */
  async setupAuthenticatedSession(userType: keyof typeof TEST_USERS = 'user'): Promise<void> {
    await this.createTestUser(userType);
    const userData = TEST_USERS[userType];

    // Create JWT-like token for testing
    const mockToken = `mock-jwt-${userType}-${Date.now()}`;

    // Set authentication cookies
    await this.page.context().addCookies([
      {
        name: 'token',
        value: mockToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    // Mock session verification endpoint
    await this.page.route(`${this.apiBaseUrl}/auth/session`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: userData.plexId,
              username: userData.username,
              email: userData.email,
              role: userData.role,
            },
          },
        }),
      });
    });
  }

  /**
   * Set up expired session for testing timeout scenarios
   */
  async setupExpiredSession(): Promise<void> {
    await this.page.context().addCookies([
      {
        name: 'token',
        value: 'expired-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    // Mock expired token response
    await this.page.route(`${this.apiBaseUrl}/auth/session`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Token expired', code: 'TOKEN_EXPIRED' },
        }),
      });
    });
  }

  /**
   * Mock rate-limited authentication response
   */
  async setupRateLimitedAuth(): Promise<void> {
    await this.page.route(`${this.apiBaseUrl}/auth/plex/verify`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Too many authentication attempts',
            code: 'RATE_LIMITED',
            retryAfter: 60,
          },
        }),
      });
    });
  }

  /**
   * Clear all authentication cookies
   */
  async clearAuthCookies(): Promise<void> {
    await this.page.context().clearCookies();
  }

  /**
   * Navigate to login page and perform Plex OAuth flow
   */
  async performPlexLogin(): Promise<void> {
    await this.setupMockPlexApi();
    await this.page.goto(`${this.baseUrl}/auth/login`);
    await this.page.click('[data-testid="plex-login-button"]');
    await this.page.click('[data-testid="plex-authorize-button"]');
  }

  /**
   * Verify successful authentication redirect
   */
  async verifyAuthenticationSuccess(): Promise<void> {
    await this.page.waitForURL(`${this.baseUrl}/dashboard`, { timeout: 10000 });
  }

  /**
   * Verify user is redirected to login
   */
  async verifyRedirectToLogin(): Promise<void> {
    await this.page.waitForURL(`${this.baseUrl}/auth/login`);
  }

  /**
   * Perform logout action
   */
  async performLogout(): Promise<void> {
    await this.page.click('[data-testid="user-menu-button"]');
    await this.page.click('[data-testid="logout-button"]');
  }

  /**
   * Get current session data from API
   */
  async getCurrentSession(): Promise<any> {
    return await this.page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'include',
      });
      if (response.ok) {
        return await response.json();
      }
      return { status: response.status, success: false };
    });
  }

  /**
   * Wait for element with timeout and return if it exists
   */
  async waitForTestId(testId: string, timeout: number = 5000): Promise<boolean> {
    try {
      await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user has admin privileges in UI
   */
  async hasAdminAccess(): Promise<boolean> {
    return await this.waitForTestId('admin-menu-button');
  }

  /**
   * Navigate to admin panel
   */
  async navigateToAdminPanel(): Promise<void> {
    await this.page.click('[data-testid="admin-menu-button"]');
    await this.page.click('[data-testid="admin-panel-link"]');
    await this.page.waitForURL(`${this.baseUrl}/admin`);
  }

  /**
   * Set up mock for admin API endpoints with proper authorization
   */
  async setupAdminApiMocks(userRole: 'admin' | 'user'): Promise<void> {
    const isAdmin = userRole === 'admin';

    await this.page.route(`${this.apiBaseUrl}/admin/**`, async (route) => {
      if (isAdmin) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { message: 'Admin access granted' },
          }),
        });
      } else {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
          }),
        });
      }
    });
  }

  /**
   * Simulate network retry scenario
   */
  async setupNetworkRetryScenario(): Promise<void> {
    let attempts = 0;

    await this.page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml',
          body: `<pin><authToken>retry-success-token</authToken></pin>`,
        });
      }
    });
  }

  /**
   * Clean up test user data
   */
  async cleanupTestUsers(): Promise<void> {
    const plexIds = Object.values(TEST_USERS).map((user) => user.plexId);

    await prisma.user.deleteMany({
      where: {
        plexId: {
          in: plexIds,
        },
      },
    });
  }
}

/**
 * Page Object Model for Authentication Pages
 */
export class AuthPageObjects {
  private page: Page;
  private baseUrl: string;

  constructor(page: Page, baseUrl: string = 'http://localhost:3001') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  // Login Page
  get loginPage() {
    return this.page.locator('[data-testid="login-page"]');
  }

  get plexLoginButton() {
    return this.page.locator('[data-testid="plex-login-button"]');
  }

  get authErrorMessage() {
    return this.page.locator('[data-testid="auth-error-message"]');
  }

  // Plex PIN Modal
  get plexPinModal() {
    return this.page.locator('[data-testid="plex-pin-modal"]');
  }

  get plexPinCode() {
    return this.page.locator('[data-testid="plex-pin-code"]');
  }

  get plexQrCode() {
    return this.page.locator('[data-testid="plex-qr-code"]');
  }

  get plexAuthorizeButton() {
    return this.page.locator('[data-testid="plex-authorize-button"]');
  }

  get pinErrorMessage() {
    return this.page.locator('[data-testid="pin-error-message"]');
  }

  // Admin Setup Page
  get adminSetupPage() {
    return this.page.locator('[data-testid="admin-setup-page"]');
  }

  get adminPasswordInput() {
    return this.page.locator('[data-testid="admin-password-input"]');
  }

  get adminPasswordConfirm() {
    return this.page.locator('[data-testid="admin-password-confirm"]');
  }

  get adminSetupSubmit() {
    return this.page.locator('[data-testid="admin-setup-submit"]');
  }

  get passwordError() {
    return this.page.locator('[data-testid="password-error"]');
  }

  get passwordMismatchError() {
    return this.page.locator('[data-testid="password-mismatch-error"]');
  }

  // Dashboard
  get dashboardWelcome() {
    return this.page.locator('[data-testid="dashboard-welcome"]');
  }

  get userMenuButton() {
    return this.page.locator('[data-testid="user-menu-button"]');
  }

  get adminMenuButton() {
    return this.page.locator('[data-testid="admin-menu-button"]');
  }

  get logoutButton() {
    return this.page.locator('[data-testid="logout-button"]');
  }

  get adminPanelLink() {
    return this.page.locator('[data-testid="admin-panel-link"]');
  }

  // Error States
  get networkErrorMessage() {
    return this.page.locator('[data-testid="network-error-message"]');
  }

  get rateLimitError() {
    return this.page.locator('[data-testid="rate-limit-error"]');
  }

  get sessionExpiredMessage() {
    return this.page.locator('[data-testid="session-expired-message"]');
  }

  get unauthorizedMessage() {
    return this.page.locator('[data-testid="unauthorized-message"]');
  }

  get retryButton() {
    return this.page.locator('[data-testid="retry-button"]');
  }

  // Navigation helpers
  async navigateToLogin(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/auth/login`);
  }

  async navigateToDashboard(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/dashboard`);
  }

  async navigateToAdminPanel(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/admin`);
  }
}
