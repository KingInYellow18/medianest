import { PrismaClient } from '@prisma/client';

import { AppError } from '../utils/errors';
import { CatchError } from '../types/common';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  constructor(protected prisma: PrismaClient) {}

  protected handleDatabaseError(error: any): never {
    // Handle Prisma-specific errors
    if (((error as any).code as any) === 'P2002') {
      throw new AppError('Duplicate entry', 409, 'DUPLICATE_ENTRY');
    }
    if (((error as any).code as any) === 'P2025') {
      throw new AppError('Record not found', 404, 'NOT_FOUND');
    }
    if (((error as any).code as any) === 'P2003') {
      throw new AppError('Foreign key constraint failed', 400, 'FOREIGN_KEY_ERROR');
    }
    if (((error as any).code as any) === 'P2016') {
      throw new AppError('Query interpretation error', 400, 'QUERY_ERROR');
    }

    // Re-throw unknown errors
    throw error;
  }

  protected getPaginationParams(options: PaginationOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip, take: limit };
  }

  protected async paginate<M>(
    model: any,
    where: any = {},
    options: PaginationOptions = {},
    select?: any,
    include?: any
  ): Promise<PaginatedResult<M>> {
    const { page, limit, skip, take } = this.getPaginationParams(options);

    try {
      const [items, total] = await Promise.all([
        model.findMany({
          where,
          skip,
          take,
          orderBy: options.orderBy || { createdAt: 'desc' },
          ...(select && { select }),
          ...(include && { include }),
        }),
        model.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }
}
