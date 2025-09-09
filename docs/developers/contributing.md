# Contributing Guidelines

Welcome to the MediaNest contributor community! This guide provides everything you need to know to contribute effectively to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation Guidelines](#documentation-guidelines)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)

## Code of Conduct

### Our Commitment

We foster an open and welcoming environment where all contributors feel safe and valued, regardless of experience level, background, or identity.

### Expected Behavior

- **Be Respectful**: Treat all community members with respect and kindness
- **Be Inclusive**: Welcome newcomers and help them get started
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning and growing
- **Focus on Solutions**: Work together to solve problems effectively

### Unacceptable Behavior

- Harassment, discrimination, or exclusionary behavior
- Personal attacks or trolling
- Publishing private information without consent
- Spam or off-topic discussions
- Any conduct that creates an unwelcoming environment

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 20.x LTS**: Required for all development
- **Docker & Docker Compose V2**: For local database services
- **Git**: With understanding of basic Git workflows
- **TypeScript Knowledge**: The project is fully typed
- **React Experience**: Frontend is built with Next.js and React

### Initial Setup

1. **Read the Documentation**
   - [Getting Started Guide](../getting-started/index.md)
   - [Architecture Overview](../ARCHITECTURE.md)
   - [Development Setup](../getting-started/development-setup.md)

2. **Set Up Development Environment**
   ```bash
   # Fork and clone the repository
   git clone https://github.com/YOUR_USERNAME/medianest.git
   cd medianest
   
   # Install dependencies and setup environment
   npm install
   cp .env.example .env
   npm run generate-secrets
   
   # Start development environment
   docker compose -f docker-compose.dev.yml up -d
   npm run db:migrate
   npm run dev
   ```

3. **Verify Your Setup**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000/api/health
   - All tests pass: `npm test`

### Finding Work

Look for issues labeled:
- **`good first issue`**: Perfect for newcomers
- **`help wanted`**: Community assistance needed
- **`bug`**: Bug fixes needed
- **`enhancement`**: New features or improvements
- **`documentation`**: Documentation improvements

Before starting work:
1. Comment on the issue expressing interest
2. Wait for maintainer confirmation
3. Ask questions if anything is unclear

## Development Process

### Branch Strategy

We use **GitFlow** with these branch types:

#### Main Branches
- **`main`**: Production-ready code, always stable
- **`develop`**: Integration branch for features

#### Feature Branches
- **`feature/issue-number-short-description`**: New features
- **`fix/issue-number-short-description`**: Bug fixes
- **`docs/short-description`**: Documentation changes
- **`refactor/short-description`**: Code refactoring
- **`test/short-description`**: Test improvements
- **`chore/short-description`**: Maintenance tasks

### Workflow Steps

1. **Create Feature Branch**
   ```bash
   # Start from develop branch
   git checkout develop
   git pull upstream develop
   
   # Create feature branch
   git checkout -b feature/123-add-media-filtering
   ```

2. **Make Changes**
   - Follow code standards
   - Write/update tests
   - Update documentation
   - Ensure TypeScript compliance

3. **Commit Changes**
   ```bash
   # Use conventional commit format
   git commit -m "feat(media): add advanced filtering options
   
   - Add genre and year filters
   - Implement filter persistence 
   - Add filter reset functionality
   
   Closes #123"
   ```

4. **Keep Branch Updated**
   ```bash
   # Regularly sync with upstream
   git fetch upstream
   git rebase upstream/develop
   ```

5. **Submit Pull Request**
   - Push to your fork
   - Create PR from your branch to `develop`
   - Fill out PR template completely
   - Link related issues

## Code Standards

### TypeScript Guidelines

#### Type Safety
```typescript
// ✅ Good: Explicit interfaces
interface UserProps {
  id: string;
  name: string;
  role: 'admin' | 'user';
  email?: string;
}

// ❌ Bad: Using any
const userData: any = fetchUser();

// ✅ Good: Proper typing
const userData: User = await fetchUser(userId);
```

#### Function Signatures
```typescript
// ✅ Good: Clear function typing
async function createUser(
  userData: CreateUserRequest
): Promise<ApiResponse<User>> {
  // Implementation
}

// ✅ Good: Component props
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant, 
  onClick, 
  disabled = false, 
  children 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

#### Error Handling
```typescript
// ✅ Good: Proper error handling
async function fetchUserData(userId: string): Promise<User> {
  try {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  } catch (error) {
    logger.error('Failed to fetch user', { userId, error });
    throw error;
  }
}

// ✅ Good: API error responses
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: error.message }
      });
    }
    next(error);
  }
});
```

### React/Next.js Guidelines

#### Component Structure
```tsx
// ✅ Good: Well-structured component
interface ServiceCardProps {
  service: {
    name: string;
    status: ServiceStatus;
    url?: string;
  };
  onTest?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ 
  service, 
  onTest 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleTest = useCallback(async () => {
    if (!onTest) return;
    
    setIsLoading(true);
    try {
      await onTest();
    } finally {
      setIsLoading(false);
    }
  }, [onTest]);
  
