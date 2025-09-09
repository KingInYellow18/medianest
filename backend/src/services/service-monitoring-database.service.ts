/**
 * Production Service Monitoring Database Service
 * Replaces mock service history and monitoring data
 */
import { executeQuery, executeTransaction } from '../config/database-connection-pool';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

export interface ServiceMetric {
  id: string;
  serviceName: string;
  status: 'up' | 'down' | 'degraded' | 'maintenance';
  responseTimeMs?: number;
  uptimePercentage: number;
  timestamp: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
  incidentId?: string;
}

export interface ServiceIncident {
  id: string;
  serviceName: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  startedAt: Date;
  resolvedAt?: Date;
  affectedUsers?: number;
  metadata?: Record<string, any>;
}

export interface ServiceHistoryQuery {
  serviceName: string;
  fromDate: Date;
  toDate: Date;
  interval?: 'minute' | 'hour' | 'day';
  includeDowntime?: boolean;
}

export interface ServiceSummary {
  serviceName: string;
  displayName: string;
  currentStatus: 'up' | 'down' | 'degraded' | 'maintenance';
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  averageResponseTime: number;
  totalIncidents: number;
  activeIncidents: number;
  lastCheck: Date;
}

class ServiceMonitoringDatabaseService {
  /**
   * Record service metric
   */
  async recordMetric(metric: Omit<ServiceMetric, 'id' | 'timestamp'>): Promise<ServiceMetric> {
    return executeQuery(async (client) => {
      const record = await client.serviceMetric.create({
        data: {
          id: this.generateId('metric'),
          serviceName: metric.serviceName,
          status: metric.status,
          responseTimeMs: metric.responseTimeMs,
          uptimePercentage: metric.uptimePercentage,
          errorMessage: metric.errorMessage,
          metadata: metric.metadata ? JSON.stringify(metric.metadata) : null,
          incidentId: metric.incidentId,
          timestamp: new Date(),
        },
      });

      return this.mapServiceMetric(record);
    }, 'recordMetric');
  }

  /**
   * Get service history with aggregation
   */
  async getServiceHistory(query: ServiceHistoryQuery): Promise<ServiceMetric[]> {
    return executeQuery(async (client) => {
      const { serviceName, fromDate, toDate, interval = 'hour', includeDowntime = true } = query;

      // Build where clause
      const where: any = {
        serviceName,
        timestamp: {
          gte: fromDate,
          lte: toDate,
        },
      };

      if (!includeDowntime) {
        where.status = { not: 'down' };
      }

      // Get raw metrics
      const metrics = await client.serviceMetric.findMany({
        where,
        orderBy: { timestamp: 'asc' },
      });

      // Aggregate by interval if needed
      if (interval !== 'minute') {
        return this.aggregateMetrics(metrics, interval);
      }

      return metrics.map(this.mapServiceMetric);
    }, 'getServiceHistory');
  }

  /**
   * Get current service summary
   */
  async getServiceSummary(serviceName: string): Promise<ServiceSummary | null> {
    return executeQuery(async (client) => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        latestMetric,
        metrics24h,
        metrics7d,
        metrics30d,
        activeIncidents,
        totalIncidents,
      ] = await Promise.all([
        // Latest metric
        client.serviceMetric.findFirst({
          where: { serviceName },
          orderBy: { timestamp: 'desc' },
        }),
        // 24h metrics
        client.serviceMetric.findMany({
          where: {
            serviceName,
            timestamp: { gte: oneDayAgo },
          },
          orderBy: { timestamp: 'asc' },
        }),
        // 7d metrics
        client.serviceMetric.findMany({
          where: {
            serviceName,
            timestamp: { gte: sevenDaysAgo },
          },
          orderBy: { timestamp: 'asc' },
        }),
        // 30d metrics
        client.serviceMetric.findMany({
          where: {
            serviceName,
            timestamp: { gte: thirtyDaysAgo },
          },
          orderBy: { timestamp: 'asc' },
        }),
        // Active incidents
        client.serviceIncident.count({
          where: {
            serviceName,
            status: { not: 'resolved' },
          },
        }),
        // Total incidents (30d)
        client.serviceIncident.count({
          where: {
            serviceName,
            startedAt: { gte: thirtyDaysAgo },
          },
        }),
      ]);

      if (!latestMetric) {
        return null;
      }

      // Calculate uptime percentages
      const uptime24h = this.calculateUptime(metrics24h);
      const uptime7d = this.calculateUptime(metrics7d);
      const uptime30d = this.calculateUptime(metrics30d);

      // Calculate average response time (24h)
      const responseTimeMetrics = metrics24h.filter(m => m.responseTimeMs !== null);
      const averageResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + (m.responseTimeMs || 0), 0) / responseTimeMetrics.length
        : 0;

