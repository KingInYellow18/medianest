'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// PERFORMANCE OPTIMIZATION: Lazy load heavy components to reduce main bundle size

// Loading component for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Auth components (large, not immediately needed)
export const LazySignInPage = dynamic(() => import('@/app/auth/signin/page'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

// Media components (heavy UI components)
export const LazyAdvancedSearchFilters = dynamic(
  () => import('@/components/plex/AdvancedSearchFilters'),
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  },
);

export const LazyDownloadQueue = dynamic(() => import('@/components/youtube/DownloadQueue'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export const LazyRequestTable = dynamic(() => import('@/components/requests/RequestTable'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export const LazyRequestModal = dynamic(() => import('@/components/media/RequestModal'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

// API testing page (dev-only, large)
export const LazyApiTestPage = dynamic(() => import('@/app/api-test/page'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

// YouTube URL submission form
export const LazyURLSubmissionForm = dynamic(
  () => import('@/components/youtube/URLSubmissionForm'),
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  },
);

// Performance Monitor (dev tools)
export const LazyPerformanceMonitor = dynamic(() => import('@/components/PerformanceMonitor'), {
  ssr: false,
  loading: () => null, // No loader for monitoring component
});

// Type exports for better TypeScript support
export type LazyComponentType<T = {}> = ComponentType<T>;
