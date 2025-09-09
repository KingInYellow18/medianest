# Development Workflow Guide

This guide outlines the day-to-day development workflow for MediaNest contributors, from setting up your workspace to deploying features to production.

## Table of Contents

- [Daily Development Flow](#daily-development-flow)
- [Git Workflow](#git-workflow)
- [Code Quality Process](#code-quality-process)
- [Testing Workflow](#testing-workflow)
- [Review Process](#review-process)
- [Deployment Process](#deployment-process)
- [Maintenance Tasks](#maintenance-tasks)

## Daily Development Flow

### Morning Routine

1. **Sync Your Fork**
   ```bash
   git checkout develop
   git pull upstream develop
   git push origin develop
   ```

2. **Start Development Environment**
   ```bash
   # Start database services
   docker compose -f docker-compose.dev.yml up -d
   
   # Start development servers
   npm run dev
   
   # Verify everything is running
   curl http://localhost:4000/api/health
   ```

3. **Check for Updates**
   ```bash
   # Check for dependency updates
   npm outdated
   
   # Check for new issues or PRs
   gh issue list --assignee @me
   gh pr list --author @me
   ```

### Working on Features

1. **Plan Your Work**
   - Review issue requirements
   - Break down into smaller tasks
   - Estimate time needed
   - Comment on issue with plan

2. **Create Feature Branch**
   ```bash
   # Always start from develop
   git checkout develop
   git pull upstream develop
   
   # Create feature branch
   git checkout -b feature/123-add-media-filtering
   ```

3. **Development Cycle**
   ```bash
   # Make changes iteratively
   # Run tests frequently
   npm test
   
   # Check types
   npm run type-check
   
   # Commit small, logical changes
   git add -A
   git commit -m "feat(media): add basic filter structure"
   ```

### End of Day

1. **Save Progress**
   ```bash
   # Push work in progress
   git push origin feature/123-add-media-filtering
   
   # Create draft PR if significant progress
   gh pr create --draft --title "WIP: Add media filtering" --body "Work in progress"
   ```

2. **Clean Up**
   ```bash
   # Stop development servers
   # Ctrl+C to stop npm run dev
   
   # Optional: Stop Docker services to free resources
   docker compose -f docker-compose.dev.yml down
   ```

## Git Workflow

### Branch Management

#### Branch Types and Naming

```bash
# Feature branches (new functionality)
feature/123-add-media-filtering
feature/456-youtube-download-ui

# Bug fix branches
fix/789-auth-token-expiry
fix/101-websocket-reconnection

# Documentation branches
docs/api-reference-update
docs/deployment-guide

# Refactoring branches
refactor/service-layer-cleanup
refactor/component-structure

# Chore branches (maintenance tasks)
chore/update-dependencies
chore/improve-ci-pipeline
```

#### Working with Branches

```bash
# Create and switch to new branch
git checkout -b feature/new-feature

# Switch between branches
git checkout develop
git checkout feature/new-feature

# Update branch with latest changes
git fetch upstream
git rebase upstream/develop

# Push branch to your fork
git push origin feature/new-feature

# Delete local branch after merge
git branch -d feature/new-feature

# Delete remote branch
git push origin --delete feature/new-feature
```

### Commit Guidelines

#### Conventional Commits Format

```bash
# Format: <type>(<scope>): <subject>
#
# <body>
#
# <footer>

# Examples:
git commit -m "feat(media): add advanced search filters

Implement genre, year, and rating filters for media search.
Includes:
- Filter component with multi-select options
- Backend API support for filter parameters
- Persistent filter state in local storage

Closes #123"

git commit -m "fix(auth): resolve session timeout issue

Session tokens were expiring prematurely due to incorrect
timezone handling in JWT validation.

Fixes #456"

git commit -m "docs(api): update authentication endpoints

Add examples for new JWT refresh token flow.
Update error response documentation.

Related to #789"
```

#### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools
- **ci**: Changes to CI configuration files and scripts
- **revert**: Reverts a previous commit

#### Commit Best Practices

```bash
# ✅ Good commits
git commit -m "feat(dashboard): add real-time status updates"
git commit -m "fix(api): validate user permissions in media requests"
git commit -m "test(auth): add unit tests for JWT service"
git commit -m "docs(readme): update installation instructions"

# ❌ Poor commits
git commit -m "fixes"
git commit -m "WIP"
git commit -m "updates and stuff"
git commit -m "fix bugs and add features"
```

### Rebase vs Merge Strategy

#### When to Rebase

```bash
# Update feature branch with latest develop
git fetch upstream
git rebase upstream/develop

# Interactive rebase to clean up commits
git rebase -i HEAD~3

# Use rebase for:
# - Updating feature branches
# - Cleaning up commit history
# - Removing "fix typo" commits
```

#### When to Merge

```bash
# Merge develop into feature for complex conflicts
git merge upstream/develop

# Use merge for:
# - Integrating large features
# - Preserving collaboration history
# - When rebase would be destructive
```

## Code Quality Process

### Automated Quality Checks

#### Pre-commit Hooks

The project uses `simple-git-hooks` and `lint-staged`:

```bash
# Pre-commit hook runs automatically
# Manually trigger: npx lint-staged

# What runs on commit:
# - ESLint on TypeScript/JavaScript files
# - Prettier formatting
# - Type checking on changed files
# - Test files related to changes
```

#### CI/CD Pipeline

```bash
# Triggered on push to any branch
# - Install dependencies
# - Run type checking
# - Run linting
# - Run all tests
# - Build project
# - Security scanning
```

### Manual Quality Checks

#### Before Committing

```bash
# Run full test suite
npm test

# Check TypeScript errors
npm run type-check

# Lint and format code
npm run lint
npm run format

# Build to verify no build errors
npm run build
```

#### Code Review Checklist

**Functionality**
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance is acceptable

**Code Quality**
- [ ] Code is readable and well-documented
- [ ] Functions are small and focused
- [ ] No code duplication
- [ ] TypeScript types are accurate

**Testing**
- [ ] Unit tests cover new functionality
- [ ] Integration tests updated if needed
- [ ] Manual testing completed
- [ ] Test data is realistic

**Security**
- [ ] Input validation implemented
- [ ] Authorization checks in place
- [ ] No secrets in code
- [ ] SQL injection prevention

## Testing Workflow

### Test-Driven Development (TDD)

#### Red-Green-Refactor Cycle

```bash
# 1. Red: Write failing test
npm test -- --watch media.service.test.ts

# Write test that fails
describe('MediaService.searchMedia', () => {
  it('should filter by genre', async () => {
    const results = await mediaService.searchMedia({ genre: 'action' });
    expect(results.every(r => r.genres.includes('action'))).toBe(true);
  });
});

# 2. Green: Make test pass with minimal code
# Implement just enough code to make the test pass

# 3. Refactor: Improve code while keeping tests green
# Clean up implementation, improve performance, etc.
```

### Testing Strategies

#### Unit Testing

```bash
# Run specific test file
npm test media.service.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Debug tests
npm run test:ui
```

#### Integration Testing

```bash
# Start test database
npm run test:setup

# Run integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- api.test.ts

# Clean up test environment
npm run test:teardown
```

#### End-to-End Testing

```bash
# Install Playwright browsers (first time)
cd backend && npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run specific test file
npm run test:e2e -- auth.spec.ts

# Debug failed tests
npm run test:e2e:debug
```

### Testing Best Practices

#### Test Structure

```typescript
// ✅ Good test structure
describe('MediaController', () => {
  let controller: MediaController;
  let mockService: jest.Mocked<MediaService>;
  
  beforeEach(() => {
    // Setup test environment
    mockService = createMockMediaService();
    controller = new MediaController(mockService);
  });
  
  describe('searchMedia', () => {
    const validRequest = {
      query: 'Inception',
      type: 'movie'
    };
    
    it('should return search results for valid query', async () => {
      // Arrange
      const expectedResults = [{ id: '1', title: 'Inception' }];
      mockService.searchMedia.mockResolvedValue(expectedResults);
      
      // Act
      const response = await controller.searchMedia(validRequest);
      
      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(expectedResults);
    });
    
    it('should handle service errors gracefully', async () => {
      // Arrange
      mockService.searchMedia.mockRejectedValue(new Error('Service unavailable'));
      
      // Act & Assert
      await expect(controller.searchMedia(validRequest))
        .rejects.toThrow('Service unavailable');
    });
  });
});
```

#### Mock Management

```typescript
// Create reusable mocks
export const createMockMediaService = (): jest.Mocked<MediaService> => ({
  searchMedia: jest.fn(),
  getMediaDetails: jest.fn(),
  requestMedia: jest.fn(),
  getUserRequests: jest.fn(),
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock external dependencies
jest.mock('../integrations/overseerr.client', () => ({
  OverseerrClient: jest.fn().mockImplementation(() => ({
    search: jest.fn(),
    getMovie: jest.fn(),
  }))
}));
```

## Review Process

### Preparing for Review

#### Self-Review Checklist

```bash
# Before requesting review:

# 1. Review your own changes
git diff develop...HEAD

# 2. Ensure all checks pass
npm test
npm run lint
npm run type-check
npm run build

# 3. Update documentation
# - Update README if needed
# - Add/update API docs
# - Update CHANGELOG.md

# 4. Write clear PR description
# - Explain the problem being solved
# - Describe the solution approach
# - List any breaking changes
# - Include screenshots for UI changes
```

#### PR Template Completion

```markdown
## Description
Clear description of what this PR does and why.

## Changes Made
- [ ] Added media filtering functionality
- [ ] Updated API endpoints to support filters
- [ ] Added filter persistence to localStorage
- [ ] Updated tests for new functionality

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] Manual testing completed
- [ ] Cross-browser testing done

## Screenshots
Include before/after screenshots for UI changes.

## Breaking Changes
List any breaking changes and migration steps.
```

### Review Guidelines

#### As a Reviewer

**Focus Areas:**
1. **Functionality**: Does the code work as intended?
2. **Code Quality**: Is it maintainable and readable?
3. **Performance**: Are there any performance concerns?
4. **Security**: Are there any security implications?
5. **Testing**: Is the code adequately tested?

**Review Process:**
```bash
# Checkout PR branch for testing
gh pr checkout 123

# Start development environment
npm run dev

# Test the functionality manually
# Run automated tests
npm test

# Review code changes
# Leave constructive feedback
# Approve or request changes
```

**Constructive Feedback Examples:**
```markdown
# ✅ Good feedback
Consider extracting this logic into a separate function for reusability:
[suggest specific code]

This could potentially cause a memory leak. Have you considered using useCallback here?

Great implementation! One small suggestion: we could add error boundaries here for better UX.

# ❌ Poor feedback
This is wrong.
Change this.
I don't like this approach.
```

#### As a PR Author

**Responding to Reviews:**
- Thank reviewers for their time
- Ask clarifying questions if feedback is unclear
- Make requested changes promptly
- Explain decisions when you disagree
- Request re-review after making changes

```bash
# Address feedback
git add .
git commit -m "refactor: extract media filter logic into custom hook"
git push origin feature/123-add-media-filtering

# Request re-review
gh pr review --comment --body "Thanks for the feedback! I've addressed all the suggestions and would appreciate another look."
```

## Deployment Process

### Development Deployment

#### Local Development

```bash
# Start full development environment
docker compose -f docker-compose.dev.yml up -d
npm run dev

# Access services:
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# Database: localhost:5432
# Redis: localhost:6379
```

#### Staging Environment

```bash
# Deploy to staging (maintainers only)
git checkout develop
git pull upstream develop
npm run build
npm run deploy:staging

# Test staging deployment
npm run test:e2e:staging
```

### Production Deployment

#### Pre-deployment Checklist

- [ ] All tests pass in CI
- [ ] Code review approved
- [ ] Breaking changes documented
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Backup procedures ready

#### Deployment Steps

```bash
# 1. Final preparation
git checkout main
git pull upstream main
git merge upstream/develop

# 2. Version bump and tagging
npm version patch|minor|major
git push upstream main --tags

# 3. Build and deploy
npm run build:prod
npm run deploy:prod

# 4. Verify deployment
npm run health-check:prod
npm run test:smoke:prod
```

#### Post-deployment

- Monitor application logs
- Check error rates and performance
- Verify all services are healthy
- Update documentation if needed
- Communicate deployment to team

### Rollback Procedures

```bash
# If issues are detected:

# 1. Quick rollback
npm run rollback:prod

# 2. Or manual rollback
git revert HEAD
npm run deploy:prod

# 3. Monitor recovery
npm run health-check:prod
```

## Maintenance Tasks

### Regular Maintenance

#### Weekly Tasks

```bash
# Update dependencies
npm update
npm audit fix

# Clean up branches
git remote prune origin
git branch -d $(git branch --merged | grep -v "main\|develop")

# Review performance metrics
npm run analyze:performance

# Check test coverage
npm run test:coverage
```

#### Monthly Tasks

```bash
# Major dependency updates
npm outdated
# Evaluate and update major versions

# Security audit
npm audit
npm run security:scan

# Database maintenance
npm run db:analyze
npm run db:vacuum

# Performance review
npm run performance:report
```

#### Release Tasks

```bash
# Prepare release
git checkout main
git merge develop
npm version minor
git push --tags

# Update CHANGELOG.md
# Create GitHub release
gh release create v1.2.0 --generate-notes

# Deploy to production
npm run deploy:prod

# Post-release cleanup
git checkout develop
git merge main
git push upstream develop
```

### Troubleshooting Workflow

#### Common Issues

**TypeScript Errors:**
```bash
# Clear TypeScript cache
npx tsc --build --clean

# Regenerate Prisma client
npm run db:generate

# Restart TS server in VS Code
# Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

**Test Failures:**
```bash
# Clear test cache
npx jest --clearCache

# Reset test database
npm run test:setup

# Debug specific test
npm run test:ui -- --grep "failing test name"
```

**Build Failures:**
```bash
# Clear build cache
npm run clean
rm -rf node_modules/.cache

# Reinstall dependencies
rm package-lock.json
npm install

# Check for circular dependencies
npx madge --circular src/
```

**Performance Issues:**
```bash
# Profile application
npm run dev -- --inspect
# Open Chrome DevTools -> Node.js icon

# Analyze bundle size
npm run analyze

# Check memory usage
npm run dev:memory-profile
```

### Documentation Workflow

#### Keeping Documentation Updated

```bash
# When adding features:
# 1. Update README.md feature list
# 2. Add API documentation
# 3. Update environment variables docs
# 4. Add troubleshooting section if needed

# Generate API docs
npm run docs:api

# Build documentation site
npm run docs:build

# Preview documentation locally
npm run docs:serve
```

## Tools and Scripts

### Useful Development Scripts

```bash
# Package.json scripts
npm run dev              # Start development servers
npm run build           # Build for production
npm run test            # Run all tests
npm run lint            # Check code style
npm run type-check      # Check TypeScript types
npm run clean           # Clean build artifacts

# Database scripts
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio
npm run db:reset        # Reset database

# Docker scripts
npm run docker:up       # Start Docker services
npm run docker:down     # Stop Docker services
npm run docker:logs     # View Docker logs
npm run docker:build    # Build Docker images
```

### Development Aliases

```bash
# Add to your shell configuration
alias mn-dev="cd ~/projects/medianest && npm run dev"
alias mn-test="cd ~/projects/medianest && npm test"
alias mn-build="cd ~/projects/medianest && npm run build"
alias mn-reset="cd ~/projects/medianest && docker compose -f docker-compose.dev.yml down -v && npm run db:migrate"
```

## Best Practices Summary

### Code Organization
- Keep functions small and focused
- Use consistent naming conventions
- Organize files logically
- Avoid deep nesting

### Git Hygiene
- Write clear commit messages
- Keep commits atomic and focused
- Rebase feature branches regularly
- Clean up branches after merge

### Testing Strategy
- Write tests first when possible
- Test edge cases and error conditions
- Use realistic test data
- Keep tests fast and isolated

### Code Review
- Review your own code first
- Provide constructive feedback
- Be responsive to feedback
- Learn from each review

### Performance
- Profile before optimizing
- Monitor key metrics
- Use appropriate caching
- Consider user experience

This workflow guide will evolve as the project grows. Always feel free to suggest improvements to make development more efficient and enjoyable!