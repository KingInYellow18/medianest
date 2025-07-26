# Contributing Guide

Welcome to MediaNest! We're excited to have you contribute to our production-ready media management platform.

!!! success "Development Environment Health: 78%"
    Our validation framework ensures quality contributions with established coding standards and automated testing.

## 🎯 Getting Started

### Before You Begin

1. **Read the Documentation** - Familiarize yourself with our [architecture](../architecture/overview.md) and [development environment](../development/environment.md)
2. **Check Existing Issues** - Browse [GitHub Issues](https://github.com/medianest/medianest/issues) to see what's needed
3. **Join the Discussion** - Participate in [GitHub Discussions](https://github.com/medianest/medianest/discussions)

### Types of Contributions

We welcome all types of contributions:

| Contribution Type | Examples | Skill Level |
|------------------|----------|-------------|
| **Bug Reports** | Found an issue? Report it! | Beginner |
| **Documentation** | Fix typos, improve guides | Beginner |
| **Code Fixes** | Bug fixes, small improvements | Intermediate |
| **New Features** | Major functionality additions | Advanced |
| **Testing** | Add tests, improve coverage | Intermediate |
| **Performance** | Optimization and efficiency | Advanced |
| **Security** | Security improvements | Advanced |

## 🚀 Quick Start for Contributors

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/medianest.git
cd medianest

# Add upstream remote
git remote add upstream https://github.com/medianest/medianest.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:setup

# Start development servers
npm run dev
```

### 3. Create a Feature Branch

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 4. Make Your Changes

Follow our [coding standards](#coding-standards) and ensure your changes include:

- [ ] Code changes
- [ ] Tests for new functionality
- [ ] Updated documentation
- [ ] Proper commit messages

### 5. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:backend
npm run test:frontend

# Check code coverage
npm run test:coverage

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### 6. Submit a Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
# Fill out the PR template completely
```

## 📋 Coding Standards

### TypeScript Best Practices

```typescript
// ✅ Good: Use explicit types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

const createUser = (userData: Omit<User, 'id'>): User => {
  return {
    id: generateId(),
    ...userData
  };
};

// ❌ Avoid: Any types
const createUser = (userData: any): any => {
  // ...
};
```

### React Component Standards

```tsx
// ✅ Good: Functional components with TypeScript
interface DownloadCardProps {
  download: Download;
  onCancel?: (id: string) => void;
  className?: string;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  download,
  onCancel,
  className
}) => {
  const handleCancel = useCallback(() => {
    onCancel?.(download.id);
  }, [download.id, onCancel]);

  return (
    <Card className={cn("download-card", className)}>
      <CardHeader>
        <CardTitle>{download.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={download.progress} />
      </CardContent>
      {onCancel && (
        <CardFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
```

### API Route Standards

```typescript
// ✅ Good: Proper error handling and validation
export const createMediaRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Validate input
    const requestData = mediaRequestSchema.parse(req.body);
    
    // Business logic
    const request = await mediaService.createRequest(
      req.user!.id,
      requestData
    );
    
    // Consistent response format
    res.status(201).json({
      success: true,
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

// ❌ Avoid: No validation or error handling
export const createMediaRequest = async (req: Request, res: Response) => {
  const request = await mediaService.createRequest(req.body);
  res.json(request);
};
```

### Database Best Practices

```typescript
// ✅ Good: Use Prisma for type-safe queries
export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true
        // Don't include sensitive fields like password
      }
    });
  }

  async create(userData: CreateUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }
}
```

## 🧪 Testing Requirements

### Test Coverage Requirements

- **Unit Tests**: Minimum 85% coverage
- **Integration Tests**: Minimum 80% coverage
- **New Features**: Must include comprehensive tests
- **Bug Fixes**: Must include regression tests

### Writing Good Tests

```typescript
// ✅ Good: Descriptive test with clear AAA pattern
describe('MediaService', () => {
  describe('requestMedia', () => {
    it('should create media request and notify Overseerr', async () => {
      // Arrange
      const userId = 'user-123';
      const mediaData = { title: 'Inception', type: 'movie' };
      
      mockOverseerrService.createRequest.mockResolvedValue({ id: 'req-456' });
      mockNotificationService.notify.mockResolvedValue(undefined);

      // Act
      const result = await mediaService.requestMedia(userId, mediaData);

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        userId,
        title: 'Inception',
        status: 'pending'
      });
      
      expect(mockOverseerrService.createRequest).toHaveBeenCalledWith(mediaData);
      expect(mockNotificationService.notify).toHaveBeenCalledWith(
        userId,
        'Media request created successfully'
      );
    });
  });
});
```

### Component Testing

```tsx
// ✅ Good: Test user interactions and accessibility
describe('DownloadCard', () => {
  const mockDownload = {
    id: '1',
    title: 'Test Video',
    progress: 50,
    status: 'downloading' as const
  };

  it('should display download information correctly', () => {
    render(<DownloadCard download={mockDownload} />);
    
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const mockOnCancel = vi.fn();
    const user = userEvent.setup();
    
    render(<DownloadCard download={mockDownload} onCancel={mockOnCancel} />);
    
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(mockOnCancel).toHaveBeenCalledWith('1');
  });

  it('should be accessible to screen readers', async () => {
    const { container } = render(<DownloadCard download={mockDownload} />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## 🎨 UI/UX Guidelines

### Design System

MediaNest uses a consistent design system built on:

- **Tailwind CSS** for styling
- **Radix UI** for accessible primitives
- **Lucide React** for icons
- **Dark/Light themes** with system preference support

### Component Patterns

```tsx
// ✅ Good: Consistent component structure
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
```

### Accessibility Requirements

- **WCAG 2.1 AA Compliance** - All components must meet accessibility standards
- **Keyboard Navigation** - Full keyboard accessibility
- **Screen Reader Support** - Proper ARIA labels and descriptions
- **Color Contrast** - Minimum 4.5:1 contrast ratio
- **Focus Management** - Visible focus indicators

## 📝 Commit Message Guidelines

### Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages:

```bash
# Format
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add Plex OAuth integration` |
| `fix` | Bug fix | `fix(queue): resolve download progress calculation` |
| `docs` | Documentation | `docs(api): update authentication endpoints` |
| `style` | Code style changes | `style(frontend): format components with prettier` |
| `refactor` | Code refactoring | `refactor(backend): extract user service logic` |
| `test` | Add or update tests | `test(auth): add login flow integration tests` |
| `chore` | Build/tool changes | `chore(deps): update dependencies` |
| `perf` | Performance improvements | `perf(database): optimize user queries` |
| `ci` | CI/CD changes | `ci(github): add automated testing workflow` |

### Examples

```bash
# ✅ Good commit messages
feat(media): add YouTube download queue management
fix(auth): handle expired JWT tokens gracefully
docs(contributing): add testing guidelines section
test(api): add comprehensive auth endpoint tests

# ❌ Poor commit messages
update stuff
fix bug
wip
minor changes
```

## 🔄 Pull Request Process

### PR Template

When creating a pull request, please fill out our template completely:

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Screenshots/videos for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or marked as such)
```

### Review Process

1. **Automated Checks** - CI/CD pipeline runs tests and linting
2. **Code Review** - At least one maintainer reviews the code
3. **Testing** - Changes are tested in development environment
4. **Documentation** - Verify documentation is updated
5. **Approval** - PR is approved and merged

### Review Criteria

- **Functionality** - Code works as intended
- **Quality** - Follows coding standards and best practices
- **Performance** - No performance regressions
- **Security** - No security vulnerabilities introduced
- **Tests** - Adequate test coverage
- **Documentation** - Clear and up-to-date

## 🏷️ Issue Management

### Bug Reports

When reporting bugs, please include:

```markdown
**Bug Description**
Clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]
- MediaNest Version: [e.g. 1.0.0]

**Additional Context**
Screenshots, logs, or additional information.
```

### Feature Requests

For feature requests, please include:

```markdown
**Feature Description**
Clear description of the feature.

**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Any alternative solutions considered?

**Additional Context**
Mockups, examples, or additional information.
```

## 🎯 Getting Help

### Where to Ask Questions

- **GitHub Discussions** - General questions and community support
- **GitHub Issues** - Bug reports and feature requests
- **Documentation** - Check our comprehensive docs first
- **Code Comments** - For specific implementation questions

### Mentorship

New contributors can:

- **Start with "good first issue" labels** - Beginner-friendly tasks
- **Ask for guidance** - Don't hesitate to ask questions
- **Pair programming** - Request code review sessions
- **Documentation contributions** - Great way to learn the codebase

## 🏆 Recognition

### Contributors

All contributors are recognized in:

- **GitHub Contributors** section
- **Release notes** for significant contributions
- **Special recognition** for outstanding contributions

### Maintainer Path

Active contributors may be invited to become maintainers based on:

- **Consistent quality contributions**
- **Community involvement**
- **Code review participation**
- **Mentoring other contributors**

## 📜 Code of Conduct

### Our Standards

- **Be respectful** - Treat everyone with respect
- **Be inclusive** - Welcome people of all backgrounds
- **Be collaborative** - Work together constructively
- **Be professional** - Maintain professional communication

### Enforcement

Violations of the code of conduct should be reported to the project maintainers. All reports will be reviewed and investigated promptly.

## 🔄 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Schedule

- **Major releases** - Quarterly
- **Minor releases** - Monthly
- **Patch releases** - As needed for critical fixes

---

**Ready to contribute?** Check out our [good first issues](https://github.com/medianest/medianest/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) to get started!