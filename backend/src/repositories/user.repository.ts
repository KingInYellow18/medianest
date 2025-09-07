import { User, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

import { encryptionService } from '../services/encryption.service';
// @ts-ignore
import {
  NotFoundError, // @ts-ignore
} from '@medianest/shared';
import { logger } from '../utils/logger';

import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { CatchError } from '../types/common';

export interface CreateUserInput {
  email: string;
  name?: string;
  plexId?: string;
  plexUsername?: string;
  plexToken?: string;
  role?: string;
  password?: string;
  status?: string;
  emailVerified?: boolean;
  image?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  plexUsername?: string;
  plexToken?: string;
  role?: string;
  status?: string;
  lastLoginAt?: Date;
  requiresPasswordChange?: boolean;
  image?: string | null;
  githubId?: string | null;
  githubUsername?: string | null;
  googleId?: string | null;
  googleUsername?: string | null;
  emailVerified?: boolean;
}

export class UserRepository extends BaseRepository<User, CreateUserInput, UpdateUserInput> {
  private decryptUserData(user: User): User {
    try {
      const decryptedUser = { ...user };

      // Decrypt Plex token if it exists
      if (user.plexToken) {
        try {
          decryptedUser.plexToken = encryptionService.decryptFromStorage(user.plexToken);
        } catch (error: CatchError) {
          logger.error('Failed to decrypt Plex token', { userId: user.id, error });
          // Return null token if decryption fails
          decryptedUser.plexToken = null;
        }
      }

      return decryptedUser;
    } catch (error: CatchError) {
      logger.error('Failed to decrypt user data', { userId: user.id, error });
      return user;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      return user ? this.decryptUserData(user) : null;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      return user ? this.decryptUserData(user) : null;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findByPlexId(plexId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { plexId },
      });
      return user ? this.decryptUserData(user) : null;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    return this.paginate<User>(this.prisma.user, {}, options, {
      id: true,
      email: true,
      name: true,
      plexUsername: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    });
  }

  async findByRole(role: string, options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    return this.paginate<User>(this.prisma.user, { role }, options);
  }

  async create(data: CreateUserInput): Promise<User> {
    try {
      const encryptedData = { ...data };

      // Encrypt Plex token if provided
      if (data.plexToken) {
        encryptedData.plexToken = encryptionService.encryptForStorage(data.plexToken);
      }

      // Hash password if provided
      if (data.password) {
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Create password hash field for admin bootstrap
        const userData: any = {
          ...encryptedData,
          passwordHash: hashedPassword,
        };
        delete userData.password;

        const user = await this.prisma.user.create({
          data: userData,
        });
        return this.decryptUserData(user);
      }

      const user = await this.prisma.user.create({
        data: encryptedData as Prisma.UserCreateInput,
      });
      return this.decryptUserData(user);
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      // Verify user exists
      const exists = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundError('User');
      }

      const encryptedData = { ...data };

      // Encrypt Plex token if provided
      if (data.plexToken) {
        encryptedData.plexToken = encryptionService.encryptForStorage(data.plexToken);
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: encryptedData,
      });

      return this.decryptUserData(user);
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async updateLastLogin(id: string): Promise<User> {
    return this.update(id, { lastLoginAt: new Date() });
  }

  async delete(id: string): Promise<User> {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async countByRole(role: string): Promise<number> {
    return this.prisma.user.count({
      where: { role },
    });
  }

  async isFirstUser(): Promise<boolean> {
    const count = await this.count();
    return count === 0;
  }

  async updatePlexToken(id: string, plexToken: string): Promise<User> {
    return this.update(id, { plexToken });
  }

  async findActiveUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    return this.paginate<User>(this.prisma.user, { status: 'active' }, options);
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          passwordHash: newPasswordHash,
          requiresPasswordChange: false,
        },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }
}
