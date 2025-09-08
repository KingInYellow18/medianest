import { useQuery } from '@tanstack/react-query';

import { getUserQuota } from '@/lib/api/youtube';

export function useUserQuota() {
  const {
    data: quota,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['youtube', 'quota'],
    queryFn: getUserQuota,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Default quota if no data
  const defaultQuota = {
    used: 0,
    limit: 5,
    resetAt: new Date(Date.now() + 3600000), // 1 hour from now
    canDownload: true,
  };

  return {
    quota: quota || defaultQuota,
    isLoading,
    error,
    refetch,
  };
}
