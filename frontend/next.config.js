/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  typescript: {
    ignoreBuildErrors: false,
  },

  outputFileTracingRoot: path.join(__dirname, '../'),

  // Essential optimizations for <500KB target
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'clsx',
    ],
    optimizeServerReact: true,
  },

  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }

    // Lightweight code splitting
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /[\/]node_modules[\/](react|react-dom)[\/]/,
            priority: 40,
            enforce: true,
          },
          vendor: {
            chunks: 'all',
            name: 'vendor',
            test: /[\/]node_modules[\/]/,
            priority: 20,
            minSize: 20000,
          },
        },
      };
    }

    return config;
  },

  // SWC optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' 
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.plex.direct' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/webp'],
  },

  output: 'standalone',
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
