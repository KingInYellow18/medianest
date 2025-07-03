# Task: Create Next.js and Express Applications

**Priority:** Critical  
**Estimated Duration:** 3 hours  
**Dependencies:** 01-monorepo-initialization, 02-typescript-configuration  
**Phase:** 0 (Week 1 - Day 2)

## Objective
Initialize Next.js 14 application with App Router in the frontend workspace, create Express.js application with TypeScript in the backend workspace, configure Tailwind CSS, and set up basic health check endpoints.

## Background
This task establishes the core applications. Next.js 14 with App Router provides modern React features and excellent performance. Express.js offers flexibility for our API needs with WebSocket support.

## Detailed Requirements

### 1. Next.js 14 Setup
- Use App Router (not Pages Router)
- Configure for custom server (Socket.io support)
- Set up Tailwind CSS with custom configuration
- Create basic layout and home page
- Configure for API routes

### 2. Express.js Setup
- TypeScript configuration
- Basic middleware stack
- Health check endpoint
- CORS configuration for frontend
- Error handling middleware
- Custom server for Socket.io

### 3. Tailwind CSS Configuration
- Custom color scheme
- Dark mode support
- Component classes
- Responsive breakpoints

### 4. Path Aliases
- Ensure imports work correctly
- Shared types accessible

## Technical Implementation Details

### Next.js Installation and Setup

```bash
# In frontend directory
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

### Frontend Structure Setup

#### app/layout.tsx
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediaNest - Unified Media Portal',
  description: 'Manage your Plex media server and related services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 dark:bg-gray-900`}>
        {children}
      </body>
    </html>
  );
}
```

#### app/page.tsx
```typescript
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to MediaNest
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Your unified media management portal
        </p>
        <div className="mt-8">
          <a
            href="/auth/login"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Get Started
          </a>
        </div>
      </div>
    </main>
  );
}
```

#### app/api/health/route.ts
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'frontend',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
```

### Tailwind Configuration (tailwind.config.ts)
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        gray: {
          850: '#18202F',
          950: '#0a0e1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
};

export default config;
```

### Express.js Setup

#### backend/src/server.ts
```typescript
import 'tsconfig-paths/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { healthRouter } from '@/routes/health';
import { config } from '@/config';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use('/api/health', healthRouter);

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.env}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

#### backend/src/config/index.ts
```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret',
    expiresIn: '24h',
  },
};
```

#### backend/src/routes/health.ts
```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'backend',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  });
});

export { router as healthRouter };
```

#### backend/src/middleware/errorHandler.ts
```typescript
import type { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
```

#### backend/src/middleware/requestLogger.ts
```typescript
import type { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};
```

### Package.json Updates

#### Frontend package.json additions
```json
{
  "dependencies": {
    "next": "14.1.0",
    "react": "^18",
    "react-dom": "^18",
    "socket.io-client": "^4.6.1"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.7",
    "@tailwindcss/typography": "^0.5.10",
    "tailwindcss": "^3.4.1"
  }
}
```

#### Backend package.json additions
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "socket.io": "^4.6.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5"
  }
}
```

## Acceptance Criteria
1. ✅ Next.js app starts on http://localhost:3000
2. ✅ Express server runs on http://localhost:4000
3. ✅ Health endpoints return correct JSON
4. ✅ Tailwind CSS styling works
5. ✅ CORS allows frontend-backend communication
6. ✅ Socket.io connection established
7. ✅ TypeScript compiles without errors
8. ✅ Hot reload works in development

## Testing Requirements
1. Start both servers with `npm run dev`
2. Visit http://localhost:3000 - see welcome page
3. Check http://localhost:3000/api/health
4. Check http://localhost:4000/api/health
5. Verify WebSocket connection in browser console

## Commands to Execute
```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Start development servers
npm run dev # from root - starts both

# Or individually
cd frontend && npm run dev
cd backend && npm run dev
```

## Common Issues & Solutions
1. **Port already in use**: Change PORT in .env
2. **CORS errors**: Verify FRONTEND_URL in backend .env
3. **TypeScript errors**: Run `npm run build` to check
4. **Tailwind not working**: Check content paths in config

## Next Steps
- Set up Docker configuration
- Configure CI/CD pipeline
- Initialize database connections

## References
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Socket.io Documentation](https://socket.io/docs/v4/)