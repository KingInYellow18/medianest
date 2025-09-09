# MediaNest Development Guide

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active - Post-Cleanup Development Guide  
**Current Build Status:** ⚠️ Mostly Working (6 minor TypeScript warnings)

## Development Environment Setup

### Prerequisites

**Required Software:**
- **Node.js**: 20.x or higher (tested with v22.17.0)
- **npm**: 8.0+ (tested with v11.5.2)  
- **Docker**: Latest stable with Docker Compose V2
- **Git**: For version control
- **Code Editor**: VS Code recommended with extensions

**Recommended VS Code Extensions:**
```
- TypeScript and JavaScript Language Features
- Prettier - Code Formatter
- ESLint
- Docker
- GitLens
- Thunder Client (for API testing)
```

### Quick Development Setup

**1. Clone and Install:**
```bash
# Clone repository
git clone <repository-url>
cd medianest

# Install root dependencies
npm install

# Install workspace dependencies
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..
cd shared && npm install && cd ..
```

**2. Environment Configuration:**
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> frontend/.env.local
```

**3. Database Setup:**
```bash
# Start database (Docker)
docker-compose up postgres redis -d

# Run migrations
npm run db:migrate

# Optional: Seed with sample data
npm run db:seed
```

**4. Start Development:**
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend  # Backend on :4000
npm run dev:frontend # Frontend on :3000
```

**Expected Results:**
- ✅ Backend starts on http://localhost:4000
- ✅ Frontend starts on http://localhost:3000  
- ⚠️ ~6 TypeScript warnings shown (non-blocking)
- ✅ Hot reloading works
- ✅ Database connectivity established

## Project Structure

### Workspace Architecture

MediaNest uses a monorepo with workspaces:

```
medianest/
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── config/    # Configuration management
│   │   ├── controllers/ # Request handlers
│   │   ├── middleware/ # Custom middleware
│   │   ├── routes/    # API route definitions
│   │   ├── services/  # Business logic
│   │   ├── types/     # TypeScript definitions
│   │   └── utils/     # Utility functions
│   ├── tests/         # Backend tests
│   └── prisma/        # Database schema
├── frontend/          # Next.js React application
│   ├── src/
│   │   ├── app/       # App router pages
│   │   ├── components/ # Reusable components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Client-side utilities
│   │   └── styles/    # Global styles
│   └── tests/         # Frontend tests
├── shared/            # Shared utilities and types
│   └── src/
│       ├── types/     # Common TypeScript types
│       ├── utils/     # Shared utilities
│       └── config/    # Shared configuration
└── docs/             # Documentation
```

### Key Files and Directories

**Root Level:**
- `package.json` - Root workspace configuration
- `.env` - Backend environment variables
- `docker-compose.yml` - Development services
- `vitest.workspace.ts` - Test configuration

**Backend Important Files:**
- `backend/src/app.ts` - Express application setup
- `backend/src/server.ts` - Server entry point
- `backend/prisma/schema.prisma` - Database schema
- `backend/src/config/env.ts` - Environment validation

**Frontend Important Files:**
- `frontend/src/app/layout.tsx` - Root layout
- `frontend/src/app/page.tsx` - Home page
- `frontend/next.config.js` - Next.js configuration
- `frontend/.env.local` - Frontend environment variables

## Development Workflow

### Daily Development Routine

**1. Start Development Environment:**
```bash
# Pull latest changes
git pull origin develop

# Install any new dependencies
npm install

# Start development servers
npm run dev
```

**2. Make Changes:**
- Edit code in your preferred editor
- Changes are automatically reloaded via hot reloading
- Check browser console and terminal for errors

**3. Test Changes:**
```bash
# Run type checking
npm run typecheck

# Run tests
npm test

# Run specific test suites
npm run test:backend
npm run test:frontend
```

**4. Commit Changes:**
```bash
# Stage changes
git add .

# Commit (pre-commit hooks will run)
git commit -m "feat: description of changes"

# Push changes
git push origin feature-branch
```

### Current Development Status

**Working Features:**
- ✅ Hot reloading (frontend and backend)
- ✅ TypeScript compilation (with warnings)
- ✅ Database migrations and seeding
- ✅ Test suite execution
- ✅ Docker development environment
- ✅ API endpoints functional
- ✅ Authentication flow working

