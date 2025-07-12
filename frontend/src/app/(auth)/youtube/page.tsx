'use client';

import { useState } from 'react';

import { PageHeader } from '@/components/ui/PageHeader';
import { DownloadQueue } from '@/components/youtube/DownloadQueue';
import { YouTubeDownloader } from '@/components/youtube/YouTubeDownloader';

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState<'download' | 'queue'>('download');

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="YouTube Downloader"
        description="Download videos and playlists to your Plex library"
      />

      <div className="mt-6">
        {/* Tab Navigation */}
        <div className="grid w-full max-w-md grid-cols-2 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'download' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            New Download
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'queue' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Download Queue
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'download' && (
            <YouTubeDownloader onDownloadQueued={() => setActiveTab('queue')} />
          )}
          {activeTab === 'queue' && <DownloadQueue />}
        </div>
      </div>
    </div>
  );
}
