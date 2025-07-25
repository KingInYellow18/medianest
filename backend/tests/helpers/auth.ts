import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

export function createAuthToken(user: any = {}) {
  const payload = {
    userId: user.id || 'test-user-id',
    email: user.email || 'test@example.com',
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function createAdminToken() {
  return jwt.sign(
    {
      userId: 'admin-user-id',
      email: 'admin@example.com',
      role: 'admin',
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

export function createExpiredToken() {
  return jwt.sign(
    { userId: 'test-user-id', role: 'user' },
    JWT_SECRET,
    { expiresIn: '-1h' }, // Already expired
  );
}

export function createInvalidToken() {
  return 'invalid.jwt.token';
}

export function createAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
