// Ultra-optimized dynamic imports for bundle splitting
import dynamic from 'next/dynamic';
import { ComponentType, lazy } from 'react';

// Micro-loading components
const MicroLoadingSpinner = () => <div className="animate-pulse bg-gray-200 rounded h-4 w-24" />;

const MicroLoadingCard = () => <div className="animate-pulse bg-gray-200 rounded-lg h-48 w-full" />;

// Aggressive dynamic imports with micro-loading states
export const DynamicPlexCard = dynamic(() => import('../dashboard/cards/PlexCard'), {
  loading: MicroLoadingCard,
  ssr: false, // Client-side only for heavy components
});

export const DynamicOverseerrCard = dynamic(() => import('../dashboard/cards/OverseerrCard'), {
  loading: MicroLoadingCard,
  ssr: false,
});

export const DynamicUptimeKumaCard = dynamic(() => import('../dashboard/cards/UptimeKumaCard'), {
  loading: MicroLoadingCard,
  ssr: false,
});

// Motion components - lazy load
export const DynamicMotion = {
  div: dynamic(() => import('framer-motion').then((mod) => ({ default: mod.motion.div })), {
    loading: () => <div />,
    ssr: false,
  }),
  button: dynamic(() => import('framer-motion').then((mod) => ({ default: mod.motion.button })), {
    loading: () => <button />,
    ssr: false,
  }),
  span: dynamic(() => import('framer-motion').then((mod) => ({ default: mod.motion.span })), {
    loading: () => <span />,
    ssr: false,
  }),
};

// Icon components - lazy load specific icons only
export const DynamicIcons = {
  Search: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.Search })), {
    loading: MicroLoadingSpinner,
    ssr: true,
  }),
  Settings: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.Settings })), {
    loading: MicroLoadingSpinner,
    ssr: true,
  }),
  User: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.User })), {
    loading: MicroLoadingSpinner,
    ssr: true,
  }),
  Home: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.Home })), {
    loading: MicroLoadingSpinner,
    ssr: true,
  }),
  Play: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.Play })), {
    loading: MicroLoadingSpinner,
    ssr: false,
  }),
  Pause: dynamic(() => import('lucide-react').then((mod) => ({ default: mod.Pause })), {
    loading: MicroLoadingSpinner,
    ssr: false,
  }),
};

// Form components - heavy, load on demand
export const DynamicFormComponents = {
  AdvancedForm: dynamic(() => import('../forms/AdvancedForm'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
  MediaUploader: dynamic(() => import('../media/MediaUploader'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
  RequestModal: dynamic(() => import('../media/RequestModal'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
};

// Chart components - heavy, client-side only
export const DynamicCharts = {
  AnalyticsChart: dynamic(() => import('../analytics/AnalyticsChart'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
  MetricsChart: dynamic(() => import('../charts/MetricsChart'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
};

// Admin components - heavy, authenticated only
export const DynamicAdmin = {
  AdminPanel: dynamic(() => import('../admin/AdminPanel'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
  UserManagement: dynamic(() => import('../admin/UserManagement'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
  SettingsPanel: dynamic(() => import('../settings/SettingsPanel'), {
    loading: MicroLoadingCard,
    ssr: false,
  }),
};

export default {
  DynamicPlexCard,
  DynamicOverseerrCard,
  DynamicUptimeKumaCard,
  DynamicMotion,
  DynamicIcons,
  DynamicFormComponents,
  DynamicCharts,
  DynamicAdmin,
};
