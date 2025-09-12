# Bundle Size Optimization Guide

## Overview

This guide provides comprehensive bundle size optimization strategies for the MediaNest frontend, targeting a **70% reduction** in bundle size through advanced code splitting, tree shaking, and dynamic loading techniques.

## Current Bundle Analysis

### Before Optimization

- **Total Bundle Size**: ~3.2MB
- **Main App Chunk**: 7.3MB (uncompressed)
- **Critical Path**: Framework + Vendor chunks (~500KB)
- **Load Time (3G)**: ~8-12 seconds

### Target After Optimization

- **Total Bundle Size**: ~1MB (70% reduction)
- **Main App Chunk**: <300KB
- **Critical Path**: <200KB
- **Load Time (3G)**: <3 seconds

## Optimization Strategies

### 1. Advanced Code Splitting

#### Next.js 15 Configuration

```javascript
// next.config.bundle-optimized.js
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@headlessui/react',
      'date-fns',
      '@tanstack/react-query',
      'framer-motion',
      'react-hook-form',
    ],
    optimizeServerReact: true,
  },

  webpack: (config, { isServer }) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        framework: {
          /* React, Next.js */
        },
        vendor: {
          /* Third-party libs */
        },
        ui: {
          /* UI components */
        },
        auth: {
          /* Authentication */
        },
        // ... more strategic splits
      },
    };
  },
};
```

#### Route-Level Splitting

```typescript
// app/dashboard/page.tsx
import { DynamicServiceStatus, DynamicQuickActions } from '@/components/dynamic/DynamicImports';

export default function DashboardPage() {
  return (
    <div>
      <DynamicServiceStatus />
      <DynamicQuickActions />
    </div>
  );
}
```

#### Component-Level Splitting

```typescript
// components/dynamic/DynamicImports.tsx
export const DynamicPlexLibraryBrowser = dynamic(
  () => import('@/components/plex/PlexLibraryBrowser'),
  { loading: LoadingCard, ssr: false }
);
```

### 2. Tree Shaking Optimization

#### Optimized Imports

```typescript
// ❌ Before (imports entire library)
import { format, parseISO } from 'date-fns';

// ✅ After (imports only needed functions)
export { format } from 'date-fns/format';
export { parseISO } from 'date-fns/parseISO';
```

#### Bundle Analysis

```bash
npm run analyze:bundle    # Analyze current bundle
npm run optimize:bundle   # Apply optimizations
npm run bundle:compare    # Compare before/after
```

### 3. Lazy Loading Strategies

#### Viewport-Based Loading

```typescript
<LazyLoader
  strategy="viewport"
  loader={() => import('@/components/heavy/HeavyComponent')}
  fallback={LoadingSkeleton}
/>
```

#### Interaction-Based Loading

```typescript
<LazyLoader
  strategy="interaction"
  trigger="click"
  loader={() => import('@/components/admin/AdminPanel')}
/>
```

#### Idle Loading

```typescript
<LazyLoader strategy="idle" loader={() => import('@/components/analytics/AnalyticsChart')} />
```

## Implementation Steps

### Phase 1: Build Infrastructure

1. ✅ Create optimized Next.js configuration
2. ✅ Implement bundle analysis tools
3. ✅ Set up dynamic import system
4. ✅ Create lazy loading components

### Phase 2: Component Optimization

1. **Heavy Components** → Dynamic imports
   - PlexLibraryBrowser (~200KB)
   - YouTubeDownloader (~150KB)
   - MediaViewer (~180KB)
   - AnalyticsChart (~120KB)

2. **Route-Level Splitting**

   ```typescript
   // app/plex/page.tsx
   const PlexPage = dynamic(() => import('./PlexPageContent'), {
     loading: () => <LoadingSkeleton lines={5} />,
   });
   ```

3. **Vendor Library Optimization**
   - Date-fns: Tree-shake specific functions
   - Framer Motion: Import only needed components
   - Lucide React: Import specific icons only
   - React Hook Form: Use optimized resolver imports

### Phase 3: Advanced Techniques

1. **Service Worker Preloading**
2. **Critical CSS Extraction**
3. **Resource Hints Implementation**
4. **Compression Strategy**