**Known Issues to Work Around:**
- ⚠️ **6 TypeScript warnings**: Non-blocking, development continues normally
- ⚠️ **2 integration test failures**: Minor issues, core functionality works
- ⚠️ **Frontend peer dependencies**: Use `--legacy-peer-deps` for installation

**Development Impact:** None - all development workflows function normally despite warnings.

## Code Standards and Guidelines

### TypeScript Usage

**Current Status:** Mostly strict TypeScript with some legacy code

```typescript
// ✅ Good: Proper typing
interface UserData {
  id: string;
  username: string;
  email: string;
}

const createUser = (data: UserData): Promise<User> => {
  // Implementation
};

// ⚠️ Current warnings (being addressed)
// Some controllers have 'any' types
// Some comparisons between incompatible string literals
```

**Type Safety Guidelines:**
- Use interfaces for data structures
- Avoid `any` types when possible
- Use strict null checks
- Leverage TypeScript utility types

### Code Style

**Formatting:** Uses Prettier with these settings:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Linting:** ESLint configuration:
```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Check specific files
npm run lint backend/src/controllers/
```

### Component Guidelines (Frontend)

**React Component Structure:**
```tsx
// components/ExampleComponent.tsx
import React from 'react';
import { SomeType } from '@/types';

interface ExampleComponentProps {
  title: string;
  data: SomeType[];
  onAction?: () => void;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  title,
  data,
  onAction
}) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {/* Component content */}
    </div>
  );
};
```

**Hook Usage:**
```tsx
// hooks/useExample.ts
import { useState, useEffect } from 'react';

export const useExample = (initialValue: string) => {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Effect logic
  }, []);

  return { value, setValue, loading };
};
```

### API Development (Backend)

**Controller Pattern:**
```typescript
// controllers/example.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ExampleService } from '@/services';

export class ExampleController {
  private exampleService: ExampleService;

  constructor() {
    this.exampleService = new ExampleService();
  }

  public getExample = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.exampleService.getData();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
```

**Service Pattern:**
```typescript
// services/example.service.ts
import { PrismaClient } from '@prisma/client';

export class ExampleService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  public async getData(): Promise<ExampleData[]> {
    return this.prisma.example.findMany();
  }
}
```

## Testing

### Test Structure

**Test Categories:**
- **Unit Tests**: Individual function/component testing
- **Integration Tests**: API endpoint and service integration
- **E2E Tests**: Full user workflow testing

**Test Locations:**
```
├── backend/tests/
│   ├── unit/          # Unit tests
│   ├── integration/   # API integration tests  
│   └── fixtures/      # Test data
├── frontend/tests/
│   ├── components/    # Component tests
│   └── hooks/         # Hook tests
└── tests/            # Cross-workspace tests
```

### Running Tests

**All Tests:**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

**Specific Test Suites:**
```bash
# Backend only
npm run test:backend

# Frontend only  
npm run test:frontend

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit
```

**Test Status (Current):**
- ✅ **28/30 integration tests passing** (2 minor failures)
- ✅ **Unit tests mostly passing**
- ✅ **Core functionality tests all pass**
- ⚠️ **Some edge case tests failing** (being addressed)

### Writing Tests

**Backend Test Example:**
```typescript
// backend/tests/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '@/services/user.service';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  it('should create user with encrypted data', async () => {
    const userData = { username: 'test', email: 'test@example.com' };
    const result = await userService.createUser(userData);
    
    expect(result.id).toBeDefined();
    expect(result.username).toBe('test');
  });
});
```

**Frontend Test Example:**
```typescript
// frontend/tests/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});
```

## Database Development

### Schema Management

**Prisma Schema Location:** `backend/prisma/schema.prisma`

**Common Operations:**
```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate:dev --name "add_user_preferences"

# Apply migrations
npm run db:migrate

# Reset database (development only)
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Database Development Workflow

**1. Schema Changes:**
```bash
# Edit backend/prisma/schema.prisma
# Add new models or fields

# Create migration
npm run db:migrate:dev --name "descriptive_name"

# Generate new client
npm run db:generate
```

**2. Seed Data:**
```bash
# Edit backend/prisma/seed.ts
# Add sample data for development

# Run seed
npm run db:seed
```

**3. Database Queries:**
```typescript
// services/user.service.ts
import { PrismaClient } from '@prisma/client';

export class UserService {
  private prisma = new PrismaClient();

