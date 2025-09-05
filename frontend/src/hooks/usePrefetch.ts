import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Prefetch common navigation paths
export function usePrefetch() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch common routes after initial load
    const prefetchTimeout = setTimeout(() => {
      // Only prefetch on good connections
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (
          connection.saveData ||
          connection.effectiveType === 'slow-2g' ||
          connection.effectiveType === '2g'
        ) {
          return;
        }
      }

      // Prefetch common routes
      router.prefetch('/dashboard');
      router.prefetch('/media');
      router.prefetch('/requests');
      router.prefetch('/plex/browse');
    }, 2000); // Wait 2 seconds after mount

    return () => clearTimeout(prefetchTimeout);
  }, [router]);
}

// Hook to prefetch on hover with delay
export function usePrefetchOnHover(href: string, delay = 100) {
  const router = useRouter();

  const handleMouseEnter = () => {
    const timeout = setTimeout(() => {
      router.prefetch(href);
    }, delay);

    return () => clearTimeout(timeout);
  };

  return { onMouseEnter: handleMouseEnter };
}
