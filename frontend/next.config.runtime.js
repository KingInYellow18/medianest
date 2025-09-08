/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runtime optimizations
  experimental: {
    runtime: 'nodejs',
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt', 'sharp'],
    optimizeCss: true,
    optimizePackageImports: ['react-icons', '@tabler/icons-react', 'lucide-react'],
  },

  // Image optimization for performance
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compression and caching
  compress: true,
  poweredByHeader: false,

  // Headers for performance
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects optimization
  async redirects() {
    return [];
  },

  // Rewrites optimization
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
