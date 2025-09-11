// @ts-nocheck
import {
  NotFoundError, // @ts-ignore
} from '@medianest/shared';
import { ServiceStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// @ts-ignore

import { CatchError } from '../types/common';

import { BaseRepository } from './base.repository';

export interface ServiceStatusUpdate {
  status?: string;
  responseTimeMs?: number;
  lastCheckAt?: Date;
  uptimePercentage?: number;
}

export class ServiceStatusRepository extends BaseRepository<ServiceStatus> {
  constructor(prisma: any) {
    super(prisma);
  }
  async findByName(serviceName: string): Promise<ServiceStatus | null> {
    try {
      return await this.prisma.serviceStatus.findUnique({
        where: { serviceName },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(): Promise<ServiceStatus[]> {
    try {
      return await this.prisma.serviceStatus.findMany({
        orderBy: { serviceName: 'asc' },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async upsert(serviceName: string, data: ServiceStatusUpdate): Promise<ServiceStatus> {
    try {
      const updateData: Prisma.ServiceStatusUpdateInput = {
        ...data,
        lastCheckAt: data.lastCheckAt || new Date(),
      };

      if (data.uptimePercentage !== undefined) {
        updateData.uptimePercentage = new Decimal(data.uptimePercentage);
      }

      return await this.prisma.serviceStatus.upsert({
        where: { serviceName },
        update: updateData,
        create: {
          serviceName,
          ...updateData,
        },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(
    serviceName: string,
    status: string,
    responseTimeMs?: number,
  ): Promise<ServiceStatus> {
    return this.upsert(serviceName, {
      status,
      responseTimeMs,
      lastCheckAt: new Date(),
    });
  }

  async updateUptimePercentage(serviceName: string, percentage: number): Promise<ServiceStatus> {
    return this.upsert(serviceName, {
      uptimePercentage: percentage,
    });
  }

  async getHealthyServices(): Promise<ServiceStatus[]> {
    try {
      return await this.prisma.serviceStatus.findMany({
        where: {
          status: 'healthy',
        },
        orderBy: { serviceName: 'asc' },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async getUnhealthyServices(): Promise<ServiceStatus[]> {
    try {
      return await this.prisma.serviceStatus.findMany({
        where: {
          OR: [{ status: { not: 'healthy' } }, { status: null }],
        },
        orderBy: { serviceName: 'asc' },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async getServicesStalerThan(minutes: number): Promise<ServiceStatus[]> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - minutes);

    try {
      return await this.prisma.serviceStatus.findMany({
        where: {
          OR: [{ lastCheckAt: { lt: threshold } }, { lastCheckAt: null }],
        },
        orderBy: { serviceName: 'asc' },
      });
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }

  async clearStatus(serviceName: string): Promise<ServiceStatus> {
    return this.upsert(serviceName, {
      status: null,
      responseTimeMs: null,
      lastCheckAt: new Date(),
    });
  }

  async getAverageResponseTime(serviceName: string): Promise<number | null> {
    try {
      const result = await this.prisma.serviceStatus.aggregate({
        where: { serviceName },
        _avg: {
          responseTimeMs: true,
        },
      });

      return result._avg.responseTimeMs;
    } catch (error: CatchError) {
      this.handleDatabaseError(error);
    }
  }
}