  return (
    <Card className="service-card">
      <CardHeader>
        <CardTitle>{service.name}</CardTitle>
        <StatusIndicator status={service.status} />
      </CardHeader>
      
      <CardContent>
        {service.url && (
          <p className="text-sm text-gray-600">{service.url}</p>
        )}
      </CardContent>
      
      {onTest && (
        <CardFooter>
          <Button 
            onClick={handleTest}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
```

#### Hooks and State Management
```tsx
// ✅ Good: Custom hooks
const useServiceStatus = (serviceId: string) => {
  const [status, setStatus] = useState<ServiceStatus>('unknown');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const checkStatus = useCallback(async () => {
    try {
      setError(null);
      const result = await api.checkServiceStatus(serviceId);
      setStatus(result.status);
      setLastCheck(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [serviceId]);
  
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // 30s
    return () => clearInterval(interval);
  }, [checkStatus]);
  
  return { status, lastCheck, error, refetch: checkStatus };
};
```

### Backend/API Guidelines

#### Service Layer Pattern
```typescript
// ✅ Good: Service class structure
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly overseerrClient: OverseerrClient
  ) {}
  
  async searchMedia(query: MediaSearchQuery): Promise<MediaSearchResult[]> {
    // Validate input
    const validatedQuery = MediaSearchSchema.parse(query);
    
    // Business logic
    const results = await this.overseerrClient.search(validatedQuery);
    
    // Transform and return
    return results.map(this.transformMediaResult);
  }
  
  private transformMediaResult(result: ExternalMediaResult): MediaSearchResult {
    return {
      id: result.tmdbId,
      title: result.title,
      year: result.releaseDate ? new Date(result.releaseDate).getFullYear() : undefined,
      type: result.mediaType,
      posterPath: result.posterPath,
      overview: result.overview
    };
  }
}
```

#### Repository Pattern
```typescript
// ✅ Good: Repository implementation
export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaClient) {
    super(prisma, 'user');
  }
  
  async findByPlexId(plexId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { plexId },
      include: {
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          take: 1
        }
      }
    });
  }
  
  async createWithPlexData(plexData: PlexUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        plexId: plexData.id,
        plexUsername: plexData.username,
        email: plexData.email,
        role: this.determineUserRole(plexData),
        plexToken: await this.encryptionService.encrypt(plexData.token)
      }
    });
  }
  
  private determineUserRole(plexData: PlexUserData): UserRole {
    // First user becomes admin
    const userCount = await this.count();
    return userCount === 0 ? 'admin' : 'user';
  }
}
```

### Database Guidelines

#### Migration Best Practices
```sql
-- ✅ Good: Safe migration with rollback plan
-- Migration: 20250109120000_add_user_preferences
ALTER TABLE users 
  ADD COLUMN preferences JSONB DEFAULT '{}';

-- Add index for performance
CREATE INDEX idx_users_preferences 
  ON users USING gin(preferences);

