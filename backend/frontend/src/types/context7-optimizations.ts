/**
 * Context7 Optimization Types
 * Type definitions for performance optimization metadata and component props
 */

// Base optimization metadata interface
export interface RenderMetadata {
  componentName: string;
  renderCount: number;
  lastRenderTime: Date;
  averageRenderTime: number;
}

// Priority levels for component rendering
export type Priority = 'high' | 'medium' | 'low';

// Optimization hints interface
export interface OptimizationHints {
  priority?: Priority;
  cacheKey?: string;
  shouldMemoize?: boolean;
  renderStrategy?: 'immediate' | 'deferred' | 'lazy';
  dependencies?: string[];
}

// Base props interface with optimization metadata
export interface OptimizedProps<T = {}> {
  __optimization?: OptimizationHints;
  children?: T extends { children?: infer C } ? C : never;
}