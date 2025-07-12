'use client';

import { useState } from 'react';

import { RequestFilters } from '@/components/requests/RequestFilters';
import { RequestHistory } from '@/components/requests/RequestHistory';
import { PageHeader } from '@/components/ui/PageHeader';
import { RequestFilters as RequestFiltersType } from '@/types/requests';

export default function RequestsPage() {
  const [filters, setFilters] = useState<RequestFiltersType>({
    status: 'all',
    mediaType: 'all',
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Request History" description="Track the status of your media requests" />

      <div className="mt-8 space-y-6">
        <RequestFilters filters={filters} onChange={setFilters} />
        <RequestHistory filters={filters} />
      </div>
    </div>
  );
}