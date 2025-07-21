'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from '@headlessui/react';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ServerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { MonitorVisibilityToggle } from './MonitorVisibilityToggle';
import { MonitorVisibilityBulkActions } from './MonitorVisibilityBulkActions';
import { useMonitorVisibility } from '@/lib/hooks/useMonitorVisibility';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export function MonitorVisibilityManagement() {
  const { data: session } = useSession();
  const {
    monitors,
    stats,
    loading,
    error,
    refetch,
    updateVisibility,
    bulkUpdateVisibility,
    resetAllToAdminOnly,
  } = useMonitorVisibility();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'public' | 'admin'>('all');
  const [selectedMonitors, setSelectedMonitors] = useState<Set<number>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter monitors based on search and filter status
  const filteredMonitors = monitors.filter((monitor) => {
    const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'public' && monitor.visibility?.isPublic) ||
      (filterStatus === 'admin' && !monitor.visibility?.isPublic);
    return matchesSearch && matchesFilter;
  });

  const handleToggleVisibility = async (monitorId: number, isPublic: boolean) => {
    setIsUpdating(true);
    try {
      await updateVisibility(monitorId, isPublic);
      toast.success(`Monitor visibility updated`);
    } catch (error) {
      toast.error('Failed to update monitor visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkUpdate = async (isPublic: boolean) => {
    if (selectedMonitors.size === 0) {
      toast.error('No monitors selected');
      return;
    }

    setIsUpdating(true);
    try {
      await bulkUpdateVisibility(Array.from(selectedMonitors), isPublic);
      toast.success(`Updated visibility for ${selectedMonitors.size} monitors`);
      setSelectedMonitors(new Set());
    } catch (error) {
      toast.error('Failed to update monitor visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all monitors to admin-only visibility?')) {
      return;
    }

    setIsUpdating(true);
    try {
      await resetAllToAdminOnly();
      toast.success('All monitors reset to admin-only visibility');
      setSelectedMonitors(new Set());
    } catch (error) {
      toast.error('Failed to reset monitor visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedMonitors.size === filteredMonitors.length) {
      setSelectedMonitors(new Set());
    } else {
      setSelectedMonitors(new Set(filteredMonitors.map((m) => m.monitorID)));
    }
  };

  const toggleSelectMonitor = (monitorId: number) => {
    const newSelected = new Set(selectedMonitors);
    if (newSelected.has(monitorId)) {
      newSelected.delete(monitorId);
    } else {
      newSelected.add(monitorId);
    }
    setSelectedMonitors(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error.message} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Monitor Visibility Management
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Control which monitors are visible to regular users
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <div className="flex items-center">
            <ServerIcon className="h-5 w-5 text-gray-400 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-500">Total Monitors</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.total}
              </p>
            </div>
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="flex items-center">
            <EyeIcon className="h-5 w-5 text-green-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-500">Public</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.public}
              </p>
            </div>
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="flex items-center">
            <EyeSlashIcon className="h-5 w-5 text-yellow-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-500">Admin Only</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.adminOnly}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-gray-300 pl-10 pr-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search monitors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filter */}
          <select
            className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Monitors</option>
            <option value="public">Public Only</option>
            <option value="admin">Admin Only</option>
          </select>

          {/* Refresh */}
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedMonitors.size > 0 && (
          <MonitorVisibilityBulkActions
            selectedCount={selectedMonitors.size}
            onMakePublic={() => handleBulkUpdate(true)}
            onMakeAdminOnly={() => handleBulkUpdate(false)}
            onResetAll={handleResetAll}
            disabled={isUpdating}
          />
        )}
      </Card>

      {/* Monitor List */}
      <Card>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="relative px-6 py-3">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={
                      filteredMonitors.length > 0 &&
                      selectedMonitors.size === filteredMonitors.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Monitor
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Uptime (24h)
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Visibility
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
              {filteredMonitors.map((monitor) => (
                <tr key={monitor.monitorID}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedMonitors.has(monitor.monitorID)}
                      onChange={() => toggleSelectMonitor(monitor.monitorID)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ServerIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {monitor.name}
                        </div>
                        {monitor.url && (
                          <div className="text-sm text-gray-500">{monitor.url}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {monitor.status ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-sm text-green-600">Online</span>
                        </>
                      ) : (
                        <>
                          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                          <span className="text-sm text-red-600">Offline</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {monitor.uptime24h ? `${monitor.uptime24h.toFixed(2)}%` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={monitor.visibility?.isPublic ? 'success' : 'warning'}
                      size="sm"
                    >
                      {monitor.visibility?.isPublic ? 'Public' : 'Admin Only'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <MonitorVisibilityToggle
                      monitorId={monitor.monitorID}
                      isPublic={monitor.visibility?.isPublic || false}
                      onChange={handleToggleVisibility}
                      disabled={isUpdating}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}