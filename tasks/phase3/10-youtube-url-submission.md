# YouTube URL Submission Interface Implementation

## Overview

Create a user-friendly interface for submitting YouTube playlist and video URLs for download. The interface should validate URLs, check user quotas, and queue downloads through the BullMQ job processing system.

## Prerequisites

- User authentication with download permissions
- BullMQ queue configured (Phase 2)
- Redis connection established
- YouTube URL validation utilities
- Rate limiting middleware

## Acceptance Criteria

1. Clean URL submission form with validation
2. Support for video and playlist URLs
3. Real-time URL validation and metadata preview
4. User quota checking (5 downloads per hour)
5. Download format selection (MP4, highest quality)
6. Queue position feedback
7. Duplicate URL detection
8. Mobile-responsive design

## Technical Requirements

### Data Structures

```typescript
// frontend/src/types/youtube.ts
export interface YouTubeDownloadRequest {
  id: string;
  userId: string;
  url: string;
  type: 'video' | 'playlist';
  title: string;
  thumbnail?: string;
  duration?: number;
  videoCount?: number; // For playlists
  status: DownloadStatus;
  format: DownloadFormat;
  progress: number;
  queuePosition?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  plexCollectionId?: string;
}

export type DownloadStatus = 
  | 'validating'
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadFormat {
  quality: 'best' | '1080p' | '720p' | '480p';
  container: 'mp4' | 'mkv';
}

export interface YouTubeMetadata {
  url: string;
  type: 'video' | 'playlist';
  title: string;
  author: string;
  thumbnail: string;
  duration?: number; // seconds
  videoCount?: number;
  videos?: YouTubeVideoInfo[]; // For playlists
}

export interface UserQuota {
  used: number;
  limit: number;
  resetAt: Date;
  canDownload: boolean;
}
```

### Component Structure

```typescript
// frontend/src/components/youtube/YouTubeDownloader.tsx
interface YouTubeDownloaderProps {
  onDownloadQueued: (download: YouTubeDownloadRequest) => void;
}

// frontend/src/components/youtube/URLSubmissionForm.tsx
interface URLSubmissionFormProps {
  onSubmit: (url: string, format: DownloadFormat) => Promise<void>;
  userQuota: UserQuota;
}

// frontend/src/components/youtube/MetadataPreview.tsx
interface MetadataPreviewProps {
  metadata: YouTubeMetadata;
  isLoading: boolean;
}

// frontend/src/components/youtube/QuotaDisplay.tsx
interface QuotaDisplayProps {
  quota: UserQuota;
  onRefresh: () => void;
}
```

## Implementation Steps

1. **Create YouTube Types**
   ```bash
   frontend/src/types/youtube.ts
   ```

2. **Build Main Downloader Page**
   ```bash
   frontend/src/app/(auth)/youtube/page.tsx
   ```

3. **Implement URL Submission Form**
   ```bash
   frontend/src/components/youtube/URLSubmissionForm.tsx
   ```

4. **Create Metadata Preview Component**
   ```bash
   frontend/src/components/youtube/MetadataPreview.tsx
   ```

5. **Build Quota Display**
   ```bash
   frontend/src/components/youtube/QuotaDisplay.tsx
   ```

6. **Add URL Validation Hook**
   ```bash
   frontend/src/hooks/useYouTubeValidation.ts
   ```

## Component Implementation

### Main YouTube Downloader Page

```typescript
// frontend/src/app/(auth)/youtube/page.tsx
'use client';

import { useState } from 'react';
import { YouTubeDownloader } from '@/components/youtube/YouTubeDownloader';
import { DownloadQueue } from '@/components/youtube/DownloadQueue';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState<'download' | 'queue'>('download');

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="YouTube Downloader"
        description="Download videos and playlists to your Plex library"
      />
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="download">New Download</TabsTrigger>
          <TabsTrigger value="queue">Download Queue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="download" className="mt-6">
          <YouTubeDownloader 
            onDownloadQueued={() => setActiveTab('queue')}
          />
        </TabsContent>
        
        <TabsContent value="queue" className="mt-6">
          <DownloadQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### URL Submission Form

```typescript
// frontend/src/components/youtube/URLSubmissionForm.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Youtube, Link, Download } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { QuotaDisplay } from './QuotaDisplay';
import { useDebounce } from '@/hooks/useDebounce';
import { validateYouTubeURL } from '@/lib/youtube/validation';

const formSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .refine((url) => validateYouTubeURL(url), 'Invalid YouTube URL'),
  quality: z.enum(['best', '1080p', '720p', '480p']),
  container: z.enum(['mp4', 'mkv'])
});

type FormData = z.infer<typeof formSchema>;

export function URLSubmissionForm({ onSubmit, userQuota }: URLSubmissionFormProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [urlError, setUrlError] = useState<string>();
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quality: 'best',
      container: 'mp4'
    }
  });
  
  const urlValue = watch('url');
  const debouncedUrl = useDebounce(urlValue, 500);
  
  // Validate URL in real-time
  useEffect(() => {
    if (!debouncedUrl) {
      setUrlError(undefined);
      return;
    }
    
    setIsValidating(true);
    validateYouTubeURL(debouncedUrl)
      .then((isValid) => {
        setUrlError(isValid ? undefined : 'Invalid YouTube URL format');
      })
      .finally(() => setIsValidating(false));
  }, [debouncedUrl]);
  
  const onFormSubmit = async (data: FormData) => {
    if (!userQuota.canDownload) {
      setUrlError('Download quota exceeded. Please try again later.');
      return;
    }
    
    try {
      await onSubmit(data.url, {
        quality: data.quality,
        container: data.container
      });
      reset();
    } catch (error) {
      setUrlError(error.message || 'Failed to queue download');
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Youtube className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-semibold text-white">Submit YouTube URL</h2>
        </div>
        
        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">
            Video or Playlist URL
          </label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              {...register('url')}
              placeholder="https://youtube.com/watch?v=... or playlist?list=..."
              className="pl-10"
              disabled={isSubmitting}
            />
          </div>
          {(errors.url || urlError) && (
            <p className="text-sm text-red-500">
              {errors.url?.message || urlError}
            </p>
          )}
        </div>
        
        {/* Format Options */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Quality</label>
            <Select
              {...register('quality')}
              options={[
                { value: 'best', label: 'Best Available' },
                { value: '1080p', label: '1080p' },
                { value: '720p', label: '720p' },
                { value: '480p', label: '480p' }
              ]}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Format</label>
            <Select
              {...register('container')}
              options={[
                { value: 'mp4', label: 'MP4' },
                { value: 'mkv', label: 'MKV' }
              ]}
            />
          </div>
        </div>
        
        {/* Quota Display */}
        <div className="mt-6">
          <QuotaDisplay quota={userQuota} onRefresh={() => {}} />
        </div>
        
        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          className="w-full mt-6"
          disabled={!userQuota.canDownload || isSubmitting || isValidating}
          loading={isSubmitting}
        >
          <Download className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Queuing Download...' : 'Queue Download'}
        </Button>
        
        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Downloads will be automatically added to your Plex library when complete
        </p>
      </div>
    </form>
  );
}
```

### Metadata Preview Component

```typescript
// frontend/src/components/youtube/MetadataPreview.tsx
import Image from 'next/image';
import { Clock, Film, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDuration } from '@/lib/utils/time';

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
            className="rounded-lg"
          />
        </div>
        
        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white line-clamp-2">
            {metadata.title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            by {metadata.author}
          </p>
          
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
          {metadata.videoCount > 3 && (
            <p className="text-sm text-gray-500 mt-2">
              and {metadata.videoCount - 3} more...
            </p>
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
```

### Quota Display Component

```typescript
// frontend/src/components/youtube/QuotaDisplay.tsx
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/Progress';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function QuotaDisplay({ quota, onRefresh }: QuotaDisplayProps) {
  const percentage = (quota.used / quota.limit) * 100;
  const remaining = quota.limit - quota.used;
  
  return (
    <div className={clsx(
      'rounded-lg p-4',
      quota.canDownload ? 'bg-gray-700' : 'bg-red-900/20 border border-red-800'
    )}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          {!quota.canDownload && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          Download Quota
        </h3>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Refresh quota"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      <Progress value={percentage} className="mb-2" />
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {quota.used} / {quota.limit} downloads used
        </span>
        {!quota.canDownload && (
          <span className="text-red-400">
            Resets {formatDistanceToNow(quota.resetAt, { addSuffix: true })}
          </span>
        )}
      </div>
      
      {quota.canDownload ? (
        <p className="text-xs text-gray-500 mt-2">
          {remaining} download{remaining !== 1 ? 's' : ''} remaining
        </p>
      ) : (
        <p className="text-xs text-red-400 mt-2">
          Quota exceeded. Please wait for reset.
        </p>
      )}
    </div>
  );
}
```

### YouTube Validation Hook

```typescript
// frontend/src/hooks/useYouTubeValidation.ts
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { validateAndFetchMetadata } from '@/lib/api/youtube';
import { useDebounce } from '@/hooks/useDebounce';

export function useYouTubeValidation(url: string) {
  const debouncedUrl = useDebounce(url, 500);
  
  const { data: metadata, isLoading, error } = useQuery({
    queryKey: ['youtube', 'validate', debouncedUrl],
    queryFn: () => validateAndFetchMetadata(debouncedUrl),
    enabled: !!debouncedUrl && debouncedUrl.length > 10,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false
  });
  
  return {
    metadata,
    isValidating: isLoading,
    isValid: !!metadata && !error,
    error: error?.message
  };
}
```

### Main YouTube Downloader Component

```typescript
// frontend/src/components/youtube/YouTubeDownloader.tsx
import { useState } from 'react';
import { URLSubmissionForm } from './URLSubmissionForm';
import { MetadataPreview } from './MetadataPreview';
import { useYouTubeValidation } from '@/hooks/useYouTubeValidation';
import { useUserQuota } from '@/hooks/useUserQuota';
import { useYouTubeDownload } from '@/hooks/useYouTubeDownload';
import { useToast } from '@/hooks/useToast';

export function YouTubeDownloader({ onDownloadQueued }: YouTubeDownloaderProps) {
  const [currentUrl, setCurrentUrl] = useState('');
  const { quota, refetch: refetchQuota } = useUserQuota();
  const { metadata, isValidating } = useYouTubeValidation(currentUrl);
  const { queueDownload } = useYouTubeDownload();
  const { toast } = useToast();
  
  const handleSubmit = async (url: string, format: DownloadFormat) => {
    try {
      const download = await queueDownload(url, format);
      
      toast({
        title: 'Download Queued',
        description: `"${download.title}" has been added to the download queue.`,
        variant: 'success'
      });
      
      refetchQuota();
      onDownloadQueued(download);
      setCurrentUrl('');
    } catch (error) {
      toast({
        title: 'Queue Failed',
        description: error.message || 'Failed to queue download',
        variant: 'error'
      });
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <URLSubmissionForm
        onSubmit={handleSubmit}
        userQuota={quota}
      />
      
      {currentUrl && (
        <MetadataPreview
          metadata={metadata}
          isLoading={isValidating}
        />
      )}
      
      {/* Features Info */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Download individual videos or entire playlists</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Automatic organization into Plex collections</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>High quality video downloads (up to 4K when available)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Background processing with progress tracking</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Automatic metadata and thumbnail extraction</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

## API Integration

```typescript
// frontend/src/lib/api/youtube.ts
export async function validateAndFetchMetadata(url: string): Promise<YouTubeMetadata> {
  const response = await fetch('/api/youtube/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ url })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Invalid YouTube URL');
  }
  
  return response.json();
}

export async function queueYouTubeDownload(
  url: string, 
  format: DownloadFormat
): Promise<YouTubeDownloadRequest> {
  const response = await fetch('/api/youtube/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ url, format })
  });
  
  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      throw new Error('Download quota exceeded. Please try again later.');
    }
    throw new Error(error.message || 'Failed to queue download');
  }
  
  return response.json();
}
```

## Testing Requirements

1. **URL Validation**:
   - Valid video URLs accepted
   - Valid playlist URLs accepted
   - Invalid URLs rejected with error
   - Real-time validation feedback

2. **Quota Management**:
   - Quota display updates correctly
   - Submit disabled when quota exceeded
   - Reset timer shows accurate time

3. **Form Submission**:
   - Successful submissions queue downloads
   - Error handling for failed submissions
   - Form resets after successful submission

4. **Metadata Preview**:
   - Video metadata displays correctly
   - Playlist information shows video count
   - Loading state during validation

## Performance Considerations

1. **Debouncing**: 500ms delay on URL validation
2. **Caching**: Cache metadata for 5 minutes
3. **Optimistic Updates**: Update quota immediately
4. **Error Recovery**: Retry failed validations
5. **Progressive Enhancement**: Basic form works without JS

## Accessibility

- Form labels and ARIA attributes
- Keyboard navigation support
- Error announcements for screen readers
- Loading state announcements
- Focus management after submission

## Related Tasks

- Download Queue Visualization
- Progress Tracking Implementation
- Plex Collection Integration
- Admin Download Management