-- Update existing users
UPDATE users 
  SET preferences = '{}'
  WHERE preferences IS NULL;
```

#### Prisma Schema Guidelines
```prisma
// ✅ Good: Well-structured schema
model User {
  id           String   @id @default(cuid())
  plexId       String   @unique
  plexUsername String
  email        String?
  role         UserRole @default(USER)
  
  // Encrypted sensitive data
  plexToken    String?  @db.Text
  
  // Relationships
  mediaRequests MediaRequest[]
  sessions      UserSession[]
  
  // Timestamps
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  lastLoginAt  DateTime?
  
  // Indexes for performance
  @@index([plexId])
  @@index([role])
  @@map("users")
}

enum UserRole {
  USER
  ADMIN
  @@map("user_roles")
}
```

### Security Guidelines

#### Input Validation
```typescript
// ✅ Good: Zod schema validation
export const CreateMediaRequestSchema = z.object({
  title: z.string().min(1).max(500),
  mediaType: z.enum(['movie', 'tv']),
  tmdbId: z.string().regex(/^\d+$/),
  seasonNumber: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional()
});

// ✅ Good: Middleware usage
export const validateCreateMediaRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = CreateMediaRequestSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      });
    }
    next(error);
  }
};
```

#### Authentication & Authorization
```typescript
// ✅ Good: Role-based middleware
export const requireRole = (role: UserRole) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }
    
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    
    next();
  };
};

// ✅ Good: User isolation
export const requireOwnership = (resourceUserIdParam: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const resourceUserId = req.params[resourceUserIdParam];
    
    if (req.user.role !== 'admin' && req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }
    
    next();
  };
};
```

## Testing Requirements

### Test Coverage Standards

- **Minimum Coverage**: 70% overall
- **New Features**: 90% coverage required
- **Critical Paths**: 100% coverage (auth, data integrity)
- **Bug Fixes**: Must include regression tests

### Unit Testing

```typescript
// ✅ Good: Comprehensive unit test
describe('MediaService', () => {
  let mediaService: MediaService;
  let mockRepository: jest.Mocked<MediaRepository>;
  let mockOverseerrClient: jest.Mocked<OverseerrClient>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    mockOverseerrClient = createMockOverseerrClient();
    mediaService = new MediaService(mockRepository, mockOverseerrClient);
  });
  
  describe('searchMedia', () => {
    it('should return transformed search results', async () => {
      // Arrange
      const query = { title: 'Inception', type: 'movie' };
      const externalResults = [
        {
          tmdbId: '123',
          title: 'Inception',
          releaseDate: '2010-07-16',
          mediaType: 'movie',
          posterPath: '/poster.jpg',
          overview: 'A mind-bending thriller'
        }
      ];
      
      mockOverseerrClient.search.mockResolvedValue(externalResults);
      
      // Act
      const results = await mediaService.searchMedia(query);
      
      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: '123',
        title: 'Inception',
        year: 2010,
        type: 'movie',
        posterPath: '/poster.jpg',
        overview: 'A mind-bending thriller'
      });
    });
    
    it('should handle overseerr client errors', async () => {
      // Arrange
      const query = { title: 'Test', type: 'movie' };
      mockOverseerrClient.search.mockRejectedValue(new Error('Service unavailable'));
      
      // Act & Assert
      await expect(mediaService.searchMedia(query))
        .rejects.toThrow('Service unavailable');
    });
  });
});
```

### Integration Testing

```typescript
// ✅ Good: API integration test
describe('Media API', () => {
  let app: Express;
  let testDb: TestDatabase;
  let testUser: User;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createTestApp(testDb);
    testUser = await testDb.createUser({ role: 'user' });
  });
  
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  describe('POST /api/media/request', () => {
    it('should create media request for authenticated user', async () => {
      // Arrange
      const requestData = {
        title: 'Test Movie',
        mediaType: 'movie',
        tmdbId: '12345'
      };
      
      // Act
      const response = await request(app)
        .post('/api/media/request')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(requestData)
        .expect(201);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.userId).toBe(testUser.id);
      
      // Verify database state
      const dbRequest = await testDb.findMediaRequest(response.body.data.id);
      expect(dbRequest).toBeTruthy();
      expect(dbRequest.title).toBe(requestData.title);
    });
    
    it('should reject request without authentication', async () => {
      const requestData = { title: 'Test', mediaType: 'movie', tmdbId: '123' };
      
      await request(app)
        .post('/api/media/request')
        .send(requestData)
        .expect(401);
    });
  });
});
```

### End-to-End Testing

```typescript
// ✅ Good: E2E test with Playwright
test.describe('Media Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsUser(page, 'testuser');
  });
  
  test('should allow user to search and request media', async ({ page }) => {
    // Navigate to media page
    await page.click('[data-testid="nav-media"]');
    await page.waitForLoadState('networkidle');
    
    // Search for media
    await page.fill('[data-testid="search-input"]', 'Inception');
    await page.click('[data-testid="search-button"]');
    
    // Wait for results
    await page.waitForSelector('[data-testid="media-results"]');
    
    // Verify results are displayed
    const results = page.locator('[data-testid="media-card"]');
    await expect(results).toHaveCount.greaterThan(0);
    
    // Request first result
    await results.first().click('[data-testid="request-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-notification"]'))
      .toBeVisible();
    
    // Verify request appears in user's requests
    await page.click('[data-testid="nav-requests"]');
    await expect(page.locator('[data-testid="request-item"]'))
      .toContainText('Inception');
  });
});
```

## Documentation Guidelines

### Code Documentation

#### JSDoc Standards
```typescript
/**
 * Searches for media content across configured providers
 * 
 * @param query - Search parameters including title, type, and filters
 * @param options - Additional search options like pagination and sorting
 * @returns Promise resolving to paginated search results
 * 
 * @throws {ValidationError} When query parameters are invalid
 * @throws {ServiceUnavailableError} When external services are down
 * 
 * @example
 * ```typescript
 * const results = await mediaService.searchMedia(
 *   { title: 'Inception', type: 'movie' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */
