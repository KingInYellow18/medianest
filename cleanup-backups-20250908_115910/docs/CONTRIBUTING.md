# Contributing to MediaNest

**Version:** 4.0 - Development Guidelines  
**Last Updated:** September 7, 2025  
**Audience:** Contributors and Developers

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing Requirements](#testing-requirements)
5. [Documentation Guidelines](#documentation-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Issue Reporting](#issue-reporting)
8. [Security Guidelines](#security-guidelines)

## Getting Started

### Prerequisites

Before contributing to MediaNest, ensure you have:

- **Node.js 18+** installed
- **PostgreSQL 14+** for database
- **Redis 6.2+** for caching
- **Git** for version control
- **Code editor** with TypeScript support (VS Code recommended)

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/yourusername/medianest.git
   cd medianest
   ```

2. **Install Dependencies**

   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.development.example .env.development
   cp backend/.env.example backend/.env
   cp frontend/.env.local.example frontend/.env.local
   ```

4. **Database Setup**

   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed  # Optional
   ```

5. **Verify Installation**
   ```bash
   npm run dev  # Start all services
   # Backend: http://localhost:4000
   # Frontend: http://localhost:3000
   ```

## Development Workflow

### Branching Strategy

We use **GitFlow** with the following branch structure:

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/\***: New features and enhancements
- **bugfix/\***: Bug fixes
- **hotfix/\***: Critical production fixes
- **release/\***: Release preparation

### Branch Naming Convention

```bash
# Feature branches
feature/user-authentication
feature/media-search-optimization
feature/dashboard-improvements

# Bug fix branches
bugfix/login-session-timeout
bugfix/database-connection-leak
bugfix/memory-usage-spike

# Hotfix branches
hotfix/security-vulnerability
hotfix/critical-auth-bypass

# Release branches
release/1.2.0
release/1.2.1
```

### Commit Message Format

Follow **Conventional Commits** specification:

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature/fix
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, auxiliary tools, dependencies

#### Examples

```bash
feat(auth): add JWT token rotation for enhanced security

- Implement automatic token rotation every 15 minutes
- Add refresh token mechanism for seamless user experience
- Include device tracking for security monitoring

Closes #123
```

```bash
fix(database): resolve connection pool exhaustion

- Increase pool size from 10 to 20 connections
- Add connection timeout handling
- Implement proper connection cleanup

Fixes #456
```

## Code Standards

### TypeScript Guidelines

#### Code Style

```typescript
// Use explicit types when not obvious
interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

// Prefer async/await over promises
async function fetchUserData(userId: string): Promise<User> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user;
  } catch (error) {
    logger.error('Failed to fetch user', { userId, error });
    throw new AppError('User not found', 404);
  }
}

// Use proper error handling
class UserService {
  static async createUser(userData: CreateUserDto): Promise<User> {
    const validation = userSchema.safeParse(userData);
    if (!validation.success) {
      throw new ValidationError('Invalid user data', validation.error);
    }

    return await prisma.user.create({
      data: validation.data,
    });
  }
}
```

#### Naming Conventions

```typescript
// Files: kebab-case
user - service.ts;
auth - middleware.ts;
media - controller.ts;

// Classes: PascalCase
class UserService {}
class AuthenticationError {}
class MediaController {}

// Functions/Variables: camelCase
const getUserById = async (id: string) => {};
const isAuthenticated = true;
const apiResponse = await fetchData();

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_CACHE_TTL = 3600;
const JWT_EXPIRES_IN = '15m';

// Interfaces/Types: PascalCase
interface UserProfile {}
type AuthStatus = 'authenticated' | 'unauthenticated';
```

### Code Organization

#### File Structure

```typescript
// Service files
export class UserService {
  // Public methods first
  public static async createUser(data: CreateUserDto): Promise<User> {}

  // Private methods last
  private static validateUserData(data: unknown): boolean {}
}

// Controller files
export class UserController {
  // Route handlers
  public static register = async (req: Request, res: Response) => {};
  public static login = async (req: Request, res: Response) => {};
}

// Utility files
export const formatDate = (date: Date): string => {};
export const generateId = (): string => {};
```

#### Import Organization

```typescript
// External libraries first
import express from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

// Internal modules (relative imports last)
import { UserService } from '../services/user.service';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';
```

### React/Frontend Guidelines

#### Component Structure

```typescript
// Functional components with TypeScript
interface MediaCardProps {
  media: Media;
  onSelect?: (media: Media) => void;
  className?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onSelect, className = '' }) => {
  // Hooks at the top
  const [isLoading, setIsLoading] = useState(false);
  const { data: mediaDetails } = useQuery(['media', media.id], fetchMediaDetails);

  // Event handlers
  const handleClick = useCallback(() => {
    onSelect?.(media);
  }, [media, onSelect]);

  // Early returns for loading/error states
  if (isLoading) {
    return <MediaCardSkeleton />;
  }

  return (
    <div className={`media-card ${className}`} onClick={handleClick}>
      {/* Component JSX */}
    </div>
  );
};
```

#### Styling Guidelines

```typescript
// Use Tailwind classes with proper organization
<div className="
  flex items-center justify-between
  p-4 mb-4
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-lg shadow-sm
  hover:shadow-md transition-shadow
