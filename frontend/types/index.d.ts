// Frontend-specific type declarations
import type { User, MediaRequest, ServiceStatus } from '@medianest/shared';

// Next.js page props
export interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[] | undefined>;
}

// Next-Auth session extension
declare module 'next-auth' {
  interface Session {
    user: User & {
      plexToken?: string;
    };
  }
}

// API response types
export interface DashboardData {
  services: ServiceStatus[];
  recentRequests: MediaRequest[];
  userStats: {
    totalRequests: number;
    pendingRequests: number;
    completedRequests: number;
  };
}