import { ServiceConfig, Prisma } from '@prisma/client';

import { NotFoundError } from '../utils/errors';

import { BaseRepository } from './base.repository';

export interface CreateServiceConfigInput {
  serviceName: string;
  serviceUrl: string;
  apiKey?: string;
  enabled?: boolean;
  configData?: Record<string, unknown>;
}

export interface UpdateServiceConfigInput {
  serviceUrl?: string;
  apiKey?: string;
  enabled?: boolean;
  configData?: Record<string, unknown>;
  updatedBy?: string;
}

export class ServiceConfigRepository extends BaseRepository<
  ServiceConfig,
  CreateServiceConfigInput,
  UpdateServiceConfigInput
> {
  async findByName(serviceName: string): Promise<ServiceConfig | null> {
    try {
      return await this.prisma.serviceConfig.findUnique({
        where: { serviceName },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(): Promise<ServiceConfig[]> {
    try {
      return await this.prisma.serviceConfig.findMany({
        orderBy: { serviceName: 'asc' },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findEnabled(): Promise<ServiceConfig[]> {
    try {
      return await this.prisma.serviceConfig.findMany({
        where: { enabled: true },
        orderBy: { serviceName: 'asc' },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async create(data: CreateServiceConfigInput): Promise<ServiceConfig> {
    try {
      return await this.prisma.serviceConfig.create({
        data,
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async update(serviceName: string, data: UpdateServiceConfigInput): Promise<ServiceConfig> {
    try {
      const exists = await this.prisma.serviceConfig.findUnique({
        where: { serviceName },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundError('Service configuration');
      }

      return await this.prisma.serviceConfig.update({
        where: { serviceName },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async upsert(serviceName: string, data: UpdateServiceConfigInput): Promise<ServiceConfig> {
    try {
      return await this.prisma.serviceConfig.upsert({
        where: { serviceName },
        update: {
          ...data,
          updatedAt: new Date(),
        },
        create: {
          serviceName,
          serviceUrl: data.serviceUrl || '',
          ...data,
        },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async toggle(serviceName: string, enabled: boolean, updatedBy?: string): Promise<ServiceConfig> {
    return this.update(serviceName, { enabled, updatedBy });
  }

  async delete(serviceName: string): Promise<ServiceConfig> {
    try {
      return await this.prisma.serviceConfig.delete({
        where: { serviceName },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async getConfig(serviceName: string): Promise<{
    url: string;
    apiKey?: string;
    enabled: boolean;
    configData?: Record<string, unknown>;
  } | null> {
    const config = await this.findByName(serviceName);

    if (!config) return null;

    return {
      url: config.serviceUrl,
      apiKey: config.apiKey || undefined,
      enabled: config.enabled,
      configData: config.configData,
    };
  }

  async isEnabled(serviceName: string): Promise<boolean> {
    const config = await this.findByName(serviceName);
    return config?.enabled || false;
  }
}
