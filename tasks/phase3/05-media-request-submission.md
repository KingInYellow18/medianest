# Media Request Submission Implementation

## Overview

Implement the media request submission flow that allows users to request movies and TV shows through the Overseerr integration. This includes request confirmation, season selection for TV shows, and real-time status tracking.

## Prerequisites

- Media search interface implemented
- Overseerr API integration complete (Phase 2)
- User authentication functional
- WebSocket connection for real-time updates

## Acceptance Criteria

1. Request confirmation modal shows media details
2. TV shows allow season/episode selection
3. Request submits successfully to Overseerr
4. User receives immediate feedback on submission
5. Request status updates in real-time
6. Users can only request content they don't have access to
7. Rate limiting enforced (20 requests per hour)

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/requests.ts
export interface MediaRequest {
  id: string;
  userId: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  status: RequestStatus;
  seasons?: SeasonRequest[];
  requestedAt: Date;
  approvedAt?: Date;
  availableAt?: Date;
  overseerrId?: string;
  deniedReason?: string;
}

export type RequestStatus = 
  | 'pending'
  | 'approved' 
  | 'processing'
  | 'partially-available'
  | 'available'
  | 'denied'
  | 'failed';

export interface SeasonRequest {
  seasonNumber: number;
  episodes?: number[];
  status: RequestStatus;
}

export interface RequestSubmission {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  seasons?: number[]; // For TV shows
  episodes?: { [seasonNumber: number]: number[] }; // Specific episodes
}
```

### Component Interfaces

```typescript
// frontend/src/components/media/RequestModal.tsx
interface RequestModalProps {
  media: MediaSearchResult;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: RequestSubmission) => Promise<void>;
}

// frontend/src/components/media/SeasonSelector.tsx
interface SeasonSelectorProps {
  tvShow: TVShowDetails;
  selectedSeasons: number[];
  onSeasonToggle: (seasonNumber: number) => void;
  onEpisodeToggle?: (seasonNumber: number, episodeNumber: number) => void;
}

// frontend/src/components/requests/RequestStatusBadge.tsx
interface RequestStatusBadgeProps {
  status: RequestStatus;
  showLabel?: boolean;
}
```

## Implementation Steps

1. **Create Request Types**
   ```bash
   frontend/src/types/requests.ts
   ```

2. **Build Request Modal Component**
   ```bash
   frontend/src/components/media/RequestModal.tsx
   ```

3. **Implement Season Selector**
   ```bash
   frontend/src/components/media/SeasonSelector.tsx
   ```

4. **Create Request Submission Hook**
   ```bash
   frontend/src/hooks/useMediaRequest.ts
   ```

5. **Build Request Status Badge**
   ```bash
   frontend/src/components/requests/RequestStatusBadge.tsx
   ```

6. **Add Request Confirmation**
   ```bash
   frontend/src/components/media/RequestConfirmation.tsx
   ```

## Component Implementation

### Request Modal

```typescript
// frontend/src/components/media/RequestModal.tsx
import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';
import { X, Calendar, Star } from 'lucide-react';
import { SeasonSelector } from './SeasonSelector';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

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
        variant: 'success'
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Request Failed',
        description: error.message || 'Failed to submit request. Please try again.',
        variant: 'error'
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
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={media.mediaType === 'tv' && selectedSeasons.length === 0}
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
```

### Season Selector Component

```typescript
// frontend/src/components/media/SeasonSelector.tsx
import { Check } from 'lucide-react';
import clsx from 'clsx';

