import { type NextWebVitalsMetric } from 'next/app';

// Define thresholds for performance metrics (in milliseconds)
const THRESHOLDS = {
  FCP: 1800, // First Contentful Paint
  LCP: 2500, // Largest Contentful Paint
  FID: 100, // First Input Delay
  CLS: 0.1, // Cumulative Layout Shift
  TTFB: 800, // Time to First Byte
  INP: 200, // Interaction to Next Paint
};

// Log Web Vitals to console in development
function logWebVital(metric: NextWebVitalsMetric) {
  const threshold = THRESHOLDS[metric.name as keyof typeof THRESHOLDS];
  const isGood = threshold ? metric.value <= threshold : true;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Web Vital] ${metric.name}: ${metric.value.toFixed(2)}${
        metric.name === 'CLS' ? '' : 'ms'
      } ${isGood ? '✅' : '⚠️'}`,
    );
  }
}

// Send analytics to your analytics service
function sendToAnalytics(metric: NextWebVitalsMetric) {
  // You can send to Google Analytics, Plausible, or any other service
  // Example for Google Analytics:
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }

  // Or send to a custom endpoint when needed
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Log in development
  logWebVital(metric);

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    sendToAnalytics(metric);
  }

  // Special handling for specific metrics
  switch (metric.name) {
    case 'FCP':
      // First Contentful Paint
      break;
    case 'LCP':
      // Largest Contentful Paint - critical for user experience
      if (metric.value > THRESHOLDS.LCP) {
        console.warn('LCP is above recommended threshold');
      }
      break;
    case 'CLS':
      // Cumulative Layout Shift
      break;
    case 'FID':
      // First Input Delay
      break;
    case 'TTFB':
      // Time to First Byte
      break;
    case 'INP':
      // Interaction to Next Paint (replacing FID)
      break;
  }
}

// Type declarations for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      parameters: {
        value: number;
        event_category: string;
        event_label: string;
        non_interaction: boolean;
      },
    ) => void;
  }
}
