'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

import { MediaSearchResult } from '@/types/media';

interface SeasonSelectorProps {
  tvShow: MediaSearchResult;
  selectedSeasons: number[];
  onSeasonToggle: (seasonNumber: number) => void;
  onEpisodeToggle?: (seasonNumber: number, episodeNumber: number) => void;
}

export function SeasonSelector({ tvShow, selectedSeasons, onSeasonToggle }: SeasonSelectorProps) {
  // Return null if not a TV show or missing numberOfSeasons
  if (tvShow.mediaType !== 'tv' || !tvShow.numberOfSeasons) {
    return null;
  }

  const handleSelectAll = () => {
    for (let i = 1; i <= tvShow.numberOfSeasons; i++) {
      if (!selectedSeasons.includes(i)) {
        onSeasonToggle(i);
      }
    }
  };

  const handleDeselectAll = () => {
    selectedSeasons.forEach((season) => {
      onSeasonToggle(season);
    });
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-300 mb-3">Select Seasons</h3>

      {/* Select/Deselect All buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleSelectAll} className="text-xs text-blue-400 hover:text-blue-300">
          Select All
        </button>
        <button onClick={handleDeselectAll} className="text-xs text-blue-400 hover:text-blue-300">
          Deselect All
        </button>
      </div>

      {/* Season grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: tvShow.numberOfSeasons }, (_, i) => i + 1).map((season) => {
          const isSelected = selectedSeasons.includes(season);
          const isAvailable =
            tvShow.availability?.seasons?.find((s) => s.seasonNumber === season)?.status ===
            'available';

          return (
            <button
              key={season}
              onClick={() => !isAvailable && onSeasonToggle(season)}
              disabled={isAvailable}
              className={clsx('relative p-3 rounded-lg border-2 transition-all duration-150', {
                'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500': isSelected,
                'border-gray-700 hover:border-gray-600': !isSelected && !isAvailable,
                'border-green-500/50 bg-green-500/10 cursor-not-allowed': isAvailable,
              })}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Season {season}</span>
                {isSelected && !isAvailable && <Check className="w-4 h-4 text-blue-500" />}
                {isAvailable && <Check className="w-4 h-4 text-green-500" />}
              </div>
              {isAvailable && <span className="text-xs text-green-500">Available</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