export function SeasonSelector({ 
  tvShow, 
  selectedSeasons, 
  onSeasonToggle 
}: SeasonSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: tvShow.numberOfSeasons }, (_, i) => i + 1).map((season) => {
        const isSelected = selectedSeasons.includes(season);
        const isAvailable = tvShow.availability.seasons?.find(
          s => s.seasonNumber === season
        )?.status === 'available';
        
        return (
          <button
            key={season}
            onClick={() => !isAvailable && onSeasonToggle(season)}
            disabled={isAvailable}
            className={clsx(
              'relative p-3 rounded-lg border-2 transition-all duration-150',
              {
                'border-blue-500 bg-blue-500/20': isSelected && !isAvailable,
                'border-gray-700 hover:border-gray-600': !isSelected && !isAvailable,
                'border-green-500/50 bg-green-500/10 cursor-not-allowed': isAvailable
              }
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Season {season}
              </span>
              {isSelected && !isAvailable && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
              {isAvailable && (
                <span className="text-xs text-green-500">Available</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

### Request Submission Hook

```typescript
// frontend/src/hooks/useMediaRequest.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitMediaRequest } from '@/lib/api/requests';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useMediaRequest() {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();
  
  const submitRequest = useMutation({
    mutationFn: submitMediaRequest,
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries(['media', 'availability', variables.mediaId]);
      queryClient.invalidateQueries(['requests', 'user']);
      
      // Subscribe to real-time updates for this request
      socket?.emit('subscribe:request', data.id);
    },
    onError: (error: any) => {
      if (error.response?.status === 429) {
        throw new Error('Request limit exceeded. Please try again later.');
      }
      throw error;
    }
  });
  
  return {
    submitRequest: submitRequest.mutateAsync,
    isSubmitting: submitRequest.isPending
  };
}
```

### Request Status Badge

```typescript
// frontend/src/components/requests/RequestStatusBadge.tsx
import clsx from 'clsx';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Download
} from 'lucide-react';

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500 bg-yellow-500/10',
    label: 'Pending'
  },
  approved: {
    icon: CheckCircle,
    color: 'text-blue-500 bg-blue-500/10',
    label: 'Approved'
  },
  processing: {
    icon: Loader2,
    color: 'text-purple-500 bg-purple-500/10',
    label: 'Processing',
    animate: true
  },
  'partially-available': {
    icon: Download,
    color: 'text-orange-500 bg-orange-500/10',
    label: 'Partial'
  },
  available: {
    icon: CheckCircle,
    color: 'text-green-500 bg-green-500/10',
    label: 'Available'
  },
  denied: {
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10',
    label: 'Denied'
  },
  failed: {
    icon: AlertCircle,
    color: 'text-red-500 bg-red-500/10',
    label: 'Failed'
  }
};

export function RequestStatusBadge({ status, showLabel = true }: RequestStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.color
    )}>
      <Icon className={clsx('w-3.5 h-3.5', {
        'animate-spin': config.animate
      })} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
```

## Real-time Status Updates

```typescript
// frontend/src/hooks/useRequestStatus.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useRequestStatus(requestId?: string) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();
  
  useEffect(() => {
    if (!socket || !requestId) return;
    
    const handleStatusUpdate = (update: RequestStatusUpdate) => {
      queryClient.setQueryData<MediaRequest>(
        ['request', requestId],
        (old) => old ? { ...old, ...update } : old
      );
      
      // Also update in user's request list
      queryClient.setQueryData<MediaRequest[]>(
        ['requests', 'user'],
        (old) => old?.map(req => 
          req.id === requestId ? { ...req, ...update } : req
        ) || []
      );
    };
    
    socket.on(`request:${requestId}:status`, handleStatusUpdate);
    
    return () => {
      socket.off(`request:${requestId}:status`, handleStatusUpdate);
    };
  }, [socket, requestId, queryClient]);
}
```

## API Integration

```typescript
// frontend/src/lib/api/requests.ts
export async function submitMediaRequest(request: RequestSubmission): Promise<MediaRequest> {
  const response = await fetch('/api/media/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit request');
  }
  
  return response.json();
}

export async function getUserRequests(): Promise<MediaRequest[]> {
  const response = await fetch('/api/media/requests', {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  
  return response.json();
}
```

## Testing Requirements

1. **Request Flow**:
   - Modal opens with correct media details
   - Season selection works for TV shows
   - Submit button disabled when no seasons selected
   - Request submits successfully

2. **Error Handling**:
   - Rate limit errors display correctly
   - Network errors handled gracefully
   - Invalid requests show error messages

3. **Real-time Updates**:
   - Status changes reflect immediately
   - Multiple requests update independently
   - WebSocket disconnection handled

## Rate Limiting

Implement client-side rate limit tracking:

```typescript
// frontend/src/hooks/useRateLimit.ts
export function useRateLimit(limit = 20, window = 3600000) {
  const [requests, setRequests] = useState<number[]>([]);
  
  const canRequest = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter(time => now - time < window);
    return recentRequests.length < limit;
  }, [requests, limit, window]);
  
  const addRequest = useCallback(() => {
    setRequests(prev => [...prev, Date.now()]);
  }, []);
  
  const remainingRequests = useMemo(() => {
    const now = Date.now();
    const recentRequests = requests.filter(time => now - time < window);
    return Math.max(0, limit - recentRequests.length);
  }, [requests, limit, window]);
  
  return { canRequest, addRequest, remainingRequests };
}
```

## Related Tasks

- Media Search Interface
- Request History View
- Request Status Tracking
- Admin Request Management