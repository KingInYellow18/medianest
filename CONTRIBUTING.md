# Contributing to MediaNest

Thank you for your interest in contributing to MediaNest! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, nationality, or other similar characteristics.

### Expected Behavior

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members
- Be constructive in your feedback

### Unacceptable Behavior

- Harassment, discrimination, or exclusionary behavior
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct that could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 20.x LTS
- Docker Desktop or Docker Engine with Docker Compose V2
- Git
- A code editor (VS Code recommended)
- Basic knowledge of TypeScript, React, and Node.js

### Understanding the Project

1. Read the [README.md](README.md) for project overview
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Check [CLAUDE.md](CLAUDE.md) for AI assistant guidelines
4. Explore the [docs/](docs/) directory for detailed documentation

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/medianest.git
cd medianest

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/medianest.git
```

### 2. Install Dependencies

```bash
# Install all dependencies (this sets up Git hooks automatically)
npm install

# Generate environment files
cp .env.example .env
npm run generate-secrets
```

### 3. Start Development Environment

```bash
# Start Docker services (database, Redis)
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### 4. Verify Setup

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Database: PostgreSQL on port 5432
- Redis: Port 6379

## How to Contribute

### Types of Contributions

#### 1. Bug Reports

- Use the bug report template
- Include steps to reproduce
- Provide system information
- Include relevant logs/screenshots

#### 2. Feature Requests

- Use the feature request template
- Explain the use case
- Describe the expected behavior
- Consider implementation approach

#### 3. Code Contributions

- Bug fixes
- New features
- Performance improvements
- Refactoring
- Tests

#### 4. Documentation

- Fix typos or clarify existing docs
- Add missing documentation
- Improve examples
- Translate documentation

#### 5. Design

- UI/UX improvements
- Accessibility enhancements
- Mobile responsiveness
- Design mockups

### Finding Issues to Work On

Look for issues labeled:

- `good first issue` - Great for newcomers
- `help wanted` - Community help needed
- `documentation` - Documentation improvements
- `bug` - Bug fixes
- `enhancement` - New features

## Development Workflow

### 1. Create a Branch

```bash
# Update your fork
git checkout main
git pull upstream main
git push origin main

# Create feature branch from develop
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/fixes
- `chore/` - Maintenance tasks

### 2. Make Changes

Follow the coding standards and ensure:

- Code is properly typed (TypeScript)
- Tests are added/updated
- Documentation is updated
- No linting errors

### 3. Commit Changes

Follow conventional commits format:

```bash
# Format: <type>(<scope>): <subject>

git commit -m "feat(media): add advanced search filters"
git commit -m "fix(auth): resolve session timeout issue"
git commit -m "docs(api): update endpoint documentation"
git commit -m "test(dashboard): add service card tests"
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

### 4. Git Hooks

This project uses `simple-git-hooks` to maintain code quality:

- **Pre-commit**: Runs ESLint on staged TypeScript/JavaScript files via lint-staged
- Hooks are automatically installed when you run `npm install`
- To manually update hooks: `npx simple-git-hooks`

### 5. Keep Your Branch Updated

```bash
# Regularly sync with upstream
git fetch upstream
git rebase upstream/main
```

## Coding Standards

### TypeScript Guidelines

```typescript
// Use explicit types
interface UserProps {
  id: string;
  name: string;
  role: 'user' | 'admin';
}

// Avoid any type
// Bad: const data: any = fetchData();
// Good: const data: UserData = fetchData();

// Use const assertions for literals
const ROLES = ['user', 'admin'] as const;
type Role = (typeof ROLES)[number];

// Prefer interfaces over types for objects
interface Config {
  apiUrl: string;
  timeout: number;
}
```

### React Guidelines

```tsx
// Use function components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, variant = 'primary' }) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};

// Use custom hooks for logic
const useServiceStatus = (serviceId: string) => {
  const [status, setStatus] = useState<Status>();
  // Hook logic
  return { status, refetch };
};
```

### Node.js/Express Guidelines

```typescript
// Use async/await for asynchronous operations
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Validate inputs with Zod
const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  role: z.enum(['user', 'admin']),
});
```

### Style Guide

- Follow the ESLint configuration
- Use Prettier for formatting (runs automatically)
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Use descriptive variable names
- Keep functions small and focused

## Testing Guidelines

### Test Structure

```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Test setup
  });

  // Group related tests
  describe('when user is authenticated', () => {
    it('should display user menu', () => {
      // Test implementation
    });

    it('should allow logout', () => {
      // Test implementation
    });
  });

  // Test edge cases
  describe('error handling', () => {
    it('should display error message on API failure', () => {
      // Test implementation
    });
  });
});
```

### Testing Requirements

- Write tests for new features
- Maintain test coverage above 70%
- Run `npm test` before committing
- Add unit tests for utilities
- Add integration tests for API endpoints
- Mock external dependencies appropriately

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run backend tests with test database
cd backend && ./run-tests.sh
```

## Documentation

### Code Documentation

```typescript
/**
 * Fetches user details from the database
 * @param userId - The unique identifier of the user
 * @returns User object if found, null otherwise
 * @throws {DatabaseError} If database connection fails
 */
export async function getUser(userId: string): Promise<User | null> {
  // Implementation
}
```

### Documentation Updates

When adding features, update:

- Feature list in README.md
- Configuration options in docs
- API documentation for new endpoints
- Component documentation for new UI components
- Add usage examples where appropriate

## Pull Request Process

### Before Submitting

1. **Run Tests and Checks**

   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

2. **Update Documentation**

   - Add/update relevant docs
   - Add JSDoc comments
   - Update API documentation if needed

3. **Self Review**
   - Check for console.logs
   - Verify no sensitive data
   - Ensure proper error handling
   - Check for TODOs
   - Review your own diff

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues

Fixes #(issue number)
```

### Review Process

1. **Automated Checks**

   - CI/CD pipeline runs tests
   - Linting and type checking
   - Code coverage analysis

2. **Code Review**

   - At least one maintainer review required
   - Address feedback constructively
   - Update PR based on comments
   - Re-request review after changes

3. **Merge Requirements**
   - All CI checks passing
   - Approved by maintainer
   - No merge conflicts
   - Branch up to date with main

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality
- PATCH version for backwards-compatible bug fixes

### Release Steps

1. **Prepare Release**

   ```bash
   # Update version
   npm version minor

   # Update CHANGELOG.md
   # Document all changes since last release
   ```

2. **Create Release PR**

   - Title: `Release v1.2.0`
   - Include changelog in description
   - Tag maintainers for review

3. **After Merge**
   - Create GitHub release
   - Tag with version number
   - Include release notes
   - Publish Docker images

## Getting Help

### Resources

- [Documentation](docs/)
- [GitHub Discussions](https://github.com/OWNER/medianest/discussions)
- [Issue Tracker](https://github.com/OWNER/medianest/issues)

### Questions?

- For general questions, use GitHub Discussions
- For bugs, create an issue
- For feature ideas, use Discussions first
- For security issues, see [SECURITY.md](SECURITY.md)

## Recognition

Contributors will be:

- Added to the contributors list
- Mentioned in release notes
- Given credit in documentation

## License

By contributing to MediaNest, you agree that your contributions will be licensed under the [MIT License](LICENSE).
