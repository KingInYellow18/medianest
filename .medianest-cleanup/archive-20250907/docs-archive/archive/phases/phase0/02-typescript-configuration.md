# Task: Configure TypeScript for Frontend and Backend

**Status:** ✅ COMPLETED  
**Completed Date:** 2025-01-04  
**Priority:** Critical  
**Estimated Duration:** 2 hours  
**Dependencies:** 01-monorepo-initialization  
**Phase:** 0 (Week 1 - Day 1)

## Objective

Set up TypeScript configuration for frontend (Next.js), backend (Express), and shared packages with proper path aliases, strict type checking, and optimized build settings.

## Background

Consistent TypeScript configuration across the monorepo ensures type safety, better IDE support, and prevents runtime errors. Each workspace needs specific settings while sharing common configurations.

## Detailed Requirements

### 1. Root TypeScript Configuration

Create base configuration that other configs extend from

### 2. Frontend TypeScript Config

- Next.js specific settings
- JSX support for React
- Path aliases for clean imports
- Module resolution for app directory

### 3. Backend TypeScript Config

- Node.js target settings
- Express types support
- Path aliases matching frontend
- Build output configuration

### 4. Shared Package Config

- Library build settings
- Declaration file generation
- CommonJS and ESM support

## Technical Implementation Details

### Root tsconfig.base.json

```json
{
  "compilerOptions": {
    // Type Checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Module Resolution
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,

    // Language and Environment
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", "coverage"]
}
```

### Frontend tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/services/*": ["./services/*"],
      "@/contexts/*": ["./contexts/*"],
      "@/types/*": ["./types/*"],
      "@/utils/*": ["./utils/*"],
      "@medianest/shared": ["../shared/src"]
    },
    "baseUrl": ".",
    "allowJs": true,
    "noEmit": true,
    "isolatedModules": true,
    "moduleDetection": "force"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Backend tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@/controllers/*": ["controllers/*"],
      "@/services/*": ["services/*"],
      "@/middleware/*": ["middleware/*"],
      "@/routes/*": ["routes/*"],
      "@/models/*": ["models/*"],
      "@/utils/*": ["utils/*"],
      "@/config/*": ["../config/*"],
      "@medianest/shared": ["../../shared/src"]
    },
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "noEmit": false
  },
  "include": ["src/**/*", "config/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"],
  "ts-node": {
    "require": ["tsconfig-paths/register"],
    "transpileOnly": true,
    "files": true
  }
}
```

### Shared tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Type Declaration Files

#### shared/src/types/index.ts

```typescript
// Common types used across frontend and backend

export interface User {
  id: string;
  plexId: string;
  plexUsername: string;
  email?: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface MediaRequest {
  id: string;
  userId: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId?: string;
  status: 'pending' | 'approved' | 'completed' | 'failed';
  overseerrId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck?: Date;
  uptime?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}
```

### TypeScript Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0",
    "tsconfig-paths": "^4.2.0",
    "tsx": "^4.7.0"
  }
}
```

### Path Alias Configuration for Runtime

#### Backend tsconfig-paths setup

```typescript
// backend/src/server.ts (at the top)
import 'tsconfig-paths/register';
```

## Acceptance Criteria

1. ✅ TypeScript compiles without errors in all workspaces
2. ✅ Path aliases work in both frontend and backend
3. ✅ Shared types accessible from both projects
4. ✅ Strict mode enabled and enforced
5. ✅ Build outputs generated correctly
6. ✅ IDE autocomplete works with path aliases
7. ✅ Source maps generated for debugging
8. ✅ Type checking runs on build

## Testing Requirements

1. Run `tsc --noEmit` in each workspace - should pass
2. Import shared types in both frontend/backend
3. Verify path aliases resolve correctly
4. Check IDE IntelliSense works

## Commands to Execute

```bash
# Install TypeScript dependencies
npm install -D typescript @types/node tsconfig-paths tsx

# Create config files
touch tsconfig.base.json
touch frontend/tsconfig.json
touch backend/tsconfig.json
touch shared/tsconfig.json

# Test compilation
cd frontend && npx tsc --noEmit
cd ../backend && npx tsc --noEmit
cd ../shared && npx tsc
```

## Common Issues & Solutions

1. **Path aliases not working**: Ensure tsconfig-paths is registered
2. **Cannot find module**: Check baseUrl and paths configuration
3. **Type errors**: Verify strict mode settings are appropriate
4. **Build fails**: Check rootDir and outDir settings

## Dependencies

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `tsconfig-paths` - Runtime path alias support
- `tsx` - TypeScript execution for Node.js

## Next Steps

- Configure ESLint with TypeScript support
- Set up Prettier for consistent formatting
- Initialize framework-specific files

## References

- [TypeScript Configuration](https://www.typescriptlang.org/tsconfig)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Next.js TypeScript](https://nextjs.org/docs/basic-features/typescript)
