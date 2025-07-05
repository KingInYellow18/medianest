# MediaNest Frontend Architecture Guide

**Version:** 1.0  
**Date:** January 2025  
**Status:** Implementation Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Project Structure](#3-project-structure)
4. [Component Architecture](#4-component-architecture)
5. [State Management Strategy](#5-state-management-strategy)
6. [Routing & Navigation](#6-routing--navigation)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Data Fetching Patterns](#8-data-fetching-patterns)
9. [UI/UX Implementation](#9-uiux-implementation)
10. [Performance Optimization](#10-performance-optimization)
11. [Testing Strategy](#11-testing-strategy)
12. [Development Workflow](#12-development-workflow)

## 1. Overview

This guide provides comprehensive implementation details for the MediaNest frontend, built with Next.js 14+ App Router, React 18, and Tailwind CSS. It serves as the primary reference for developers implementing frontend features.

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3.x
- **State Management**: Zustand (client state) + TanStack Query v5 (server state)
- **Authentication**: NextAuth.js v5
- **Real-time**: Socket.io Client
- **Forms**: React Hook Form + Zod
- **Testing**: Jest, React Testing Library, Playwright

## 2. Architecture Philosophy

### Core Principles

1. **Server-First Approach**
   - Leverage Server Components for initial data fetching
   - Minimize client-side JavaScript bundle
   - Progressive enhancement for interactivity

2. **Component Composition**
   - Small, focused components
   - Clear separation between smart and presentational components
   - Shared component library for consistency

3. **Type Safety**
   - TypeScript throughout the codebase
   - Zod schemas for runtime validation
   - Strict type checking enabled

4. **Performance by Default**
   - Lazy loading and code splitting
   - Optimistic UI updates
   - Image optimization with Next.js Image

## 3. Project Structure

```
frontend/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth-required routes
│   │   ├── dashboard/       # Dashboard pages
│   │   ├── media/           # Media browsing
│   │   ├── requests/        # Request management
│   │   └── youtube/         # YouTube downloads
│   ├── (public)/            # Public routes
│   │   ├── login/           # Login page
│   │   └── docs/            # Documentation
│   ├── admin/               # Admin routes (role-protected)
│   ├── api/                 # API route handlers
│   ├── layout.tsx           # Root layout
│   ├── error.tsx            # Error boundary
│   └── providers.tsx        # Client providers
├── components/
│   ├── ui/                  # Base UI components
│   │   ├── button/
│   │   ├── card/
│   │   ├── modal/
│   │   └── form/
│   ├── features/            # Feature-specific components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── media/
│   │   └── youtube/
│   └── shared/              # Shared components
│       ├── navigation/
│       ├── layout/
│       └── feedback/
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions
│   ├── api/                 # API client functions
│   ├── auth/                # Auth utilities
│   ├── utils/               # General utilities
│   └── validation/          # Zod schemas
├── services/                # External service integrations
│   ├── plex/
│   ├── overseerr/
│   └── socket/
├── stores/                  # Zustand stores
├── styles/                  # Global styles
└── types/                   # TypeScript types
```

## 4. Component Architecture

### 4.1 Component Patterns

#### Server Components (Default)
```tsx
// app/(auth)/dashboard/page.tsx
import { getServerSession } from 'next-auth';
import { DashboardStats } from '@/components/features/dashboard/dashboard-stats';
import { ServiceStatus } from '@/components/features/dashboard/service-status';

export default async function DashboardPage() {
  const session = await getServerSession();
  const stats = await fetchDashboardStats(session.user.id);
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <DashboardStats initialData={stats} />
      <ServiceStatus />
    </div>
  );
}
```

#### Client Components
```tsx
// components/features/dashboard/service-status.tsx
'use client';

import { useServiceStatus } from '@/hooks/use-service-status';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ServiceStatus() {
  const { data: services, isLoading } = useServiceStatus();
  
  if (isLoading) return <ServiceStatusSkeleton />;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {services?.map((service) => (
        <Card key={service.id} className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{service.name}</h3>
            <Badge variant={service.status === 'up' ? 'success' : 'destructive'}>
              {service.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Uptime: {service.uptimePercentage}%
          </p>
        </Card>
      ))}
    </div>
  );
}
```

### 4.2 Component Composition Guidelines

1. **Container/Presentational Pattern**
   ```tsx
   // Container Component (handles logic)
   export function MediaRequestContainer() {
     const { data, submit } = useMediaRequest();
     return <MediaRequestForm onSubmit={submit} />;
   }
   
   // Presentational Component (pure UI)
   export function MediaRequestForm({ onSubmit }: Props) {
     return <form>...</form>;
   }
   ```

2. **Compound Components**
   ```tsx
   // components/ui/card/index.tsx
   export const Card = ({ children, className }: CardProps) => {
     return <div className={cn("rounded-lg border", className)}>{children}</div>;
   };
   
   Card.Header = CardHeader;
   Card.Content = CardContent;
   Card.Footer = CardFooter;
   ```

3. **Render Props Pattern**
   ```tsx
   export function DataTable<T>({ 
     data, 
     columns,
     renderRow 
   }: DataTableProps<T>) {
     return (
       <table>
         <tbody>
           {data.map((item, index) => renderRow(item, index))}
         </tbody>
       </table>
     );
   }
   ```

## 5. State Management Strategy

### 5.1 State Categories

| State Type | Solution | Use Case |
|------------|----------|----------|
| Server State | TanStack Query | API data, caching |
| Client State | Zustand | UI state, user preferences |
| Form State | React Hook Form | Form inputs, validation |
| URL State | Next.js Router | Filters, pagination |

### 5.2 TanStack Query Setup

```tsx
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          gcTime: 5 * 60 * 1000, // 5 minutes
          refetchOnWindowFocus: false,
          retry: (failureCount, error: any) => {
            if (error?.status === 404) return false;
            return failureCount < 3;
          },
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 5.3 Zustand Store Example

```tsx
// stores/ui-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: UIState['theme']) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        theme: 'system',
        toggleSidebar: () => set((state) => ({ 
          sidebarOpen: !state.sidebarOpen 
        })),
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'ui-preferences',
        partialize: (state) => ({ theme: state.theme }),
      }
    )
  )
);
```

### 5.4 Data Fetching Patterns

#### Server Component Data Fetching
```tsx
// app/(auth)/media/page.tsx
import { getMedia } from '@/lib/api/media';

export default async function MediaPage() {
  const media = await getMedia();
  
  return <MediaGrid initialData={media} />;
}
```

#### Client Component with TanStack Query
```tsx
// hooks/use-media.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '@/lib/api/media';

export function useMedia() {
  return useQuery({
    queryKey: ['media'],
    queryFn: mediaApi.getAll,
  });
}

export function useRequestMedia() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: mediaApi.request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => {
      toast.error('Failed to request media');
    },
  });
}
```

## 6. Routing & Navigation

### 6.1 Route Organization

```
app/
├── (auth)/                    # Requires authentication
│   ├── layout.tsx            # Auth check wrapper
│   ├── dashboard/
│   ├── media/
│   │   ├── page.tsx          # Media list
│   │   └── [id]/             # Media details
│   │       └── page.tsx
│   └── requests/
│       ├── page.tsx          # Request list
│       └── new/              # New request
│           └── page.tsx
├── (public)/                  # No auth required
│   ├── login/
│   └── docs/
└── admin/                     # Admin only
    ├── layout.tsx            # Role check
    └── users/
```

### 6.2 Navigation Component

```tsx
// components/shared/navigation/main-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/media', label: 'Browse Media', icon: FilmIcon },
  { href: '/requests', label: 'My Requests', icon: InboxIcon },
  { href: '/youtube', label: 'YouTube Downloads', icon: DownloadIcon },
];

