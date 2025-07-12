'use client';

import { useState } from 'react';

import { PlexBrowser } from '@/components/plex/PlexBrowser';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PlexPage() {
  const [selectedLibrary, setSelectedLibrary] = useState<string>();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Plex Library" description="Browse your media collection" />

      <PlexBrowser initialLibrary={selectedLibrary} onLibraryChange={setSelectedLibrary} />
    </div>
  );
}
