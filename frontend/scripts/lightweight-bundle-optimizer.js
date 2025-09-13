#!/usr/bin/env node

const fs = require('fs');
const path = require('path');


const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Create lightweight Next.js config focusing on essentials
const lightweightConfig = `/** @type {import('next').NextConfig} */
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
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            priority: 40,
            enforce: true,
          },
          vendor: {
            chunks: 'all',
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
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
`;

// Create lightweight component replacements
const lightweightComponents = `// Lightweight component replacements for better bundle size
import { ReactNode } from 'react';

// Lightweight loading components
export const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
);

export const LoadingCard = () => (
  <div className="animate-pulse bg-gray-200 rounded-lg h-48 w-full"></div>
);

// CSS-based animations instead of framer-motion for critical UI
export const FadeIn = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={\`animate-fade-in \${className}\`}>
    {children}
  </div>
);

export const SlideUp = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={\`animate-slide-up \${className}\`}>
    {children}
  </div>
);

// Lightweight icon component
export const SimpleIcon = ({ icon, className = '' }: { icon: string; className?: string }) => (
  <span className={\`inline-block \${className}\`} dangerouslySetInnerHTML={{ __html: icon }} />
);
`;

// Add CSS animations to replace framer-motion
const lightweightCSS = `/* Lightweight CSS animations to replace framer-motion */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { 
    opacity: 0;
    transform: translateY(20px); 
  }
  to { 
    opacity: 1;
    transform: translateY(0); 
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.4s ease-out;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;

function applyOptimization() {

  try {
    // 1. Backup current config if needed
    const currentConfig = 'next.config.js';
    const backupConfig = 'next.config.js.backup-lightweight';

    if (fs.existsSync(currentConfig) && !fs.existsSync(backupConfig)) {
      fs.copyFileSync(currentConfig, backupConfig);
    }

    // 2. Apply lightweight config
    fs.writeFileSync(currentConfig, lightweightConfig);

    // 3. Create lightweight components
    const componentDir = 'src/components/lightweight';
    if (!fs.existsSync(componentDir)) {
      fs.mkdirSync(componentDir, { recursive: true });
    }

    fs.writeFileSync(`${componentDir}/LightweightComponents.tsx`, lightweightComponents);

    // 4. Add CSS animations
    fs.writeFileSync('src/styles/lightweight-animations.css', lightweightCSS);


      `   1. Run: ${colors.yellow}npm run build${colors.reset} - Test build with optimizations`
    );

    return true;
  } catch (error) {
    return false;
  }
}

// Bundle size tips
function printOptimizationTips() {




}

// Main execution
if (require.main === module) {
  const success = applyOptimization();

  if (success) {
    printOptimizationTips();
      `\n${colors.green}${colors.bold}🎉 LIGHTWEIGHT OPTIMIZATION COMPLETE!${colors.reset}\n`
    );
  }
}

module.exports = { applyOptimization };
