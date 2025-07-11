# Plex Collection Creation Implementation

## Overview

Implement automatic Plex collection creation for completed YouTube downloads. When playlists are downloaded, they should be organized into Plex collections with proper metadata, and individual videos should be added to appropriate collections or libraries.

## Prerequisites

- YouTube download queue functional
- Plex API integration complete (Phase 2)
- Download completion webhooks configured
- Plex library write access
- File system access for media organization

## Acceptance Criteria

1. Automatic collection creation for YouTube playlists
2. Proper metadata assignment (title, description, poster)
3. Individual videos added to correct Plex library
4. Collection poster generation from playlist thumbnail
5. User notification when collection is ready
6. Handle duplicate content gracefully
7. Cleanup failed downloads
8. Collection sharing respects user permissions

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/plex-collections.ts
export interface PlexCollectionCreation {
  id: string;
  downloadId: string;
  userId: string;
  collectionTitle: string;
  collectionKey?: string;
  librarySection: string;
  status: CollectionStatus;
  videoCount: number;
  processedCount: number;
  videos: PlexCollectionVideo[];
  metadata: CollectionMetadata;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export type CollectionStatus = 
  | 'pending'
  | 'creating'
  | 'adding-media'
  | 'updating-metadata'
  | 'completed'
  | 'failed';

export interface PlexCollectionVideo {
  youtubeId: string;
  title: string;
  filePath: string;
  plexKey?: string;
  status: 'pending' | 'added' | 'failed';
  error?: string;
}

export interface CollectionMetadata {
  title: string;
  summary?: string;
  posterUrl?: string;
  backgroundUrl?: string;
  year?: number;
  tags?: string[];
}

export interface CollectionProgress {
  collectionId: string;
  status: CollectionStatus;
  progress: number;
  currentVideo?: string;
  message?: string;
}
```

### Component Structure

```typescript
// frontend/src/components/youtube/CollectionStatus.tsx
interface CollectionStatusProps {
  downloadId: string;
  onComplete: (collectionKey: string) => void;
}

// frontend/src/components/youtube/CollectionProgress.tsx
interface CollectionProgressProps {
  collection: PlexCollectionCreation;
  compact?: boolean;
}

// frontend/src/components/youtube/CollectionManager.tsx
interface CollectionManagerProps {
  collections: PlexCollectionCreation[];
  onViewCollection: (collectionKey: string) => void;
}
```

## Implementation Steps

1. **Create Collection Types**
   ```bash
   frontend/src/types/plex-collections.ts
   ```

2. **Build Collection Status Component**
   ```bash
   frontend/src/components/youtube/CollectionStatus.tsx
   ```

3. **Implement Collection Progress Display**
   ```bash
   frontend/src/components/youtube/CollectionProgress.tsx
   ```

4. **Create Collection Manager**
   ```bash
   frontend/src/components/youtube/CollectionManager.tsx
   ```

5. **Add Collection Creation Hook**
   ```bash
   frontend/src/hooks/usePlexCollection.ts
   ```

6. **Build Collection Detail Modal**
   ```bash
   frontend/src/components/youtube/CollectionDetailModal.tsx
   ```

## Component Implementation

### Collection Status Component

```typescript
// frontend/src/components/youtube/CollectionStatus.tsx
import { useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, Film } from 'lucide-react';
import { useCollectionStatus } from '@/hooks/usePlexCollection';
import { CollectionProgress } from './CollectionProgress';
import { Button } from '@/components/ui/Button';

export function CollectionStatus({ downloadId, onComplete }: CollectionStatusProps) {
  const { collection, isLoading, error } = useCollectionStatus(downloadId);
  
  useEffect(() => {
    if (collection?.status === 'completed' && collection.collectionKey) {
      onComplete(collection.collectionKey);
    }
  }, [collection, onComplete]);
  
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-gray-300">Checking collection status...</span>
        </div>
      </div>
    );
  }
  
  if (error || !collection) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-300">
            {error || 'Collection information unavailable'}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-white flex items-center gap-2">
            <Film className="w-5 h-5" />
            Plex Collection
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {collection.collectionTitle}
          </p>
        </div>
        
        <StatusBadge status={collection.status} />
      </div>
      
      {collection.status !== 'completed' && (
        <CollectionProgress collection={collection} compact />
      )}
      
      {collection.status === 'completed' && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            <span className="text-green-400">✓</span> {collection.processedCount} videos added
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/plex/collection/${collection.collectionKey}`, '_blank')}
          >
            View in Plex
          </Button>
        </div>
      )}
      
      {collection.status === 'failed' && collection.error && (
        <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
          {collection.error}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CollectionStatus }) {
  const configs = {
    pending: { color: 'text-gray-400', icon: Clock },
    creating: { color: 'text-blue-400', icon: Loader2, animate: true },
    'adding-media': { color: 'text-blue-400', icon: Loader2, animate: true },
    'updating-metadata': { color: 'text-purple-400', icon: Loader2, animate: true },
    completed: { color: 'text-green-400', icon: CheckCircle },
    failed: { color: 'text-red-400', icon: AlertCircle }
  };
  
  const config = configs[status];
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-1.5 ${config.color}`}>
      <Icon className={clsx('w-4 h-4', config.animate && 'animate-spin')} />
      <span className="text-sm capitalize">{status.replace('-', ' ')}</span>
    </div>
  );
}
```

### Collection Progress Component

```typescript
// frontend/src/components/youtube/CollectionProgress.tsx
import { Progress } from '@/components/ui/Progress';
import { Film, FolderPlus, FileVideo } from 'lucide-react';

