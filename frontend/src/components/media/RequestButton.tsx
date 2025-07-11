'use client';

import { MediaSearchResult } from '@/types/media';
import { Button } from '@/components/ui/button';
import { Plus, Check, Clock, Loader2 } from 'lucide-react';

interface RequestButtonProps {
  media: MediaSearchResult;
  onClick: (e: React.MouseEvent) => void;
  isLoading?: boolean;
}

export function RequestButton({ media, onClick, isLoading = false }: RequestButtonProps) {
  const { availability } = media;

  if (availability.status === 'available') {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        className="w-full"
      >
        <Check className="w-4 h-4 mr-2" />
        Available
      </Button>
    );
  }

  if (availability.status === 'requested') {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        className="w-full"
      >
        <Clock className="w-4 h-4 mr-2" />
        Requested
      </Button>
    );
  }

  if (availability.status === 'processing') {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        className="w-full"
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Processing
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Plus className="w-4 h-4 mr-2" />
      )}
      Request
    </Button>
  );
}