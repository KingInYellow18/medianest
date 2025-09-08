'use client';

import { PlexSearch } from '@/components/plex/PlexSearch';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PlexSearchPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="Search Plex Library"
          description="Search across your entire Plex collection"
        />
      </div>

      <PlexSearch />
    </div>
  );
}
