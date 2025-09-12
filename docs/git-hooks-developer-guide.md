# Git Hooks Developer Guide - MediaNest

## Quick Start Guide

### 🚀 Installation

```bash
# Install dependencies and set up hooks (one-time setup)
npm install
npm run hooks:install

# Test hook performance
npm run hooks:test
```

### ⚡ Quick Commands

**Normal Development:**

```bash
git commit -m "feat: implement user authentication"
# Hooks run automatically (< 2.5s total)
```

**Work-in-Progress Commits:**

```bash
npm run hooks:bypass precommit
git commit -m "wip: exploring new caching approach"
# Skips formatting, keeps commit message validation
```

**Emergency Fixes:**

```bash
npm run hooks:bypass emergency
git commit -m "emergency: fix critical authentication bypass"
# Only basic validation, everything else bypassed
```

**Return to Normal:**

```bash
npm run hooks:bypass clear
# All hooks active again
```

## Hook Performance Targets

| Hook       | Target Time | Current Performance |
| ---------- | ----------- | ------------------- |
| Pre-commit | < 2.0s      | ✅ ~1.2s            |
| Commit-msg | < 0.5s      | ✅ ~0.3s            |
| **Total**  | **< 2.5s**  | **✅ ~1.5s**        |

## Bypass Scenarios & Usage

### 1. 🚨 Emergency Mode

**When:** Production outages, critical security fixes

```bash
export MEDIANEST_SKIP_HOOKS=1
git commit -m "emergency: fix authentication bypass vulnerability"
```

- ✅ **Kept:** Basic commit message length validation (10+ chars)
- ❌ **Skipped:** Code formatting, linting, complex validation
- 🎯 **Use Case:** Production down, immediate deployment needed

### 2. ⚠️ Pre-commit Bypass

**When:** WIP commits, experiments, draft implementations

```bash
export MEDIANEST_SKIP_PRECOMMIT=1
git commit -m "wip: exploring new database optimization"
```

- ✅ **Kept:** Commit message format validation
- ❌ **Skipped:** Code formatting and pre-commit linting
- 🎯 **Use Case:** Checkpoints, experiments, incomplete features
- 📝 **Remember:** Run `npm run lint:fix` before pushing

### 3. 🛠️ Nuclear Option (Rare)

**When:** Git hooks themselves are broken

```bash
git commit --no-verify -m "fix: repair broken lint-staged configuration"
```

- ❌ **Skipped:** Everything (complete bypass)
- ⚠️ **Warning:** Use very sparingly for hook maintenance only

## Interactive Bypass Manager

### Set Bypass Mode

```bash
npm run hooks:bypass emergency   # Full emergency mode
npm run hooks:bypass precommit   # Skip pre-commit only
npm run hooks:bypass clear       # Return to normal
npm run hooks:bypass status      # Check current status
```

### Example Workflow

```bash
# Check current status
npm run hooks:bypass status
# Output: ✅ NORMAL MODE: All hooks active

# Start experimental work
npm run hooks:bypass precommit
# Output: ⚠️ PRE-COMMIT BYPASS ACTIVATED

# Make experimental commits
git commit -m "wip: testing new architecture patterns"

# Finish experiment, clean up code
npm run lint:fix

# Return to normal development
npm run hooks:bypass clear
git commit -m "feat: implement improved architecture patterns"
```

## Performance Monitoring

### Health Check

```bash
npm run hooks:test
# Comprehensive health check with performance testing
```

### Performance Testing

```bash
npm run hooks:performance           # Full performance test
npm run hooks:performance quick     # Quick single test
npm run hooks:performance optimize  # Test after optimization
```

### Expected Output

```bash
⚡ Git Hooks Performance Testing for MediaNest
==============================================

💻 System Performance Information:
  CPU Cores: 8
  Memory: Used: 4.2G/16G (26.25%)
  Node.js: v18.17.0

⏱️ Testing pre-commit performance...
  Run 1/3: 1.234s
  Run 2/3: 1.189s
  Run 3/3: 1.156s
🚀 EXCELLENT: Average 1.193s (3/3 runs)

⏱️ Testing commit-msg performance...
  Run 1/3: 0.287s
  Run 2/3: 0.298s
  Run 3/3: 0.291s
🚀 EXCELLENT: Average 0.292s (3/3 runs)
```

