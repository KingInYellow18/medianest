import { User, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

import { getPrismaClient } from '../db/prisma';
import { NotFoundError } from '../utils/errors';

import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
} from './base.repository';

export interface CreateUserInput {
  email: string;
  name?: string;
  plexId?: string;
  plexUsername?: string;
  plexToken?: string;
  role?: string;
  password?: string;
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
}

export class UserRepository extends BaseRepository<
  User,
  CreateUserInput,
  UpdateUserInput
> {
  constructor() {
    super(getPrismaClient());
  }
  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findByPlexId(plexId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { plexId },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<User>> {
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

  async findByRole(
    role: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<User>> {
    return this.paginate<User>(this.prisma.user, { role }, options);
  }

  async create(data: CreateUserInput): Promise<User> {
    try {
      // Hash password if provided
      if (data.password) {
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Create password hash field for admin bootstrap
        const { password, ...userDataWithoutPassword } = data;
        const userData = {
          ...userDataWithoutPassword,
          passwordHash: hashedPassword,
        };

        return await this.prisma.user.create({
          data: userData as Prisma.UserCreateInput,
        });
      }

      return await this.prisma.user.create({
        data: data as Prisma.UserCreateInput,
      });
    } catch (error) {
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

      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
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
    } catch (error) {
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

  async findActiveUsers(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<User>> {
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
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }
}
