import { MediaRequest, Prisma } from '@prisma/client';

// @ts-ignore
import {
  NotFoundError, // @ts-ignore
} from '@medianest/shared';

import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';

export interface CreateMediaRequestInput {
  userId: string;
  title: string;
  mediaType: string;
  tmdbId?: string;
  overseerrId?: string;
}

export interface UpdateMediaRequestInput {
  status?: string;
  overseerrId?: string;
  completedAt?: Date;
}

export interface MediaRequestFilters {
  userId?: string;
  status?: string;
  mediaType?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class MediaRequestRepository extends BaseRepository<
  MediaRequest,
  CreateMediaRequestInput,
  UpdateMediaRequestInput
> {
  async findById(id: string): Promise<MediaRequest | null> {
    try {
      return await this.prisma.mediaRequest.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              plexUsername: true,
            },
          },
        },
      });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async findByUser(
    userId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<MediaRequest>> {
    return this.paginate<MediaRequest>(this.prisma.mediaRequest, { userId }, options, undefined, {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          plexUsername: true,
        },
      },
    });
  }

  async findByFilters(
    filters: MediaRequestFilters,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<MediaRequest>> {
    const where: Prisma.MediaRequestWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.mediaType) where.mediaType = filters.mediaType;

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    return this.paginate<MediaRequest>(this.prisma.mediaRequest, where, options, undefined, {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          plexUsername: true,
        },
      },
    });
  }

  async create(data: CreateMediaRequestInput): Promise<MediaRequest> {
    try {
      return await this.prisma.mediaRequest.create({
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              plexUsername: true,
            },
          },
        },
      });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async update(id: string, data: UpdateMediaRequestInput): Promise<MediaRequest> {
    try {
      const exists = await this.prisma.mediaRequest.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundError('Media request');
      }

      return await this.prisma.mediaRequest.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              plexUsername: true,
            },
          },
        },
      });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(id: string, status: string): Promise<MediaRequest> {
    const data: UpdateMediaRequestInput = { status };

    if (status === 'completed' || status === 'available') {
      data.completedAt = new Date();
    }

    return this.update(id, data);
  }

  async bulkUpdateStatus(requestIds: string[], status: string): Promise<number> {
    try {
      const data: Prisma.MediaRequestUpdateManyMutationInput = { status };

      if (status === 'completed' || status === 'available') {
        data.completedAt = new Date();
      }

      const result = await this.prisma.mediaRequest.updateMany({
        where: {
          id: { in: requestIds },
        },
        data,
      });

      return result.count;
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async delete(id: string): Promise<MediaRequest> {
    try {
      return await this.prisma.mediaRequest.delete({
        where: { id },
      });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async countByStatus(status?: string): Promise<number> {
    return this.prisma.mediaRequest.count({
      where: status ? { status } : undefined,
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.mediaRequest.count({
      where: { userId },
    });
  }

  async getUserRequestStats(userId: string): Promise<Record<string, number>> {
    const requests = await this.prisma.mediaRequest.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    return requests.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async getRecentRequests(limit: number = 10, offset: number = 0): Promise<MediaRequest[]> {
    return this.prisma.mediaRequest.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plexUsername: true,
          },
        },
      },
    });
  }

  async findByTmdbId(tmdbId: number | string, mediaType: string): Promise<MediaRequest | null> {
    return this.prisma.mediaRequest.findFirst({
      where: {
        tmdbId: String(tmdbId),
        mediaType,
      },
    });
  }

  async findByOverseerrId(overseerrId: string): Promise<MediaRequest | null> {
    return this.prisma.mediaRequest.findFirst({
      where: { overseerrId },
    });
  }

  async getCountsByStatus(userId: string): Promise<Record<string, number> & { total: number }> {
    const counts = await this.getUserRequestStats(userId);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      ...counts,
      total,
      pending: counts.pending || 0,
      approved: counts.approved || 0,
      available: counts.available || 0,
      failed: counts.failed || 0,
    };
  }

  async count(filters: MediaRequestFilters = {}): Promise<number> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.mediaType) where.mediaType = filters.mediaType;

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    try {
      return await this.prisma.mediaRequest.count({ where });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }

  async findMany(
    filters: MediaRequestFilters = {},
    options: { skip?: number; take?: number; orderBy?: any } = {},
  ): Promise<MediaRequest[]> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.mediaType) where.mediaType = filters.mediaType;

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    try {
      return await this.prisma.mediaRequest.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: options.orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              plexUsername: true,
            },
          },
        },
      });
    } catch (error: any) {
      this.handleDatabaseError(error);
    }
  }
}
