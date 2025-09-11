/**
 * Component exports - Barrel file for cleaner imports
 * 
 * Usage:
 * import { UserManagement, ServiceStatus, Modal } from '@/components';
 * 
 * Or import specific categories:
 * import { UserManagement } from '@/components/admin';
 * import { Modal, ToastProvider } from '@/components/ui';
 */

// Admin components
export { UserManagement } from './admin';

// Dashboard components
export { ServiceStatus } from './dashboard';

// UI components
export { Modal, ToastProvider } from './ui';

// Form components
export { AdvancedForm } from './forms';

// Plex components
export { PlexDashboard, PlexCollectionManager, PlexLibraryBrowser } from './plex';

// Media components
export { MediaUploader, MediaViewer } from './media';

// Analytics components
export { AnalyticsChart } from './analytics';

// Realtime components
export { RealtimeStatus } from './realtime';

// Settings components
export { SettingsPanel } from './settings';

// Re-export everything from subdirectories for flexibility
export * from './admin';
export * from './dashboard';
export * from './ui';
export * from './forms';
export * from './plex';
export * from './media';
export * from './analytics';
export * from './realtime';
export * from './settings';