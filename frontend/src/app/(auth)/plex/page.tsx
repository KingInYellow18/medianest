'use client';

import { useState } from 'react';
import Link from 'next/link';

import { PlexBrowser } from '@/components/plex/PlexBrowser';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { IconPlaylist } from '@tabler/icons-react';

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