## What Hooks Do

### Pre-commit Hook

- **Formatting:** Prettier for all staged files
- **File Permissions:** Make scripts executable
- **Performance:** Optimized Node.js options, concurrent processing
- **Bypass-aware:** Respects both emergency and precommit bypass flags

### Commit Message Hook

- **Validation:** Conventional commit format (feat, fix, docs, etc.)
- **Special Types:** `hotfix` and `emergency` for urgent commits
- **Length Check:** Minimum 10 characters for emergency mode
- **Performance:** Fast validation with optimized memory usage

### Files Processed

```javascript
// Frontend files
'frontend/**/*.{js,jsx,ts,tsx}' → Prettier formatting

// Backend files
'backend/**/*.ts' → Prettier formatting

// Shared code
'shared/**/*.ts' → Prettier formatting

// Documentation
'**/*.{json,md,yml,yaml}' → Prettier (excludes package-lock.json)

// Scripts
'**/*.sh' → Make executable + Prettier
```

## Troubleshooting

### Slow Hook Performance

```bash
# 1. Check current performance
npm run hooks:performance

# 2. Optimize system
npm cache clean --force
npm update

# 3. Use bypass for immediate needs
npm run hooks:bypass precommit
```

### Hook Failures

```bash
# 1. Check hook health
npm run hooks:test

# 2. Verify configuration
ls -la .husky/
cat lint-staged.config.js

# 3. Emergency bypass if critical
npm run hooks:bypass emergency
```

### Environment Variables Not Working

```bash
# Check current environment
env | grep MEDIANEST

# Clear and reset using script
npm run hooks:bypass clear

# Verify status
npm run hooks:bypass status
```

## Best Practices

### ✅ DO

- Use bypass flags for their intended scenarios
- Run `npm run lint:fix` after bypassing pre-commit formatting
- Test hook performance regularly with health checks
- Clear bypass flags when no longer needed
- Document bypass usage in commit messages

### ❌ DON'T

- Use `--no-verify` as default practice
- Leave bypass flags set permanently
- Skip commit message validation in shared branches
- Bypass hooks for convenience in normal development
- Ignore hook performance degradation

## Integration with CI/CD

### Local vs CI Validation

- **Local Hooks:** Fast formatting and basic validation
- **CI Pipeline:** Comprehensive linting, type checking, testing
- **Branch Protection:** Prevents direct pushes, requires PR review
- **Quality Gates:** Final validation before merge

### CI Catches What Hooks Skip

```yaml
# CI performs comprehensive checks
- ESLint with full rule set
- TypeScript compilation with strict mode
- Complete test suite with coverage
- Security vulnerability scanning
- Performance regression detection
```

## Git Aliases (Optional)

Add to your `~/.gitconfig`:

```ini
[alias]
    # Emergency commit with bypass
    ce = !MEDIANEST_SKIP_HOOKS=1 git commit -m

    # WIP commit with pre-commit bypass
    cw = !MEDIANEST_SKIP_PRECOMMIT=1 git commit -m

    # Check hook status
    hookstatus = !npm run hooks:bypass status

    # Performance test
    hookperf = !npm run hooks:performance quick
```

Usage:

```bash
git ce "emergency: fix critical auth vulnerability"
git cw "wip: testing new caching strategy"
git hookstatus
git hookperf
```

## Support & Maintenance

### Regular Maintenance

- **Daily:** Monitor hook performance with health checks
- **Weekly:** Review bypass usage patterns and optimize
- **Monthly:** Update dependencies and configuration

### Getting Help

- Check health status: `npm run hooks:test`
- Performance issues: `npm run hooks:performance optimize`
- Configuration problems: Review `docs/git-hooks-bypass-guide.md`
- Emergency situations: Use bypass flags appropriately

### Monitoring

```bash
# Weekly bypass usage report (optional)
git log --grep="emergency:\|hotfix:\|wip:" --oneline --since="1 week ago"

# Performance trend tracking
npm run hooks:performance >> hooks-performance.log
```

This developer guide ensures efficient development workflows while maintaining code quality through intelligent git hooks automation. The system is designed to enhance productivity rather than hinder it, with multiple escape hatches for different scenarios.
