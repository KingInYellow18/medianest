'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

import { TVShowDetails } from '@/types/requests';

interface SeasonSelectorProps {
  tvShow: TVShowDetails;
  selectedSeasons: number[];
  onSeasonToggle: (seasonNumber: number) => void;
  onEpisodeToggle?: (seasonNumber: number, episodeNumber: number) => void;
}

export function SeasonSelector({ tvShow, selectedSeasons, onSeasonToggle }: SeasonSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: tvShow.numberOfSeasons }, (_, i) => i + 1).map((season) => {
        const isSelected = selectedSeasons.includes(season);
        const isAvailable =
          tvShow.availability.seasons?.find((s) => s.seasonNumber === season)?.status ===
          'available';

        return (
          <button
            key={season}
            onClick={() => !isAvailable && onSeasonToggle(season)}
            disabled={isAvailable}
            className={clsx('relative p-3 rounded-lg border-2 transition-all duration-150', {
              'border-blue-500 bg-blue-500/20': isSelected && !isAvailable,
              'border-gray-700 hover:border-gray-600': !isSelected && !isAvailable,
              'border-green-500/50 bg-green-500/10 cursor-not-allowed': isAvailable,
            })}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Season {season}</span>
              {isSelected && !isAvailable && <Check className="w-4 h-4 text-blue-500" />}
              {isAvailable && <span className="text-xs text-green-500">Available</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
