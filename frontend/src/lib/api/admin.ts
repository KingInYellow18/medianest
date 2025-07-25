import { apiClient } from './client';

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

interface MonitorsWithVisibilityResponse {
  monitors: MonitorWithVisibility[];
  stats: MonitorVisibilityStats;
}

interface UpdateVisibilityResponse {
  message: string;
  visibility?: any;
  updatedCount?: number;
  resetCount?: number;
}

export const adminApi = {
  // Monitor Visibility Management
  async getMonitorsWithVisibility(): Promise<MonitorsWithVisibilityResponse> {
    const response = await apiClient.get<MonitorsWithVisibilityResponse>('/v1/admin/monitors');
    return response;
  },

  async updateMonitorVisibility(monitorId: number, isPublic: boolean): Promise<UpdateVisibilityResponse> {
    const response = await apiClient.patch<UpdateVisibilityResponse>(
      `/v1/admin/monitors/${monitorId}/visibility`,
      { isPublic }
    );
    return response;
  },

  async bulkUpdateMonitorVisibility(
    monitorIds: number[],
    isPublic: boolean
  ): Promise<UpdateVisibilityResponse> {
    const response = await apiClient.patch<UpdateVisibilityResponse>(
      '/v1/admin/monitors/bulk-visibility',
      { monitorIds, isPublic }
    );
    return response;
  },

  async resetAllMonitorVisibility(): Promise<UpdateVisibilityResponse> {
    const response = await apiClient.post<UpdateVisibilityResponse>(
      '/v1/admin/monitors/reset-visibility',
      { confirm: true }
    );
    return response;
  },

  async getVisibilityStats(): Promise<MonitorVisibilityStats> {
    const response = await apiClient.get<MonitorVisibilityStats>(
      '/v1/admin/monitors/visibility-stats'
    );
    return response;
  },

  // User Management
  async getUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    return apiClient.get('/v1/admin/users', { params });
  },

  async updateUserRole(userId: string, role: string) {
    return apiClient.patch(`/v1/admin/users/${userId}/role`, { role });
  },

  async deleteUser(userId: string) {
    return apiClient.delete(`/v1/admin/users/${userId}`);
  },

  // Service Management
  async getServices() {
    return apiClient.get('/v1/admin/services');
  },

  // System Statistics
  async getSystemStats() {
    return apiClient.get('/v1/admin/stats');
  },

  // Media Requests
  async getAllRequests(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  }) {
    return apiClient.get('/v1/admin/requests', { params });
  },
};