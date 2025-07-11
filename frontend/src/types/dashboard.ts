export interface ServiceStatus {
  id: string;
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptimePercentage: number;
  url?: string;
  features?: string[];
}

export interface ServiceStatusUpdate {
  serviceId: string;
  update: Partial<ServiceStatus>;
}