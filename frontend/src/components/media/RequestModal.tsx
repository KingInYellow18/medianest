'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';
import { X, Calendar, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MediaSearchResult } from '@/types/media';
import { RequestSubmission, TVShowDetails } from '@/types/requests';
import { SeasonSelector } from './SeasonSelector';

interface RequestModalProps {
  media: MediaSearchResult;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: RequestSubmission) => Promise<void>;
}

export function RequestModal({ media, isOpen, onClose, onSubmit }: RequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const { toast } = useToast();
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        mediaId: media.tmdbId,
        mediaType: media.mediaType,
        seasons: media.mediaType === 'tv' ? selectedSeasons : undefined
      });
      
      toast({
        title: 'Request Submitted',
        description: `Your request for "${media.title}" has been submitted successfully.`,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Request Failed',
        description: error instanceof Error ? error.message : 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-gray-900 rounded-xl shadow-xl">
          {/* Header with backdrop */}
          <div className="relative h-48 overflow-hidden rounded-t-xl">
            {media.backdropPath && (
              <Image
                src={`https://image.tmdb.org/t/p/w780${media.backdropPath}`}
                alt=""
                fill
                className="object-cover opacity-50"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="absolute bottom-4 left-6 right-6">
              <Dialog.Title className="text-2xl font-bold text-white">
                Request {media.title}
              </Dialog.Title>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
                {media.releaseDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(media.releaseDate).getFullYear()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {media.voteAverage.toFixed(1)}
                </span>
                <span className="capitalize">{media.mediaType}</span>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 mb-6">{media.overview}</p>
            
            {/* Season Selection for TV Shows */}
            {media.mediaType === 'tv' && media.numberOfSeasons && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Select Seasons to Request
                </h3>
                <SeasonSelector
                  tvShow={media as TVShowDetails}
                  selectedSeasons={selectedSeasons}
                  onSeasonToggle={(season) => {
                    setSelectedSeasons(prev =>
                      prev.includes(season)
                        ? prev.filter(s => s !== season)
                        : [...prev, season]
                    );
                  }}
                />
              </div>
            )}
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleSubmit}
                disabled={isSubmitting || (media.mediaType === 'tv' && selectedSeasons.length === 0)}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}