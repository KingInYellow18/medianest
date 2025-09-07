'use client';

import { Clock, Film, List } from 'lucide-react';
import Image from 'next/image';

import { Skeleton } from '@/components/ui/skeleton';
import type { YouTubeMetadata } from '@/types/youtube';

interface MetadataPreviewProps {
  metadata: YouTubeMetadata | null;
  isLoading: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function MetadataPreview({ metadata, isLoading }: MetadataPreviewProps) {
  if (isLoading) {
    return <MetadataPreviewSkeleton />;
  }

  if (!metadata) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <Image
            src={metadata.thumbnail}
            alt={metadata.title}
            width={160}
            height={90}
            className="rounded-lg object-cover"
            unoptimized
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white line-clamp-2">{metadata.title}</h3>
          <p className="text-sm text-gray-400 mt-1">by {metadata.author}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            {metadata.type === 'video' ? (
              <>
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  Video
                </span>
                {metadata.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(metadata.duration)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <List className="w-4 h-4" />
                  Playlist
                </span>
                <span>
                  {metadata.videoCount} video{metadata.videoCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Videos Preview */}
      {metadata.type === 'playlist' && metadata.videos && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-2">
            First {Math.min(3, metadata.videos.length)} videos:
          </p>
          <div className="space-y-2">
            {metadata.videos.slice(0, 3).map((video, index) => (
              <div key={index} className="text-sm text-gray-300">
                {index + 1}. {video.title}
              </div>
            ))}
          </div>
          {metadata.videoCount && metadata.videoCount > 3 && (
            <p className="text-sm text-gray-500 mt-2">and {metadata.videoCount - 3} more...</p>
          )}
        </div>
      )}
    </div>
  );
}

function MetadataPreviewSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <div className="flex gap-4">
        <Skeleton className="w-40 h-24 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
          <div className="flex gap-4 mt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
