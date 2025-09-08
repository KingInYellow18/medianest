import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Inter } from 'next/font/google';
<<<<<<< HEAD

import './globals.css';
import { Providers } from '@/components/providers';
=======
// Context7 Pattern: Dynamic import for better bundle splitting
>>>>>>> origin/develop

import './globals.css';

// Context7 Pattern: Lazy load providers for better initial page load
const Providers = dynamic(
  () => import('@/components/providers').then((mod) => ({ default: mod.Providers })),
  {
    ssr: true, // Keep SSR for critical providers
  }
);

// Context7 Pattern: Optimized font loading with preload
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true, // Context7: Preload critical fonts
  fallback: ['system-ui', 'arial'], // Context7: Better fallback fonts
});

// Context7 Pattern: Enhanced metadata for better SEO and performance
export const metadata: Metadata = {
  title: {
    template: '%s | MediaNest',
    default: 'MediaNest - Media Management Portal',
  },
  description: 'Unified media management portal for Plex and related services',
  keywords: ['media', 'plex', 'overseerr', 'streaming', 'management'],
  authors: [{ name: 'MediaNest Team' }],
  creator: 'MediaNest',
  // Context7 Pattern: Performance hints
  other: {
    'theme-color': '#000000',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
