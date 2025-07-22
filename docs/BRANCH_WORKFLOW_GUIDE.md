# MediaNest Branch Workflow Guide

## Overview

This guide provides detailed instructions for working with MediaNest's 4-branch strategy. It's designed for developers, DevOps engineers, and project managers who need to understand the new workflow.

## Branch Strategy Summary

| Branch | Purpose | Environment | Auto-Deploy | Protection Level |
|--------|---------|-------------|-------------|------------------|
| `main` | Production code | production.medianest.com | ✅ | Maximum |
| `development` | Integration & staging | staging.medianest.com | ✅ | High |
| `test` | QA & validation | test.medianest.com | ✅ | Medium |
| `claude-flowv2` | AI development | ai-dev.medianest.internal | ✅ | Medium |

## Developer Workflows

### 1. Feature Development Workflow

```bash
# 1. Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/user-authentication

# 2. Develop your feature
# ... make changes ...
git add .
git commit -m "feat: implement user authentication with JWT"

# 3. Push and create pull request
git push origin feature/user-authentication
# Create PR targeting 'development' branch
```

### 2. Bug Fix Workflow

```bash
# 1. Create bugfix branch from development
git checkout development
git pull origin development
git checkout -b bugfix/fix-login-redirect

# 2. Fix the bug
# ... make changes ...
git add .
git commit -m "fix: resolve login redirect loop issue"

# 3. Push and create pull request
git push origin bugfix/fix-login-redirect
# Create PR targeting 'development' branch
```

### 3. AI/Automation Development Workflow

```bash
# 1. Create AI feature branch from claude-flowv2
git checkout claude-flowv2
git pull origin claude-flowv2
git checkout -b ai/automated-media-tagging

# 2. Develop AI feature
# ... make changes ...
git add .
git commit -m "feat: implement automated media tagging with ML"

# 3. Push and create pull request
git push origin ai/automated-media-tagging
# Create PR targeting 'claude-flowv2' branch
```

### 4. Hotfix Workflow (Emergency Production Fixes)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-patch

# 2. Apply the fix
# ... make critical changes ...
git add .
git commit -m "fix: patch critical security vulnerability CVE-2024-XXXX"

# 3. Push and create emergency PR
git push origin hotfix/critical-security-patch
# Create PR targeting 'main' branch
# This requires admin approval and bypasses normal flow

# 4. After merge, back-merge to development
git checkout development
git pull origin main
git merge main
git push origin development
```

## Pull Request Guidelines

### PR Titles
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Examples:
  - `feat(auth): add OAuth2 integration`
  - `fix(media): resolve video streaming buffering issue`
  - `docs(api): update authentication endpoint documentation`

### PR Descriptions
Include:
- **Summary**: What does this PR do?
- **Motivation**: Why is this change needed?
- **Testing**: How was this tested?
- **Screenshots**: For UI changes
- **Breaking Changes**: Any API or behavior changes
- **Deployment Notes**: Any deployment considerations

### PR Checklist Template
```markdown
## PR Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated for changes
- [ ] Documentation updated if needed
- [ ] No merge conflicts
- [ ] CI/CD checks passing
- [ ] Breaking changes documented
- [ ] Database migrations included (if applicable)
```

## Branch Promotion Flow

### Standard Flow (Feature → Production)
```
feature/new-feature → development → test → main
                          ↓           ↓       ↓
                       staging    testing  production
```

### AI Development Flow
```
ai/ml-feature → claude-flowv2 → development → test → main
                     ↓              ↓          ↓       ↓
                 ai-dev         staging    testing  production
```

### Testing Integration Points
```
development (PR merge) → test (auto-merge) → main (manual promotion)
     ↓                      ↓                    ↓
  staging env           testing env         production env
