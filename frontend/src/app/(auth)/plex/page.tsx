'use client';

import { IconPlaylist } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { PlexBrowser } from '@/components/plex/PlexBrowser';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PlexPage() {
  const [selectedLibrary, setSelectedLibrary] = useState<string>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Plex Library" description="Browse your media collection" />
        <Link href="/plex/collections">
          <Button variant="secondary" className="flex items-center gap-2">
            <IconPlaylist size={20} />
            Browse Collections
          </Button>
        </Link>
      </div>

      <PlexBrowser initialLibrary={selectedLibrary} onLibraryChange={setSelectedLibrary} />
    </div>
  );
}
