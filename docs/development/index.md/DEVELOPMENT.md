# Development Guide

## 🏆 Code Quality Standards

**Repository Health Score:** 96/100  
**Technical Debt:** LOW  
**Last Audit:** January 10, 2025

## Development Environment Setup

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- PostgreSQL 15.x
- Redis 7.x
- TypeScript 5.x

### Initial Setup

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd medianest
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   npm run generate-secrets
   ```

3. **Database Setup**

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## Coding Standards

### File Naming Conventions

✅ **REQUIRED Standards:**

- Use kebab-case for all files: `user-service.ts`, `auth-middleware.ts`
- No temporal suffixes: ❌ `-fixed`, `-old`, `-new`, `-backup`, `-copy`
- Descriptive names that reflect purpose
- Consistent casing throughout

### Code Organization

```
medianest/
├── apps/                    # Applications
│   ├── api-server/         # Backend API
│   ├── web-client/         # Frontend app
│   └── docs-site/          # Documentation
├── packages/               # Shared libraries
│   ├── types/             # TypeScript types
│   ├── config/            # Shared configs
│   └── utils/             # Utilities
├── tools/                  # Dev tools
└── docs/                   # Documentation
    └── reports/           # Technical reports
```

### Security Requirements

⚠️ **CRITICAL - Never commit:**

- Console.log statements in production code
- Hardcoded secrets or API keys
- Debug information in production builds
- Commented-out code blocks
- TODO comments without GitHub issues

### Import Standards

```typescript
// ✅ GOOD - Organized imports
import { Controller, Get, Post } from '@nestjs/common';
import { UserService } from '@/services/user.service';
import { User } from '@/types';

// ❌ BAD - Unused imports
import { unused } from 'library'; // Will be caught in review
```

## Quality Assurance

### Pre-Commit Checklist

Before committing code, ensure:

1. **Build passes:** `npm run build`
2. **Tests pass:** `npm test`
3. **Linting passes:** `npm run lint`
4. **Type checking:** `npm run typecheck`
5. **No console.log:** Check for debug statements
6. **Professional naming:** No -fixed, -old suffixes

### Automated Checks

Our CI/CD pipeline enforces:

- ✅ TypeScript strict mode
- ✅ ESLint rules compliance
- ✅ No security vulnerabilities
- ✅ Build success
- ✅ Test passage

### Code Review Standards

All PRs must:

- Follow naming conventions
- Include tests for new features
- Update documentation if needed
- Pass all automated checks
- Have descriptive commit messages

## Testing Guidelines

### Test Organization

Tests are co-located with source code:

```
src/
├── services/
│   ├── user.service.ts
│   └── user.service.test.ts
```

### Test Coverage Requirements

- **Minimum:** 75% (current)
- **Target:** 90% (Q2 2025)
- **Critical paths:** 100% required

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- user.service.test.ts

# Run in watch mode
npm run test:watch
```

## Development Workflow

### Branch Strategy

```bash
main           # Production-ready code
├── develop    # Integration branch
├── feature/*  # New features
├── fix/*      # Bug fixes
└── chore/*    # Maintenance tasks
```

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes following standards
3. Run quality checks locally
4. Push and create PR
5. Address review feedback
6. Merge after approval

## Performance Guidelines

### Optimization Checklist

- [ ] Lazy load heavy components
- [ ] Implement proper caching
- [ ] Optimize database queries
- [ ] Use indexes appropriately
- [ ] Monitor memory usage
- [ ] Profile performance bottlenecks

### Monitoring

```bash
# Check memory usage
npm run monitor:memory

# Profile performance
npm run profile

# Analyze bundle size
npm run analyze
```

## Documentation Standards

### Code Documentation

```typescript
/**
 * Service for managing user authentication
 * @class AuthService
 * @implements {IAuthService}
 */
export class AuthService {
  /**
   * Authenticates a user with credentials
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<AuthToken>} Authentication token
   * @throws {UnauthorizedException} Invalid credentials
   */
  async authenticate(email: string, password: string): Promise<AuthToken> {
    // Implementation
  }
}
```

### API Documentation

- All endpoints must be documented
- Include request/response examples
- Document error codes
- Specify rate limits

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build
```

#### Test Failures

```bash
# Reset test database
npm run db:test:reset
```

#### Type Errors

```bash
# Regenerate types
npm run generate:types
```

## Technical Debt Management

### Current Status

- **Score:** 96/100 (Excellent)
- **Debt Level:** Low
- **Next Audit:** April 10, 2025

### Prevention Measures

1. Regular code reviews
2. Automated quality checks
3. Quarterly technical debt audits
4. Continuous refactoring
5. Documentation updates

### Reporting Issues

Found technical debt? Report it:

1. Check `/docs/reports/` for existing reports
2. Create GitHub issue with `tech-debt` label
3. Include severity and impact assessment

## Resources

### Internal Documentation

- [Technical Debt Status](/TECHNICAL_DEBT_STATUS.md)
- [Architecture Documentation](/docs/architecture.md)
- [API Documentation](/docs/api.md)
- [Deployment Guide](/docs/deployment.md)

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)

## Contact

For development questions:

- Review this guide
- Check technical reports in `/docs/reports/`
- Consult team lead for clarifications

---

**Last Updated:** January 10, 2025  
**Maintained By:** Development Team
