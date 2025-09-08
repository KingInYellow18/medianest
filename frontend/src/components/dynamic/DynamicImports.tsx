/**
 * Dynamic Imports for Bundle Optimization
 *
 * This file contains all dynamic imports to enable code splitting
 * and reduce initial bundle size. Components are loaded only when needed.
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading components for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

const LoadingCard = () => (
  <div className="animate-pulse bg-gray-200 rounded-lg h-64 flex items-center justify-center">
    <div className="text-gray-500">Loading...</div>
  </div>
);

// Plex Components (Heavy - load on demand)
export const DynamicPlexLibraryBrowser = dynamic(
  () => import('@/components/plex/PlexLibraryBrowser').then((mod) => mod.PlexLibraryBrowser),
  {
    loading: LoadingCard,
    ssr: false, // Client-side only for better performance
  }
);

export const DynamicPlexCollectionManager = dynamic(
  () => import('@/components/plex/PlexCollectionManager').then((mod) => mod.PlexCollectionManager),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

export const DynamicPlexSearch = dynamic(
  () => import('@/components/plex/PlexSearch').then((mod) => mod.PlexSearch),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

// YouTube Components (Heavy due to media handling)
export const DynamicYouTubeDownloader = dynamic(
  () => import('@/components/youtube/YouTubeDownloader').then((mod) => mod.YouTubeDownloader),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

export const DynamicDownloadQueue = dynamic(
  () => import('@/components/youtube/DownloadQueue').then((mod) => mod.DownloadQueue),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

// Dashboard Components (Load when dashboard is accessed)
export const DynamicServiceStatus = dynamic(
  () => import('@/components/dashboard/ServiceStatus').then((mod) => mod.ServiceStatus),
  {
    loading: LoadingSpinner,
    ssr: true, // SSR for better SEO
  }
);

export const DynamicQuickActions = dynamic(
  () => import('@/components/dashboard/QuickActions').then((mod) => mod.QuickActions),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

export const DynamicPerformanceMonitor = dynamic(
  () => import('@/components/PerformanceMonitor').then((mod) => mod.PerformanceMonitor),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

// Media Components (Heavy due to image/video handling)
export const DynamicMediaViewer = dynamic(
  () => import('@/components/media/MediaViewer').then((mod) => mod.MediaViewer),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

export const DynamicMediaUploader = dynamic(
  () => import('@/components/media/MediaUploader').then((mod) => mod.MediaUploader),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

// Chart/Analytics Components (Heavy dependencies)
export const DynamicAnalyticsChart = dynamic(
  () => import('@/components/analytics/AnalyticsChart').then((mod) => mod.AnalyticsChart),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

// Form Components (Load when forms are needed)
export const DynamicAdvancedForm = dynamic(
  () => import('@/components/forms/AdvancedForm').then((mod) => mod.AdvancedForm),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

// Toast/Notification System (Load on demand)
export const DynamicToastProvider = dynamic(
  () => import('@/components/ui/ToastProvider').then((mod) => mod.ToastProvider),
  {
    loading: () => null, // No loading state for provider
    ssr: false,
  }
);

// Error Boundaries (Critical - but can be lazy loaded on error pages)
export const DynamicErrorBoundary = dynamic(
  () => import('@/components/ErrorBoundary').then((mod) => mod.ErrorBoundary),
  {
    loading: LoadingSpinner,
    ssr: true,
  }
);

// Modal System (Load when modals are triggered)
export const DynamicModal = dynamic(
  () => import('@/components/ui/Modal').then((mod) => mod.Modal),
  {
    loading: () => null,
    ssr: false,
  }
);

// Settings Components (Admin/Settings pages only)
export const DynamicSettingsPanel = dynamic(
  () => import('@/components/settings/SettingsPanel').then((mod) => mod.SettingsPanel),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

export const DynamicUserManagement = dynamic(
  () => import('@/components/admin/UserManagement').then((mod) => mod.UserManagement),
  {
    loading: LoadingCard,
    ssr: false,
  }
);

// WebSocket Components (Load when real-time features are needed)
export const DynamicRealtimeStatus = dynamic(
  () => import('@/components/realtime/RealtimeStatus').then((mod) => mod.RealtimeStatus),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

// Helper function to create dynamic imports with consistent loading states
export function createDynamicComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ [key: string]: T }>,
  exportName: string,
  options: {
    loading?: ComponentType;
    ssr?: boolean;
  } = {}
): ComponentType {
  return dynamic(() => importFn().then((mod) => mod[exportName as keyof typeof mod]), {
    loading: options.loading || LoadingSpinner,
    ssr: options.ssr ?? false,
  });
}

// Pre-configured dynamic import presets
export const DynamicPresets = {
  // Heavy UI components (load on interaction)
  heavyUI: (importFn: () => Promise<any>, exportName: string) =>
    createDynamicComponent(importFn, exportName, { loading: LoadingCard, ssr: false }),

  // Light utilities (can SSR)
  lightUtil: (importFn: () => Promise<any>, exportName: string) =>
    createDynamicComponent(importFn, exportName, { loading: LoadingSpinner, ssr: true }),

  // Admin only (never SSR, heavy loading)
  adminOnly: (importFn: () => Promise<any>, exportName: string) =>
    createDynamicComponent(importFn, exportName, { loading: LoadingCard, ssr: false }),
};
