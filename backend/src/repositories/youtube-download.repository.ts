import { NotFoundError } from '@medianest/shared';
import { YoutubeDownload, Prisma } from '@prisma/client';

import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';

export interface CreateYoutubeDownloadInput {
  userId: string;
  playlistUrl: string;
  playlistTitle?: string;
}

export interface UpdateYoutubeDownloadInput {
  status?: string;
  playlistTitle?: string;
  filePaths?: any;
  plexCollectionId?: string;
  completedAt?: Date;
}

export interface YoutubeDownloadFilters {
  userId?: string;
  status?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class YoutubeDownloadRepository extends BaseRepository<
  YoutubeDownload,
  CreateYoutubeDownloadInput,
  UpdateYoutubeDownloadInput
> {
  async findById(id: string): Promise<YoutubeDownload | null> {
    try {
      return await this.prisma.youtubeDownload.findUnique({
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
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findByUser(
    userId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<YoutubeDownload>> {
    return this.paginate<YoutubeDownload>(
      this.prisma.youtubeDownload,
      { userId },
      options,
      undefined,
      {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plexUsername: true,
          },
        },
      },
    );
  }

  async findByFilters(
    filters: YoutubeDownloadFilters,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<YoutubeDownload>> {
    const where: Prisma.YoutubeDownloadWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    return this.paginate<YoutubeDownload>(this.prisma.youtubeDownload, where, options, undefined, {
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

  async create(data: CreateYoutubeDownloadInput): Promise<YoutubeDownload> {
    try {
      return await this.prisma.youtubeDownload.create({
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
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async update(id: string, data: UpdateYoutubeDownloadInput): Promise<YoutubeDownload> {
    try {
      const exists = await this.prisma.youtubeDownload.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundError('YouTube download');
      }

      return await this.prisma.youtubeDownload.update({
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
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(id: string, status: string): Promise<YoutubeDownload> {
    const data: UpdateYoutubeDownloadInput = { status };

    if (status === 'completed') {
      data.completedAt = new Date();
    }

    return this.update(id, data);
  }

  async delete(id: string): Promise<YoutubeDownload> {
    try {
      return await this.prisma.youtubeDownload.delete({
        where: { id },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async countByStatus(status?: string): Promise<number> {
    return this.prisma.youtubeDownload.count({
      where: status ? { status } : undefined,
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.youtubeDownload.count({
      where: { userId },
    });
  }

  async getUserDownloadStats(userId: string): Promise<Record<string, number>> {
    const downloads = await this.prisma.youtubeDownload.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    return downloads.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async getActiveDownloads(): Promise<YoutubeDownload[]> {
    return this.prisma.youtubeDownload.findMany({
      where: {
        status: {
          in: ['queued', 'downloading'],
        },
      },
      orderBy: { createdAt: 'asc' },
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

  async getRecentDownloads(limit: number = 10): Promise<YoutubeDownload[]> {
    return this.prisma.youtubeDownload.findMany({
      take: limit,
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

  async getUserDownloadsInPeriod(userId: string, hours: number): Promise<number> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.prisma.youtubeDownload.count({
      where: {
        userId,
        createdAt: {
          gte: since,
        },
      },
    });
  }
}
