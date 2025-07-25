# Task: Frontend Next.js Initialization

**Task ID:** PHASE1-04  
**Priority:** Critical  
**Estimated Time:** 3 hours  
**Dependencies:** PHASE1-02 (Docker Environment)

## Objective
Initialize the Next.js 14 frontend with TypeScript, Tailwind CSS, and proper project structure for the MediaNest application.

## Acceptance Criteria
- [ ] Next.js application starts successfully
- [ ] TypeScript configuration complete
- [ ] Tailwind CSS integrated and working
- [ ] Basic layout structure in place
- [ ] Dark mode support configured
- [ ] Environment variables properly loaded

## Detailed Steps

### 1. Initialize Next.js Project
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
```

When prompted:
- Would you like to use ESLint? → Yes
- Would you like to use `src/` directory? → Yes
- Would you like to use App Router? → Yes
- Would you like to customize the default import alias? → No

### 2. Install Additional Dependencies
```bash
# UI and Styling
npm install clsx tailwind-merge
npm install @tailwindcss/forms @tailwindcss/typography
npm install lucide-react

# State Management and Data Fetching
npm install zustand @tanstack/react-query
npm install axios

# Authentication
npm install next-auth

# Forms and Validation
npm install react-hook-form @hookform/resolvers zod

# Utilities
npm install date-fns
npm install nanoid

# Development Dependencies
npm install -D @types/node
npm install -D prettier prettier-plugin-tailwindcss
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 3. Configure TypeScript
Update `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/services/*": ["./src/services/*"],
      "@/types/*": ["./src/types/*"],
      "@/styles/*": ["./src/styles/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4. Configure Tailwind CSS
Update `frontend/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config
```

### 5. Create Global Styles
Update `frontend/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 199 89% 48%;
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
    --ring: 199 89% 48%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 199 89% 48%;
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
    --ring: 199 89% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary text-primary-foreground hover:bg-primary/90 
           px-4 py-2 rounded-md font-medium transition-colors
           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2;
  }

  .btn-secondary {
    @apply bg-secondary text-secondary-foreground hover:bg-secondary/80
           px-4 py-2 rounded-md font-medium transition-colors
           focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2;
  }

  .card {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-md p-6
           border border-gray-200 dark:border-gray-700;
  }
}
```

### 6. Create Root Layout
Update `frontend/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'MediaNest',
  description: 'Unified media management portal',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 7. Create Providers Component
Create `frontend/src/components/providers.tsx`:

```typescript
'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  )
}
```

### 8. Create Theme Toggle Component
Create `frontend/src/components/theme-toggle.tsx`:

```typescript
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  )
}
```

### 9. Create API Client Configuration
Create `frontend/src/lib/api-client.ts`:

```typescript
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor for auth
apiClient.interceptors.request.use(
  (config) => {
    // Add correlation ID
    config.headers['x-correlation-id'] = `web-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)
```

### 10. Create Environment Variables
Create `frontend/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_nextauth_secret_change_me

# Plex OAuth (to be configured)
PLEX_CLIENT_ID=medianest-dev
PLEX_CLIENT_SECRET=
```

### 11. Create Utility Functions
Create `frontend/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function truncate(str: string, length: number) {
  return str.length > length ? `${str.substring(0, length)}...` : str
}
```

### 12. Create Type Definitions
Create `frontend/src/types/index.ts`:

```typescript
export interface User {
  id: string
  plexId: string
  plexUsername: string
  email?: string
  role: 'user' | 'admin'
  createdAt: string
  lastLoginAt?: string
  status: 'active' | 'suspended'
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    version: string
  }
}

export interface ServiceStatus {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  lastCheck: string
  uptime: number
}
```

### 13. Update Next.js Configuration
Update `frontend/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost', 'plex.tv'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
```

### 14. Create Basic Home Page
Update `frontend/src/app/page.tsx`:

```typescript
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">MediaNest</h1>
          <ThemeToggle />
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Your unified media management portal
        </p>
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Frontend is successfully initialized. Next step: Set up authentication.
          </p>
        </div>
      </div>
    </main>
  )
}
```

## Verification Steps
1. Run `npm install` to ensure all dependencies are installed
2. Run `npm run dev` to start the development server
3. Visit http://localhost:3000 - should see the MediaNest home page
4. Toggle dark/light mode to verify theme switching works
5. Check browser console for any errors
6. Verify TypeScript compilation with `npm run build`
7. Run linting with `npm run lint`

## Testing Requirements
- [ ] Unit tests for utility functions (cn, formatDate, truncate)
- [ ] Unit tests for theme toggle component
- [ ] Unit tests for API client interceptors
- [ ] Component tests for providers setup
- [ ] Integration tests for theme persistence
- [ ] Test API client error handling (401 redirects)
- [ ] Test environment variable loading
- [ ] Snapshot tests for layout components
- [ ] Accessibility tests for theme toggle
- [ ] Test coverage should exceed 80% for utilities and components
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Module not found errors**: Clear .next folder and restart
- **TypeScript errors**: Ensure all type definitions are in place
- **Tailwind not working**: Check content paths in config
- **Dark mode flashing**: Ensure suppressHydrationWarning is set

## Notes
- Next.js 14 uses App Router by default
- Server Components are used where possible for better performance
- Client Components are marked with 'use client' directive
- Theme persistence is handled by next-themes

## Related Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Frontend Architecture Guide](/docs/FRONTEND_ARCHITECTURE_GUIDE.md)