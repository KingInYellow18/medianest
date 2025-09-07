'use client';

import { useState } from 'react';

import { useUserQuota } from '@/hooks/useUserQuota';
import { useYouTubeDownload } from '@/hooks/useYouTubeDownload';
import { useYouTubeValidation } from '@/hooks/useYouTubeValidation';
// Note: Using console.log for now - replace with proper toast implementation
import type { DownloadFormat, YouTubeDownloadRequest } from '@/types/youtube';

import { MetadataPreview } from './MetadataPreview';
import { URLSubmissionForm } from './URLSubmissionForm';

interface YouTubeDownloaderProps {
  onDownloadQueued?: (download: YouTubeDownloadRequest) => void;
}

export function YouTubeDownloader({ onDownloadQueued }: YouTubeDownloaderProps) {
  const [currentUrl, setCurrentUrl] = useState('');
  const { quota, refetch: refetchQuota } = useUserQuota();
  const { metadata, isValidating } = useYouTubeValidation(currentUrl);
  const { queueDownload } = useYouTubeDownload();

  const handleSubmit = async (url: string, format: DownloadFormat) => {
    try {
      const download = await queueDownload({ url, format });

      console.log('Download Queued:', `"${download.title}" has been added to the download queue.`);

      refetchQuota();
      onDownloadQueued?.(download);
      setCurrentUrl('');
    } catch (error: any) {
      console.error('Queue Failed:', error.message || 'Failed to queue download');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <URLSubmissionForm
        onSubmit={handleSubmit}
        userQuota={quota}
        onUrlChange={setCurrentUrl}
        onRefreshQuota={() => refetchQuota()}
      />

      {currentUrl && <MetadataPreview metadata={metadata || null} isLoading={isValidating} />}

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
