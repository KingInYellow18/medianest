'use client';

import {
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Filter,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { useDownloadQueue } from '@/hooks/useDownloadQueue';
import { useToast } from '@/hooks/useToast';
import { isToday } from '@/lib/utils/format';
import type { DownloadQueueProps, QueueFilters as QueueFiltersType } from '@/types/youtube-queue';

import { DownloadCard } from './DownloadCard';
import { EmptyQueue } from './EmptyQueue';
import { QueueFilters } from './QueueFilters';

export function DownloadQueue({ userId }: DownloadQueueProps = {}) {
  const [filters, setFilters] = useState<QueueFiltersType>({
    status: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { downloads, stats, isLoading, cancelDownload, retryDownload, error } = useDownloadQueue({
    userId,
    filters,
    refetchInterval: 3000, // More frequent updates for active downloads
  });

  const { toast } = useToast();

  const handleCancel = async (downloadId: string) => {
    try {
      await cancelDownload(downloadId);
      toast({
        title: 'Download Cancelled',
        description: 'The download has been cancelled.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel download',
        variant: 'error',
      });
    }
  };

  const handleRetry = async (downloadId: string) => {
    try {
      await retryDownload(downloadId);
      toast({
        title: 'Download Requeued',
        description: 'The download has been added back to the queue.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: error instanceof Error ? error.message : 'Failed to retry download',
        variant: 'error',
      });
    }
  };

  const handleViewInPlex = (downloadId: string) => {
    const download = downloads.find((d) => d.id === downloadId);
    if (download?.plexCollectionId) {
      window.open(`/plex/collections/${download.plexCollectionId}`, '_blank');
    } else {
      toast({
        title: 'Plex Collection Not Available',
        description: 'This download is not yet available in Plex.',
        variant: 'warning',
      });
    }
  };

  if (error) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Failed to Load Downloads</h3>
        <p className="text-gray-400 text-sm">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="w-16 h-4 bg-gray-700 rounded"></div>
                  <div className="w-12 h-3 bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Content */}
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading downloads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Download Queue</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor and manage your YouTube downloads</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Downloads"
          value={stats.active}
          icon={<Download className="w-5 h-5" />}
          color="blue"
          description="Currently downloading"
        />
        <StatCard
          label="In Queue"
          value={stats.queued}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          description="Waiting to start"
        />
        <StatCard
          label="Completed Today"
          value={
            downloads.filter(
              (d) => d.status === 'completed' && d.completedAt && isToday(new Date(d.completedAt))
            ).length
          }
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          description="Finished today"
        />
        <StatCard
          label="Total Downloads"
          value={stats.total}
          icon={<BarChart3 className="w-5 h-5" />}
          color="purple"
          description="All time"
        />
      </div>

      {/* Filters */}
      {showFilters && <QueueFilters filters={filters} onChange={setFilters} />}

      {/* Download List */}
      {downloads.length === 0 ? (
        <EmptyQueue filters={filters} />
      ) : (
        <div className="space-y-4">
          {downloads.map((download) => (
            <DownloadCard
              key={download.id}
              download={download}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onViewInPlex={handleViewInPlex}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'green' | 'purple' | 'red';
  description?: string;
}

function StatCard({ label, value, icon, color, description }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-600 text-blue-100',
    yellow: 'bg-yellow-600 text-yellow-100',
    green: 'bg-green-600 text-green-100',
    purple: 'bg-purple-600 text-purple-100',
    red: 'bg-red-600 text-red-100',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{value}</span>
          </div>
          <p className="text-sm font-medium text-gray-300">{label}</p>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
      </div>
    </div>
  );
}