async searchMedia(
  query: MediaSearchQuery,
  options: SearchOptions = {}
): Promise<PaginatedResult<MediaSearchResult>> {
  // Implementation
}
```

#### Component Documentation
```tsx
/**
 * ServiceCard displays the status and details of an external service
 * 
 * Features:
 * - Real-time status updates via WebSocket
 * - Connection testing functionality
 * - Responsive design for mobile and desktop
 * - Accessibility compliant (WCAG 2.1 AA)
 * 
 * @example
 * ```tsx
 * <ServiceCard
 *   service={{
 *     name: 'Plex Media Server',
 *     status: 'online',
 *     url: 'https://plex.example.com'
 *   }}
 *   onTest={() => testPlexConnection()}
 * />
 * ```
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({ 
  service, 
  onTest 
}) => {
  // Component implementation
};
```

### API Documentation

#### OpenAPI/Swagger Standards
```yaml
# ✅ Good: Complete API documentation
paths:
  /api/media/search:
    get:
      summary: Search for media content
      description: |
        Search for movies and TV shows across configured media providers.
        Results are paginated and can be filtered by type, year, and genre.
      parameters:
        - name: query
          in: query
          required: true
          description: Search query string
          schema:
            type: string
            minLength: 1
            maxLength: 100
        - name: type
          in: query
          description: Media type filter
          schema:
            type: string
            enum: [movie, tv, person]
        - name: page
          in: query
          description: Page number for pagination
          schema:
            type: integer
            minimum: 1
            default: 1
      responses:
        200:
          description: Search results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MediaSearchResponse'
        400:
          description: Invalid query parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

### README Updates

When adding features, update relevant README sections:

```markdown
## ✅ Features Added
- **Advanced Media Filtering**: Filter by genre, year, and rating
  - Persistent filter state across sessions
  - Quick filter presets for common searches
  - Mobile-optimized filter interface

## 📖 API Changes
- Added `/api/media/filters` endpoint for available filters
- Extended `/api/media/search` with new query parameters
- WebSocket event `media:filters-updated` for real-time updates

## 🔧 Configuration
New environment variables:
- `MEDIA_FILTER_CACHE_TTL`: Cache duration for filter options (default: 3600)
- `ENABLE_ADVANCED_FILTERS`: Enable advanced filtering UI (default: true)
```

## Pull Request Process

### Before Submitting

1. **Self-Review Checklist**
   - [ ] Code follows project style guide
   - [ ] All tests pass locally
   - [ ] No TypeScript errors
   - [ ] No linting warnings
   - [ ] Documentation updated
   - [ ] Environment variables documented
   - [ ] Breaking changes noted

2. **Testing Checklist**
   - [ ] Unit tests added/updated
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   - [ ] Cross-browser testing (for UI changes)
   - [ ] Mobile responsiveness verified

3. **Security Review**
   - [ ] No secrets in code
   - [ ] Input validation implemented
   - [ ] Authorization checks in place
   - [ ] SQL injection prevention
   - [ ] XSS protection

### Pull Request Template

```markdown
## Description
Brief description of the changes and their purpose.

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Refactoring
- [ ] ⚡ Performance improvement

## Related Issues
- Closes #[issue-number]
- Related to #[issue-number]

## Changes Made
- [ ] Detailed list of changes
- [ ] Including technical details
- [ ] And user-facing improvements

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Cross-browser testing (if applicable)

## Documentation
- [ ] Code documentation updated
- [ ] API documentation updated (if applicable)
- [ ] README updated (if applicable)
- [ ] Migration guide provided (for breaking changes)

## Screenshots (if applicable)
Include screenshots or GIFs for UI changes.

## Deployment Notes
Any special deployment considerations or database migrations needed.

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules
```

### Review Process

1. **Automated Checks**
   - CI pipeline must pass (tests, linting, type checking)
   - Security scans must pass
   - No merge conflicts

2. **Code Review**
   - At least one approving review from maintainer
   - All review comments addressed
   - Discussion resolved constructively

3. **Final Checks**
   - Branch up-to-date with target branch
   - No failing checks
   - Documentation complete

### Merge Strategy

- **Feature branches**: Squash and merge to keep clean history
- **Bug fixes**: Regular merge to preserve commit context
- **Documentation**: Squash and merge for clean history

## Community Guidelines

### Communication

- **Be Respectful**: Treat all contributors with kindness and respect
- **Be Clear**: Use clear, concise communication
- **Be Patient**: Remember that people have different schedules and time zones
- **Be Constructive**: Focus on solutions rather than problems

### Getting Help

1. **Documentation First**: Check existing docs and guides
2. **Search Issues**: Look for existing discussions
3. **Ask Questions**: Use GitHub Discussions for general questions
4. **Report Bugs**: Use issue templates for bug reports

### Recognition

We recognize contributors through:
- **Contributors List**: All contributors are listed in the project
- **Release Notes**: Significant contributions mentioned in releases
- **Community Shoutouts**: Recognition in community discussions
- **Badges**: Special recognition for regular contributors

## Advanced Contributing

### Becoming a Regular Contributor

After several successful contributions:

1. **Expertise Areas**: Develop expertise in specific areas
2. **Code Review**: Help review other contributors' PRs
3. **Issue Triage**: Help categorize and prioritize issues
4. **Documentation**: Contribute to and maintain documentation
5. **Community Support**: Help other contributors get started

### Maintainer Path

Exceptional contributors may be invited to become maintainers:

- **Technical Excellence**: Consistent high-quality contributions
- **Community Engagement**: Active participation in discussions
- **Leadership**: Helping guide project direction
- **Mentorship**: Supporting other contributors
- **Reliability**: Consistent availability and responsiveness

## License

By contributing to MediaNest, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to MediaNest! Your efforts help make this project better for everyone in the community.