'use client';

import { Play, Star, Eye } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

import { getPlexPosterUrl, formatDuration } from '@/lib/plex/utils';
import { PlexMediaItem } from '@/types/plex';

interface MediaCardProps {
  media: PlexMediaItem;
  onClick: () => void;
}

export function MediaCard({ media, onClick }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = !imageError ? getPlexPosterUrl(media.thumb) : '/images/poster-placeholder.svg';

  const progress =
    media.viewOffset && media.duration ? (media.viewOffset / media.duration) * 100 : 0;

  return (
    <div onClick={onClick} className="group relative cursor-pointer">
      {/* Poster */}
      <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
        <Image
          src={imageUrl}
          alt={media.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageError(true)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Watch Progress */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
            <div className="h-full bg-orange-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {media.viewCount && media.viewCount > 0 && (
            <div className="bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3 text-white" />
              <span className="text-xs text-white">{media.viewCount}</span>
            </div>
          )}

          {media.rating && (
            <div className="bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-white">{media.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Type badge for TV shows */}
        {media.type === 'show' && media.seasonCount && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <span className="text-xs text-white">
              {media.seasonCount} {media.seasonCount === 1 ? 'Season' : 'Seasons'}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mt-2 text-sm font-medium text-white line-clamp-2">{media.title}</h3>

      {/* Metadata */}
      <div className="mt-1 text-xs text-gray-400 flex items-center gap-2">
        {media.year && <span>{media.year}</span>}
        {media.contentRating && (
          <>
            <span className="text-gray-600">•</span>
            <span>{media.contentRating}</span>
          </>
        )}
        {media.duration && (
          <>
            <span className="text-gray-600">•</span>
            <span>{formatDuration(media.duration)}</span>
          </>
        )}
      </div>
    </div>
  );
}
