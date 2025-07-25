'use client';

import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

import { MediaRequest } from '@/types/requests';

import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestListProps {
  requests: MediaRequest[];
  showRequester?: boolean;
  onRequestClick: (request: MediaRequest) => void;
}

export function RequestList({ requests, showRequester, onRequestClick }: RequestListProps) {
  return (
    <div className="divide-y divide-gray-700">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onRequestClick(request)}
          className="p-4 hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            {request.posterPath && (
              <Image
                src={`https://image.tmdb.org/t/p/w92${request.posterPath}`}
                alt=""
                width={46}
                height={69}
                className="rounded flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">{request.title}</h3>

              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <span className="capitalize">{request.mediaType}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                </span>
              </div>

              {showRequester && (
                <p className="mt-1 text-xs text-gray-500">
                  Requested by {request.user?.plexUsername || `User ${request.userId.slice(0, 8)}`}
                </p>
              )}

              <div className="mt-2">
                <RequestStatusBadge status={request.status} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
