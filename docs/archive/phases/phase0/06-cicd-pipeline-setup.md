# Task: CI/CD Pipeline Configuration

**Priority:** High  
**Estimated Duration:** 2 hours  
**Dependencies:** 03-linting-formatting-setup, 05-docker-configuration  
**Phase:** 0 (Week 1 - Day 3)

## Objective

**Status:** ✅ Complete

Configure GitHub Actions for automated testing, set up branch protection rules, configure automated dependency updates with Dependabot, establish code coverage reporting, and create PR templates and contributing guidelines.

## Background

A robust CI/CD pipeline ensures code quality, prevents regressions, and automates repetitive tasks. This setup will catch issues early and maintain high code standards throughout development.

## Detailed Requirements

### 1. GitHub Actions Workflows

- Main CI workflow for tests and linting
- Docker build verification
- Dependency security scanning
- Code coverage reporting

### 2. Branch Protection

- Require PR reviews
- Require status checks
- Prevent force pushes
- Enforce linear history

### 3. Automated Updates

- Dependabot for npm packages
- Security vulnerability alerts
- Automated PR creation

### 4. Documentation

- PR template
- Issue templates
- Contributing guidelines
- Code of conduct

## Technical Implementation Details

### Main CI Workflow (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  # Lint and type check
  lint:
    name: Lint and Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npm run type-check

  # Unit and integration tests
  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test
        run: |
          cd backend
          npx prisma migrate deploy

      - name: Run tests
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          NEXTAUTH_SECRET: test-nextauth-secret
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  # Build verification
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build projects
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4000

  # Docker build verification
  docker:
    name: Docker Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: medianest:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Security scanning
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  # E2E tests (only on main branch)
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: test-results/
```

### PR Check Workflow (.github/workflows/pr-check.yml)

```yaml
name: PR Check

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  # Check PR title follows conventional commits
  pr-title:
    name: Validate PR Title
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            docs
            style
            refactor
            perf
            test
            build
            ci
            chore
            revert

  # Check file sizes
  file-size:
    name: Check File Sizes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for large files
        run: |
          find . -type f -size +1M | grep -v node_modules | grep -v .git > large_files.txt || true
          if [ -s large_files.txt ]; then
            echo "Large files detected:"
            cat large_files.txt
            exit 1
          fi
```

### Dependabot Configuration (.github/dependabot.yml)

```yaml
version: 2
updates:
  # Root package.json
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '03:00'
    open-pull-requests-limit: 5
    groups:
      development-dependencies:
        patterns:
          - '@types/*'
          - 'eslint*'
          - 'prettier*'
          - '*test*'

  # Frontend dependencies
  - package-ecosystem: 'npm'
    directory: '/frontend'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '03:00'
    open-pull-requests-limit: 5
    groups:
      next-ecosystem:
        patterns:
          - 'next'
          - '@next/*'
          - 'react'
          - 'react-dom'

  # Backend dependencies
  - package-ecosystem: 'npm'
    directory: '/backend'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '03:00'
    open-pull-requests-limit: 5

  # Docker dependencies
  - package-ecosystem: 'docker'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '03:00'

  # GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '03:00'
```

### PR Template (.github/pull_request_template.md)

```markdown
## Description

Brief description of the changes in this PR.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issue

Fixes #(issue number)

## How Has This Been Tested?

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] E2E tests

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if appropriate)

Add screenshots here if UI changes are involved.

## Additional Notes

Any additional information that reviewers should know.
```

### Issue Templates

#### Bug Report (.github/ISSUE_TEMPLATE/bug_report.md)

```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior

A clear and concise description of what you expected to happen.

## Screenshots

If applicable, add screenshots to help explain your problem.

## Environment

- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome, Firefox, Safari]
- Version: [e.g. 1.0.0]

## Additional Context

Add any other context about the problem here.
```

#### Feature Request (.github/ISSUE_TEMPLATE/feature_request.md)

```markdown
---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Is your feature request related to a problem? Please describe.

A clear and concise description of what the problem is.

## Describe the solution you'd like

A clear and concise description of what you want to happen.

## Describe alternatives you've considered

A clear and concise description of any alternative solutions or features you've considered.

## Additional context

Add any other context or screenshots about the feature request here.
```

### Contributing Guidelines (CONTRIBUTING.md)

```markdown
# Contributing to MediaNest

First off, thank you for considering contributing to MediaNest!

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

- Use the bug report template
- Include as much detail as possible
- Include steps to reproduce

### Suggesting Features

- Use the feature request template
- Explain the problem it solves
- Consider the project scope

### Pull Requests

1. Fork the repo and create your branch from `develop`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Issue that pull request!

## Development Process

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Create a feature branch: `git checkout -b feature/your-feature`
5. Make your changes
6. Run tests: `npm test`
7. Commit with conventional commits
8. Push and create a PR

## Style Guide

- Follow the ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages
- Add JSDoc comments for public APIs

## Testing

- Write tests for new features
- Maintain test coverage above 70%
- Run `npm test` before committing

## Questions?

Feel free to open an issue with your question!
```

### Branch Protection Settings (via GitHub UI)

```
Main Branch Protection:
- Require pull request reviews (1 approval)
- Dismiss stale pull request approvals
- Require review from CODEOWNERS
- Require status checks to pass:
  - ci/lint
  - ci/test
  - ci/build
- Require branches to be up to date
- Require conversation resolution
- Require signed commits (optional)
- Include administrators
- Restrict who can push (maintainers only)

Develop Branch Protection:
- Require pull request reviews (1 approval)
- Require status checks to pass:
  - ci/lint
  - ci/test
- Require branches to be up to date
```

## Acceptance Criteria

1. ✅ CI workflow runs on all PRs
2. ✅ Tests run automatically
3. ✅ Linting enforced
4. ✅ Docker builds verified
5. ✅ Dependabot creates PRs
6. ✅ Branch protection active
7. ✅ PR template used
8. ✅ Code coverage reported

## Testing Requirements

1. Create a test PR and verify workflows run
2. Check that failing tests block merge
3. Verify Dependabot configuration
4. Test PR template appears
5. Confirm branch protection works

## Setup Commands

```bash
# Create workflow directories
mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE

# Create workflow files
touch .github/workflows/ci.yml
touch .github/workflows/pr-check.yml
touch .github/dependabot.yml
touch .github/pull_request_template.md
touch CONTRIBUTING.md

# Add CI badge to README
echo "![CI](https://github.com/your-username/medianest/workflows/CI/badge.svg)" >> README.md
```

## Common Issues & Solutions

1. **Workflows not running**: Check file permissions and YAML syntax
2. **Service containers failing**: Ensure health checks are correct
3. **Coverage not uploading**: Verify Codecov token is set
4. **Dependabot not working**: Check configuration syntax

## Next Steps

- Complete Phase 0 documentation
- Begin Phase 1 implementation
- Set up monitoring for CI/CD

## Completion Notes

- Completed on: July 4, 2025
- All acceptance criteria met
- Ready for production use

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
