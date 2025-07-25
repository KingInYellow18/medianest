# MediaNest 4-Tier Branch Workflow

## Branch Structure

```
main (production) ← development ← test ← claude-flow
```

### Branch Roles

1. **`main`** - Production branch
   - Contains production-ready code
   - Protected branch with strict merge requirements
   - Only accepts merges from `development`
   - Triggers deployment to production

2. **`development`** - Stable development branch
   - Contains tested and reviewed features
   - Accepts merges from `test`
   - Regular integration point for features
   - Used for staging deployments

3. **`test`** - Testing and validation branch
   - Contains features ready for testing
   - Accepts merges from `claude-flow`
   - Quality assurance and integration testing
   - Performance and security validation

4. **`claude-flow`** - Experimental and AI development branch
   - Active development and experimentation
   - Claude AI agent work happens here
   - Feature development and rapid iteration
   - Continuous integration and testing

## Merge Flow Process

### 1. Development Workflow
```bash
# Start development in claude-flow
git checkout claude-flow
git pull origin claude-flow

# Make changes and commit
git add .
git commit -m "feat: implement new feature"
git push origin claude-flow
```

### 2. Promotion to Test
```bash
# Merge to test branch
git checkout test
git pull origin test
git merge claude-flow
git push origin test
```

### 3. Promotion to Development
```bash
# After testing validation
git checkout development
git pull origin development
git merge test
git push origin development
```

### 4. Production Release
```bash
# After development validation
git checkout main
git pull origin main
git merge development
git push origin main
```

## Branch Protection Rules

### Main Branch
- Require pull request reviews (2 reviewers)
- Require status checks to pass
- Require up-to-date branches before merging
- Include administrators in restrictions

### Development Branch
- Require pull request reviews (1 reviewer)
- Require status checks to pass
- Allow force pushes for maintainers

### Test Branch
- Require status checks to pass
- Allow direct pushes for testing

### Claude-Flow Branch
- No restrictions
- Continuous integration enabled
- Automated testing on push

## Automated Workflows

### On Push to Any Branch
- Run linting and code quality checks
- Execute unit tests
- Validate branch hierarchy
- Check merge direction compliance

### On Push to Test
- Run integration tests
- Performance benchmarks
- Security scans
- Generate test reports

### On Push to Development
- Full test suite execution
- Code coverage analysis
- Documentation generation
- Staging deployment

### On Push to Main
- Production deployment
- Release tagging
- Changelog generation
- Notification systems

## Emergency Procedures

### Hotfix Process
```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-fix

# Make fix and test
git add .
git commit -m "fix: critical production issue"

# Merge directly to main
git checkout main
git merge hotfix/critical-fix
git push origin main

# Backport to other branches
git checkout development
git merge main
git checkout test
git merge development
git checkout claude-flow
git merge test
```

### Rollback Process
```bash
# Identify last good commit
git log --oneline main

# Create rollback
git checkout main
git revert <bad-commit-hash>
git push origin main
```

## Best Practices

1. **Always test locally** before pushing to any branch
2. **Use descriptive commit messages** following conventional commits
3. **Keep branches up to date** with regular merges from upstream
4. **Run full test suite** before merging to development or main
5. **Use pull requests** for code review and documentation
6. **Tag releases** when merging to main
7. **Monitor CI/CD pipelines** for all branches
8. **Document breaking changes** in commit messages and PRs

## Tools and Integration

- **GitHub Actions** for CI/CD workflows
- **Branch protection** rules enforced
- **Automated testing** on all branches
- **Code quality** checks with linting
- **Security scanning** before production
- **Performance monitoring** across environments
- **Claude AI integration** for development assistance

## Monitoring and Metrics

- Track merge frequency and success rates
- Monitor branch divergence and conflicts
- Measure deployment frequency and lead time
- Analyze test coverage and quality metrics
- Review security scan results and fixes
- Performance benchmarks across environments