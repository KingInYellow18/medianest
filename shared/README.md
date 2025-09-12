# MediaNest Shared

**⚠️ Current Status: Development/Repair Phase - Type Consistency Issues**

The MediaNest Shared module provides common utilities, types, constants, and configuration shared between the frontend and backend. It ensures type safety and code reuse across the MediaNest ecosystem.

## 🚨 Known Issues

- **Type Inconsistencies**: Frontend/backend type mismatches
- **Build Dependencies**: Shared module build issues
- **Import Resolution**: Module resolution problems in consuming projects

## 📋 Purpose

The shared module provides:

- **Type Definitions**: Common TypeScript interfaces and types
- **Validation Schemas**: Zod schemas for data validation
- **Constants**: Application-wide constants and enums
- **Utility Functions**: Helper functions used across modules
- **Configuration**: Shared configuration management
- **Error Handling**: Standardized error classes

## 🏗️ Architecture

```
shared/src/
├── config/          # Shared configuration
│   ├── database.ts  # Database configuration types
│   ├── auth.ts      # Authentication configuration
│   └── index.ts     # Configuration exports
├── constants/       # Application constants
│   ├── errors.ts    # Error codes and messages
│   ├── roles.ts     # User roles and permissions
│   ├── services.ts  # Service identifiers
│   └── index.ts     # Constants exports
├── errors/          # Custom error classes
│   ├── AppError.ts  # Base application error
│   ├── ValidationError.ts  # Validation errors
│   └── index.ts     # Error exports
├── types/           # TypeScript type definitions
│   ├── auth.ts      # Authentication types
│   ├── user.ts      # User-related types
│   ├── media.ts     # Media types
│   ├── api.ts       # API request/response types
│   └── index.ts     # Type exports
├── utils/           # Utility functions
│   ├── crypto.ts    # Cryptographic utilities
│   ├── date.ts      # Date manipulation
│   ├── validation.ts # Validation helpers
│   └── index.ts     # Utility exports
├── validators/      # Zod validation schemas
│   ├── auth.ts      # Authentication schemas
│   ├── user.ts      # User validation schemas
│   ├── media.ts     # Media validation schemas
│   └── index.ts     # Validator exports
└── index.ts         # Main exports
```

## 🚀 Getting Started

### Installation

```bash
# Install from local workspace (used by frontend/backend)
npm install @medianest/shared

# Or install dependencies for development
cd shared
npm install

# Build the module
npm run build

# Run tests
npm test
```

### Usage in Other Modules

```typescript
// Frontend usage
import { User, AuthRequest } from '@medianest/shared';
import { validateLoginSchema } from '@medianest/shared/validators';

// Backend usage
import { AppError, ErrorCodes } from '@medianest/shared';
import { hashPassword } from '@medianest/shared/utils';
```

## 📝 Type Definitions

### User Types

```typescript
// User entity
export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  profile?: UserProfile;
}

// User roles
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MODERATOR = 'MODERATOR',
}

// User profile
export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  timezone?: string;
  preferences: UserPreferences;
}
```

### Authentication Types

```typescript
// Login request/response
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: DeviceInfo;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// JWT payload
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  deviceId?: string;
  iat: number;
  exp: number;
}

// Device information
export interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  fingerprint: string;
  platform?: string;
  browser?: string;
}
```

### Media Types

```typescript
// Media library
export interface MediaLibrary {
  id: string;
  name: string;
  type: MediaType;
  path: string;
  serverId: string;
  itemCount: number;
  lastScanAt?: Date;
}

// Media types
export enum MediaType {
  MOVIE = 'MOVIE',
  TV_SHOW = 'TV_SHOW',
  MUSIC = 'MUSIC',
  PHOTO = 'PHOTO',
}

// Media item
export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  libraryId: string;
  metadata: MediaMetadata;
  files: MediaFile[];
  createdAt: Date;
  updatedAt: Date;
}
```

### API Types

```typescript
// Standard API response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
}

// API error
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Pagination
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

## ✅ Validation Schemas

### Zod Validation

```typescript
// User validation
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(3).max(50),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

// Login validation
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

// Media validation
export const mediaLibrarySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(MediaType),
  path: z.string().min(1),
  serverId: z.string().uuid(),
});
```

### Usage Examples

```typescript
// Validate request data
try {
  const validData = loginSchema.parse(requestBody);
  // Proceed with validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new ValidationError('Invalid input', error.errors);
  }
}

// Safe parsing
const result = createUserSchema.safeParse(userData);
if (!result.success) {
  return { errors: result.error.errors };
}
```

## 🔧 Utility Functions

### Cryptographic Utilities

```typescript
// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Token generation
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};
```

### Date Utilities

```typescript
// Date formatting
export const formatDate = (date: Date, format: string = 'yyyy-MM-dd'): string => {
  return format(date, format);
};

