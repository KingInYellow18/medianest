/** @type {import('next').NextConfig} */
const nextConfig = {
  // PERFORMANCE OPTIMIZATION: Production-ready aggressive bundle optimization
  experimental: {
    // AGGRESSIVE TREE-SHAKING: Optimize package imports for 50%+ bundle reduction
    optimizePackageImports: [
      'lucide-react',
      '@headlessui/react', 
      'date-fns',
      '@tanstack/react-query',
      'framer-motion',
      'react-hook-form',
      '@hookform/resolvers',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'socket.io-client',
      'next-auth'
    ],
    // Enable experimental optimizations
    optimizeServerReact: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }

    // AGGRESSIVE OPTIMIZATION: Advanced webpack configuration for maximum bundle reduction
    config.optimization = {
      ...config.optimization,
      // CRITICAL: Aggressive code splitting to reduce main bundle from 7.3MB to <2MB
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 30, // Increased for more granular splitting
        maxAsyncRequests: 25,
        enforceSizeThreshold: 50000, // 50KB threshold for splitting
        cacheGroups: {
          // React/Next.js framework (highest priority)
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            maxSize: 150000, // 150KB max - React core
            priority: 30,
            enforce: true,
          },
          
          // Authentication libraries
          auth: {
            test: /[\\/]node_modules[\\/](next-auth|@auth)[\\/]/,
            name: 'auth',
            chunks: 'all', 
            maxSize: 80000, // 80KB max
            priority: 25,
            enforce: true,
          },

          // UI Component libraries
          ui: {
            test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react|framer-motion|@tanstack)[\\/]/,
            name: 'ui-libs',
            chunks: 'all',
            maxSize: 120000, // 120KB max
            priority: 20,
            enforce: true,
          },

          // Form handling
          forms: {
            test: /[\\/]node_modules[\\/](react-hook-form|@hookform)[\\/]/,
            name: 'forms',
            chunks: 'all',
            maxSize: 60000, // 60KB max
            priority: 18,
            enforce: true,
          },

          // Date/Time utilities  
          date: {
            test: /[\\/]node_modules[\\/](date-fns)[\\/]/,
            name: 'date-utils',
            chunks: 'all',
            maxSize: 50000, // 50KB max
            priority: 15,
            enforce: true,
          },

          // Socket.io
          websockets: {
            test: /[\\/]node_modules[\\/](socket\.io)[\\/]/,
            name: 'websockets',
            chunks: 'all',
            maxSize: 70000, // 70KB max
            priority: 12,
            enforce: true,
          },

          // All other vendor libraries
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 80000, // 80KB max per vendor chunk
            priority: 10,
            enforce: false,
          },

          // Common application code
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            maxSize: 60000, // 60KB max
            priority: 8,
            enforce: false,
          },

          // Default fallback
          default: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 40000, // 40KB max for defaults
          }
        },
      },
      
      // Enable advanced optimizations
      concatenateModules: true, // Webpack's "ModuleConcatenationPlugin"
      usedExports: true, // Enable tree shaking
      sideEffects: false, // Assume no side effects for better tree shaking
      
      // Additional size optimizations
      removeAvailableModules: true,
      removeEmptyChunks: true,
      mergeDuplicateChunks: true,
      flagIncludedChunks: true,
    };

    // Production-specific optimizations
    if (!config.devtool && process.env.NODE_ENV === 'production') {
      config.devtool = false; // No source maps in production
    }

    return config;
  },

  // Image optimization 
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.plex.direct' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Performance headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Aggressive caching for static assets
      {
        source: '/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:all*(js|css|woff|woff2|ttf|otf|svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  // Enable compression
  compress: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Output optimization
  output: 'standalone',

  // Fix workspace root warning
  outputFileTracingRoot: '/home/kinginyellow/projects/medianest',
};

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);