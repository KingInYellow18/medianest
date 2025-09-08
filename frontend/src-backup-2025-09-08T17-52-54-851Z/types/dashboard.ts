// Re-export types from shared package
export type { ServiceStatus, ServiceStatusUpdate } from '@medianest/shared';

export interface QuickAction {
  type: 'navigate' | 'refresh' | 'configure';
  serviceId: string;
  url?: string;
}
