import { MonitorVisibility, Prisma } from '@prisma/client';

import { prisma } from '@/config/database';

export interface MonitorVisibilityCreateInput {
  monitorId: number;
  monitorName: string;
  isPublic?: boolean;
  updatedBy?: string;
}

export interface MonitorVisibilityUpdateInput {
  isPublic?: boolean;
  updatedBy?: string;
}

export interface MonitorVisibilityBulkUpdateInput {
  monitorIds: number[];
  isPublic: boolean;
  updatedBy?: string;
}

export class MonitorVisibilityRepository {
  async findAll(): Promise<MonitorVisibility[]> {
    return prisma.monitorVisibility.findMany({
      orderBy: {
        monitorName: 'asc',
      },
    });
  }

  async findByMonitorId(monitorId: number): Promise<MonitorVisibility | null> {
    return prisma.monitorVisibility.findUnique({
      where: { monitorId },
    });
  }

  async findByMonitorIds(monitorIds: number[]): Promise<MonitorVisibility[]> {
    return prisma.monitorVisibility.findMany({
      where: {
        monitorId: {
          in: monitorIds,
        },
      },
    });
  }

  async findPublicMonitors(): Promise<MonitorVisibility[]> {
    return prisma.monitorVisibility.findMany({
      where: {
        isPublic: true,
      },
      orderBy: {
        monitorName: 'asc',
      },
    });
  }

  async create(data: MonitorVisibilityCreateInput): Promise<MonitorVisibility> {
    return prisma.monitorVisibility.create({
      data: {
        monitorId: data.monitorId,
        monitorName: data.monitorName,
        isPublic: data.isPublic ?? false,
        updatedBy: data.updatedBy,
      },
    });
  }

  async createMany(data: MonitorVisibilityCreateInput[]): Promise<Prisma.BatchPayload> {
    return prisma.monitorVisibility.createMany({
      data: data.map((item) => ({
        monitorId: item.monitorId,
        monitorName: item.monitorName,
        isPublic: item.isPublic ?? false,
        updatedBy: item.updatedBy,
      })),
      skipDuplicates: true,
    });
  }

  async update(monitorId: number, data: MonitorVisibilityUpdateInput): Promise<MonitorVisibility> {
    return prisma.monitorVisibility.update({
      where: { monitorId },
      data: {
        isPublic: data.isPublic,
        updatedBy: data.updatedBy,
      },
    });
  }

  async updateMany(data: MonitorVisibilityBulkUpdateInput): Promise<Prisma.BatchPayload> {
    return prisma.monitorVisibility.updateMany({
      where: {
        monitorId: {
          in: data.monitorIds,
        },
      },
      data: {
        isPublic: data.isPublic,
        updatedBy: data.updatedBy,
      },
    });
  }

  async upsert(data: MonitorVisibilityCreateInput): Promise<MonitorVisibility> {
    return prisma.monitorVisibility.upsert({
      where: {
        monitorId: data.monitorId,
      },
      update: {
        monitorName: data.monitorName,
        isPublic: data.isPublic ?? false,
        updatedBy: data.updatedBy,
      },
      create: {
        monitorId: data.monitorId,
        monitorName: data.monitorName,
        isPublic: data.isPublic ?? false,
        updatedBy: data.updatedBy,
      },
    });
  }

  async delete(monitorId: number): Promise<MonitorVisibility> {
    return prisma.monitorVisibility.delete({
      where: { monitorId },
    });
  }

  async deleteMany(monitorIds: number[]): Promise<Prisma.BatchPayload> {
    return prisma.monitorVisibility.deleteMany({
      where: {
        monitorId: {
          in: monitorIds,
        },
      },
    });
  }

  // Helper method to get visibility map for efficient lookups
  async getVisibilityMap(): Promise<Map<number, boolean>> {
    const visibilities = await this.findAll();
    const map = new Map<number, boolean>();

    visibilities.forEach((visibility) => {
      map.set(visibility.monitorId, visibility.isPublic);
    });

    return map;
  }

  // Sync monitors from Uptime Kuma
  async syncMonitors(
    monitors: Array<{ id: number; name: string }>,
    updatedBy?: string,
  ): Promise<void> {
    // Get existing visibility records
    const existing = await this.findAll();
    const existingMap = new Map(existing.map((v) => [v.monitorId, v]));

    // Find new monitors
    const newMonitors = monitors.filter((m) => !existingMap.has(m.id));

    // Create visibility records for new monitors (default to admin-only)
    if (newMonitors.length > 0) {
      await this.createMany(
        newMonitors.map((monitor) => ({
          monitorId: monitor.id,
          monitorName: monitor.name,
          isPublic: false, // Default to admin-only
          updatedBy,
        })),
      );
    }

    // Update monitor names if changed
    const updates: Promise<any>[] = [];
    monitors.forEach((monitor) => {
      const existing = existingMap.get(monitor.id);
      if (existing && existing.monitorName !== monitor.name) {
        updates.push(
          prisma.monitorVisibility.update({
            where: { monitorId: monitor.id },
            data: { monitorName: monitor.name },
          }),
        );
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Remove visibility records for monitors that no longer exist
    const currentMonitorIds = new Set(monitors.map((m) => m.id));
    const toDelete = existing
      .filter((v) => !currentMonitorIds.has(v.monitorId))
      .map((v) => v.monitorId);

    if (toDelete.length > 0) {
      await this.deleteMany(toDelete);
    }
  }
}

export const monitorVisibilityRepository = new MonitorVisibilityRepository();