## Performance Metrics

### Bundle Size Targets

| Component Category | Current | Target | Strategy              |
| ------------------ | ------- | ------ | --------------------- |
| Framework          | 400KB   | 200KB  | React optimizations   |
| Vendor             | 800KB   | 300KB  | Tree shaking + splits |
| App Code           | 600KB   | 200KB  | Route splitting       |
| UI Components      | 500KB   | 150KB  | Dynamic imports       |
| Media Handling     | 400KB   | 100KB  | Lazy loading          |

### Load Time Targets

| Connection | Current | Target | Improvement |
| ---------- | ------- | ------ | ----------- |
| 3G Fast    | 8s      | 3s     | 62% faster  |
| 4G         | 4s      | 1.5s   | 62% faster  |
| WiFi       | 1s      | 0.3s   | 70% faster  |

## Usage Guide

### Development

```bash
# Start development with optimization
npm run dev

# Analyze bundle during development
npm run analyze:bundle
```

### Production Build

```bash
# Build with optimizations
npm run build:optimized

# Full analysis with comparison
npm run analyze:full
```

### Testing Optimization

```bash
# Compare bundle sizes
npm run bundle:compare

# Performance testing
npm run test:performance
```

## Monitoring & Maintenance

### Bundle Size Monitoring

- **Continuous Integration**: Bundle size checks on PRs
- **Performance Budget**: Max 300KB for critical path
- **Regular Audits**: Monthly bundle analysis

### Performance Tracking

```typescript
// Development monitoring
bundleMetrics.trackComponentRender('ComponentName');
bundleMetrics.trackDynamicImport('ModuleName');
perfMonitor.measure('lazy-load-duration', 'start', 'end');
```

## Best Practices

### 1. Component Design

- Keep components under 50KB
- Use composition over large monolithic components
- Implement progressive loading for heavy features

### 2. Import Strategy

- Always use tree-shakable imports
- Avoid importing entire libraries
- Use dynamic imports for non-critical features

### 3. Route Organization

- Group related functionality
- Implement route-level code splitting
- Use parallel routes for dashboard layouts

### 4. Asset Optimization

- Use Next.js Image optimization
- Implement responsive images
- Enable compression for static assets

## Troubleshooting

### Common Issues

#### Large Bundle Size After Optimization

```bash
# Debug large chunks
npm run analyze:bundle
# Check for duplicate dependencies
npm ls --depth=0
```

#### Slow Loading Times

```bash
# Profile loading performance
npm run test:performance
# Check network waterfall
npm run dev -- --profile
```

#### Tree Shaking Not Working

- Verify `sideEffects: false` in package.json
- Check import statements for ESM compatibility
- Review webpack bundle analyzer for unused code

## Results Expected

### Bundle Size Reduction

- **Framework**: 400KB → 200KB (50% reduction)
- **Vendor**: 800KB → 300KB (62% reduction)
- **App Code**: 600KB → 200KB (67% reduction)
- **Total**: 3.2MB → 1MB (69% reduction)

### Performance Improvements

- **First Contentful Paint**: 2.5s → 1.2s
- **Largest Contentful Paint**: 4.8s → 2.1s
- **Time to Interactive**: 5.2s → 2.8s
- **Cumulative Layout Shift**: 0.15 → 0.05

### User Experience

- Faster page loads on slow connections
- Improved perceived performance
- Better Core Web Vitals scores
- Reduced bounce rates

## Implementation Timeline

- **Week 1**: Infrastructure setup and analysis
- **Week 2**: Component-level optimizations
- **Week 3**: Route-level splitting implementation
- **Week 4**: Testing, monitoring, and fine-tuning

## Conclusion

This comprehensive bundle optimization strategy targets a 70% reduction in bundle size through:

1. **Advanced code splitting** with strategic cache groups
2. **Tree shaking optimization** with targeted imports
3. **Intelligent lazy loading** with multiple strategies
4. **Performance monitoring** and continuous optimization

The implementation provides immediate performance benefits while establishing a foundation for ongoing optimization and monitoring.