```

## Environment Management

### Development Environment (staging.medianest.com)
- **Purpose**: Integration testing and stakeholder review
- **Data**: Sanitized production copy (refreshed weekly)
- **Access**: All developers, product team
- **Deployment**: Automatic on push to `development`
- **Rollback**: Previous commit via deployment pipeline

### Test Environment (test.medianest.com)
- **Purpose**: QA testing, performance testing, automated testing
- **Data**: Controlled test datasets
- **Access**: QA team, automated testing systems
- **Deployment**: Automatic on push to `test`
- **Rollback**: Branch reset or previous deployment

### Production Environment (production.medianest.com)
- **Purpose**: Live user traffic
- **Data**: Real production data
- **Access**: Limited to operations team
- **Deployment**: Automatic on push to `main` (with approval gates)
- **Rollback**: Blue/green deployment rollback

### AI Development Environment (ai-dev.medianest.internal)
- **Purpose**: AI/ML model testing, automation development
- **Data**: Subset of production data for model training
- **Access**: AI developers, automation engineers
- **Deployment**: Automatic on push to `claude-flowv2`
- **Rollback**: Model versioning rollback

## Code Review Process

### Review Requirements by Branch

#### main Branch PRs
- **Reviewers**: 2 required (must include tech lead)
- **Checks**: All CI/CD checks must pass
- **Additional**: Security review for sensitive changes
- **Timeline**: Review within 4 hours for hotfixes, 24 hours for standard

#### development Branch PRs
- **Reviewers**: 1 required
- **Checks**: Unit tests and linting must pass
- **Additional**: Design review for UI changes
- **Timeline**: Review within 24 hours

#### test Branch PRs
- **Reviewers**: 1 required (can be QA team member)
- **Checks**: Integration tests must pass
- **Additional**: Test plan review
- **Timeline**: Review within 48 hours

#### claude-flowv2 Branch PRs
- **Reviewers**: 1 required (preferably AI/automation expert)
- **Checks**: AI workflow tests and security scan
- **Additional**: Model validation for ML changes
- **Timeline**: Review within 48 hours

### Review Checklist for Reviewers
- [ ] Code follows established patterns and style
- [ ] Business logic is sound and efficient
- [ ] Security implications considered
- [ ] Error handling is appropriate
- [ ] Tests are comprehensive and meaningful
- [ ] Documentation is updated
- [ ] Performance impact is acceptable
- [ ] Breaking changes are documented

## Conflict Resolution

### Merge Conflicts
1. **Prevention**: Keep branches up to date with targets
2. **Resolution**: Developer resolves conflicts in feature branch
3. **Validation**: Re-run tests after conflict resolution
4. **Escalation**: Tech lead involvement for complex conflicts

### Branch Synchronization
```bash
# Daily synchronization (automated)
# development ← main (to get hotfixes)
# test ← development (to get new features)

# Manual synchronization when needed
git checkout development
git pull origin main
git push origin development
```

## CI/CD Pipeline Behavior

### Branch-Specific Pipelines

#### main Branch Pipeline
1. Full test suite (unit, integration, e2e)
2. Security scanning (SAST, dependency audit)
3. Performance testing
4. Docker build and push
5. Production deployment (blue/green)
6. Health checks and monitoring alerts

#### development Branch Pipeline
1. Unit and integration tests
2. Basic security scanning
3. Docker build and push
4. Staging deployment
5. Smoke tests

#### test Branch Pipeline
1. Full test suite execution
2. Performance benchmarks
3. Docker build and push
4. Test environment deployment
5. Automated test execution

#### claude-flowv2 Branch Pipeline
1. AI workflow validation tests
2. Model training/validation (if applicable)
3. Security scanning
4. Docker build and push
5. AI development environment deployment

### Pipeline Triggers
- **Push to protected branch**: Full pipeline
- **PR creation**: Validation pipeline (no deployment)
- **PR update**: Re-run validation pipeline
- **Manual trigger**: Available for all pipelines with parameters

## Monitoring and Alerting

### Branch Health Monitoring
- Merge frequency and success rates
- Branch age and staleness
- Conflict frequency and resolution time
- Pipeline success rates by branch

### Deployment Monitoring
- Deployment frequency by environment
- Rollback frequency and causes
- Performance metrics per environment
- Error rates and user impact

### Team Productivity Metrics
- Time from PR creation to merge
- Code review turnaround time
- Feature delivery velocity
- Bug fix cycle time

## Emergency Procedures

### Production Incident Response
1. **Immediate**: Create hotfix branch from `main`
2. **Fix**: Apply minimal fix with clear commit message
3. **Review**: Emergency review by available tech lead
4. **Deploy**: Fast-track through pipeline with approval
5. **Monitor**: Watch deployment metrics closely
6. **Follow-up**: Back-merge to `development` within 24 hours

### Rollback Procedures

#### Production Rollback
```bash
# Option 1: Blue/green rollback (preferred)
kubectl rollout undo deployment/medianest-production