      return {
        serviceName,
        displayName: this.getServiceDisplayName(serviceName),
        currentStatus: latestMetric.status as any,
        uptime24h,
        uptime7d,
        uptime30d,
        averageResponseTime: Math.round(averageResponseTime),
        totalIncidents,
        activeIncidents,
        lastCheck: latestMetric.timestamp,
      };
    }, 'getServiceSummary');
  }

  /**
   * Create service incident
   */
  async createIncident(incident: Omit<ServiceIncident, 'id' | 'startedAt'>): Promise<ServiceIncident> {
    return executeQuery(async (client) => {
      const record = await client.serviceIncident.create({
        data: {
          id: this.generateId('incident'),
          serviceName: incident.serviceName,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          status: incident.status,
          affectedUsers: incident.affectedUsers,
          metadata: incident.metadata ? JSON.stringify(incident.metadata) : null,
          startedAt: new Date(),
        },
      });

      return this.mapServiceIncident(record);
    }, 'createIncident');
  }

  /**
   * Update incident status
   */
  async updateIncident(
    incidentId: string,
    updates: Partial<Pick<ServiceIncident, 'status' | 'description' | 'resolvedAt'>>
  ): Promise<ServiceIncident | null> {
    return executeQuery(async (client) => {
      const updateData: any = { ...updates };

      if (updates.status === 'resolved' && !updates.resolvedAt) {
        updateData.resolvedAt = new Date();
      }

      const record = await client.serviceIncident.update({
        where: { id: incidentId },
        data: updateData,
      });

      return this.mapServiceIncident(record);
    }, 'updateIncident');
  }

  /**
   * Get active incidents
   */
  async getActiveIncidents(serviceName?: string): Promise<ServiceIncident[]> {
    return executeQuery(async (client) => {
      const where: any = {
        status: { not: 'resolved' },
      };

      if (serviceName) {
        where.serviceName = serviceName;
      }

      const incidents = await client.serviceIncident.findMany({
        where,
        orderBy: [
          { severity: 'desc' }, // Critical first
          { startedAt: 'desc' },
        ],
      });

      return incidents.map(this.mapServiceIncident);
    }, 'getActiveIncidents');
  }

  /**
   * Get all service summaries
   */
  async getAllServiceSummaries(): Promise<ServiceSummary[]> {
    return executeQuery(async (client) => {
      // Get distinct service names
      const services = await client.serviceMetric.findMany({
        distinct: ['serviceName'],
        select: { serviceName: true },
      });

      const summaries = await Promise.all(
        services.map(service => this.getServiceSummary(service.serviceName))
      );

      return summaries.filter(Boolean) as ServiceSummary[];
    }, 'getAllServiceSummaries');
  }

  /**
   * Get downtime events for a service
   */
  async getDowntimeEvents(
    serviceName: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{ startTime: Date; endTime?: Date; duration?: number }>> {
    return executeQuery(async (client) => {
      const downMetrics = await client.serviceMetric.findMany({
        where: {
          serviceName,
          status: 'down',
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group consecutive down events
      const downtimeEvents = [];
      let currentDowntime: { startTime: Date; endTime?: Date; duration?: number } | null = null;

      for (const metric of downMetrics) {
        if (!currentDowntime) {
          currentDowntime = { startTime: metric.timestamp };
        } else {
          // If gap is more than 10 minutes, consider it a separate downtime
          const gap = metric.timestamp.getTime() - currentDowntime.startTime.getTime();
          if (gap > 10 * 60 * 1000) {
            downtimeEvents.push(currentDowntime);
            currentDowntime = { startTime: metric.timestamp };
          }
        }
      }

      if (currentDowntime) {
        // Try to find when service came back up
        const upMetric = await client.serviceMetric.findFirst({
          where: {
            serviceName,
            status: { not: 'down' },
            timestamp: { gt: currentDowntime.startTime },
          },
          orderBy: { timestamp: 'asc' },
        });

        if (upMetric) {
          currentDowntime.endTime = upMetric.timestamp;
          currentDowntime.duration = upMetric.timestamp.getTime() - currentDowntime.startTime.getTime();
        }

        downtimeEvents.push(currentDowntime);
      }

      return downtimeEvents;
    }, 'getDowntimeEvents');
  }

  /**
   * Clean up old metrics to prevent database growth
   */
  async cleanupOldMetrics(olderThanDays: number = 90): Promise<number> {
    return executeQuery(async (client) => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await client.serviceMetric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up old service metrics', {
          deletedCount: result.count,
          olderThanDays,
        });
      }

      return result.count;
    }, 'cleanupOldMetrics');
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Map database record to ServiceMetric
   */
  private mapServiceMetric(dbRecord: any): ServiceMetric {
    return {
      id: dbRecord.id,
      serviceName: dbRecord.serviceName,
      status: dbRecord.status,
      responseTimeMs: dbRecord.responseTimeMs,
      uptimePercentage: parseFloat(dbRecord.uptimePercentage || '0'),
      timestamp: dbRecord.timestamp,
      errorMessage: dbRecord.errorMessage,
      metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) : undefined,
      incidentId: dbRecord.incidentId,
    };
  }

  /**
   * Map database record to ServiceIncident
   */
  private mapServiceIncident(dbRecord: any): ServiceIncident {
    return {
      id: dbRecord.id,
      serviceName: dbRecord.serviceName,
      title: dbRecord.title,
      description: dbRecord.description,
      severity: dbRecord.severity,
      status: dbRecord.status,
      startedAt: dbRecord.startedAt,
      resolvedAt: dbRecord.resolvedAt,
      affectedUsers: dbRecord.affectedUsers,
      metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) : undefined,
    };
  }

  /**
   * Calculate uptime percentage from metrics
   */
  private calculateUptime(metrics: any[]): number {
    if (metrics.length === 0) return 100;

    const upMetrics = metrics.filter(m => m.status === 'up' || m.status === 'degraded');
    return Math.round((upMetrics.length / metrics.length) * 100 * 100) / 100;
  }

  /**
   * Aggregate metrics by time interval
   */
  private aggregateMetrics(metrics: any[], interval: 'hour' | 'day'): ServiceMetric[] {
    const grouped = new Map<string, any[]>();
    const intervalMs = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    metrics.forEach(metric => {
      const intervalKey = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
      const key = intervalKey.toString();
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    return Array.from(grouped.entries()).map(([intervalKey, intervalMetrics]) => {
      const timestamp = new Date(parseInt(intervalKey));
      const upMetrics = intervalMetrics.filter(m => m.status === 'up');
      const responseTimeMetrics = intervalMetrics.filter(m => m.responseTimeMs !== null);
      
      const averageResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / responseTimeMetrics.length
        : undefined;

      const uptime = (upMetrics.length / intervalMetrics.length) * 100;
      const mostCommonStatus = this.getMostCommonStatus(intervalMetrics);

      return {
        id: `agg_${intervalKey}`,
        serviceName: intervalMetrics[0].serviceName,
        status: mostCommonStatus,
        responseTimeMs: averageResponseTime,
        uptimePercentage: uptime,
        timestamp,
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get most common status from metrics
   */
  private getMostCommonStatus(metrics: any[]): 'up' | 'down' | 'degraded' | 'maintenance' {
    const statusCounts = metrics.reduce((counts, metric) => {
      counts[metric.status] = (counts[metric.status] || 0) + 1;
      return counts;
    }, {});

    return Object.entries(statusCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0][0] as any;
  }

  /**
   * Get display name for service
   */
  private getServiceDisplayName(serviceName: string): string {
    const displayNames: Record<string, string> = {
      'plex': 'Plex Media Server',
      'overseerr': 'Overseerr',
      'medianest': 'MediaNest',
      'uptime-kuma': 'Uptime Kuma',
      'redis': 'Redis Cache',
      'database': 'PostgreSQL Database',
    };

    return displayNames[serviceName] || serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
  }
}

export const serviceMonitoringService = new ServiceMonitoringDatabaseService();

// Setup cleanup job for production
if (process.env.NODE_ENV === 'production') {
  // Clean up old metrics daily at 3 AM
  const scheduleCleanup = () => {
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(3, 0, 0, 0);
    
    if (nextCleanup <= now) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }
    
    const msUntilCleanup = nextCleanup.getTime() - now.getTime();
    
    setTimeout(() => {
      serviceMonitoringService.cleanupOldMetrics(90).catch((error) => {
        logger.error('Failed to cleanup old service metrics', { error });
      });
      
      // Schedule next cleanup
      setInterval(() => {
        serviceMonitoringService.cleanupOldMetrics(90).catch((error) => {
          logger.error('Failed to cleanup old service metrics', { error });
        });
      }, 24 * 60 * 60 * 1000); // Daily
    }, msUntilCleanup);
  };
  
  scheduleCleanup();
}
