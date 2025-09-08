'use client';

import React, { useState } from 'react';
import {
  LazyMediaGrid,
  LazyAdvancedSearchFilters,
  LazyPlexDashboard,
  LazyMetricsChart,
  LazyAdminPanel,
  LazySettingsPanel,
  LazyLoadErrorBoundary,
  preloadCriticalComponents,
  createDynamicComponent,
} from '@/components/LazyComponents';
import { PlexSearchFilters } from '@/types/plex-search';

// Test dynamic component creation
const LazyTestComponent = createDynamicComponent(
  () => import('@/components/plex/MediaCard').then((mod) => ({ default: mod.MediaCard })),
  {
    fallback: () => <div className="p-4 text-gray-500">Loading test component...</div>,
    retryCount: 2,
    timeout: 5000,
  }
);

export default function ComponentShowcasePage() {
  const [activeComponent, setActiveComponent] = useState<string>('media-grid');
  const [filters, setFilters] = useState<PlexSearchFilters>({});

  // Preload components on mount
  React.useEffect(() => {
    preloadCriticalComponents();
  }, []);

  const components = [
    { id: 'media-grid', label: 'Media Grid', component: 'MediaGrid' },
    { id: 'search-filters', label: 'Search Filters', component: 'AdvancedSearchFilters' },
    { id: 'plex-dashboard', label: 'Plex Dashboard', component: 'PlexDashboard' },
    { id: 'metrics-chart', label: 'Metrics Chart', component: 'MetricsChart' },
    { id: 'admin-panel', label: 'Admin Panel', component: 'AdminPanel' },
    { id: 'settings-panel', label: 'Settings Panel', component: 'SettingsPanel' },
    { id: 'test-component', label: 'Test Component', component: 'LazyTestComponent' },
  ];

  const renderComponent = () => {
    switch (activeComponent) {
      case 'media-grid':
        return <LazyMediaGrid libraryKey="1" filters={{}} searchQuery="" />;

      case 'search-filters':
        return (
          <LazyAdvancedSearchFilters
            filters={filters}
            onChange={setFilters}
            availableFilters={{
              genres: ['Action', 'Comedy', 'Drama'],
              contentRatings: ['PG', 'PG-13', 'R'],
            }}
          />
        );

      case 'plex-dashboard':
        return <LazyPlexDashboard />;

      case 'metrics-chart':
        return (
          <LazyMetricsChart
            title="Performance Metrics"
            data={[
              { label: 'CPU Usage', value: 75, color: 'bg-blue-500' },
              { label: 'Memory', value: 60, color: 'bg-green-500' },
              { label: 'Storage', value: 90, color: 'bg-red-500' },
            ]}
          />
        );

      case 'admin-panel':
        return <LazyAdminPanel />;

      case 'settings-panel':
        return <LazySettingsPanel />;

      case 'test-component':
        return <LazyTestComponent />;

      default:
        return <div>Select a component to test</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Component Showcase
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Dynamic loading components with optimized performance
          </p>
        </div>

        {/* Component Selector */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {components.map((comp) => (
              <button
                key={comp.id}
                onClick={() => setActiveComponent(comp.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeComponent === comp.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {comp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Performance Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Dynamic Import Features
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Components load on-demand with code splitting</li>
            <li>• Intelligent caching prevents redundant loading</li>
            <li>• Error boundaries handle loading failures gracefully</li>
            <li>• Performance monitoring tracks load times</li>
            <li>• Retry mechanisms handle temporary failures</li>
          </ul>
        </div>

        {/* Component Display */}
        <LazyLoadErrorBoundary
          fallback={({ error, retry }) => (
            <div className="p-6 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
              <h3 className="font-semibold mb-2">Component Loading Failed</h3>
              <p className="text-sm mb-4">
                {error?.message || 'An unexpected error occurred while loading the component.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={retry}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Retry Loading
                </button>
                <button
                  onClick={() => setActiveComponent('media-grid')}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          )}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {components.find((c) => c.id === activeComponent)?.label || 'Component'}
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Active: {activeComponent}
              </div>
            </div>

            <div className="min-h-[400px]">{renderComponent()}</div>
          </div>
        </LazyLoadErrorBoundary>
      </div>
    </div>
  );
}
