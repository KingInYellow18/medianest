/**
 * Optimized Base Repository with Connection Pool Integration
 * Replaces direct Prisma client usage with connection pooling
 */
import { AppError } from '@medianest/shared';

import { executeQuery, executeTransaction } from '../config/database-connection-pool';
import { CatchError } from '../types/common';
import { logger } from '../utils/logger';

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
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CacheOptions {
  key?: string;
  ttl?: number; // seconds
  skipCache?: boolean;
}

export abstract class OptimizedBaseRepository<T, CreateInput, UpdateInput> {
  protected readonly modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  /**
   * Execute query with connection pool and error handling
   */
  protected async query<R>(
    operation: (client: any) => Promise<R>,
    operationName: string = 'query',
  ): Promise<R> {
    return executeQuery(async (client) => {
      try {
        return await operation(client);
      } catch (error: CatchError) {
        this.handleDatabaseError(error, operationName);
        // handleDatabaseError never returns (throws), so no return needed
      }
    }, `${this.modelName}.${operationName}`);
  }

  /**
   * Execute transaction with connection pool
   */
  protected async transaction<R>(
    operations: (client: any) => Promise<R>,
    operationName: string = 'transaction',
  ): Promise<R> {
    return executeTransaction(async (client) => {
      try {
        return await operations(client);
      } catch (error: CatchError) {
        this.handleDatabaseError(error, operationName);
        // handleDatabaseError never returns (throws), so no return needed
      }
    }, `${this.modelName}.${operationName}`);
  }

