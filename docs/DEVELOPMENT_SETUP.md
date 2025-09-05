# Development Setup - Simplified DevOps

This project uses a simplified DevOps setup optimized for development workflow and pre-release projects.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Install git hooks
npm run hooks:install

# Start development
npm run dev
```

## 📋 Git Workflow

### Pre-commit Hooks (Lightweight)
- **Prettier formatting** on staged files
- **No linting or type checking** (for speed)
- Use `git commit --no-verify` to bypass if needed

### Pre-push Hooks (Minimal)
- **Basic linting** check only
- **No tests or builds** (for development speed)  
- Use `git push --no-verify` to bypass if needed

### Bypassing Hooks During Development
When you need to commit/push quickly during development:
```bash
# Bypass pre-commit
git commit --no-verify -m "wip: quick fix"

# Bypass pre-push  
git push --no-verify
```

## 🔧 CI/CD Workflows

### Main Branch (`main`)
- **Full CI pipeline** with lint, test, build
- **Single Node.js version** (20.x) for simplicity
- **Required for merging** to main

### Development Branches (`develop`, `feature/*`)
- **Light CI checks** with `continue-on-error`
- **Non-blocking** - won't fail the build
- **Fast feedback** for development

## 📦 Dependencies

- **Monthly Dependabot updates** (not weekly)
- **Major version updates ignored** during development
- **Limited to 5 PRs** to avoid noise

## ⚡ Philosophy

This setup prioritizes:
- **Development speed** over strict enforcement
- **Fast feedback** over comprehensive checking
- **Flexibility** with easy bypass options
- **Gradual adoption** - can be tightened later

## 🔄 Production Readiness

When ready for production, consider:
1. Enable full pre-commit checks (tests + type checking)
2. Add security scanning workflows
3. Enable branch protection rules
4. Add comprehensive CI/CD pipelines
5. Remove bypass options

## 🛠 Available Scripts

```bash
npm run commit        # Interactive conventional commits
npm run format        # Format all files
npm run format:check  # Check formatting
npm run hooks:install # Install/reinstall git hooks
```

## 📚 Documentation

- `CLAUDE.md` - Claude Code configuration
- `docs/HOOKS_CONFIGURATION.md` - Git hooks details
- `docs/github-config-summary.md` - GitHub settings