  async findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { sessions: true }
    });
  }
}
```

## API Development

### API Structure

**Current API Organization:**
```
/api/v1/
├── auth/          # Authentication endpoints
├── users/         # User management
├── media/         # Media library access
├── services/      # External service integration
├── health/        # Health check endpoints
└── webhooks/      # Webhook handling
```

### API Development Workflow

**1. Define Routes:**
```typescript
// backend/src/routes/v1/example.routes.ts
import { Router } from 'express';
import { ExampleController } from '@/controllers';
import { authenticate } from '@/middleware/auth';

const router = Router();
const exampleController = new ExampleController();

router.get('/', authenticate, exampleController.getExample);
router.post('/', authenticate, exampleController.createExample);

export { router as exampleRoutes };
```

**2. Implement Controllers:**
```typescript
// backend/src/controllers/example.controller.ts
export class ExampleController {
  public getExample = async (req: Request, res: Response) => {
    // Implementation
  };
}
```

**3. Test API Endpoints:**
```bash
# Using curl
curl http://localhost:4000/api/v1/health

# Using npm scripts (if available)
npm run api:test

# Using Thunder Client extension in VS Code
```

## Frontend Development

### Next.js App Router

**Current Structure:** Uses Next.js 14 with App Router

```
frontend/src/app/
├── layout.tsx         # Root layout
├── page.tsx          # Home page
├── globals.css       # Global styles
├── auth/             # Authentication pages
├── dashboard/        # Dashboard pages
├── media/            # Media browsing pages
└── api/              # API routes (if any)
```

### Component Development

**Component Categories:**
- **UI Components**: Reusable interface elements
- **Feature Components**: Specific functionality components  
- **Page Components**: Full page implementations
- **Layout Components**: Page structure components

**Development Pattern:**
```tsx
// 1. Create component
// frontend/src/components/MediaCard.tsx

// 2. Add styles with Tailwind
// Use className with Tailwind utilities

// 3. Add to component index
// frontend/src/components/index.ts

// 4. Write tests
// frontend/tests/components/MediaCard.test.tsx
```

### State Management

**Current Approach:** React Context + Custom Hooks

```tsx
// contexts/AppContext.tsx
const AppContext = createContext<AppState | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State management logic
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
};

// hooks/useApp.ts
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
```

## Performance Optimization

### Development Performance

**Fast Development Setup:**
```bash
# Use fast build modes
npm run dev:fast

# Skip type checking during development (when needed)
npm run dev:skip-types

# Use Docker for consistent environment
npm run docker:dev
```

**Build Performance:**
```bash
# Analyze bundle size
npm run analyze

# Check build performance
npm run build:analyze

# Optimize dependencies
npm run deps:analyze
```

### Runtime Performance

**Backend Optimization:**
- Database query optimization
- Redis caching implementation
- API response caching
- Connection pooling

**Frontend Optimization:**
- Component lazy loading
- Image optimization
- Bundle splitting
- Service Worker implementation

## Debugging

### Development Debugging

**Backend Debugging:**
```bash
# Start with debugger
npm run dev:debug

# Or with specific port
node --inspect=9229 src/server.ts
```

**Frontend Debugging:**
```bash
# Next.js has built-in debugging
npm run dev

# Use browser dev tools
# React Developer Tools extension recommended
```

### Common Debugging Scenarios

**TypeScript Errors:**
```bash
# Check specific file
npx tsc --noEmit backend/src/controllers/example.ts

# Check all files
npm run typecheck

# Get detailed error information
npm run typecheck:verbose
```

**Runtime Errors:**
```bash
# Check backend logs
npm run logs:backend

# Check frontend logs
npm run logs:frontend

# Check database logs
npm run logs:db
```

## Contributing Guidelines

### Branch Strategy

**Branch Naming:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Pull Request Process

**1. Before Creating PR:**
```bash
# Ensure all tests pass
npm test

# Check code style
npm run lint:fix

# Check types
npm run typecheck

# Build successfully
npm run build
```

**2. PR Requirements:**
- Clear description of changes
- Tests for new functionality
- Documentation updates if needed
- No introduction of new TypeScript errors

### Current Contribution Opportunities

**High Priority (Help Appreciated):**
- Fix remaining 6 TypeScript warnings
- Improve failing integration tests
- UI/UX improvements
- Performance optimizations

**Medium Priority:**
- Additional service integrations
- Enhanced error handling
- Improved documentation
- Test coverage improvements

---

**Last Updated**: September 2025  
**Development Guide Version**: 2.0 (Post-Cleanup)  
**Status**: Active development environment with minor known issues