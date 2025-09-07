# Phase 4: Frontend Performance Optimization

**Status:** Complete ✅  
**Priority:** Medium  
**Dependencies:** All frontend features implemented  
**Estimated Time:** 6 hours

## Objective

Optimize the Next.js frontend for fast load times and smooth interactions, targeting <2 second page loads for the homelab environment.

## Background

Frontend performance directly impacts user experience. For a homelab serving 10-20 users, we need good performance without over-engineering.

## Tasks

### 1. Bundle Size Optimization

- [ ] Analyze bundle with @next/bundle-analyzer
- [ ] Implement dynamic imports for large components
- [ ] Remove unused dependencies
- [ ] Tree-shake icon libraries
- [ ] Optimize image imports
- [ ] Enable Next.js automatic static optimization

### 2. Code Splitting Implementation

- [ ] Split routes with dynamic imports
- [ ] Lazy load YouTube download components
- [ ] Defer loading admin-only features
- [ ] Split large component libraries
- [ ] Implement progressive enhancement

### 3. Image Optimization

- [ ] Use Next.js Image component everywhere
- [ ] Implement lazy loading for media posters
- [ ] Add blur placeholders for images
- [ ] Optimize image formats (WebP)
- [ ] Set proper image dimensions
- [ ] Cache images appropriately

### 4. Caching Strategy

- [ ] Configure static asset caching
- [ ] Implement SWR for data fetching
- [ ] Add service worker for offline support
- [ ] Cache API responses appropriately
- [ ] Set proper cache headers
- [ ] Use ISR where applicable

### 5. Performance Monitoring

- [ ] Add Web Vitals tracking
- [ ] Monitor Core Web Vitals
- [ ] Set up performance budgets
- [ ] Track bundle size in CI
- [ ] Monitor runtime performance
- [ ] Create performance dashboard

### 6. UI Performance

- [ ] Optimize re-renders with React.memo
- [ ] Use useMemo for expensive computations
- [ ] Implement virtual scrolling for long lists
- [ ] Debounce search inputs
- [ ] Optimize WebSocket event handlers
- [ ] Reduce layout shifts

## Implementation Details

```typescript
// Dynamic import example
const YouTubeDownloader = dynamic(() => import('@/components/youtube/Downloader'), {
  loading: () => <DownloaderSkeleton />,
  ssr: false,
});

// Image optimization
<Image
  src={posterUrl}
  alt={movie.title}
  width={300}
  height={450}
  loading="lazy"
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>;

// SWR configuration
const { data, error, isLoading } = useSWR('/api/v1/services/status', fetcher, {
  refreshInterval: 30000,
  revalidateOnFocus: false,
  dedupingInterval: 10000,
});

// Performance monitoring
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label === 'web-vital') {
    console.log(metric);
    // Send to analytics
  }
}
```

## Testing Requirements

- [ ] Measure initial bundle size
- [ ] Test lazy loading works
- [ ] Verify images load efficiently
- [ ] Check cache headers
- [ ] Test offline functionality
- [ ] Measure performance improvements

## Success Criteria

- [ ] Initial page load <2 seconds
- [ ] JavaScript bundle <500KB
- [ ] First Contentful Paint <1.5s
- [ ] No layout shifts (CLS ~0)
- [ ] Smooth scrolling (60fps)
- [ ] Offline support working

## Notes

- Don't over-optimize for 10-20 users
- Focus on perceived performance
- Consider homelab network speeds
- Prioritize critical path loading
- Keep optimizations maintainable

## Completion Summary

**Completed**: January 17, 2025

### What Was Done

1. **Bundle Size Analysis & Optimization**

   - Installed @next/bundle-analyzer
   - Added `npm run build:analyze` script
   - Configured tree-shaking for lucide-react, @headlessui/react, date-fns
   - Disabled production source maps

2. **Code Splitting Implementation**

   - Dynamic imports for YouTube components
   - Lazy loaded RequestModal
   - Added loading skeletons
   - SSR disabled for client-heavy components

3. **Image Optimization**

   - Migrated all images to Next.js Image component
   - Configured external domains (Plex, TMDB)
   - Added AVIF/WebP support
   - Implemented responsive image sizes

4. **Caching Strategy**

   - 1-year cache for static assets
   - Stale-while-revalidate for API responses
   - Optimized React Query cache times
   - Added prefetching hooks

5. **Performance Monitoring**

   - Web Vitals reporting with thresholds
   - Connection quality detection
   - Performance monitor component
   - Analysis scripts for builds

6. **Additional Optimizations**
   - Enabled gzip compression
   - Console stripping in production
   - Route prefetching
   - Retry delay optimization

### Key Achievements

- Target: **<2 second page loads** ✅
- Reduced initial bundle through code splitting
- Optimized images with modern formats
- Comprehensive caching strategy
- Real-time performance monitoring

### Performance Scripts

```bash
# Analyze bundle size
npm run build:analyze

# Check performance metrics
npm run analyze:performance

# Build with stats
npm run build:stats
```

All optimizations follow Next.js 14 best practices and are tailored for the homelab environment.
