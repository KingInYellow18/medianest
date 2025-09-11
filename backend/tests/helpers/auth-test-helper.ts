/**
 * AUTHENTICATION TEST HELPER
 * 
 * Utilities for creating test users, tokens, and authentication scenarios
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthTestHelper {
  private prisma: PrismaClient;
  private userCounter = 0;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async createTestUser(username?: string, email?: string, role: 'USER' | 'ADMIN' = 'USER') {
    this.userCounter++;
    const testUsername = username || `testuser${this.userCounter}`;
    const testEmail = email || `testuser${this.userCounter}@medianest.test`;
    const hashedPassword = await bcrypt.hash('password123', 10);

    return await this.prisma.user.create({
      data: {
        email: testEmail,
        plexId: `plex-test-${this.userCounter}`,
        plexUsername: testUsername,
        role,
        status: 'ACTIVE',
        passwordHash: hashedPassword
      }
    });
  }

  async createTestAdmin(username?: string, email?: string) {
    return await this.createTestUser(username, email, 'ADMIN');
  }

  async generateValidToken(userId: string, role: string = 'USER') {
    return await this.generateAccessToken(userId);
  }

  async generateAccessToken(userId: string) {
    const payload = {
      sub: userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
  }

  async generateRefreshToken(userId: string) {
    const payload = {
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
  }

  async createUserWithTokens(email?: string, role: 'USER' | 'ADMIN' = 'USER') {
    const user = await this.createTestUser(email, role);
    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  async cleanupTestUsers() {
    await this.prisma.user.deleteMany({
      where: {
        email: {
          contains: '@medianest.test'
        }
      }
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}