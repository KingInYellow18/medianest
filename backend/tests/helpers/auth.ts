import { generateToken } from '@/utils/jwt';
import { User } from '@prisma/client';

export function createAuthToken(user: Partial<User> = {}) {
  const payload = {
    userId: user.id || 'test-user-id',
    email: user.email || 'test@example.com',
    role: user.role || 'user',
  };
  // For testing, include userId in token for MSW parsing
  const token = generateToken(payload, false);
  return `${token}.${user.id || 'test-user-id'}`;
}

export function createAdminToken() {
  return generateToken(
    {
      userId: 'admin-user-id',
      email: 'admin@example.com',
      role: 'admin',
    },
    false,
  );
}

export function createExpiredToken() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId: 'test-user-id', role: 'user' },
    process.env.JWT_SECRET,
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