# Option 2: Git revert (if blue/green unavailable)
git checkout main
git revert HEAD
git push origin main
```

#### Staging/Test Rollback
```bash
# Simple branch reset for non-production
git checkout development  # or test
git reset --hard HEAD~1
git push --force origin development  # or test
```

## Best Practices

### General Guidelines
1. **Keep branches short-lived**: Merge within 3-5 days
2. **Small, focused PRs**: Easier to review and less risky
3. **Clear commit messages**: Follow conventional commit format
4. **Test locally**: Run tests before pushing
5. **Stay updated**: Sync with target branches regularly

### Branch Naming Conventions
- **Features**: `feature/short-description`
- **Bug fixes**: `bugfix/short-description`
- **Hotfixes**: `hotfix/short-description`
- **AI features**: `ai/short-description`
- **Experiments**: `experiment/short-description`

### Commit Message Format
```
type(scope): short description

Longer description if needed.

- Breaking changes documented
- Related issues: Closes #123
```

### Code Quality Standards
- **Coverage**: Maintain >80% test coverage
- **Linting**: Zero linting errors/warnings
- **Security**: No high/critical vulnerabilities
- **Performance**: No regressions in key metrics

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Branch protection rules prevent push"
**Solution**: Create a PR instead of pushing directly
```bash
git checkout -b fix/branch-push-issue
git push origin fix/branch-push-issue
# Create PR via GitHub/GitLab interface
```

#### Issue: "Merge conflicts in development"
**Solution**: Update your branch with latest development
```bash
git checkout your-feature-branch
git fetch origin
git rebase origin/development
# Resolve conflicts
git rebase --continue
git push --force-with-lease origin your-feature-branch
```

#### Issue: "CI/CD pipeline failing"
**Solution**: Check specific failure and fix
```bash
# Run tests locally to identify issues
npm run test
npm run lint
npm run build

# Check specific component failures
cd backend && npm test
cd frontend && npm test
cd shared && npm test
```

#### Issue: "Deployment stuck in progress"
**Solution**: Check deployment status and logs
```bash
# Check deployment status
kubectl get deployments
kubectl describe deployment medianest-[environment]

# Check logs
kubectl logs -f deployment/medianest-[environment]
```

## Getting Help

### Escalation Path
1. **Technical questions**: Ask in #dev-medianest Slack channel
2. **Process questions**: Ask tech lead or project manager
3. **Emergency issues**: Page on-call engineer
4. **Branch strategy feedback**: Create issue in repository

### Resources
- **Architecture Documentation**: `/docs/BRANCH_ARCHITECTURE.md`
- **Migration Guide**: `/scripts/branch-migration.sh --help`
- **CI/CD Configuration**: `/.github/workflows/branch-strategy.yml`
- **Protection Rules**: `/.github/branch-protection.yml`

### Team Contacts
- **Tech Lead**: [Contact information]
- **DevOps Engineer**: [Contact information]  
- **Product Manager**: [Contact information]
- **On-call Engineer**: [Pager/phone information]

---

*This guide is a living document. Please suggest improvements via PR to the `docs/` directory.*