export function CollectionProgress({ collection, compact = false }: CollectionProgressProps) {
  const progress = collection.videoCount > 0 
    ? (collection.processedCount / collection.videoCount) * 100 
    : 0;
  
  const currentStep = getStepFromStatus(collection.status);
  
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">{currentStep.label}</span>
          <span className="text-white">{collection.processedCount}/{collection.videoCount}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Step Indicators */}
      <div className="flex items-center justify-between">
        <StepIndicator
          icon={FolderPlus}
          label="Create Collection"
          status={getStepStatus(collection.status, 'creating')}
        />
        <div className="flex-1 h-0.5 bg-gray-700 mx-2" />
        <StepIndicator
          icon={FileVideo}
          label="Add Media"
          status={getStepStatus(collection.status, 'adding-media')}
        />
        <div className="flex-1 h-0.5 bg-gray-700 mx-2" />
        <StepIndicator
          icon={Film}
          label="Update Metadata"
          status={getStepStatus(collection.status, 'updating-metadata')}
        />
      </div>
      
      {/* Progress Details */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Processing Videos</span>
          <span className="text-white font-medium">
            {collection.processedCount} / {collection.videoCount}
          </span>
        </div>
        <Progress value={progress} className="h-3" />
        
        {collection.videos && (
          <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
            {collection.videos.map((video, index) => (
              <VideoStatus key={video.youtubeId} video={video} index={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ 
  icon: Icon, 
  label, 
  status 
}: { 
  icon: any; 
  label: string; 
  status: 'pending' | 'active' | 'completed' 
}) {
  return (
    <div className={clsx(
      'flex flex-col items-center gap-1',
      status === 'pending' && 'opacity-50',
      status === 'active' && 'text-blue-400',
      status === 'completed' && 'text-green-400'
    )}>
      <div className={clsx(
        'w-10 h-10 rounded-full flex items-center justify-center',
        status === 'pending' && 'bg-gray-700',
        status === 'active' && 'bg-blue-500/20 animate-pulse',
        status === 'completed' && 'bg-green-500/20'
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function VideoStatus({ video, index }: { video: PlexCollectionVideo; index: number }) {
  const statusIcons = {
    pending: { icon: Clock, color: 'text-gray-400' },
    added: { icon: CheckCircle, color: 'text-green-400' },
    failed: { icon: AlertCircle, color: 'text-red-400' }
  };
  
  const config = statusIcons[video.status];
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-6">{index}.</span>
      <Icon className={`w-3 h-3 ${config.color}`} />
      <span className="text-gray-300 truncate flex-1" title={video.title}>
        {video.title}
      </span>
      {video.error && (
        <span className="text-red-400 text-xs" title={video.error}>!</span>
      )}
    </div>
  );
}
```

### Collection Manager Component

```typescript
// frontend/src/components/youtube/CollectionManager.tsx
import { useState } from 'react';
import { Folder, ExternalLink, MoreVertical } from 'lucide-react';
import { CollectionDetailModal } from './CollectionDetailModal';
import { Dropdown } from '@/components/ui/Dropdown';
import { formatDistanceToNow } from 'date-fns';

export function CollectionManager({ collections, onViewCollection }: CollectionManagerProps) {
  const [selectedCollection, setSelectedCollection] = useState<PlexCollectionCreation | null>(null);
  
  if (collections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No collections created yet</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="space-y-3">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-white line-clamp-1">
                  {collection.collectionTitle}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                  <span>{collection.videoCount} videos</span>
                  <span>•</span>
                  <span>Library: {collection.librarySection}</span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(collection.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <CollectionStatusBadge status={collection.status} />
                
                <Dropdown
                  trigger={
                    <button className="p-1 hover:bg-gray-700 rounded">
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                  }
                >
                  <Dropdown.Item onClick={() => setSelectedCollection(collection)}>
                    View Details
                  </Dropdown.Item>
                  {collection.status === 'completed' && collection.collectionKey && (
                    <Dropdown.Item onClick={() => onViewCollection(collection.collectionKey!)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Plex
                    </Dropdown.Item>
                  )}
                </Dropdown>
              </div>
            </div>
            
            {collection.status !== 'completed' && collection.status !== 'failed' && (
              <div className="mt-3">
                <CollectionProgress collection={collection} compact />
              </div>
            )}
            
            {collection.error && (
              <div className="mt-3 text-sm text-red-400 bg-red-900/20 rounded p-2">
                {collection.error}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedCollection && (
        <CollectionDetailModal
          collection={selectedCollection}
          isOpen={!!selectedCollection}
          onClose={() => setSelectedCollection(null)}
          onViewInPlex={() => onViewCollection(selectedCollection.collectionKey!)}
        />
      )}
    </>
  );
}

function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  const colors = {
    pending: 'bg-gray-500/20 text-gray-400',
    creating: 'bg-blue-500/20 text-blue-400',
    'adding-media': 'bg-blue-500/20 text-blue-400',
    'updating-metadata': 'bg-purple-500/20 text-purple-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400'
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status]}`}>
      {status.replace('-', ' ')}
    </span>
  );
}
```

### Collection Detail Modal

```typescript
// frontend/src/components/youtube/CollectionDetailModal.tsx
import { Dialog } from '@headlessui/react';
import Image from 'next/image';
import { X, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CollectionDetailModalProps {
  collection: PlexCollectionCreation;
  isOpen: boolean;
  onClose: () => void;
  onViewInPlex: () => void;
}

export function CollectionDetailModal({ 
  collection, 
  isOpen, 
  onClose, 
  onViewInPlex 
}: CollectionDetailModalProps) {
  const successCount = collection.videos.filter(v => v.status === 'added').length;
  const failedCount = collection.videos.filter(v => v.status === 'failed').length;
  
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-3xl w-full bg-gray-900 rounded-xl shadow-xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="relative p-6 border-b border-gray-800">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <Dialog.Title className="text-xl font-bold text-white pr-12">
              {collection.collectionTitle}
            </Dialog.Title>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              <span>Library: {collection.librarySection}</span>
              <span>•</span>
              <span>{collection.videoCount} videos</span>
              {collection.completedAt && (
                <>
                  <span>•</span>
                  <span>Completed {new Date(collection.completedAt).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Summary */}
            <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-800">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 text-green-400 rounded-full mx-auto mb-2">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-white">{successCount}</div>
                <div className="text-sm text-gray-400">Added</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-red-500/20 text-red-400 rounded-full mx-auto mb-2">
                  <XCircle className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-white">{failedCount}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-gray-500/20 text-gray-400 rounded-full mx-auto mb-2">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {collection.videos.filter(v => v.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
            
            {/* Video List */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Videos</h3>
              <div className="space-y-2">
                {collection.videos.map((video, index) => (
                  <div
                    key={video.youtubeId}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg',
                      video.status === 'failed' ? 'bg-red-900/20' : 'bg-gray-800'
                    )}
                  >
                    <span className="text-gray-500 w-8 text-right">{index + 1}.</span>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate" title={video.title}>
                        {video.title}
                      </p>
                      {video.error && (
                        <p className="text-xs text-red-400 mt-1">{video.error}</p>
                      )}
                    </div>
                    
                    <VideoStatusIcon status={video.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {collection.status === 'completed' && collection.collectionKey && (
              <Button variant="primary" onClick={onViewInPlex}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Plex
              </Button>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function VideoStatusIcon({ status }: { status: 'pending' | 'added' | 'failed' }) {
  const configs = {
    pending: { icon: Clock, color: 'text-gray-400' },
    added: { icon: CheckCircle, color: 'text-green-400' },
    failed: { icon: XCircle, color: 'text-red-400' }
  };
  
  const config = configs[status];
  const Icon = config.icon;
  
  return <Icon className={`w-5 h-5 ${config.color} flex-shrink-0`} />;
}
```

### Collection Hook

```typescript
// frontend/src/hooks/usePlexCollection.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchCollectionStatus, fetchUserCollections } from '@/lib/api/plex-collections';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useCollectionStatus(downloadId: string) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();
  
  const queryKey = ['plex', 'collection', 'download', downloadId];
  
  const { data: collection, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchCollectionStatus(downloadId),
    refetchInterval: (data) => {
      // Stop polling when completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 5000; // Poll every 5 seconds
    }
  });
  
  // Real-time updates
  useEffect(() => {
    if (!socket || !collection) return;
    
    const handleProgress = (update: CollectionProgress) => {
      if (update.collectionId !== collection.id) return;
      
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        status: update.status,
        processedCount: Math.floor((update.progress / 100) * old.videoCount),
        message: update.message
      }));
    };
    
    socket.on('collection:progress', handleProgress);
    socket.emit('subscribe:collection', collection.id);
    
    return () => {
      socket.off('collection:progress', handleProgress);
      socket.emit('unsubscribe:collection', collection.id);
    };
  }, [socket, collection, queryClient, queryKey]);
  
  return { collection, isLoading, error: error?.message };
}

export function useUserCollections() {
  const { data, isLoading } = useQuery({
    queryKey: ['plex', 'collections', 'user'],
    queryFn: fetchUserCollections,
    staleTime: 60 * 1000 // 1 minute
  });
  
  return {
    collections: data?.collections || [],
    isLoading
  };
}
```

### Collection Integration in Download Card

```typescript
// Add to DownloadCard component
{download.status === 'completed' && (
  <div className="mt-4">
    <CollectionStatus 
      downloadId={download.id}
      onComplete={(collectionKey) => {
        toast({
          title: 'Collection Ready',
          description: 'Your YouTube playlist is now available in Plex!',
          variant: 'success',
          action: (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.open(`/plex/collection/${collectionKey}`, '_blank')}
            >
              View
            </Button>
          )
        });
      }}
    />
  </div>
)}
```

## API Integration

```typescript
// frontend/src/lib/api/plex-collections.ts
export async function fetchCollectionStatus(downloadId: string): Promise<PlexCollectionCreation> {
  const response = await fetch(`/api/youtube/downloads/${downloadId}/collection`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch collection status');
  }
  
  return response.json();
}

export async function fetchUserCollections(): Promise<{
  collections: PlexCollectionCreation[]
}> {
  const response = await fetch('/api/plex/collections/youtube', {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  
  return response.json();
}
```

## Helper Functions

```typescript
// frontend/src/lib/plex/collection-utils.ts
export function getStepFromStatus(status: CollectionStatus): {
  step: number;
  label: string;
} {
  const steps = {
    pending: { step: 0, label: 'Waiting to start' },
    creating: { step: 1, label: 'Creating collection' },
    'adding-media': { step: 2, label: 'Adding videos' },
    'updating-metadata': { step: 3, label: 'Updating metadata' },
    completed: { step: 4, label: 'Complete' },
    failed: { step: -1, label: 'Failed' }
  };
  
  return steps[status];
}

export function getStepStatus(
  currentStatus: CollectionStatus, 
  targetStep: string
): 'pending' | 'active' | 'completed' {
  const statusOrder = ['creating', 'adding-media', 'updating-metadata'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const targetIndex = statusOrder.indexOf(targetStep);
  
  if (currentStatus === 'failed') return 'pending';
  if (currentStatus === 'completed') return 'completed';
  if (currentIndex === targetIndex) return 'active';
  if (currentIndex > targetIndex) return 'completed';
  return 'pending';
}
```

## Testing Requirements

1. **Collection Creation**:
   - Collections created with correct metadata
   - Playlist thumbnails used as posters
   - Videos added in correct order
   - Duplicate handling works properly

2. **Progress Tracking**:
   - Real-time updates display correctly
   - Progress calculations accurate
   - Failed videos tracked properly
   - Status transitions smooth

3. **User Experience**:
   - Notifications when collections ready
   - Easy navigation to Plex
   - Clear error messages
   - Retry functionality for failures

4. **Integration**:
   - Correct Plex library assignment
   - Metadata properly applied
   - Collections visible to authorized users
   - Cleanup of failed attempts

## Performance Considerations

1. **Batch Processing**: Add multiple videos in single API calls
2. **Progress Throttling**: Update UI max once per second
3. **Metadata Caching**: Cache collection metadata
4. **Background Processing**: Don't block UI during creation
5. **Error Recovery**: Automatic retry for transient failures

## Error Handling

1. **Plex API Errors**: Retry with exponential backoff
2. **File System Errors**: Validate paths before processing
3. **Metadata Failures**: Fallback to basic information
4. **Permission Errors**: Clear user messaging
5. **Network Timeouts**: Configurable retry limits

## Related Tasks

- YouTube Download Queue
- Plex Library Integration
- Background Job Processing
- User Notification System