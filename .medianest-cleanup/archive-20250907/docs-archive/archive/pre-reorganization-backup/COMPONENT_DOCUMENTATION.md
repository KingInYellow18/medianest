# MediaNest Frontend Component Documentation

**Version:** 1.0  
**Framework:** Next.js 14 with React 18  
**UI Library:** Custom components based on shadcn/ui patterns  
**State Management:** React Query, NextAuth, Custom Hooks

## Table of Contents

- [Component Architecture](#component-architecture)
- [Core Components](#core-components)
  - [Provider Components](#provider-components)
  - [Layout Components](#layout-components)
  - [Dashboard Components](#dashboard-components)
  - [Media Components](#media-components)
  - [Plex Browser Components](#plex-browser-components)
  - [Request Management Components](#request-management-components)
  - [YouTube Downloader Components](#youtube-downloader-components)
- [UI Component Library](#ui-component-library)
- [Custom Hooks](#custom-hooks)
- [State Management Patterns](#state-management-patterns)
- [Component Development Guidelines](#component-development-guidelines)

## Component Architecture

MediaNest follows a modular component architecture with clear separation between:

- **UI Components**: Reusable, presentational components (in `/components/ui/`)
- **Feature Components**: Business logic components organized by feature
- **Page Components**: Next.js page-level components (in `/app/`)
- **Provider Components**: Context and state providers

### File Organization

```
frontend/src/
├── app/                    # Next.js app directory (pages)
├── components/
│   ├── dashboard/         # Dashboard feature components
│   ├── media/            # Media search/request components
│   ├── plex/             # Plex browser components
│   ├── requests/         # Request management components
│   ├── youtube/          # YouTube downloader components
│   ├── providers/        # Context providers
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and API clients
└── types/                # TypeScript type definitions
```

## Core Components

### Provider Components

#### `providers.tsx`

Root-level provider that wraps the entire application with necessary contexts.

```tsx
interface ProvidersProps {
  children: React.ReactNode;
}
```

**Usage:**

```tsx
// In app/layout.tsx
<Providers>
  <ErrorBoundary>{children}</ErrorBoundary>
</Providers>
```

**Features:**

- Wraps app with NextAuth SessionProvider
- Configures React Query with retry logic
- Sets up global error boundaries
- Initializes WebSocket connections

#### `providers/session-provider.tsx`

Custom wrapper around NextAuth's SessionProvider for additional session management.

```tsx
interface SessionProviderProps {
  children: React.ReactNode;
}
```

### Layout Components

#### `ErrorBoundary.tsx`

Global error boundary for catching and displaying React errors gracefully.

```tsx
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}
```

**Usage:**

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

#### `ServiceErrorBoundary.tsx`

Specialized error boundary for service-specific failures.

```tsx
interface ServiceErrorBoundaryProps {
  service: string;
  children: React.ReactNode;
}
```

### Dashboard Components

#### `dashboard/DashboardLayout.tsx`

Main dashboard container that manages service status display.

```tsx
interface DashboardLayoutProps {
  initialServices?: ServiceStatus[];
  children?: React.ReactNode;
}
```

**Key Features:**

- Real-time service status updates via WebSocket
- Responsive grid layout
- Loading and error states
- Service quick actions

**Usage:**

```tsx
<DashboardLayout initialServices={services}>
  <AdditionalContent />
</DashboardLayout>
```

#### `dashboard/ServiceCard.tsx`

Individual service status card with real-time updates.

```tsx
interface ServiceCardProps {
  service: ServiceStatus;
  onViewDetails?: (service: ServiceStatus) => void;
  onQuickAction?: (action: QuickAction) => void;
}
```

**Features:**

- Animated status indicators
- Response time display
- Uptime percentage
- Quick action buttons
- Error state handling

**Usage:**

```tsx
<ServiceCard
  service={plexService}
  onViewDetails={(service) => router.push(`/services/${service.name}`)}
  onQuickAction={handleQuickAction}
/>
```

#### `dashboard/StatusIndicator.tsx`

Visual indicator for service status.

```tsx
interface StatusIndicatorProps {
  status: 'up' | 'down' | 'degraded' | 'checking';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage:**

```tsx
<StatusIndicator status="up" pulse />
```

#### `dashboard/ConnectionStatus.tsx`

WebSocket connection status display.

```tsx
interface ConnectionStatusProps {
  connected: boolean;
  error?: string;
  reconnectAttempt?: number;
  onReconnect?: () => void;
}
```

### Media Components

#### `media/MediaGrid.tsx`

Responsive grid layout for displaying media search results.

```tsx
interface MediaGridProps {
  results: MediaSearchResult[];
  isLoading?: boolean;
  onMediaSelect?: (media: MediaSearchResult) => void;
  onRequestClick?: (media: MediaSearchResult) => void;
}
```

**Features:**

- Responsive grid (2-6 columns)
- Loading skeletons
- Empty state
- Hover effects

**Usage:**

```tsx
<MediaGrid results={searchResults} isLoading={isSearching} onRequestClick={handleMediaRequest} />
```

#### `media/MediaCard.tsx`

Individual media item display card.

```tsx
interface MediaCardProps {
  media: MediaSearchResult;
  onSelect?: (media: MediaSearchResult) => void;
  onRequestClick?: (media: MediaSearchResult) => void;
  variant?: 'default' | 'compact';
}
```

**Features:**

- Poster image with fallback
- Title and year display
- Availability status badge
- Request button
- Hover animations

#### `media/SearchInput.tsx`

Media search input component.

```tsx
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  isLoading?: boolean;
}
```

**Features:**

- Debounced input
- Loading state
- Keyboard shortcuts
- Clear button

#### `media/RequestModal.tsx`

Modal for submitting media requests.

```tsx
interface RequestModalProps {
  media: MediaSearchResult;
  isOpen: boolean;
  onClose: () => void;
  onRequest: (options: RequestOptions) => Promise<void>;
}
```

**Features:**

- Season selection for TV shows
- Quality preferences
- Request notes
- Loading state
- Error handling

### Plex Browser Components

#### `plex/PlexBrowser.tsx`

Main Plex library browsing interface.

```tsx
interface PlexBrowserProps {
  initialLibrary?: string;
  onLibraryChange?: (libraryKey: string) => void;
  viewMode?: 'grid' | 'list';
}
```

**Features:**

- Library selection
- View mode toggle
- Sorting options
- Filter controls
- Pagination
- Bulk actions

**Usage:**

```tsx
<PlexBrowser initialLibrary="1" onLibraryChange={handleLibraryChange} viewMode="grid" />
```

#### `plex/PlexSearch.tsx`

Plex content search interface.

```tsx
interface PlexSearchProps {
  onResultSelect?: (item: PlexMediaItem) => void;
  placeholder?: string;
}
```

**Features:**

- Search across all libraries
- Recent searches
- Search suggestions
- Result grouping by type

#### `plex/LibrarySelector.tsx`

Dropdown for selecting Plex libraries.

```tsx
interface LibrarySelectorProps {
  libraries: PlexLibrary[];
  selectedLibrary?: string;
  onLibraryChange: (libraryKey: string) => void;
  showAllOption?: boolean;
}
```

#### `plex/CollectionBrowser.tsx`

Browse and manage Plex collections.

```tsx
interface CollectionBrowserProps {
  libraryKey: string;
  onCollectionSelect?: (collection: PlexCollection) => void;
}
```

**Features:**

- Collection grid view
- Create new collections
- Edit collection metadata
- Add/remove items

### Request Management Components

#### `requests/RequestHistory.tsx`

User's media request history view.

```tsx
interface RequestHistoryProps {
  userId?: string; // Admin can view other users
  showFilters?: boolean;
  pageSize?: number;
}
```

**Features:**

- Request status filtering
- Date range filtering
- Sortable columns
- Pagination
- Request details modal

#### `requests/RequestTable.tsx`

Table view for displaying media requests.

```tsx
interface RequestTableProps {
  requests: MediaRequest[];
  showRequester?: boolean;
  onRequestClick?: (request: MediaRequest) => void;
  onStatusChange?: (requestId: string, status: RequestStatus) => void;
}
```

**Features:**

- Sortable columns
- Status badges
- Action buttons
- Responsive design

#### `requests/RequestStatusBadge.tsx`

Visual badge for request status.

```tsx
interface RequestStatusBadgeProps {
  status: RequestStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### YouTube Downloader Components

#### `youtube/YouTubeDownloader.tsx`

Main YouTube download interface.

```tsx
interface YouTubeDownloaderProps {
  onDownloadQueued?: (download: YouTubeDownloadRequest) => void;
  maxConcurrentDownloads?: number;
}
```

**Features:**

- URL validation
- Metadata preview
- Quality selection
- Download quota display
- Queue management

**Usage:**

```tsx
<YouTubeDownloader onDownloadQueued={handleDownloadQueued} maxConcurrentDownloads={3} />
```

#### `youtube/URLSubmissionForm.tsx`

YouTube URL input and submission form.

```tsx
interface URLSubmissionFormProps {
  onSubmit: (url: string, options: DownloadOptions) => Promise<void>;
  userQuota: UserQuota | null;
  onUrlChange?: (url: string) => void;
  onRefreshQuota?: () => void;
}
```

**Features:**

- URL validation
- Playlist detection
- Quality options
- Format selection

#### `youtube/DownloadQueue.tsx`

Active download queue display.

```tsx
interface DownloadQueueProps {
  downloads: YouTubeDownload[];
  onCancelDownload?: (downloadId: string) => void;
  onRetryDownload?: (downloadId: string) => void;
}
```

**Features:**

- Real-time progress updates
- Download speed display
- Cancel/retry actions
- Completion notifications

## UI Component Library

### Button

Versatile button component with multiple variants.

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}
```

**Usage:**

```tsx
<Button variant="outline" size="sm" onClick={handleClick}>
  Click me
</Button>
```

### Card

Container component for content grouping.

```tsx
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
}
```

**Usage:**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

### Input

Form input component with consistent styling.

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

### Badge

Small label component for status and metadata.

```tsx
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}
```

### Skeleton

Loading placeholder component.

```tsx
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}
```

## Custom Hooks

### Data Fetching Hooks

#### `useServiceStatus`

Fetches and manages service status data.

```tsx
const { services, isLoading, error, refetch } = useServiceStatus();
```

#### `usePlexLibraries`

Fetches available Plex libraries.

```tsx
const { libraries, isLoading, error } = usePlexLibraries();
```

#### `useMediaRequest`

Manages media request submission.

```tsx
const { submitRequest, isSubmitting, error } = useMediaRequest();
```

### WebSocket Hooks

#### `useWebSocket`

Manages WebSocket connection and events.

```tsx
const { connected, subscribe, unsubscribe, emit } = useWebSocket();
```

#### `useRealtimeStatus`

Subscribes to real-time service status updates.

```tsx
const { status, lastUpdate } = useRealtimeStatus(serviceName);
```

### Utility Hooks

#### `useDebounce`

Debounces a value with configurable delay.

```tsx
const debouncedValue = useDebounce(value, 500);
```

#### `useIntersectionObserver`

Detects element visibility for infinite scroll.

```tsx
const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });
```

#### `useErrorHandler`

Centralized error handling with user notifications.

```tsx
const { handleError, clearError } = useErrorHandler();
```

## State Management Patterns

### Server State (React Query)

All server state is managed through React Query for:

- Automatic caching
- Background refetching
- Optimistic updates
- Error/loading states

```tsx
// Example query
const { data, isLoading, error } = useQuery({
  queryKey: ['media', mediaId],
  queryFn: () => api.media.getDetails(mediaId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Example mutation
const mutation = useMutation({
  mutationFn: api.media.createRequest,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['requests'] });
  },
});
```

### Session State (NextAuth)

User session managed through NextAuth:

```tsx
const { data: session, status } = useSession();

if (status === 'loading') return <Loading />;
if (!session) return <SignIn />;
```

### Local UI State

Component-specific state using React hooks:

```tsx
// Form state
const [formData, setFormData] = useState(initialData);

// UI state
const [isModalOpen, setIsModalOpen] = useState(false);

// Complex state with reducer
const [state, dispatch] = useReducer(reducer, initialState);
```

### Real-time State (WebSocket)

WebSocket events for real-time updates:

```tsx
useEffect(() => {
  const unsubscribe = socket.subscribe('service:status', (data) => {
    updateServiceStatus(data);
  });

  return unsubscribe;
}, []);
```

## Component Development Guidelines

### 1. Component Structure

```tsx
// ComponentName.tsx
import { FC, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ComponentNameProps {
  // Props interface
}

export const ComponentName: FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState();
  const { data, isLoading } = useQuery();

  // Effects
  useEffect(() => {
    // Side effects
  }, []);

  // Handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render
  if (isLoading) return <Skeleton />;

  return (
    <div className={cn('base-classes', { 'conditional-class': condition })}>
      {/* Component content */}
    </div>
  );
};
```

### 2. Styling Guidelines

- Use Tailwind CSS utility classes
- Follow the shadcn/ui component patterns
- Use `cn()` utility for conditional classes
- Keep component-specific styles minimal

### 3. Type Safety

- Define interfaces for all props
- Use generic types where appropriate
- Avoid `any` types
- Export reusable types

### 4. Performance

- Use `React.memo` for expensive components
- Implement proper dependency arrays
- Use `useMemo` and `useCallback` appropriately
- Lazy load heavy components

### 5. Accessibility

- Use semantic HTML elements
- Add proper ARIA labels
- Ensure keyboard navigation
- Test with screen readers

### 6. Testing

Components should have tests covering:

- Rendering with different props
- User interactions
- Loading/error states
- Accessibility

```tsx
// ComponentName.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName prop="value" />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });

  it('handles user interaction', () => {
    const handleClick = jest.fn();
    render(<ComponentName onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### 7. Documentation

Each component should have:

- JSDoc comments for complex logic
- Storybook stories (if applicable)
- Usage examples in this documentation
- Props documentation with types

---

## Component Checklist

When creating new components:

- [ ] TypeScript interfaces defined
- [ ] Props documented
- [ ] Error boundaries implemented where needed
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Responsive design implemented
- [ ] Accessibility considered
- [ ] Performance optimized
- [ ] Tests written
- [ ] Documentation updated
