// Test fixtures for authentication-related tests

export const authFixtures = {
  plexPin: {
    success: {
      pin: '1234',
      sessionId: 'test-session-id',
      authUrl:
        'https://plex.tv/auth#!?clientID=test-client&context[device][product]=MediaNest&context[device][version]=1.0.0&context[device][platform]=Web&context[device][platformVersion]=1.0.0&context[device][device]=Web&context[device][deviceName]=MediaNest&context[device][model]=Web&context[device][screenResolution]=1920x1080&code=1234',
    },
    authorized: {
      authorized: true,
      authToken: 'test-plex-token',
    },
    pending: {
      authorized: false,
    },
  },
  plexCallback: {
    success: {
      success: true,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      },
    },
    error: {
      success: false,
      error: 'Invalid token',
    },
  },
  adminLogin: {
    success: {
      url: '/auth/change-password?requiresPasswordChange=true',
    },
    error: {
      error: 'Invalid credentials',
    },
  },
  changePassword: {
    success: {
      success: true,
      message: 'Password changed successfully',
    },
    error: {
      success: false,
      error: 'Current password is incorrect',
    },
  },
  session: {
    authenticated: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    admin: {
      user: {
        id: 'test-admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  },
};
