'use client';

import { Calendar, Star, Clock, Tv } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { MediaSearchResult } from '@/types/media';

import { AvailabilityBadge } from './AvailabilityBadge';
import { RequestButton } from './RequestButton';

interface MediaCardProps {
  media: MediaSearchResult;
  onSelect: () => void;
  onRequestClick: () => void;
}

export function MediaCard({ media, onSelect, onRequestClick }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const posterUrl =
    media.posterPath && !imageError
      ? `https://image.tmdb.org/t/p/w500${media.posterPath}`
      : '/images/poster-placeholder.png';

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.getFullYear();
  };

  return (
    <div
      className="group relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative">
        <Image
          src={posterUrl}
          alt={media.title}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm text-gray-200 line-clamp-3">{media.overview}</p>
          </div>
        </div>

        {/* Availability Badge */}
        <div className="absolute top-2 right-2">
          <AvailabilityBadge status={media.availability.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-1 mb-2">{media.title}</h3>

        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
          {media.releaseDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(media.releaseDate)}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />
            <span>{media.voteAverage.toFixed(1)}</span>
          </div>

          {media.mediaType === 'tv' && media.numberOfSeasons && (
            <div className="flex items-center gap-1">
              <Tv className="w-3 h-3" />
              <span>
                {media.numberOfSeasons} {media.numberOfSeasons === 1 ? 'Season' : 'Seasons'}
              </span>
            </div>
          )}

          {media.mediaType === 'movie' && media.runtime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{media.runtime}m</span>
            </div>
          )}
        </div>

        {/* Request Button */}
        <RequestButton
          media={media}
          onClick={(e) => {
            e.stopPropagation();
            onRequestClick();
          }}
        />
      </div>
    </div>
  );
}