  /**
   * Optimized pagination with connection pooling
   */
  protected async paginate<M>(
    queryBuilder: (client: any) => any,
    where: any = {},
    options: PaginationOptions = {},
    select?: any,
    include?: any,
  ): Promise<PaginatedResult<M>> {
    return this.query(async (client) => {
      const { page, limit, skip, take } = this.getPaginationParams(options);
      const model = queryBuilder(client);

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

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };
    }, 'paginate');
  }

  /**
   * Find by ID with optimized query
   */
  protected async findById(
    id: string,
    queryBuilder: (client: any) => any,
    include?: any,
  ): Promise<T | null> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      return await model.findUnique({
        where: { id },
        ...(include && { include }),
      });
    }, 'findById');
  }

  /**
   * Create with optimized transaction
   */
  protected async create(
    data: CreateInput,
    queryBuilder: (client: any) => any,
    include?: any,
  ): Promise<T> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      return await model.create({
        data,
        ...(include && { include }),
      });
    }, 'create');
  }

  /**
   * Update with optimized transaction and existence check
   */
  protected async update(
    id: string,
    data: UpdateInput,
    queryBuilder: (client: any) => any,
    include?: any,
  ): Promise<T> {
    return this.transaction(async (client) => {
      const model = queryBuilder(client);

      // Check existence first
      const exists = await model.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new AppError('NOT_FOUND', `${this.modelName} not found`, 404);
      }

      return await model.update({
        where: { id },
        data,
        ...(include && { include }),
      });
    }, 'update');
  }

  /**
   * Delete with existence check
   */
  protected async delete(id: string, queryBuilder: (client: any) => any): Promise<T> {
    return this.transaction(async (client) => {
      const model = queryBuilder(client);

      // Check existence first
      const exists = await model.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new AppError('NOT_FOUND', `${this.modelName} not found`, 404);
      }

      return await model.delete({
        where: { id },
      });
    }, 'delete');
  }

  /**
   * Bulk operations with optimized batch processing
   */
  protected async bulkCreate(
    data: CreateInput[],
    queryBuilder: (client: any) => any,
    batchSize: number = 100,
  ): Promise<{ count: number; items?: T[] }> {
    if (data.length === 0) {
      return { count: 0, items: [] };
    }

    return this.transaction(async (client) => {
      const model = queryBuilder(client);
      let totalCount = 0;
      const createdItems: T[] = [];

      // Process in batches to avoid overwhelming database
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const result = await model.createMany({
          data: batch,
          skipDuplicates: true,
        });

        totalCount += result.count;
      }

      return { count: totalCount, items: createdItems };
    }, 'bulkCreate');
  }

  /**
   * Bulk update with optimized batching
   */
  protected async bulkUpdate(
    where: any,
    data: Partial<UpdateInput>,
    queryBuilder: (client: any) => any,
  ): Promise<number> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      const result = await model.updateMany({
        where,
        data,
      });
      return result.count;
    }, 'bulkUpdate');
  }

  /**
   * Count with optimized query
   */
  protected async count(where: any = {}, queryBuilder: (client: any) => any): Promise<number> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      return await model.count({ where });
    }, 'count');
  }

  /**
   * Exists check with optimized query
   */
  protected async exists(where: any, queryBuilder: (client: any) => any): Promise<boolean> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      const result = await model.findFirst({
        where,
        select: { id: true },
      });
      return !!result;
    }, 'exists');
  }

  /**
   * Aggregation queries with optimization
   */
  protected async aggregate(
    operations: any,
    where: any = {},
    queryBuilder: (client: any) => any,
  ): Promise<any> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      return await model.aggregate({
        where,
        ...operations,
      });
    }, 'aggregate');
  }

  /**
   * Group by with optimization
   */
  protected async groupBy(
    by: string[],
    where: any = {},
    having: any = {},
    queryBuilder: (client: any) => any,
    aggregations?: any,
  ): Promise<any[]> {
    return this.query(async (client) => {
      const model = queryBuilder(client);
      return await model.groupBy({
        by,
        where,
        having,
        ...aggregations,
      });
    }, 'groupBy');
  }

  /**
   * Handle database-specific errors with enhanced error reporting
   */
  protected handleDatabaseError(error: any, operation: string): never {
    // Log detailed error for debugging
    logger.error('Database operation failed', {
      model: this.modelName,
      operation,
      error: error.message,
      code: error.code,
      meta: error.meta,
    });

    // Handle Prisma-specific errors
    switch (error.code) {
      case 'P2002':
        throw new AppError('DUPLICATE_ENTRY', `Duplicate ${this.modelName} entry`, 409, {
          field: error.meta?.target,
        });
      case 'P2025':
        throw new AppError('NOT_FOUND', `${this.modelName} not found`, 404);
      case 'P2003':
        throw new AppError('FOREIGN_KEY_ERROR', 'Foreign key constraint failed', 400, {
          field: error.meta?.field_name,
        });
      case 'P2016':
        throw new AppError('QUERY_ERROR', 'Query interpretation error', 400);
      case 'P2021':
        throw new AppError('TABLE_NOT_FOUND', `Table '${error.meta?.table}' does not exist`, 500);
      case 'P2024':
        throw new AppError('CONNECTION_ERROR', 'Database connection timed out', 503);
      default:
        // Re-throw unknown errors with additional context
        throw new AppError('DATABASE_ERROR', `Database operation failed: ${error.message}`, 500, {
          operation,
          model: this.modelName,
        });
    }
  }

  /**
   * Get pagination parameters with validation
   */
  protected getPaginationParams(options: PaginationOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip, take: limit };
  }

  /**
   * Generate cache key for operations
   */
  protected generateCacheKey(operation: string, params: any): string {
    const paramsHash = Buffer.from(JSON.stringify(params)).toString('base64');
    return `${this.modelName}:${operation}:${paramsHash}`;
  }

  /**
   * Validate input data with model-specific rules
   */
  protected validateInput(data: any, operation: 'create' | 'update'): void {
    // Override in child classes for specific validation
    if (!data || typeof data !== 'object') {
      throw new AppError('INVALID_INPUT', `Invalid ${operation} data for ${this.modelName}`, 400);
    }
  }

  /**
   * Get model statistics
   */
  async getStats(): Promise<{ total: number; recentCount: number }> {
    return this.query(async (client) => {
      const model = this.getModel(client);

      const [total, recentCount] = await Promise.all([
        model.count(),
        model.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ]);

      return { total, recentCount };
    }, 'getStats');
  }

  /**
   * Abstract method to get model instance - implement in child classes
   */
  protected abstract getModel(client: any): any;
}
