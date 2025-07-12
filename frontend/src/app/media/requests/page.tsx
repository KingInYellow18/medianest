'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Film, Tv, Calendar, Clock } from 'lucide-react';

import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { useRequestStatus } from '@/hooks/useRequestStatus';
import { getUserRequests } from '@/lib/api/requests';
import { MediaRequest } from '@/types/requests';

function RequestCard({ request }: { request: MediaRequest }) {
  useRequestStatus(request.id);

  const Icon = request.mediaType === 'movie' ? Film : Tv;
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-700 rounded-lg">
            <Icon className="w-6 h-6 text-gray-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{request.title}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(request.requestedAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(request.requestedAt).toLocaleTimeString()}
              </span>
            </div>
            {request.seasons && request.seasons.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Seasons: {request.seasons.map(s => s.seasonNumber).join(', ')}
              </div>
            )}
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
    </div>
  );
}

export default function UserRequestsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'available'>('all');
  
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests', 'user'],
    queryFn: getUserRequests,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['pending', 'approved', 'processing'].includes(request.status);
    if (filter === 'available') return request.status === 'available';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Requests</h1>
          <p className="text-gray-400">Track the status of your media requests</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Requests ({requests.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Pending ({requests.filter(r => ['pending', 'approved', 'processing'].includes(r.status)).length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'available'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Available ({requests.filter(r => r.status === 'available').length})
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading your requests...</p>
          </div>
        )}

        {/* Request List */}
        {!isLoading && filteredRequests.length > 0 && (
          <div className="space-y-4">
            {filteredRequests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              {filter === 'all'
                ? "You haven't made any requests yet"
                : `No ${filter} requests`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}