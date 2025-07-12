'use client';

import { useState } from 'react';
import { RequestTable } from './RequestTable';
import { RequestDetailModal } from './RequestDetailModal';
import { Pagination } from '@/components/ui/Pagination';
import { useRequestHistory } from '@/hooks/useRequestHistory';
import { RequestFilters, MediaRequest } from '@/types/requests';
import { useSession } from 'next-auth/react';

interface RequestHistoryProps {
  filters: RequestFilters;
  isAdmin?: boolean;
  userId?: string;
}

export function RequestHistory({ filters, isAdmin, userId }: RequestHistoryProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRequest, setSelectedRequest] = useState<MediaRequest | null>(null);
  const { data: session } = useSession();

  const { requests, totalPages, isLoading } = useRequestHistory({
    userId,
    filters,
    page,
    pageSize: 20,
    sortBy,
    sortOrder
  });

  const handleRequestClick = (request: MediaRequest) => {
    setSelectedRequest(request);
  };

  const handleSort = (field: 'date' | 'title' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <RequestTable
          requests={requests}
          isLoading={isLoading}
          onRequestClick={handleRequestClick}
          showRequester={isAdmin || session?.user?.role === 'admin'}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  );
}