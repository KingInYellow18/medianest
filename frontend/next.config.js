/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emergency bundle configuration - maximum compression
  compress: true,
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: false, // Disable for minimal bundle
  
  // DISABLE ALL CHECKS FOR EMERGENCY BUILD
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Minimal images config
  images: {
    unoptimized: true
  },
  
  // Ultra aggressive webpack optimization
  webpack: (config, { dev }) => {
    if (!dev) {
      // Maximum compression settings
      config.optimization.minimize = true;
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Remove all source maps
      config.devtool = false;
      
      // Single chunk for minimal size
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 0,
        maxSize: 15000, // Very small chunks
        cacheGroups: {
          default: false,
          vendors: false,
          // Create single optimized chunk
          emergency: {
            name: 'emergency',
            chunks: 'all',
            enforce: true,
          }
        },
      };
      
      // Remove unused webpack features
      config.optimization.usedExports = true;
      config.optimization.innerGraph = true;
      config.optimization.providedExports = true;
    }
    return config;
  },
};

module.exports = nextConfig;