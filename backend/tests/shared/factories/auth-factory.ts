/**
 * Authentication Test Factory - Mock and test data generation
 * Updated with Phase 2 mock fixes
 */

import { Page } from '@playwright/test';
import { BaseTestHelper, TestUser } from '../helpers/test-base';
import {
  createMockAuthenticatedUser,
  createMockJWTPayload,
  setupAllAuthMocks,
  resetAllAuthMocks,
} from '../mocks';

export class AuthTestFactory {
  static readonly TEST_USERS = {
    admin: {
      plexId: 'e2e-admin-123',
      username: 'testadmin',
      email: 'admin@e2etest.local',
      role: 'admin' as const,
    },
    user: {
      plexId: 'e2e-user-456',
      username: 'testuser',
      email: 'user@e2etest.local',
      role: 'user' as const,
    },
  };

  static createMockPlexResponses() {
    return {
      pinGeneration: {
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-123</id>
            <code>TEST</code>
          </pin>`,
      },
      pinVerification: {
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <authToken>mock-plex-token-12345</authToken>
          </pin>`,
      },
      userInfo: {
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <user>
            <id>e2e-test-123</id>
            <username>e2etestuser</username>
            <email>e2e@test.local</email>
          </user>`,
      },
    };
  }

  static async setupMockPlexAuth(page: Page) {
    const responses = this.createMockPlexResponses();

    await page.route('https://plex.tv/pins.xml', async (route) => {
      await route.fulfill(responses.pinGeneration);
    });

    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await route.fulfill(responses.pinVerification);
    });

    await page.route('https://plex.tv/users/account.xml', async (route) => {
      await route.fulfill(responses.userInfo);
    });
  }

  static createMockAuthToken(): string {
    return 'mock-jwt-token-for-testing-' + Date.now().toString(16);
  }

  static createSessionMock(user: TestUser) {
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    };
  }

  // New helper methods using Phase 2 mocks
  static createMockUserForTest(overrides?: any) {
    return createMockAuthenticatedUser(overrides);
  }

  static createMockJWTForTest(overrides?: any) {
    return createMockJWTPayload(overrides);
  }

  static setupComprehensiveMocks() {
    return setupAllAuthMocks();
  }

  static resetComprehensiveMocks(mocks: any) {
    resetAllAuthMocks(mocks);
  }

  static createErrorScenarios() {
    return {
      networkError: () => ({ abort: 'failed' }),
      unauthorizedPin: {
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-123</id>
          </pin>`,
      },
      invalidPin: {
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PIN not found' }),
      },
      rateLimited: {
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
      },
      expiredToken: {
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Token expired', code: 'TOKEN_EXPIRED' },
        }),
      },
    };
  }

  static async setupAuthenticatedSession(
    page: Page,
    userType: 'admin' | 'user' = 'user',
    apiBaseUrl: string = '',
  ) {
    const userData = this.TEST_USERS[userType];
    const mockToken = this.createMockAuthToken();

    // Set authentication cookies
    await page.context().addCookies([
      {
        name: 'token',
        value: mockToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    // Mock session verification
    if (apiBaseUrl) {
      await page.route(`${apiBaseUrl}/auth/session`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            this.createSessionMock({
              id: userData.plexId,
              plexId: userData.plexId,
              username: userData.username,
              email: userData.email,
              role: userData.role,
            }),
          ),
        });
      });
    }

    return mockToken;
  }

  static async clearAuthSession(page: Page) {
    await page.context().clearCookies();
  }

  static createPasswordValidationScenarios() {
    return [
      {
        name: 'weak password',
        password: 'weak',
        expectedError: 'Password must be at least 8 characters',
      },
      {
        name: 'no uppercase',
        password: 'lowercase123!',
        expectedError: 'Password must contain uppercase letter',
      },
      {
        name: 'no lowercase',
        password: 'UPPERCASE123!',
        expectedError: 'Password must contain lowercase letter',
      },
      {
        name: 'no numbers',
        password: 'PasswordOnly!',
        expectedError: 'Password must contain at least one number',
      },
      {
        name: 'no special characters',
        password: 'Password123',
        expectedError: 'Password must contain special character',
      },
      {
        name: 'password mismatch',
        password: 'ValidPassword123!',
        confirm: 'DifferentPassword123!',
        expectedError: 'Passwords do not match',
      },
    ];
  }

  static createConcurrentLoginScenario() {
    return {
      userCount: 3,
      timeout: 5000,
      expectedSuccessCount: 1, // Only one should succeed
    };
  }
}
