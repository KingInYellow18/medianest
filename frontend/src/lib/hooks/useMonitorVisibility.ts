import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'react-hot-toast';

interface MonitorWithVisibility {
  monitorID: number;
  name: string;
  url?: string;
  type: string;
  active: boolean;
  status: boolean;
  ping?: number;
  uptime24h?: number;
  uptime30d?: number;
  visibility?: {
    isPublic: boolean;
    updatedAt?: Date;
    updatedBy?: string;
  };
}

interface MonitorVisibilityStats {
  total: number;
  public: number;
  adminOnly: number;
}

interface UseMonitorVisibilityReturn {
  monitors: MonitorWithVisibility[];
  stats: MonitorVisibilityStats;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateVisibility: (monitorId: number, isPublic: boolean) => Promise<void>;
  bulkUpdateVisibility: (monitorIds: number[], isPublic: boolean) => Promise<void>;
  resetAllToAdminOnly: () => Promise<void>;
}

export function useMonitorVisibility(): UseMonitorVisibilityReturn {
  const [monitors, setMonitors] = useState<MonitorWithVisibility[]>([]);
  const [stats, setStats] = useState<MonitorVisibilityStats>({
    total: 0,
    public: 0,
    adminOnly: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMonitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getMonitorsWithVisibility();
      setMonitors(data.monitors);
      setStats(data.stats);
    } catch (err) {
      setError(err as Error);
      toast.error('Failed to fetch monitors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  const updateVisibility = useCallback(
    async (monitorId: number, isPublic: boolean) => {
      try {
        await adminApi.updateMonitorVisibility(monitorId, isPublic);
        
        // Update local state optimistically
        setMonitors((prev) =>
          prev.map((monitor) =>
            monitor.monitorID === monitorId
              ? {
                  ...monitor,
                  visibility: {
                    ...monitor.visibility,
                    isPublic,
                    updatedAt: new Date(),
                  },
                }
              : monitor
          )
        );

        // Update stats
        setStats((prev) => {
          const delta = isPublic ? 1 : -1;
          return {
            ...prev,
            public: Math.max(0, prev.public + delta),
            adminOnly: Math.max(0, prev.adminOnly - delta),
          };
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  const bulkUpdateVisibility = useCallback(
    async (monitorIds: number[], isPublic: boolean) => {
      try {
        await adminApi.bulkUpdateMonitorVisibility(monitorIds, isPublic);
        
        // Update local state optimistically
        setMonitors((prev) =>
          prev.map((monitor) =>
            monitorIds.includes(monitor.monitorID)
              ? {
                  ...monitor,
                  visibility: {
                    ...monitor.visibility,
                    isPublic,
                    updatedAt: new Date(),
                  },
                }
              : monitor
          )
        );

        // Recalculate stats
        await fetchMonitors();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [fetchMonitors]
  );

  const resetAllToAdminOnly = useCallback(async () => {
    try {
      await adminApi.resetAllMonitorVisibility();
      
      // Update local state
      setMonitors((prev) =>
        prev.map((monitor) => ({
          ...monitor,
          visibility: {
            ...monitor.visibility,
            isPublic: false,
            updatedAt: new Date(),
          },
        }))
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        public: 0,
        adminOnly: prev.total,
      }));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    monitors,
    stats,
    loading,
    error,
    refetch: fetchMonitors,
    updateVisibility,
    bulkUpdateVisibility,
    resetAllToAdminOnly,
  };
}