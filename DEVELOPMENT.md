# Development Guide

## Pre-commit Hooks

The project uses minimal pre-commit hooks that only check for syntax errors. 

### Bypass Hooks (when needed)

If you need to commit without running hooks (e.g., work in progress):

```bash
# Option 1: Skip hooks for single commit
git commit --no-verify -m "wip: working on feature"

# Option 2: Disable hooks temporarily
export SKIP_SIMPLE_GIT_HOOKS=1
git commit -m "wip: working on feature"
unset SKIP_SIMPLE_GIT_HOOKS

# Option 3: Commit with hooks but ignore linting failures
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "wip: working on feature"
```

### Manual Quality Checks

Run these commands manually before pushing:

```bash
# Check all linting issues
npm run lint

# Fix auto-fixable issues
npm run lint --fix

# Check TypeScript compilation
npm run type-check

# Run tests
npm test
```

### Pre-commit Hook Configuration

- **Current behavior**: Only checks for syntax errors using `node -c`
- **Location**: `lint-staged.config.js` and `package.json`
- **Bypass**: Set `SKIP_SIMPLE_GIT_HOOKS=1` environment variable

The hooks are intentionally minimal to avoid disrupting development flow.