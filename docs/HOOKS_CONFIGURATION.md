# Git Hooks Configuration Guide

This document describes the comprehensive pre-commit hooks and Husky configuration set up for the MediaNest project.

## Overview

The project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks, providing automated quality assurance through:

- **Pre-commit hooks**: Linting, formatting, type checking, and testing
- **Commit message validation**: Conventional commit format enforcement
- **Pre-push hooks**: Full test suite and build validation
- **Post-merge hooks**: Dependency and migration management

## Hook Configuration

### Pre-commit Hook (`.husky/pre-commit`)

Runs on every commit attempt:

1. **Lint-staged**: Processes only staged files
   - ESLint with auto-fix for JavaScript/TypeScript
   - Prettier formatting for various file types
   - Prisma schema formatting

2. **Type checking**: Validates TypeScript across all workspaces
3. **Testing**: Runs tests for changed files

### Commit Message Hook (`.husky/commit-msg`)

Validates commit messages using [Conventional Commits](https://www.conventionalcommits.org/):

- **Format**: `type(scope): description`
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`
- **Length limits**: Subject max 100 chars, body/footer max 100 chars per line

### Pre-push Hook (`.husky/pre-push`)

Comprehensive validation before pushing:

1. Full test suite execution
2. Complete linting across all workspaces
3. Production build verification
4. Security vulnerability audit (moderate level)

### Post-merge Hook (`.husky/post-merge`)

Automatic maintenance after merges:

1. Dependency reinstallation if `package-lock.json` changed
2. Migration notifications if database schema changed

## Usage

### Making Commits

#### Option 1: Use Commitizen (Recommended)
```bash
npm run commit
# Interactive prompt guides you through conventional commit format
```

#### Option 2: Manual Commits
```bash
git commit -m "feat: add user authentication system"
git commit -m "fix: resolve memory leak in video processing"
git commit -m "docs: update API documentation for v2.0"
```

### Bypassing Hooks (Development)

```bash
# Skip pre-commit hooks
git commit --no-verify -m "feat: work in progress"

# Skip all hooks
HUSKY=0 git commit -m "emergency fix"

# Skip specific hooks
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "bypass simple hooks"
```

### Manual Quality Checks

```bash
# Run all quality checks manually
npm run lint
npm run type-check
npm test
npm run format:check

# Fix issues
npm run lint:fix
npm run format
```

## File Types and Processing

### Lint-staged Configuration

| File Pattern | Processing |
|--------------|------------|
| `*.{js,jsx,ts,tsx}` | ESLint fix → Prettier → Stage |
| `*.{json,md,yml,yaml}` | Prettier → Stage |
| `package.json` | Prettier → Stage |
| `*.prisma` | Prisma format → Stage |
| `*.{css,scss,sass}` | Prettier → Stage |

### Prettier Configuration

- **Indentation**: 2 spaces
- **Quotes**: Single quotes (double for JSON)
- **Semicolons**: Required
- **Line width**: 80 chars (100 for Markdown)
- **Trailing commas**: ES5 compatible

## Troubleshooting

### Hook Failures

1. **ESLint errors**:
   ```bash
   npm run lint:fix
   # Or fix manually and commit again
   ```

2. **Type checking errors**:
   ```bash
   npm run type-check
   # Fix TypeScript errors and commit again
   ```

3. **Test failures**:
   ```bash
   npm test
   # Fix failing tests and commit again
   ```

### Commit Message Validation

❌ **Invalid**:
```
update user service
Fixed bug
WIP
```

✅ **Valid**:
```
feat: add user authentication system
fix: resolve null pointer exception in user service
docs: update installation instructions
```

### Performance Considerations

- **Pre-commit**: Only processes staged files (fast)
- **Pre-push**: Full validation (slower, but comprehensive)
- **Selective testing**: Only runs tests for changed files in pre-commit

## Advanced Configuration

### Customizing Hook Behavior

Edit hook files in `.husky/` directory:

```bash
# Disable type checking in pre-commit
vim .husky/pre-commit
# Comment out the type-check section
```

### Workspace-specific Hooks

For workspace-specific validation, modify the npm scripts:

```json
{
  "scripts": {
    "lint:frontend": "npm run lint --workspace=frontend",
    "test:backend": "npm run test --workspace=backend"
  }
}
```

### CI/CD Integration

Hooks complement CI/CD pipelines:

- **Local**: Fast feedback during development
- **CI**: Comprehensive validation with additional checks
- **Production**: Deployment-specific validations

## Dependencies

### Core Tools

- **husky**: Git hooks manager
- **@commitlint/cli**: Commit message linting
- **@commitlint/config-conventional**: Conventional commit rules
- **prettier**: Code formatting
- **lint-staged**: Staged files processing
- **commitizen**: Interactive commit helper

### Integration Dependencies

- **eslint-config-prettier**: ESLint/Prettier compatibility
- **cz-conventional-changelog**: Commitizen adapter

## Maintenance

### Updating Hook Scripts

1. Edit hook files in `.husky/` directory
2. Make files executable: `chmod +x .husky/*`
3. Test with sample commits

### Updating Commit Rules

Edit `commitlint.config.js` to customize:

- Allowed commit types
- Subject case rules
- Length limits
- Custom scopes

### Adding New File Types

Update `lint-staged.config.js` to process new file patterns:

```javascript
module.exports = {
  '*.{vue,svelte}': ['eslint --fix', 'prettier --write'],
  '*.go': ['gofmt -w', 'golint']
};
```

## Best Practices

1. **Frequent commits**: Small, focused changes pass hooks faster
2. **Descriptive messages**: Clear commit messages improve project history
3. **Test locally**: Run `npm test` before committing large changes
4. **Format before commit**: Use `npm run format` to avoid formatting hooks
5. **Review staged changes**: Use `git diff --cached` before committing

## Support

- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Commitlint Rules](https://commitlint.js.org/#/reference-rules)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)