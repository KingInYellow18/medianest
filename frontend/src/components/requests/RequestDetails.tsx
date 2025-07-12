'use client';

import { format } from 'date-fns';
import { RequestStatusBadge } from './RequestStatusBadge';
import { MediaRequest } from '@/types/requests';

interface RequestDetailsProps {
  request: MediaRequest;
}

export function RequestDetails({ request }: RequestDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-1">Request Information</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Request ID:</dt>
              <dd className="text-white font-mono">{request.id.slice(0, 8)}...</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Requested:</dt>
              <dd className="text-white">{format(new Date(request.requestedAt), 'PPp')}</dd>
            </div>
            {request.approvedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Approved:</dt>
                <dd className="text-white">{format(new Date(request.approvedAt), 'PPp')}</dd>
              </div>
            )}
            {request.availableAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Available:</dt>
                <dd className="text-white">{format(new Date(request.availableAt), 'PPp')}</dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-1">Media Information</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Type:</dt>
              <dd className="text-white capitalize">{request.mediaType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">TMDB ID:</dt>
              <dd className="text-white font-mono">{request.mediaId}</dd>
            </div>
            {request.overseerrId && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Overseerr ID:</dt>
                <dd className="text-white font-mono">{request.overseerrId}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {request.mediaType === 'tv' && request.seasons && request.seasons.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Requested Seasons</h4>
          <div className="flex flex-wrap gap-2">
            {request.seasons.map((season) => (
              <div key={season.seasonNumber} className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Season {season.seasonNumber}</span>
                <RequestStatusBadge status={season.status} showLabel={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {request.deniedReason && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-1">Denial Reason</h4>
          <p className="text-sm text-red-400">{request.deniedReason}</p>
        </div>
      )}
    </div>
  );
}