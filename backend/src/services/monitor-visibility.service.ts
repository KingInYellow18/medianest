import { MonitorVisibility } from '@prisma/client';

import { MonitorStatus } from '@/integrations/uptime-kuma/uptime-kuma.client';
import { monitorVisibilityRepository } from '@/repositories/monitor-visibility.repository';
import { statusService } from '@/services/status.service';
import { logger } from '@/utils/logger';

export interface MonitorWithVisibility extends MonitorStatus {
  visibility?: {
    isPublic: boolean;
    updatedAt?: Date;
    updatedBy?: string;
  };
}

export interface MonitorVisibilityUpdate {
  monitorId: number;
  isPublic: boolean;
}

export interface MonitorVisibilityBulkUpdate {
  monitorIds: number[];
  isPublic: boolean;
}

export class MonitorVisibilityService {
  // Get all monitors with visibility settings
  async getAllMonitorsWithVisibility(userId?: string): Promise<MonitorWithVisibility[]> {
    try {
      // Get all monitors from Uptime Kuma
      const monitors = statusService.getUptimeKumaMonitors();

      // Sync monitors with database
      if (monitors.length > 0) {
        await monitorVisibilityRepository.syncMonitors(
          monitors.map((m) => ({ id: m.monitorID, name: m.name })),
          userId,
        );
      }

      // Get visibility settings
      const visibilityMap = await monitorVisibilityRepository.getVisibilityMap();

      // Combine monitor data with visibility
      return monitors.map((monitor) => ({
        ...monitor,
        visibility: {
          isPublic: visibilityMap.get(monitor.monitorID) ?? false,
        },
      }));
    } catch (error) {
      logger.error('Failed to get monitors with visibility', { error });
      throw error;
    }
  }

  // Get monitors filtered by user role
  async getFilteredMonitors(isAdmin: boolean): Promise<MonitorStatus[]> {
    try {
      // Admins see all monitors
      if (isAdmin) {
        return statusService.getUptimeKumaMonitors();
      }

      // Regular users only see public monitors
      const monitors = statusService.getUptimeKumaMonitors();
      const visibilityMap = await monitorVisibilityRepository.getVisibilityMap();

      return monitors.filter((monitor) => visibilityMap.get(monitor.monitorID) === true);
    } catch (error) {
      logger.error('Failed to get filtered monitors', { error });
      return [];
    }
  }

  // Update single monitor visibility
  async updateMonitorVisibility(
    monitorId: number,
    isPublic: boolean,
    userId: string,
  ): Promise<MonitorVisibility> {
    try {
      // Get monitor info from Uptime Kuma
      const monitor = statusService.getUptimeKumaMonitor(monitorId);
      if (!monitor) {
        throw new Error(`Monitor ${monitorId} not found`);
      }

      // Upsert visibility record
      const visibility = await monitorVisibilityRepository.upsert({
        monitorId,
        monitorName: monitor.name,
        isPublic,
        updatedBy: userId,
      });

      logger.info('Monitor visibility updated', {
        monitorId,
        monitorName: monitor.name,
        isPublic,
        userId,
      });

      // Emit visibility change event
      statusService.emitVisibilityChange(monitorId, isPublic);

      return visibility;
    } catch (error) {
      logger.error('Failed to update monitor visibility', { error, monitorId });
      throw error;
    }
  }

  // Update multiple monitors visibility
  async updateBulkMonitorVisibility(
    data: MonitorVisibilityBulkUpdate,
    userId: string,
  ): Promise<number> {
    try {
      const { monitorIds, isPublic } = data;

      // Validate monitors exist
      const monitors = statusService.getUptimeKumaMonitors();
      const validMonitorIds = new Set(monitors.map((m) => m.monitorID));
      const validIds = monitorIds.filter((id) => validMonitorIds.has(id));

      if (validIds.length === 0) {
        throw new Error('No valid monitor IDs provided');
      }

      // Ensure visibility records exist for all monitors
      const toCreate = [];
      const existing = await monitorVisibilityRepository.findByMonitorIds(validIds);
      const existingIds = new Set(existing.map((v) => v.monitorId));

      for (const id of validIds) {
        if (!existingIds.has(id)) {
          const monitor = monitors.find((m) => m.monitorID === id);
          if (monitor) {
            toCreate.push({
              monitorId: id,
              monitorName: monitor.name,
              isPublic,
              updatedBy: userId,
            });
          }
        }
      }

      if (toCreate.length > 0) {
        await monitorVisibilityRepository.createMany(toCreate);
      }

      // Update visibility for existing records
      const result = await monitorVisibilityRepository.updateMany({
        monitorIds: validIds,
        isPublic,
        updatedBy: userId,
      });

      logger.info('Bulk monitor visibility updated', {
        count: result.count,
        isPublic,
        userId,
      });

      // Emit visibility change events
      validIds.forEach((monitorId) => {
        statusService.emitVisibilityChange(monitorId, isPublic);
      });

      return result.count + toCreate.length;
    } catch (error) {
      logger.error('Failed to update bulk monitor visibility', { error });
      throw error;
    }
  }

  // Get visibility settings for specific monitors
  async getMonitorVisibility(monitorIds: number[]): Promise<Map<number, boolean>> {
    const visibilities = await monitorVisibilityRepository.findByMonitorIds(monitorIds);
    const map = new Map<number, boolean>();

    visibilities.forEach((v) => {
      map.set(v.monitorId, v.isPublic);
    });

    // Default to false (admin-only) for monitors without visibility records
    monitorIds.forEach((id) => {
      if (!map.has(id)) {
        map.set(id, false);
      }
    });

    return map;
  }

  // Check if a specific monitor is visible to users
  async isMonitorPublic(monitorId: number): Promise<boolean> {
    const visibility = await monitorVisibilityRepository.findByMonitorId(monitorId);
    return visibility?.isPublic ?? false;
  }

  // Get statistics about monitor visibility
  async getVisibilityStats(): Promise<{
    total: number;
    public: number;
    adminOnly: number;
  }> {
    const all = await monitorVisibilityRepository.findAll();
    const publicMonitors = all.filter((v) => v.isPublic);

    return {
      total: all.length,
      public: publicMonitors.length,
      adminOnly: all.length - publicMonitors.length,
    };
  }

  // Reset all monitors to admin-only (safety operation)
  async resetAllToAdminOnly(userId: string): Promise<number> {
    const monitors = statusService.getUptimeKumaMonitors();
    const monitorIds = monitors.map((m) => m.monitorID);

    const result = await monitorVisibilityRepository.updateMany({
      monitorIds,
      isPublic: false,
      updatedBy: userId,
    });

    logger.warn('All monitors reset to admin-only', {
      count: result.count,
      userId,
    });

    // Emit visibility change events
    monitorIds.forEach((monitorId) => {
      statusService.emitVisibilityChange(monitorId, false);
    });

    return result.count;
  }
}

export const monitorVisibilityService = new MonitorVisibilityService();
