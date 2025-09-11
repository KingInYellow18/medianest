# MediaNest Frontend

**🔥 Modern React 19 + Next.js 15 Application**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-Latest-38B2AC)](https://tailwindcss.com/)

**Current Status: Active Development - Core Features Functional**

The MediaNest Frontend is a Next.js 15 React 19 application providing a modern, responsive web interface for managing Plex media servers and related services. It features real-time updates, responsive design, and comprehensive media management capabilities.

## 📈 Development Progress

| Feature | Status | Notes |
|---------|--------|-------|
| **Core UI** | ✅ Working | Modern responsive design |
| **Authentication** | ✅ Working | JWT-based auth flow |
| **API Integration** | 🔶 Partial | Some endpoints functional |
| **Real-time Updates** | 🔶 Partial | Socket.io connection issues |
| **Testing** | ❌ Limited | Needs test expansion |

> **React 19 + Next.js 15**: Cutting-edge features may require `--legacy-peer-deps` for some packages.

## 📋 Purpose

The frontend provides:

- **Media Dashboard**: Centralized media management interface
- **User Authentication**: Login, registration, and device management
- **Real-time Updates**: Live notifications and status updates
- **Service Integration**: Plex, Overseerr, and Uptime Kuma interfaces
- **Responsive Design**: Mobile-first, adaptive layouts
- **Admin Controls**: User management and system configuration

## 🏗️ Architecture

```
frontend/src/
├── app/                 # Next.js App Router
│   ├── (auth)/         # Authentication pages
│   ├── dashboard/      # Main dashboard pages
│   ├── admin/          # Admin interface
│   ├── media/          # Media browsing pages
│   ├── settings/       # User settings pages
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── ui/            # Reusable UI components
│   ├── forms/         # Form components
│   ├── media/         # Media-specific components
│   ├── dashboard/     # Dashboard components
│   └── layout/        # Layout components
├── hooks/             # Custom React hooks
├── lib/              # Utility libraries
│   ├── api/          # API client functions
│   ├── auth/         # Authentication logic
│   ├── socket/       # Socket.io client
│   └── utils/        # Helper functions
├── types/            # TypeScript type definitions
└── utils/            # Shared utilities
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Backend API running (see [Backend README](../backend/README.md))

### Installation

**💡 Note: Uses latest React 19 + Next.js 15 - some packages may need compatibility flags**

```bash
# From project root
cd frontend

# Install dependencies (may need --legacy-peer-deps)
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Build project (may have issues)
npm run build

# Start development server
npm run dev
```

### Development Server

```bash
# Start development server with custom server (Socket.io support)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run type checking
npm run type-check
```

## 🎨 Design System

### UI Components (Tailwind CSS + Headless UI)

#### Core Components

```typescript
// Button variations
<Button variant="primary" size="lg">Primary Action</Button>
<Button variant="secondary" size="sm">Secondary</Button>
<Button variant="outline" disabled>Disabled</Button>

// Form components
<Input placeholder="Enter text" />
<Select options={options} />
<Checkbox label="Enable feature" />

// Layout components
<Card title="Media Server">
  <CardContent>...</CardContent>
</Card>
```

#### Icons

- **Tabler Icons**: Primary icon set
- **Lucide React**: Secondary icons
- **Custom Icons**: Media-specific graphics

### Styling

- **Tailwind CSS**: Utility-first styling
- **CSS Variables**: Dark/light theme support
- **Responsive Design**: Mobile-first approach
- **Animations**: Framer Motion integration

## 🔐 Authentication

### NextAuth.js Integration

```typescript
// Authentication provider
import { SessionProvider } from 'next-auth/react';

// Protected pages
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
if (status === 'loading') return <Loading />;
if (!session) return <SignIn />;
```

### Authentication Flow

1. **Login Page**: Email/password or Plex OAuth
2. **Session Management**: JWT tokens with refresh
3. **Device Registration**: Device fingerprinting
4. **2FA Support**: TOTP verification
5. **Logout**: Token invalidation

## 📡 API Integration

### API Client

```typescript
// API service layer
import { api } from '@/lib/api';

// Usage in components
const {
  data: users,
  error,
  loading,
} = useQuery({
  queryKey: ['users'],
  queryFn: () => api.users.getAll(),
});

// Mutations
const mutation = useMutation({
  mutationFn: api.users.create,
  onSuccess: () => {
    queryClient.invalidateQueries(['users']);
  },
});
```

### TanStack Query

- **Data Fetching**: React Query for server state
- **Caching**: Intelligent cache management
- **Background Updates**: Automatic refetching
- **Optimistic Updates**: UI responsiveness
- **Error Handling**: Centralized error management

## 🔄 Real-time Features

### Socket.io Integration

```typescript
// Socket context
import { useSocket } from '@/contexts/SocketContext';

const socket = useSocket();

// Listen for events
useEffect(() => {
  socket.on('scan-progress', (data) => {
    setProgress(data.progress);
  });

  return () => socket.off('scan-progress');
}, [socket]);

// Emit events
const startScan = () => {
  socket.emit('media-scan', { libraryId: '1' });
};
```

### Real-time Updates

- **Media Scanning**: Live progress updates
- **User Notifications**: Toast notifications
- **Service Status**: Health check updates
- **Chat/Messages**: Real-time messaging

## 📱 Pages & Features

### Dashboard

- **Overview Cards**: System status, recent activity
- **Media Statistics**: Library counts, disk usage
- **Service Status**: Plex, Overseerr, Uptime Kuma
- **Recent Activity**: User actions, system events

### Media Management

- **Library Browser**: Browse Plex libraries
- **Media Details**: Movie/show information
- **Request System**: Overseerr integration
- **Search**: Cross-library media search

### User Management (Admin)

- **User List**: All registered users
- **Device Management**: User devices
- **Permissions**: Role-based access control
- **Audit Logs**: User activity tracking

### Settings

- **Profile Settings**: User preferences
- **Device Management**: Registered devices
- **Security**: Password, 2FA settings
- **Notifications**: Alert preferences

## 🧪 Testing

### Current Status: **LIMITED**

- **Unit Tests**: Basic component testing
- **Integration Tests**: API integration testing
- **E2E Tests**: Minimal end-to-end coverage
- **Coverage**: Limited due to build issues

### Testing Setup

```typescript
// Component testing with Vitest + Testing Library
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

### Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- Button.test.tsx
```

## 🔧 Configuration

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Authentication (NextAuth.js)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Plex Integration
NEXT_PUBLIC_PLEX_CLIENT_ID=your-plex-client-id

# Feature Flags
NEXT_PUBLIC_ENABLE_ADMIN=true
NEXT_PUBLIC_ENABLE_REGISTRATION=true
```

### Next.js Configuration

```javascript
// next.config.js highlights
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['socket.io-client'],
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    });
    return config;
  },
};
```

## 🎯 Custom Hooks

### Data Fetching Hooks

```typescript
// User management
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: api.users.getAll,
  });
};

// Media libraries
export const useLibraries = () => {
  return useQuery({
    queryKey: ['libraries'],
    queryFn: api.plex.getLibraries,
  });
};

// Real-time data
export const useSocketData = (event: string) => {
  const [data, setData] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    socket.on(event, setData);
    return () => socket.off(event);
  }, [socket, event]);

  return data;
};
```

### Authentication Hooks

```typescript
// Session management
export const useAuth = () => {
  const { data: session } = useSession();
  return {
    user: session?.user,
    isAuthenticated: !!session,
    isAdmin: session?.user?.role === 'ADMIN',
  };
};

// Protected routes
export const useRequireAuth = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, router]);
};
```

## 📦 State Management

### Server State (TanStack Query)

- **API Data**: Remote server state
- **Caching**: Intelligent cache strategies
- **Background Sync**: Automatic updates
- **Optimistic Updates**: UI responsiveness

### Client State (React State + Context)

```typescript
// Theme context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  return context;
};

// UI state
const [sidebarOpen, setSidebarOpen] = useState(false);
const [notifications, setNotifications] = useState([]);
```

## 🚀 Performance Optimizations

### Next.js Features

- **App Router**: File-based routing
- **Server Components**: Reduced client bundle
- **Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic route-based splitting
- **Static Generation**: Pre-built pages where possible

### Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# Performance testing
npm run analyze:performance
```

### Optimization Strategies

- **Lazy Loading**: Component-level code splitting
- **Memoization**: React.memo, useMemo, useCallback
- **Virtual Scrolling**: Large list optimization
- **Image Optimization**: Next.js Image component

## 🔗 Related Modules

- **[Backend](../backend/README.md)** - Express.js API server
- **[Shared](../shared/README.md)** - Common utilities and types
- **[Infrastructure](../infrastructure/README.md)** - Deployment configuration
- **[Tests](../tests/README.md)** - Testing framework and E2E tests

## 📚 Key Dependencies

### Production

- **next**: React framework
- **react**: UI library (v19)
- **@tanstack/react-query**: Data fetching
- **socket.io-client**: Real-time communication
- **next-auth**: Authentication
- **tailwindcss**: Styling
- **framer-motion**: Animations
- **@headlessui/react**: UI components
- **react-hook-form**: Form management
- **zod**: Schema validation

### Development

- **typescript**: Static typing
- **vitest**: Testing framework
- **@testing-library/react**: Component testing
- **eslint**: Code linting
- **@next/bundle-analyzer**: Bundle analysis

## 🐛 Troubleshooting

### Common Issues

1. **React 19 + Next.js 15 Compatibility**

   ```bash
   # Install with legacy peer deps
   npm install --legacy-peer-deps

   # Clear cache
   npm run clean
   rm -rf .next node_modules
   npm install
   ```

2. **Socket.io Connection Issues**

   ```bash
   # Check server is running
   curl http://localhost:3001/api/health

   # Verify socket endpoint
   curl http://localhost:3001/socket.io/
   ```

3. **Build Failures**

   ```bash
   # Type checking
   npm run type-check

   # Check Next.js config
   npx next info
   ```

4. **Styling Issues**
   ```bash
   # Rebuild Tailwind
   npx tailwindcss -i ./src/app/globals.css -o ./dist/output.css
   ```

### Development Tips

- Use Next.js DevTools for debugging
- Enable verbose logging: `DEBUG=next:* npm run dev`
- Check browser console for client errors
- Use React Developer Tools extension

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Follow React/Next.js best practices
4. Write tests for new components
5. Ensure accessibility standards (WCAG 2.1)
6. Test responsive design on multiple devices
7. Submit pull request with screenshots

### Code Style

- Use functional components with hooks
- Implement TypeScript strictly
- Follow Tailwind CSS conventions
- Write accessible components
- Add prop validation with TypeScript

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