export function MainNav() {
  const pathname = usePathname();
  
  return (
    <nav className="flex flex-col space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground font-medium"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

### 6.3 Protected Routes

```tsx
// app/(auth)/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }
  
  return <>{children}</>;
}
```

## 7. Authentication & Authorization

### 7.1 NextAuth.js Configuration

```tsx
// lib/auth/config.ts
import { NextAuthOptions } from 'next-auth';
import { PlexProvider } from './plex-provider';

export const authOptions: NextAuthOptions = {
  providers: [
    PlexProvider({
      clientId: process.env.PLEX_CLIENT_ID!,
      clientSecret: process.env.PLEX_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.plexId = user.plexId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.plexId = token.plexId as string;
      session.user.role = token.role as 'user' | 'admin';
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login?error=Authentication failed',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
```

### 7.2 Plex OAuth Implementation

```tsx
// components/features/auth/plex-login.tsx
'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function PlexLogin() {
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const initiatePlexAuth = async () => {
    setLoading(true);
    
    try {
      // Request PIN from backend
      const response = await fetch('/api/auth/plex/pin', {
        method: 'POST',
      });
      
      const { pin, id } = await response.json();
      setPin(pin);
      
      // Poll for authorization
      const pollInterval = setInterval(async () => {
        const authResponse = await fetch(`/api/auth/plex/check/${id}`);
        const { authorized, authToken } = await authResponse.json();
        
        if (authorized) {
          clearInterval(pollInterval);
          await signIn('plex', { authToken, callbackUrl: '/dashboard' });
        }
      }, 2000);
      
      // Cleanup after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (error) {
      toast.error('Failed to initiate Plex authentication');
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md p-6">
      <h2 className="text-2xl font-bold mb-4">Sign in with Plex</h2>
      
      {!pin ? (
        <Button 
          onClick={initiatePlexAuth} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Initializing...' : 'Connect with Plex'}
        </Button>
      ) : (
        <div className="space-y-4">
          <p className="text-center">
            Visit <strong>plex.tv/link</strong> and enter:
          </p>
          <div className="text-4xl font-mono text-center bg-muted p-4 rounded">
            {pin}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Waiting for authorization...
          </p>
        </div>
      )}
    </Card>
  );
}
```

### 7.3 Role-Based Access Control

```tsx
// components/shared/auth/role-guard.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleGuardProps {
  allowedRoles: Array<'user' | 'admin'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback 
}: RoleGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || !allowedRoles.includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [session, status, allowedRoles, router]);
  
  if (status === 'loading') {
    return fallback || <LoadingSpinner />;
  }
  
  if (!session || !allowedRoles.includes(session.user.role)) {
    return null;
  }
  
  return <>{children}</>;
}
```

## 8. Data Fetching Patterns

### 8.1 API Client Setup

```tsx
// lib/api/client.ts
import { getSession } from 'next-auth/react';

class ApiClient {
  private baseURL: string;
  
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';
  }
  
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const session = await getSession();
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.accessToken && {
          Authorization: `Bearer ${session.accessToken}`,
        }),
        ...options.headers,
      },
    };
    
    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.message, response.status, error.code);
    }
    
    return response.json();
  }
  
  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  
  post<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  put<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### 8.2 Service Integration Example

```tsx
// services/overseerr/client.ts
import { apiClient } from '@/lib/api/client';
import { MediaRequest, MediaSearchResult } from '@/types/media';

export class OverseerrService {
  async searchMedia(query: string): Promise<MediaSearchResult[]> {
    return apiClient.get(`/media/search?q=${encodeURIComponent(query)}`);
  }
  
  async requestMedia(mediaId: string, type: 'movie' | 'tv'): Promise<MediaRequest> {
    return apiClient.post('/media/request', { mediaId, type });
  }
  
  async getRequests(userId?: string): Promise<MediaRequest[]> {
    const params = userId ? `?userId=${userId}` : '';
    return apiClient.get(`/media/requests${params}`);
  }
  
  async getRequestStatus(requestId: string): Promise<MediaRequest> {
    return apiClient.get(`/media/requests/${requestId}`);
  }
}

export const overseerrService = new OverseerrService();
```

### 8.3 Real-time Updates with Socket.io

```tsx
// hooks/use-socket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export function useSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    if (!session?.accessToken) return;
    
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: {
        token: session.accessToken,
      },
    });
    
    socketInstance.on('connect', () => {
      setConnected(true);
    });
    
    socketInstance.on('disconnect', () => {
      setConnected(false);
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, [session?.accessToken]);
  
  return { socket, connected };
}

