import crypto from 'crypto';

import { SessionToken, Prisma } from '@prisma/client';

// @ts-ignore
import {
  NotFoundError, // @ts-ignore
} from '@medianest/shared';

import { BaseRepository } from './base.repository';
import { CatchError } from '../types/common';

export interface CreateSessionTokenInput {
  userId: string;
  expiresAt: Date;
}

export class SessionTokenRepository extends BaseRepository<
  SessionToken,
  CreateSessionTokenInput,
  any
> {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(
    data: CreateSessionTokenInput
  ): Promise<{ token: string; sessionToken: SessionToken }> {
    try {
      // Generate a secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);

      const sessionToken = await this.prisma.sessionToken.create({
        data: {
          userId: data.userId,
          tokenHash,
          expiresAt: data.expiresAt,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
            },
          },
        },
      });

      return {
        token: rawToken,
        sessionToken,
      };
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findByToken(token: string): Promise<SessionToken | null> {
    try {
      const tokenHash = this.hashToken(token);

      return await this.prisma.sessionToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
            },
          },
        },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findByUserId(userId: string): Promise<SessionToken[]> {
    try {
      return await this.prisma.sessionToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async validate(token: string): Promise<SessionToken | null> {
    const sessionToken = await this.findByToken(token);

    if (!sessionToken) {
      return null;
    }

    // Check if token is expired
    if (sessionToken.expiresAt < new Date()) {
      // Delete expired token
      await this.delete(sessionToken.id);
      return null;
    }

    // Update last used timestamp
    await this.updateLastUsed(sessionToken.id);

    return sessionToken;
  }

  async updateLastUsed(id: string): Promise<SessionToken> {
    try {
      return await this.prisma.sessionToken.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async delete(id: string): Promise<SessionToken> {
    try {
      return await this.prisma.sessionToken.delete({
        where: { id },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async deleteByToken(token: string): Promise<SessionToken> {
    try {
      const tokenHash = this.hashToken(token);

      return await this.prisma.sessionToken.delete({
        where: { tokenHash },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async deleteByUserId(userId: string): Promise<number> {
    try {
      const result = await this.prisma.sessionToken.deleteMany({
        where: { userId },
      });

      return result.count;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async deleteExpired(): Promise<number> {
    try {
      const result = await this.prisma.sessionToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    try {
      return await this.prisma.sessionToken.count({
        where: {
          userId,
          expiresAt: {
            gt: new Date(),
          },
        },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async extendExpiry(id: string, newExpiryDate: Date): Promise<SessionToken> {
    try {
      return await this.prisma.sessionToken.update({
        where: { id },
        data: { expiresAt: newExpiryDate },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }
}
