/**
 * Test user fixtures for E2E testing
 * These users should be created in the test database during setup
 */

export interface TestUser {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'editor';
  isActive?: boolean;
  createdAt?: string;
  permissions?: string[];
}

// Predefined test users
export const testUsers: Record<string, TestUser> = {
  // Admin user with full permissions
  adminUser: {
    name: 'Admin User',
    email: 'admin@medianest.test',
    password: 'AdminPassword123!',
    role: 'admin',
    isActive: true,
    permissions: [
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'requests:create',
      'requests:read',
      'requests:update',
      'requests:delete',
      'admin:access',
      'system:settings'
    ]
  },

  // Regular user with standard permissions
  regularUser: {
    name: 'Regular User',
    email: 'user@medianest.test',
    password: 'UserPassword123!',
    role: 'user',
    isActive: true,
    permissions: [
      'requests:create',
      'requests:read',
      'requests:update',
      'requests:delete:own'
    ]
  },

  // Editor user with elevated permissions
  editorUser: {
    name: 'Editor User',
    email: 'editor@medianest.test',
    password: 'EditorPassword123!',
    role: 'editor',
    isActive: true,
    permissions: [
      'requests:create',
      'requests:read',
      'requests:update',
      'requests:delete',
      'users:read'
    ]
  },

  // Inactive user for testing access restrictions
  inactiveUser: {
    name: 'Inactive User',
    email: 'inactive@medianest.test',
    password: 'InactivePassword123!',
    role: 'user',
    isActive: false,
    permissions: []
  },

  // Test user for deletion tests
  deletableUser: {
    name: 'Deletable User',
    email: 'delete@medianest.test',
    password: 'DeletePassword123!',
    role: 'user',
    isActive: true,
    permissions: [
      'requests:create',
      'requests:read',
      'requests:update',
      'requests:delete:own'
    ]
  }
};

// Dynamic user creation helpers
export class TestUserFactory {
  private static userCounter = 0;

  /**
   * Generate a unique test user
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    this.userCounter++;
    
    return {
      name: `Test User ${this.userCounter}`,
      email: `testuser${this.userCounter}@medianest.test`,
      password: `TestPassword${this.userCounter}!`,
      role: 'user',
      isActive: true,
      permissions: [
        'requests:create',
        'requests:read',
        'requests:update',
        'requests:delete:own'
      ],
      ...overrides
    };
  }

  /**
   * Create admin user
   */
  static createAdmin(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'admin',
      permissions: [
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'requests:create',
        'requests:read',
        'requests:update',
        'requests:delete',
        'admin:access',
        'system:settings'
      ],
      ...overrides
    });
  }

  /**
   * Create editor user
   */
  static createEditor(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'editor',
      permissions: [
        'requests:create',
        'requests:read',
        'requests:update',
        'requests:delete',
        'users:read'
      ],
      ...overrides
    });
  }

  /**
   * Create user with specific permissions
   */
  static createUserWithPermissions(permissions: string[], overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      permissions,
      ...overrides
    });
  }

  /**
   * Create batch of test users
   */
  static createBatch(count: number, template: Partial<TestUser> = {}): TestUser[] {
    const users: TestUser[] = [];
    
    for (let i = 0; i < count; i++) {
      users.push(this.createUser(template));
    }
    
    return users;
  }

  /**
   * Reset counter (useful for test isolation)
   */
  static resetCounter(): void {
    this.userCounter = 0;
  }
}

// User credentials for quick access
export const userCredentials = {
  admin: {
    email: testUsers.adminUser.email,
    password: testUsers.adminUser.password
  },
  user: {
    email: testUsers.regularUser.email,
    password: testUsers.regularUser.password
  },
  editor: {
    email: testUsers.editorUser.email,
    password: testUsers.editorUser.password
  }
};

// Role-based permission sets
export const rolePermissions = {
  admin: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'requests:create',
    'requests:read',
    'requests:update',
    'requests:delete',
    'admin:access',
    'system:settings'
  ],
  editor: [
    'requests:create',
    'requests:read',
    'requests:update',
    'requests:delete',
    'users:read'
  ],
  user: [
    'requests:create',
    'requests:read',
    'requests:update',
    'requests:delete:own'
  ]
};

// Common user scenarios for testing
export const userScenarios = {
  // Users with different request limits
  limitedUser: {
    ...testUsers.regularUser,
    email: 'limited@medianest.test',
    name: 'Limited User',
    maxRequests: 5
  },
  
  unlimitedUser: {
    ...testUsers.adminUser,
    email: 'unlimited@medianest.test',
    name: 'Unlimited User',
    maxRequests: -1 // No limit
  },

  // Users for testing different authentication flows
  newUser: {
    name: 'New User',
    email: 'newuser@medianest.test',
    password: 'NewPassword123!',
    role: 'user' as const,
    isActive: true,
    needsPasswordChange: true
  },

  expiredPasswordUser: {
    ...testUsers.regularUser,
    email: 'expired@medianest.test',
    name: 'Expired Password User',
    passwordExpired: true
  },

  // Users for testing social login
  googleUser: {
    name: 'Google User',
    email: 'googleuser@medianest.test',
    password: '', // No password for social users
    role: 'user' as const,
    authProvider: 'google',
    socialId: 'google_123456789'
  },

  facebookUser: {
    name: 'Facebook User',
    email: 'fbuser@medianest.test',
    password: '', // No password for social users
    role: 'user' as const,
    authProvider: 'facebook',
    socialId: 'fb_987654321'
  }
};

// Export all test users as array for batch operations
export const allTestUsers = Object.values(testUsers);

// Export specific user lists by role
export const adminUsers = allTestUsers.filter(user => user.role === 'admin');
export const regularUsers = allTestUsers.filter(user => user.role === 'user');
export const editorUsers = allTestUsers.filter(user => user.role === 'editor');