// Usage in component
export function ServiceStatusMonitor() {
  const { socket, connected } = useSocket();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!socket || !connected) return;
    
    socket.on('service:status', (data) => {
      queryClient.setQueryData(['services'], (old: Service[]) => {
        return old?.map(service => 
          service.id === data.serviceId 
            ? { ...service, ...data }
            : service
        );
      });
    });
    
    return () => {
      socket.off('service:status');
    };
  }, [socket, connected, queryClient]);
  
  // Component render...
}
```

## 9. UI/UX Implementation

### 9.1 Design System

#### Color Palette
```css
/* styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

### 9.2 Component Library

#### Button Component
```tsx
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### 9.3 Form Components

```tsx
// components/features/media/request-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestMedia } from '@/hooks/use-media';

const requestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['movie', 'tv']),
  tmdbId: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export function MediaRequestForm() {
  const { mutate: requestMedia, isPending } = useRequestMedia();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });
  
  const onSubmit = async (data: RequestFormData) => {
    requestMedia(data, {
      onSuccess: () => {
        toast.success('Media requested successfully');
        reset();
      },
    });
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="Enter movie or TV show title"
        />
        {errors.title && (
          <p className="text-sm text-destructive mt-1">
            {errors.title.message}
          </p>
        )}
      </div>
      
      <div>
        <Label htmlFor="type">Type</Label>
        <Select {...register('type')}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="movie">Movie</SelectItem>
            <SelectItem value="tv">TV Show</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Requesting...' : 'Request Media'}
      </Button>
    </form>
  );
}
```

### 9.4 Dark Mode Implementation

```tsx
// components/shared/theme/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ 
  children,
  ...props 
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

// components/shared/theme/theme-toggle.tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

## 10. Performance Optimization

### 10.1 Image Optimization

```tsx
// components/shared/media/media-poster.tsx
import Image from 'next/image';
import { useState } from 'react';

interface MediaPosterProps {
  title: string;
  posterPath: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { width: 185, height: 278 },
  md: { width: 342, height: 513 },
  lg: { width: 500, height: 750 },
};

export function MediaPoster({ 
  title, 
  posterPath, 
  size = 'md' 
}: MediaPosterProps) {
  const [hasError, setHasError] = useState(false);
  const { width, height } = sizeMap[size];
  
  return (
    <div className="relative overflow-hidden rounded-lg bg-muted">
      {!hasError ? (
        <Image
          src={`https://image.tmdb.org/t/p/w${width}${posterPath}`}
          alt={title}
          width={width}
          height={height}
          className="object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
        />
      ) : (
        <div 
          className="flex items-center justify-center bg-muted"
          style={{ width, height }}
        >
          <FilmIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
```

### 10.2 Code Splitting

```tsx
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const YouTubeDownloadManager = dynamic(
  () => import('@/components/features/youtube/download-manager'),
  {
    loading: () => <DownloadManagerSkeleton />,
    ssr: false,
  }
);

const MediaSearchModal = dynamic(
  () => import('@/components/features/media/search-modal'),
  {
    loading: () => null,
  }
);
```

### 10.3 Optimistic Updates

```tsx
// hooks/use-youtube-downloads.ts
export function useDeleteYouTubeDownload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: youtubeApi.deleteDownload,
    onMutate: async (downloadId) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['youtube-downloads'] });
      
      // Optimistically update
      const previousDownloads = queryClient.getQueryData(['youtube-downloads']);
      
      queryClient.setQueryData(['youtube-downloads'], (old: Download[]) => 
        old?.filter(d => d.id !== downloadId) ?? []
      );
      
      return { previousDownloads };
    },
    onError: (err, downloadId, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ['youtube-downloads'], 
        context?.previousDownloads
      );
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['youtube-downloads'] });
    },
  });
}
```

### 10.4 Bundle Optimization

```tsx
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['image.tmdb.org', 'plex.tv'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      'date-fns',
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tree-shake unused icons
      config.resolve.alias = {
        ...config.resolve.alias,
        'lucide-react': 'lucide-react/dist/esm/icons',
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

## 11. Testing Strategy

### 11.1 Unit Tests

```tsx
// components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
  
  it('handles click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('applies variant styles', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });
});
```

### 11.2 Integration Tests

```tsx
// app/(auth)/media/media.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import MediaPage from './page';
import { server } from '@/test/mocks/server';
import { rest } from 'msw';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
};

describe('MediaPage', () => {
  it('displays media grid when loaded', async () => {
    render(<MediaPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument();
      expect(screen.getByText('Inception')).toBeInTheDocument();
    });
  });
  
  it('shows error state on API failure', async () => {
    server.use(
      rest.get('/api/media', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );
    
    render(<MediaPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/error loading media/i)).toBeInTheDocument();
    });
  });
});
```

### 11.3 E2E Tests

```tsx
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login with Plex OAuth', async ({ page }) => {
    await page.goto('/login');
    
    // Click login button
    await page.click('button:has-text("Connect with Plex")');
    
    // Wait for PIN display
    await expect(page.locator('text=plex.tv/link')).toBeVisible();
    const pin = await page.locator('.font-mono').textContent();
    
    // Simulate PIN authorization (in real test, would use API)
    await page.route('**/api/auth/plex/check/*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ authorized: true, authToken: 'mock-token' }),
      });
    });
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });
});
```

## 12. Development Workflow

### 12.1 Local Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm run test
npm run test:watch
npm run test:e2e
```

### 12.2 Git Hooks

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
npm run type-check
```

### 12.3 VS Code Configuration

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Conclusion

This guide provides the foundational patterns and practices for MediaNest frontend development. As the application evolves, this document should be updated to reflect new patterns and lessons learned.

Key takeaways:
- Leverage Next.js 14 App Router for optimal performance
- Use Server Components by default, Client Components when needed
- Implement proper state management with TanStack Query and Zustand
- Follow component composition patterns for maintainability
- Prioritize type safety and testing
- Optimize for performance from the start

For questions or clarifications, refer to the main architecture documentation or consult with the technical lead.