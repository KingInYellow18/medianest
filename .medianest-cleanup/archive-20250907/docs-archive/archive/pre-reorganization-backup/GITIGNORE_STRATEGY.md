# GitIgnore Strategy - MediaNest

## Overview

MediaNest implements an intelligent, branch-specific `.gitignore` strategy that automatically adapts ignore rules based on the current git branch. This ensures clean production branches while maintaining developer productivity with appropriate restrictions per environment.

## Architecture

### Base Strategy

- **Core `.gitignore`**: Contains universal rules that apply to all branches
- **Branch-specific files**: Additional rules for specific branches (`.gitignore.develop`, `.gitignore.staging`, `.gitignore.main`)
- **Automatic switching**: Husky post-checkout hook automatically applies appropriate rules when switching branches
- **Git info/exclude**: Combined rules are written to `.git/info/exclude` (local, not committed)

### Branch-Specific Rules

#### Development Branch (`develop`)

**Philosophy**: Maximum permissiveness for rapid iteration

**Additional patterns ignored**:

- Temporary development files: `dev-*`, `tmp-*`, `experiment-*`, `test-*`
- Development logs: `dev.log*`, `debug-*.log`, `trace-*.log`
- AI development artifacts: `training-data/`, `ai-experiments/`, `neural-training-*`
- Development databases: `dev.db*`, `test-data/`, `mock-data/`
- Rapid prototyping files: `prototype-*`, `poc-*`, `sandbox-*`
- Documentation drafts: `DRAFT-*`, `TODO-*`, `dev-notes.*`

#### Staging Branch (`staging`)

**Philosophy**: Moderate filtering for pre-production validation

**Additional patterns ignored**:

- Staging artifacts: `staging-*`, `stage-*`, `*.staging`
- Staging logs: `staging.log*`, `performance-staging-*.json`
- Staging AI outputs: `ai-staging-*`, `staging-model-*`
- Integration testing: `integration-test-staging/`, `uat-results/`
- Deployment artifacts: `deployment-staging/`, `release-candidate-*/`
- Staging documentation: `STAGING-*`, `staging-report-*`

#### Main Branch (`main`)

**Philosophy**: Strictest filtering for production-ready codebase

**Additional patterns ignored**:

- All development artifacts: `dev-*`, `staging-*`, `test-*`, `*.dev`, `*.staging`
- Debug and development logs: `debug*`, `development*`, `trace-*`
- Experimental files: `experiment-*`, `prototype-*`, `draft-*`
- AI development: `ai-experiments/`, `training-data/`, `ai-dev-*`
- Development tools: `dev-scripts/`, `dev-tools/`, `*.dev.json`
- Work-in-progress: `WIP-*`, `*.wip`, `*.draft`

## Implementation

### File Structure

```
.gitignore              # Base rules for all branches
.gitignore.develop      # Development-specific additions
.gitignore.staging      # Staging-specific additions
.gitignore.main         # Production-specific additions
scripts/gitignore-manager.js    # Management script
.husky/post-checkout    # Automatic switching hook
```

### Automatic Switching

The system uses a Husky `post-checkout` hook that:

1. Detects when branches are switched (not file checkouts)
2. Identifies the current branch
3. Runs the GitIgnore Manager script
4. Combines base rules with branch-specific rules
5. Writes the result to `.git/info/exclude`

### Manual Management

The GitIgnore Manager script provides manual control:

```bash
# Apply rules for current branch
node scripts/gitignore-manager.js

# Apply rules for specific branch
node scripts/gitignore-manager.js develop
node scripts/gitignore-manager.js staging
node scripts/gitignore-manager.js main

# Show status
node scripts/gitignore-manager.js --status

# List available branch rules
node scripts/gitignore-manager.js --list
```

## Benefits

### For Development

- **Rapid iteration**: Temporary files, experiments, and debugging artifacts are ignored
- **AI development**: Training data, model checkpoints, and AI experiments don't clutter the repository
- **Documentation drafts**: Notes, TODOs, and draft documentation are filtered out
- **Flexible testing**: Test data and development databases are automatically ignored

### For Staging

- **Clean validation**: Development artifacts are filtered but necessary staging files remain
- **Integration testing**: Staging-specific test artifacts and reports are ignored
- **Deployment preparation**: Build artifacts and deployment files are properly managed
- **Performance testing**: Load testing and performance benchmarks don't pollute staging

### for Production

- **Clean codebase**: Only production-ready files are included
- **Security**: No development credentials, debug files, or experimental code
- **Minimal surface area**: Reduced attack vectors and cleaner releases
- **Professional presentation**: No development artifacts visible to users

## Technical Details

### Git Info/Exclude vs GitIgnore

- **`.gitignore`**: Committed to repository, shared with all users
- **`.git/info/exclude`**: Local to repository, not shared
- **Strategy**: Base rules in `.gitignore`, combined rules in `.git/info/exclude`

### Husky Integration

The system leverages the existing Husky setup:

- Uses `simple-git-hooks` already configured in `package.json`
- Adds `post-checkout` hook for automatic switching
- No additional dependencies required

### Script Features

- **Error handling**: Graceful fallbacks and informative error messages
- **Status reporting**: Clear feedback on current state and available rules
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Performance**: Fast execution with minimal system impact

## Usage Guidelines

### For Developers

1. **Work normally**: The system is transparent and automatic
2. **Create temporary files freely**: Use `dev-*`, `tmp-*`, `test-*` prefixes for temporary work
3. **Experiment safely**: AI training, prototypes, and experiments are automatically filtered
4. **Check status**: Use `--status` to verify current configuration

### for CI/CD

1. **Automatic application**: Rules are applied automatically when GitHub Actions checks out branches
2. **Branch-specific builds**: Each environment gets appropriate file filtering
3. **Security compliance**: Production builds exclude all development artifacts
4. **Performance**: Faster builds with fewer files to process

### For Maintenance

1. **Add new patterns**: Edit appropriate branch-specific files
2. **Test changes**: Use the management script to verify rules
3. **Update base rules**: Modify main `.gitignore` for universal patterns
4. **Monitor effectiveness**: Check that unwanted files aren't being committed

## Troubleshooting

### Common Issues

**Rules not applying**:

```bash
# Check current status
node scripts/gitignore-manager.js --status

# Manually apply rules
node scripts/gitignore-manager.js
```

**Files still being tracked**:

```bash
# Stop tracking files already in git
git rm --cached <file>

# Apply current rules
node scripts/gitignore-manager.js
```

**Hook not running**:

```bash
# Ensure hook is executable
chmod +x .husky/post-checkout

# Test manually
./.husky/post-checkout 0000000 1111111 1
```

### Debugging

- Check `.git/info/exclude` for current active rules
- Use `git status --ignored` to see what's being ignored
- Review script output for error messages
- Verify branch-specific files exist and have content

## Future Enhancements

### Planned Features

- **Environment variables**: Support for environment-based rule selection
- **Integration with CI**: Enhanced CI/CD-specific ignore patterns
- **Team customization**: Per-developer rule extensions
- **Automatic cleanup**: Periodic cleanup of ignored files

### Extensibility

- Add new branch patterns by creating `.gitignore.<branch-name>` files
- Extend the management script for custom logic
- Integrate with additional git hooks as needed
- Support for nested branch naming conventions

---

_This strategy ensures MediaNest maintains clean, secure, and environment-appropriate git repositories while maximizing developer productivity._