">

// For complex styling, use CSS modules or styled-components
import styles from './MediaCard.module.css';

<div className={styles.mediaCard}>
  <div className={styles.content}>
    Content here
  </div>
</div>
```

## Testing Requirements

### Test Coverage Requirements

- **Unit Tests**: Minimum 80% coverage for business logic
- **Integration Tests**: All API endpoints must have tests
- **E2E Tests**: Critical user paths must be tested
- **Component Tests**: All React components need tests

### Testing Structure

#### Backend Tests

```typescript
// user.service.test.ts
describe('UserService', () => {
  beforeEach(async () => {
    // Setup test database
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Cleanup
    await cleanupTestDatabase();
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
        name: 'Test User',
      };

      const user = await UserService.createUser(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it('should throw validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      };

      await expect(UserService.createUser(userData)).rejects.toThrow(ValidationError);
    });
  });
});
```

#### Frontend Tests

```typescript
// MediaCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaCard } from './MediaCard';

const mockMedia = {
  id: '1',
  title: 'Test Movie',
  thumbnail: 'https://example.com/thumb.jpg',
};

describe('MediaCard', () => {
  it('should render media information', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', mockMedia.thumbnail);
  });

  it('should call onSelect when clicked', () => {
    const mockOnSelect = vi.fn();
    render(<MediaCard media={mockMedia} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByTestId('media-card'));

    expect(mockOnSelect).toHaveBeenCalledWith(mockMedia);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test user.service.test.ts

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

## Documentation Guidelines

### Code Documentation

#### JSDoc Comments

````typescript
/**
 * Creates a new user account with encrypted password
 *
 * @param userData - User registration data
 * @param userData.email - User's email address (must be unique)
 * @param userData.password - Plain text password (will be hashed)
 * @param userData.name - User's display name
 * @returns Promise resolving to the created user (password excluded)
 *
 * @throws {ValidationError} When user data is invalid
 * @throws {ConflictError} When email already exists
 *
 * @example
 * ```typescript
 * const user = await UserService.createUser({
 *   email: 'user@example.com',
 *   password: 'securepass123',
 *   name: 'John Doe'
 * });
 * ```
 */
export async function createUser(userData: CreateUserDto): Promise<User> {
  // Implementation
}
````

### README Updates

When adding new features, update relevant README files:

- **Root README.md**: Major feature additions
- **Backend README.md**: API changes, new services
- **Frontend README.md**: New components, UI changes

### API Documentation

Use OpenAPI/Swagger for API documentation:

```typescript
/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserDto'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.post('/users', UserController.createUser);
```

## Pull Request Process

### PR Checklist

Before submitting a pull request:

- [ ] Code follows style guidelines
- [ ] Tests are added/updated and passing
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with develop
- [ ] No merge conflicts exist
- [ ] Security considerations reviewed

### PR Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing

Describe the tests that were run to verify changes.

## Screenshots (if applicable)

Add screenshots to help explain changes.

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one team member review required
3. **Testing**: Manual testing for UI changes
4. **Documentation**: Ensure documentation is complete
5. **Merge**: Squash and merge into develop branch

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
A clear and concise description of the bug.

**Steps to Reproduce**

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**

- OS: [e.g. iOS]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]

**Additional Context**
Add any other context about the problem here.
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
A clear and concise description of what you want to happen.

**Use Case**
Describe the problem this feature would solve.

**Proposed Solution**
Describe the solution you'd like.

**Alternatives Considered**
Describe alternatives you've considered.

**Additional Context**
Add any other context or screenshots about the feature request here.
```

## Security Guidelines

### Security Best Practices

1. **Never commit secrets**: Use environment variables
2. **Validate all inputs**: Use Zod schemas for validation
3. **Sanitize user data**: Prevent XSS and injection attacks
4. **Use HTTPS**: Always use secure connections
5. **Follow OWASP guidelines**: Regular security reviews

### Security Review Process

1. **Automated Scanning**: GitHub Security Advisories
2. **Manual Review**: Security-focused code review
3. **Dependency Checks**: Regular dependency updates
4. **Penetration Testing**: Periodic security assessments

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead:

1. Email security concerns to: security@medianest.com
2. Use GitHub's private vulnerability reporting
3. Provide detailed information about the issue
4. Allow time for fix before public disclosure

---

**Thank you for contributing to MediaNest!** Your contributions help make this project better for everyone.
