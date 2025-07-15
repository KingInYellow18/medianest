'use client';

import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, ExternalLink, ArrowUpDown } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

import { MediaRequest } from '@/types/requests';
import { getExternalServiceUrls } from '@/config';

import { RequestDetails } from './RequestDetails';
import { RequestList } from './RequestList';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestTableProps {
  requests: MediaRequest[];
  isLoading: boolean;
  onRequestClick: (request: MediaRequest) => void;
  showRequester?: boolean;
  sortBy?: 'date' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: 'date' | 'title' | 'status') => void;
}

function RequestTableSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-7 h-10 bg-gray-700 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/4"></div>
              </div>
              <div className="h-6 bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestTable({
  requests,
  isLoading,
  onRequestClick,
  showRequester = false,
  sortBy = 'date',
  sortOrder: _sortOrder = 'desc',
  onSort,
}: RequestTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (requestId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <RequestTableSkeleton />;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-lg">No requests found</p>
        <p className="text-gray-500 text-sm mt-2">Start by searching for something to watch!</p>
      </div>
    );
  }

  const SortButton = ({ field }: { field: 'date' | 'title' | 'status' }) => (
    <button
      onClick={() => onSort?.(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      <span>{field === 'date' ? 'Requested' : field.charAt(0).toUpperCase() + field.slice(1)}</span>
      <ArrowUpDown
        className={clsx('w-3 h-3', {
          'text-blue-500': sortBy === field,
        })}
      />
    </button>
  );

  return (
    <div className="overflow-hidden bg-gray-800 rounded-lg">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="title" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="status" />
              </th>
              {showRequester && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Requested By
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="date" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {requests.map((request) => (
              <React.Fragment key={request.id}>
                <tr className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {request.posterPath && (
                        <div className="flex-shrink-0 h-10 w-7 mr-3">
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${request.posterPath}`}
                            alt=""
                            width={28}
                            height={40}
                            className="rounded"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-white">{request.title}</div>
                        {request.mediaType === 'tv' && request.seasons && (
                          <div className="text-xs text-gray-400">
                            {request.seasons.length} season{request.seasons.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300 capitalize">{request.mediaType}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  {showRequester && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {request.user?.plexUsername || `User ${request.userId.slice(0, 8)}`}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleRow(request.id)}
                      className="text-blue-500 hover:text-blue-400 mr-3"
                    >
                      {expandedRows.has(request.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {request.overseerrId && (
                      <a
                        href={`${getExternalServiceUrls().overseerr}/request/${request.overseerrId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>

                {/* Expanded Row */}
                {expandedRows.has(request.id) && (
                  <tr>
                    <td colSpan={showRequester ? 6 : 5} className="px-6 py-4 bg-gray-750">
                      <RequestDetails request={request} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden">
        <RequestList
          requests={requests}
          showRequester={showRequester}
          onRequestClick={onRequestClick}
        />
      </div>
    </div>
  );
}
