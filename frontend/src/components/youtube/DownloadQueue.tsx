'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  RotateCcw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDownloadQueue, useYouTubeDownload } from '@/hooks/useYouTubeDownload';

// Note: Using console.log for now - replace with proper toast implementation
import type { DownloadStatus } from '@/types/youtube';

const statusConfig: Record<
  DownloadStatus,
  {
    label: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  validating: { label: 'Validating', color: 'bg-blue-500', icon: Clock },
  queued: { label: 'Queued', color: 'bg-yellow-500', icon: Clock },
  downloading: { label: 'Downloading', color: 'bg-blue-500', icon: Download },
  processing: { label: 'Processing', color: 'bg-purple-500', icon: Download },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500', icon: Pause },
};

export function DownloadQueue() {
  const { downloads, isLoading, refetch } = useDownloadQueue();
  const { cancelDownload, retryDownload } = useYouTubeDownload();
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  const handleCancel = async (downloadId: string) => {
    setActionLoading((prev) => ({ ...prev, [downloadId]: true }));
    try {
      await cancelDownload(downloadId);
      console.log('Download cancelled');
      refetch();
    } catch (error: any) {
      console.error('Failed to cancel download:', error.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [downloadId]: false }));
    }
  };

  const handleRetry = async (downloadId: string) => {
    setActionLoading((prev) => ({ ...prev, [downloadId]: true }));
    try {
      await retryDownload(downloadId);
      console.log('Download requeued');
      refetch();
    } catch (error: any) {
      console.error('Failed to retry download:', error.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [downloadId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-12 bg-gray-700 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No downloads yet</h3>
        <p className="text-gray-400">Start by submitting a YouTube URL in the download tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Download Queue ({downloads.length})</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {downloads.map((download) => {
          const statusInfo = statusConfig[download.status];
          const StatusIcon = statusInfo.icon;
          const isActionPending = actionLoading[download.id];

          return (
            <div key={download.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                {download.thumbnail && (
                  <div className="flex-shrink-0">
                    <img
                      src={download.thumbnail}
                      alt={download.title}
                      className="w-16 h-12 object-cover rounded"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white line-clamp-1">{download.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </Badge>
                        <span>{download.type === 'playlist' ? 'Playlist' : 'Video'}</span>
                        <span>
                          {download.format.quality} • {download.format.container.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild className="p-2">
                        <a
                          href={download.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open original URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>

                      {download.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetry(download.id)}
                          disabled={isActionPending}
                          className="p-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}

                      {(download.status === 'queued' || download.status === 'downloading') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(download.id)}
                          disabled={isActionPending}
                          className="p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(download.status === 'downloading' || download.status === 'processing') && (
                    <div className="mt-3">
                      <Progress value={download.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>
                          {download.status === 'downloading' ? 'Downloading' : 'Processing'}
                        </span>
                        <span>{Math.round(download.progress)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Queue Position */}
                  {download.queuePosition && download.queuePosition > 1 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Queue position: #{download.queuePosition}
                    </p>
                  )}

                  {/* Error Message */}
                  {download.error && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
                      {download.error}
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>
                      Created{' '}
                      {formatDistanceToNow(new Date(download.createdAt), { addSuffix: true })}
                    </span>
                    {download.completedAt && (
                      <span>
                        Completed{' '}
                        {formatDistanceToNow(new Date(download.completedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
