import { ServiceConfig, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { NotFoundError } from '../utils/errors';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

export interface CreateServiceConfigInput {
  serviceName: string;
  serviceUrl: string;
  apiKey?: string;
  enabled?: boolean;
  configData?: any;
}

export interface UpdateServiceConfigInput {
  serviceUrl?: string;
  apiKey?: string;
  enabled?: boolean;
  configData?: any;
  updatedBy?: string;
}

export class ServiceConfigRepository extends BaseRepository<ServiceConfig, CreateServiceConfigInput, UpdateServiceConfigInput> {
  private decryptServiceData(config: ServiceConfig): ServiceConfig {
    try {
      const decryptedConfig = { ...config };
      
      // Decrypt API key if it exists
      if (config.apiKey) {
        try {
          decryptedConfig.apiKey = encryptionService.decryptFromStorage(config.apiKey);
        } catch (error) {
          logger.error('Failed to decrypt API key', { serviceName: config.serviceName, error });
          // Return null API key if decryption fails
          decryptedConfig.apiKey = null;
        }
      }
      
      return decryptedConfig;
    } catch (error) {
      logger.error('Failed to decrypt service config data', { serviceName: config.serviceName, error });
      return config;
    }
  }
  async findByName(serviceName: string): Promise<ServiceConfig | null> {
    try {
      const config = await this.prisma.serviceConfig.findUnique({
        where: { serviceName },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      return config ? this.decryptServiceData(config) : null;
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(): Promise<ServiceConfig[]> {
    try {
      const configs = await this.prisma.serviceConfig.findMany({
        orderBy: { serviceName: 'asc' },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      return configs.map(config => this.decryptServiceData(config));
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findEnabled(): Promise<ServiceConfig[]> {
    try {
      const configs = await this.prisma.serviceConfig.findMany({
        where: { enabled: true },
        orderBy: { serviceName: 'asc' }
      });
      return configs.map(config => this.decryptServiceData(config));
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async create(data: CreateServiceConfigInput): Promise<ServiceConfig> {
    try {
      const encryptedData = { ...data };
      
      // Encrypt API key if provided
      if (data.apiKey) {
        encryptedData.apiKey = encryptionService.encryptForStorage(data.apiKey);
      }
      
      const config = await this.prisma.serviceConfig.create({
        data: encryptedData,
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      return this.decryptServiceData(config);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async update(serviceName: string, data: UpdateServiceConfigInput): Promise<ServiceConfig> {
    try {
      const exists = await this.prisma.serviceConfig.findUnique({
        where: { serviceName },
        select: { id: true }
      });

      if (!exists) {
        throw new NotFoundError('Service configuration');
      }

      const encryptedData = { ...data };
      
      // Encrypt API key if provided
      if (data.apiKey) {
        encryptedData.apiKey = encryptionService.encryptForStorage(data.apiKey);
      }

      const config = await this.prisma.serviceConfig.update({
        where: { serviceName },
        data: {
          ...encryptedData,
          updatedAt: new Date()
        },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      return this.decryptServiceData(config);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async upsert(serviceName: string, data: UpdateServiceConfigInput): Promise<ServiceConfig> {
    try {
      const encryptedData = { ...data };
      
      // Encrypt API key if provided
      if (data.apiKey) {
        encryptedData.apiKey = encryptionService.encryptForStorage(data.apiKey);
      }
      
      const config = await this.prisma.serviceConfig.upsert({
        where: { serviceName },
        update: {
          ...encryptedData,
          updatedAt: new Date()
        },
        create: {
          serviceName,
          serviceUrl: data.serviceUrl || '',
          ...encryptedData
        },
        include: {
          updatedByUser: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      return this.decryptServiceData(config);
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
        where: { serviceName }
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async getConfig(serviceName: string): Promise<{
    url: string;
    apiKey?: string;
    enabled: boolean;
    configData?: any;
  } | null> {
    const config = await this.findByName(serviceName);
    
    if (!config) return null;

    return {
      url: config.serviceUrl,
      apiKey: config.apiKey || undefined,
      enabled: config.enabled,
      configData: config.configData
    };
  }

  async isEnabled(serviceName: string): Promise<boolean> {
    const config = await this.findByName(serviceName);
    return config?.enabled || false;
  }
}