# Fix: Missing Frontend Component Files

## Test Failure Summary

- **Test File**: frontend/src/components/youtube/**tests**/DownloadQueue.test.tsx and others
- **Test Suite**: Frontend component tests
- **Test Case**: N/A - Import resolution failure
- **Failure Type**: Import Error - Missing Component Files
- **Priority**: High

## Error Details

```
Error: Failed to resolve import "../DownloadCard" from "frontend/src/components/youtube/__tests__/DownloadQueue.test.tsx". Does the file exist?
Error: Failed to resolve import "@medianest/shared/config" from various frontend files
```

## Root Cause Analysis

Multiple frontend test files are importing components that don't exist:

1. `DownloadCard` component is imported but not present in the youtube components directory
2. `@medianest/shared/config` is being imported but the shared package doesn't export a config module
3. Several other component imports are failing due to missing files

## Affected Code

```typescript
// File: frontend/src/components/youtube/__tests__/DownloadQueue.test.tsx
// Line: 6
import { DownloadCard } from '../DownloadCard'; // File doesn't exist

// Various frontend files attempting to import:
import { config } from '@medianest/shared/config'; // Module doesn't exist
```

## Suggested Fix

Create the missing component files and update imports to match the actual project structure.

### Code Changes Required:

1. Create `frontend/src/components/youtube/DownloadCard.tsx`:

```typescript
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, RotateCw, Trash2, Download, Clock, AlertCircle } from 'lucide-react';
import type { YouTubeDownload } from '@/types/youtube-queue';
import { formatBytes, formatDuration } from '@/lib/utils';

interface DownloadCardProps {
  download: YouTubeDownload;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function DownloadCard({
  download,
  onCancel,
  onRetry,
  onDelete
}: DownloadCardProps) {
  const getStatusColor = (status: YouTubeDownload['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'downloading':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: YouTubeDownload['status']) => {
    switch (status) {
      case 'downloading':
      case 'processing':
        return <Download className="h-4 w-4 animate-pulse" />;
      case 'pending':
      case 'queued':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium line-clamp-2">
              {download.metadata?.title || download.url}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={`${getStatusColor(download.status)} text-white`}
              >
                <span className="flex items-center gap-1">
                  {getStatusIcon(download.status)}
                  {download.status}
                </span>
              </Badge>
              {download.metadata?.duration && (
                <span className="text-sm text-muted-foreground">
                  {formatDuration(download.metadata.duration)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {download.status === 'downloading' && onCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(download.id)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {download.status === 'failed' && onRetry && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRetry(download.id)}
                className="h-8 w-8"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {['completed', 'failed', 'cancelled'].includes(download.status) && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(download.id)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {download.progress && download.progress > 0 && download.progress < 100 && (
          <div className="space-y-2">
            <Progress value={download.progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{download.progress}%</span>
              {download.metadata?.filesize && (
                <span>{formatBytes(download.metadata.filesize)}</span>
              )}
            </div>
          </div>
        )}
        {download.error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {download.error}
          </div>
        )}
        {download.metadata && (
          <div className="mt-2 text-sm text-muted-foreground">
            <div>{download.metadata.uploader}</div>
            {download.outputPath && (
              <div className="text-xs mt-1 truncate" title={download.outputPath}>
                {download.outputPath}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

2. Fix imports in test files - remove or update `@medianest/shared/config` imports:

```typescript
// Instead of importing from @medianest/shared/config
// Use actual constants from the shared package:
import { API_ENDPOINTS, RATE_LIMITS } from '@medianest/shared';
```

3. Update `shared/src/index.ts` to properly export all modules:

```typescript
// Ensure all exports are available
export * from './constants';
export * from './types';
export * from './errors';
export * from './utils';
```

## Testing Verification

- [ ] Run the specific test: `cd frontend && npm test src/components/youtube/__tests__/DownloadQueue.test.tsx`
- [ ] Verify no regression: `cd frontend && npm test`
- [ ] Check test coverage remains above threshold
- [ ] Ensure fix follows project patterns

## Additional Context

- Related files: Other frontend component tests may have similar import issues
- Dependencies: Ensure UI component library is properly installed
- Previous similar issues: This appears to be missing implementation files that tests expect
