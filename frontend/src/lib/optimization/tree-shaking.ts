/**
 * Tree Shaking Optimization Utilities
 *
 * This file contains optimized imports and utilities to improve tree shaking
 * and reduce bundle size by only importing what's actually used.
 */

// ========================================
// OPTIMIZED DATE-FNS IMPORTS
// Instead of: import { format, parseISO } from 'date-fns'
// Use specific imports to ensure better tree shaking
// ========================================

// Date formatting utilities
export { format } from 'date-fns/format';
export { parseISO } from 'date-fns/parseISO';
export { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
export { isToday } from 'date-fns/isToday';
export { isYesterday } from 'date-fns/isYesterday';
export { startOfDay } from 'date-fns/startOfDay';
export { endOfDay } from 'date-fns/endOfDay';
export { addDays } from 'date-fns/addDays';
export { subDays } from 'date-fns/subDays';

// ========================================
// OPTIMIZED LUCIDE-REACT IMPORTS
// Import only the icons we actually use
// ========================================

// Common UI icons
export {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Menu,
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Info,
  User,
  Settings,
  Home,
  LogOut,
  Download,
  Upload,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';

// Media & Entertainment icons
export {
  Play,
  Pause,
  Square as Stop, // Using Square icon as Stop replacement
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Film,
  Tv,
  Music,
  Image,
  Video,
  Camera,
} from 'lucide-react';

// File & Folder icons
export { File, Folder, FolderOpen, FileText, FileImage, FileVideo, FileAudio } from 'lucide-react';

// ========================================
// OPTIMIZED FRAMER-MOTION IMPORTS
// Import only the components and utilities we use
// ========================================

// Core animation components
export { motion, AnimatePresence } from 'framer-motion';

// Animation variants factory
export const createAnimationVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  },

  slideIn: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  },

  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  },

  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  },

  stagger: {
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
};

// ========================================
// OPTIMIZED REACT-HOOK-FORM IMPORTS
// ========================================

export { useForm, useController, useWatch, useFormState, Controller } from 'react-hook-form';

// Resolver imports (only what we use)
export { zodResolver } from '@hookform/resolvers/zod';

// ========================================
// OPTIMIZED ZOD IMPORTS
// ========================================

export { z, ZodError, ZodSchema } from 'zod';

// Common validation schemas
export const commonSchemas = {
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20),
  url: z.string().url('Invalid URL format'),
  nonEmptyString: z.string().min(1, 'This field is required'),
  positiveNumber: z.number().positive('Must be a positive number'),
  boolean: z.boolean(),
};

// ========================================
// OPTIMIZED AXIOS IMPORTS
// Use axios instances instead of importing the whole library
// ========================================

import axios from 'axios';

// Create optimized axios instances
export const apiClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const mediaClient = axios.create({
  timeout: 30000, // Longer timeout for media uploads
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// ========================================
// OPTIMIZED UTILITY FUNCTIONS
// Lightweight alternatives to heavy utility libraries
// ========================================

// Lightweight clsx alternative
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Lightweight debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Lightweight throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Lightweight deep merge function
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return result;
}

// ========================================
// BUNDLE SIZE MONITORING
// Development utility to track bundle impact
// ========================================

export const bundleMetrics = {
  // Track component render counts in development
  trackComponentRender: (componentName: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 Rendered: ${componentName}`);
    }
  },

  // Track dynamic imports
  trackDynamicImport: (moduleName: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Dynamic import: ${moduleName}`);
    }
  },

  // Warn about large imports
  warnLargeImport: (moduleName: string, estimatedSize: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Large import detected: ${moduleName} (~${estimatedSize})`);
    }
  },
};

// ========================================
// TREE-SHAKING HELPERS
// ========================================

// Conditional imports based on feature flags
export function createConditionalImport<T>(
  condition: boolean,
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T> | T {
  if (condition) {
    bundleMetrics.trackDynamicImport('conditional-import');
    return importFn();
  }
  return fallback as T;
}

// Size-aware dynamic imports
export async function importWithSizeWarning<T>(
  importFn: () => Promise<T>,
  moduleName: string,
  estimatedSize: string
): Promise<T> {
  bundleMetrics.warnLargeImport(moduleName, estimatedSize);
  bundleMetrics.trackDynamicImport(moduleName);
  return importFn();
}

// ========================================
// EXPORT OPTIMIZATION HELPERS
// ========================================

// Re-export commonly used utilities with better tree shaking
export { default as clsx } from 'clsx';
export { twMerge } from 'tailwind-merge';
export { cva, type VariantProps } from 'class-variance-authority';

// Optimized class name utility that combines clsx and twMerge
export function cx(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ========================================
// PERFORMANCE MONITORING
// ========================================

export const perfMonitor = {
  // Mark performance milestones
  mark: (label: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(label);
    }
  },

  // Measure performance between marks
  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const entry = performance.getEntriesByName(name)[0];
        if (entry) {
          console.log(`⏱️ ${name}: ${entry.duration.toFixed(2)}ms`);
        }
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }
  },
};
