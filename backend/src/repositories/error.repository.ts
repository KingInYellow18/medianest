import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

export interface CreateErrorData {
  correlationId: string;
  userId: string;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  requestPath: string;
  requestMethod: string;
  statusCode?: number;
  metadata?: any;
}

class ErrorRepository {
  async create(data: CreateErrorData) {
    return prisma.errorLog.create({
      data: {
        correlationId: data.correlationId,
        userId: data.userId,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        stackTrace: data.stackTrace,
        requestPath: data.requestPath,
        requestMethod: data.requestMethod,
        statusCode: data.statusCode,
        metadata: data.metadata as Prisma.JsonValue,
      },
    });
  }

  async findRecent(userId?: string, limit: number = 10) {
    const where = userId ? { userId } : {};
    
    return prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        correlationId: true,
        errorCode: true,
        errorMessage: true,
        requestPath: true,
        statusCode: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async findByCorrelationId(correlationId: string) {
    return prisma.errorLog.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteOldLogs(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return prisma.errorLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
  }
}

export const errorRepository = new ErrorRepository();