// Relative time
export const getRelativeTime = (date: Date): string => {
  return formatDistanceToNow(date, { addSuffix: true });
};

// Time zone handling
export const convertToUserTimezone = (date: Date, timezone: string): Date => {
  return zonedTimeToUtc(date, timezone);
};
```

### Validation Helpers

```typescript
// Email validation
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Password strength
export const getPasswordStrength = (password: string): PasswordStrength => {
  const score = calculatePasswordScore(password);
  return {
    score,
    level: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong',
    suggestions: getPasswordSuggestions(password),
  };
};
```

## 🚨 Error Handling

### Custom Error Classes

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'APP_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error
export class ValidationError extends AppError {
  constructor(
    message: string,
    public validationErrors: any[],
  ) {
    super(message, 'VALIDATION_ERROR', 400, { validationErrors });
  }
}

// Authentication error
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}
```

### Error Constants

```typescript
export const ErrorCodes = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // System
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;
```

## ⚙️ Configuration

### Database Configuration

```typescript
export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeout?: number;
  enableLogging?: boolean;
}

export const createDatabaseConfig = (env: NodeJS.ProcessEnv): DatabaseConfig => ({
  url: env.DATABASE_URL!,
  maxConnections: parseInt(env.DB_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(env.DB_TIMEOUT || '30000'),
  enableLogging: env.NODE_ENV === 'development',
});
```

### Authentication Configuration

```typescript
export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  bcryptRounds: number;
}

export const createAuthConfig = (env: NodeJS.ProcessEnv): AuthConfig => ({
  jwtSecret: env.JWT_SECRET!,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET!,
  accessTokenExpiry: env.JWT_ACCESS_EXPIRY || '15m',
  refreshTokenExpiry: env.JWT_REFRESH_EXPIRY || '7d',
  bcryptRounds: parseInt(env.BCRYPT_ROUNDS || '12'),
});
```

## 🧪 Testing

### Test Structure

```
shared/tests/
├── types/           # Type definition tests
├── utils/           # Utility function tests
├── validators/      # Schema validation tests
├── errors/          # Error class tests
└── fixtures/        # Test data and mocks
```

### Testing Examples

```typescript
// Utility testing
describe('Password utilities', () => {
  test('should hash password correctly', async () => {
    const password = 'testpassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
  });
});

// Validation testing
describe('User validation', () => {
  test('should validate valid user data', () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
    };

    expect(() => createUserSchema.parse(userData)).not.toThrow();
  });
});
```

## 📦 Build & Distribution

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Package Exports

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.js"
    },
    "./config": "./dist/config/index.js",
    "./validators": "./dist/validators/index.js"
  }
}
```

## 🔗 Related Modules

- **[Backend](../backend/README.md)** - Express.js API server (consumer)
- **[Frontend](../frontend/README.md)** - Next.js React application (consumer)
- **[Infrastructure](../infrastructure/README.md)** - Deployment configuration
- **[Tests](../tests/README.md)** - Testing framework and E2E tests

## 📚 Key Dependencies

### Production

- **zod**: Schema validation
- **bcrypt**: Password hashing
- **date-fns**: Date utilities
- **uuid**: UUID generation
- **winston**: Logging utilities
- **@prisma/client**: Database types

### Development

- **typescript**: Static typing
- **vitest**: Testing framework
- **eslint**: Code linting
- **prettier**: Code formatting

## 🐛 Troubleshooting

### Common Issues

1. **Type Import Errors**

   ```bash
   # Rebuild shared module
   cd shared && npm run build

   # Clear TypeScript cache
   npx tsc --build --clean
   ```

2. **Module Resolution**

   ```bash
   # Check exports in package.json
   cat shared/package.json | grep -A 10 '"exports"'

   # Verify build output
   ls -la shared/dist/
   ```

3. **Validation Errors**
   ```typescript
   // Debug Zod validation
   const result = schema.safeParse(data);
   if (!result.success) {
     console.log(result.error.issues);
   }
   ```

### Development Tips

- Always rebuild after changes: `npm run build`
- Use TypeScript strict mode for better type safety
- Write tests for utility functions
- Document complex type definitions

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/shared-enhancement`
3. Maintain backward compatibility
4. Write comprehensive tests
5. Update type definitions
6. Ensure zero breaking changes
7. Update documentation
8. Submit pull request

### Code Style

- Use strict TypeScript configuration
- Export types and interfaces explicitly
- Document complex utility functions
- Follow consistent naming conventions
- Write unit tests for all utilities

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
