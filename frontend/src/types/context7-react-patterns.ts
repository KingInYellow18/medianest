/**
 * Context7 React TypeScript Optimization Patterns
 * Based on Microsoft TypeScript and React TypeScript documentation
 */

import { ReactNode, ComponentProps, ElementType, ForwardedRef } from 'react';

// Context7 Pattern: Polymorphic Component Types
export interface PolymorphicComponentProps<T extends ElementType> {
  as?: T;
  children?: ReactNode;
}

export type PolymorphicRef<T extends ElementType> = ForwardedRef<
  T extends keyof HTMLElementTagNameMap
    ? HTMLElementTagNameMap[T]
    : T extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[T]
    : unknown
>;

export type PolymorphicProps<T extends ElementType> = PolymorphicComponentProps<T> &
  Omit<ComponentProps<T>, keyof PolymorphicComponentProps<T>>;

// Context7 Pattern: Strict Event Handler Types
export type StrictEventHandler<T extends HTMLElement, E extends Event = Event> = (
  event: E & { currentTarget: T; target: T }
) => void;

export type StrictClickHandler<T extends HTMLElement = HTMLButtonElement> = StrictEventHandler<
  T,
  MouseEvent
>;

export type StrictChangeHandler<T extends HTMLInputElement = HTMLInputElement> = StrictEventHandler<
  T,
  Event
> & { target: T & { value: string } };

// Context7 Pattern: Component Variant Types
export type ComponentVariant<T extends Record<string, string[]>> = {
  [K in keyof T]: T[K][number];
};

export type ButtonVariants = ComponentVariant<{
  variant: ['primary', 'secondary', 'destructive', 'outline', 'ghost'];
  size: ['sm', 'md', 'lg'];
}>;

export type InputVariants = ComponentVariant<{
  variant: ['default', 'error', 'success'];
  size: ['sm', 'md', 'lg'];
}>;

// Context7 Pattern: Controlled vs Uncontrolled Component Types
export type ControlledProps<T> = {
  value: T;
  onChange: (value: T) => void;
  defaultValue?: never;
};

export type UncontrolledProps<T> = {
  value?: never;
  onChange?: (value: T) => void;
  defaultValue?: T;
};

export type ControllableProps<T> = ControlledProps<T> | UncontrolledProps<T>;

// Context7 Pattern: Form Field Types with Validation
export interface FormFieldState<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
  valid: boolean;
}

export type FormFieldProps<T = string> = ControllableProps<T> & {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  'aria-describedby'?: string;
};

// Context7 Pattern: Advanced Hook Return Types
export interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UsePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

// Context7 Pattern: Generic Component Props with Constraints
export interface DataTableColumn<T extends Record<string, any>> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  width?: number;
  render?: (value: T[keyof T], item: T) => ReactNode;
}

export interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
}

// Context7 Pattern: Context Types with Better Inference
export interface MediaContextValue {
  requests: MediaRequest[];
  createRequest: (request: CreateMediaRequest) => Promise<void>;
  updateRequest: (id: string, updates: Partial<MediaRequest>) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

// Context7 Pattern: Component Ref Types
export type ComponentRef<T> = T extends React.ForwardRefExoticComponent<
  React.RefAttributes<infer R>
>
  ? R
  : never;

// Context7 Pattern: Render Props Pattern Types
export interface RenderPropsPattern<T> {
  children: (props: T) => ReactNode;
}

export interface QueryRenderProps<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Context7 Pattern: Higher-Order Component Types
export type WithLoadingProps = {
  loading?: boolean;
};

export type HOCProps<T, K> = T & K;

export function withLoading<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<HOCProps<P, WithLoadingProps>> {
  // Implementation would go here
  return Component as any;
}

// Context7 Pattern: Compound Component Pattern
export interface CompoundComponentAPI {
  Item: React.ComponentType<{ children: ReactNode }>;
  Header: React.ComponentType<{ children: ReactNode }>;
  Body: React.ComponentType<{ children: ReactNode }>;
  Footer: React.ComponentType<{ children: ReactNode }>;
}

// Context7 Pattern: Strict Prop Types for Common Patterns
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Context7 Pattern: Theme and Styling Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  neutral: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// Context7 Pattern: API Integration Types
export interface ApiHookConfig {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  retry?: number | ((failureCount: number, error: Error) => boolean);
}

export interface MutationOptions<TData, TError, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void;
}

// Context7 Pattern: Performance Optimized List Types
export interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

// Context7 Pattern: Type-Safe Router Types
export type RouteParams<T extends string> = T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param]: string } & RouteParams<Rest>
  : T extends `${infer _Start}:${infer Param}`
  ? { [K in Param]: string }
  : {};

export type MediaRoutes =
  | '/media'
  | '/media/requests'
  | `/media/requests/${string}`
  | '/media/plex'
  | '/media/youtube';

// Context7 Pattern: Generic Media Types
interface MediaRequest {
  id: string;
  type: 'movie' | 'tv' | 'youtube';
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

interface CreateMediaRequest {
  type: 'movie' | 'tv' | 'youtube';
  title: string;
  url?: string;
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface SignInCredentials {
  email: string;
  password: string;
}
