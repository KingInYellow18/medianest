// Lightweight component replacements for better bundle size
import { ReactNode } from 'react';

// Lightweight loading components
export const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
);

export const LoadingCard = () => (
  <div className="animate-pulse bg-gray-200 rounded-lg h-48 w-full"></div>
);

// CSS-based animations instead of framer-motion for critical UI
export const FadeIn = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`animate-fade-in ${className}`}>{children}</div>;

export const SlideUp = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`animate-slide-up ${className}`}>{children}</div>;

// Lightweight icon component
export const SimpleIcon = ({ icon, className = '' }: { icon: string; className?: string }) => (
  <span className={`inline-block ${className}`} dangerouslySetInnerHTML={{ __html: icon }} />
);
