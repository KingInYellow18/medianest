# MediaNest Git Worktree Structure & Commands

**Document Version**: 1.0  
**Created By**: CODER AGENT (Hive Mind Collective Intelligence)  
**Date**: 2025-09-05  
**Coordination ID**: hive-medianest-audit

## Git Worktree Strategy Overview

This document provides comprehensive git worktree setup commands and directory structure for parallel feature development in the MediaNest project. Worktrees enable simultaneous work on multiple features without branch switching overhead.

## 1. Worktree Directory Structure

### Recommended Layout

```
~/projects/
├── medianest/                          # Main repository (develop branch)
├── medianest-security-secrets/         # security/auth/secrets-management
├── medianest-security-jwt/             # security/auth/jwt-validation-enhancement
├── medianest-security-csp/             # security/csp/content-security-policy
├── medianest-perf-api/                 # perf/api/parallel-integration-processing
├── medianest-perf-frontend/            # perf/frontend/bundle-optimization
├── medianest-perf-db/                  # perf/db/query-optimization
├── medianest-refactor-arch/            # refactor/arch/clean-architecture
├── medianest-refactor-error/           # refactor/error/standardized-handling
├── medianest-test-security/            # test/security/comprehensive-security-tests
├── medianest-test-performance/         # test/performance/load-testing
├── medianest-infra-docker/             # infra/docker/optimization
└── medianest-infra-monitoring/         # infra/monitoring/apm-integration
```

### Directory Naming Convention

```
medianest-<type>-<scope>[-<additional>]/
```

## 2. Initial Worktree Setup Commands

### Phase 1: Critical Security Branches

#### 1. Secrets Management Worktree

```bash
# Create branch and worktree
cd ~/projects/medianest
git checkout develop
git checkout -b security/auth/secrets-management
git worktree add ../medianest-security-secrets security/auth/secrets-management

# Switch to worktree and initialize
cd ../medianest-security-secrets
npm install
git remote set-url origin $(git -C ../medianest remote get-url origin)

# Verify setup
git status
git branch -vv
npm run typecheck
```

#### 2. JWT Validation Worktree

```bash
# Create dependent branch (after secrets-management is merged)
cd ~/projects/medianest
git checkout develop
git pull origin develop
git checkout -b security/auth/jwt-validation-enhancement
git worktree add ../medianest-security-jwt security/auth/jwt-validation-enhancement

cd ../medianest-security-jwt
npm install
npm run test -- --passWithNoTests
```

#### 3. Content Security Policy Worktree

```bash
# Independent security branch
cd ~/projects/medianest
git checkout develop
git checkout -b security/csp/content-security-policy
git worktree add ../medianest-security-csp security/csp/content-security-policy

cd ../medianest-security-csp
npm install
```

### Phase 2: Performance Optimization Branches

#### 4. API Parallel Processing Worktree

```bash
# High-priority performance branch
cd ~/projects/medianest
git checkout develop
git checkout -b perf/api/parallel-integration-processing
git worktree add ../medianest-perf-api perf/api/parallel-integration-processing

cd ../medianest-perf-api
npm install

# Create feature-specific test environment
cp .env.example .env.perf-test
echo "# Performance testing configuration" >> .env.perf-test
echo "LOG_LEVEL=debug" >> .env.perf-test
echo "PERF_MONITORING=true" >> .env.perf-test
```

#### 5. Frontend Bundle Optimization Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b perf/frontend/bundle-optimization
git worktree add ../medianest-perf-frontend perf/frontend/bundle-optimization

cd ../medianest-perf-frontend
npm install

# Install additional dev dependencies for bundle analysis
npm install --save-dev @next/bundle-analyzer webpack-bundle-analyzer
```

#### 6. Database Query Optimization Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b perf/db/query-optimization
git worktree add ../medianest-perf-db perf/db/query-optimization

cd ../medianest-perf-db
npm install

# Set up database testing environment
npm run db:setup:test
npx prisma generate
```

### Phase 3: Architecture Refactoring Branches

#### 7. Clean Architecture Worktree

```bash
# Depends on db optimization
cd ~/projects/medianest
git checkout develop
git checkout -b refactor/arch/clean-architecture
git worktree add ../medianest-refactor-arch refactor/arch/clean-architecture

cd ../medianest-refactor-arch
npm install

# Create architecture documentation workspace
mkdir -p docs/architecture
mkdir -p docs/diagrams
```

#### 8. Error Handling Worktree

```bash
# Depends on clean architecture
cd ~/projects/medianest
git checkout develop
git checkout -b refactor/error/standardized-handling
git worktree add ../medianest-refactor-error refactor/error/standardized-handling

cd ../medianest-refactor-error
npm install
```

### Phase 4: Testing Enhancement Branches

#### 9. Security Testing Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b test/security/comprehensive-security-tests
git worktree add ../medianest-test-security test/security/comprehensive-security-tests

cd ../medianest-test-security
npm install

# Install security testing tools
npm install --save-dev @types/supertest supertest
npm install --save-dev owasp-zap-baseline
```

#### 10. Performance Testing Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b test/performance/load-testing
git worktree add ../medianest-test-performance test/performance/load-testing

cd ../medianest-test-performance
npm install

# Install performance testing tools
npm install --save-dev autocannon k6 clinic
```

### Phase 5: Infrastructure Branches

#### 11. Docker Optimization Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b infra/docker/optimization
git worktree add ../medianest-infra-docker infra/docker/optimization

cd ../medianest-infra-docker
npm install

# Docker development setup
mkdir -p docker/{development,production,testing}
```

#### 12. Monitoring Integration Worktree

```bash
cd ~/projects/medianest
git checkout develop
git checkout -b infra/monitoring/apm-integration
git worktree add ../medianest-infra-monitoring infra/monitoring/apm-integration

cd ../medianest-infra-monitoring
npm install

# Install monitoring dependencies
npm install --save-dev @types/prom-client prom-client
npm install --save-dev elastic-apm-node
```

## 3. Worktree Management Commands

### Daily Operations

#### Sync with Develop Branch

```bash
# Run this in each worktree daily
sync_with_develop() {
    local worktree_path=$1
    cd "$worktree_path"

    echo "Syncing $(basename $PWD) with develop..."

    # Fetch latest changes
    git fetch origin develop

    # Rebase current branch onto develop
    git rebase origin/develop

    # Update dependencies if package.json changed
    if git diff HEAD~1 --name-only | grep -q "package.*\.json"; then
        echo "Package files changed, updating dependencies..."
        npm install
    fi

    # Run tests to ensure nothing broke
    npm run test -- --passWithNoTests

    echo "Sync completed for $(basename $PWD)"
}

# Usage examples
sync_with_develop ~/projects/medianest-security-secrets
sync_with_develop ~/projects/medianest-perf-api
```

#### Multi-Worktree Operations

```bash
# Create script for bulk operations
cat > ~/bin/medianest-worktree-manager << 'EOF'
#!/bin/bash

MEDIANEST_BASE="$HOME/projects"
WORKTREES=(
    "medianest-security-secrets"
    "medianest-security-jwt"
    "medianest-security-csp"
    "medianest-perf-api"
    "medianest-perf-frontend"
    "medianest-perf-db"
    "medianest-refactor-arch"
    "medianest-refactor-error"
    "medianest-test-security"
    "medianest-test-performance"
    "medianest-infra-docker"
    "medianest-infra-monitoring"
)

case "$1" in
    "sync-all")
        for worktree in "${WORKTREES[@]}"; do
            if [ -d "$MEDIANEST_BASE/$worktree" ]; then
                echo "Syncing $worktree..."
                cd "$MEDIANEST_BASE/$worktree"
                git fetch origin develop
                git rebase origin/develop
                npm install
            fi
        done
        ;;
    "test-all")
        for worktree in "${WORKTREES[@]}"; do
            if [ -d "$MEDIANEST_BASE/$worktree" ]; then
                echo "Testing $worktree..."
                cd "$MEDIANEST_BASE/$worktree"
                npm run test -- --passWithNoTests
            fi
        done
        ;;
    "status-all")
        for worktree in "${WORKTREES[@]}"; do
            if [ -d "$MEDIANEST_BASE/$worktree" ]; then
                echo "Status for $worktree:"
                cd "$MEDIANEST_BASE/$worktree"
                git status --porcelain
                echo "---"
            fi
        done
        ;;
    *)
        echo "Usage: $0 {sync-all|test-all|status-all}"
        exit 1
        ;;
esac
EOF

chmod +x ~/bin/medianest-worktree-manager
```

### Cleanup Commands

#### Remove Completed Worktree

```bash
remove_worktree() {
    local branch_name=$1
    local worktree_path=$2

    # Verify branch is merged
    cd ~/projects/medianest
    git checkout develop
    git pull origin develop

    if git branch --merged | grep -q "$branch_name"; then
        echo "Branch $branch_name is merged, safe to remove"

        # Remove worktree
        git worktree remove "$worktree_path" --force

        # Delete local branch
        git branch -d "$branch_name"

        # Delete remote branch if it exists
        git push origin --delete "$branch_name" || true

        echo "Worktree and branch cleaned up successfully"
    else
        echo "Branch $branch_name is not merged yet!"
        return 1
    fi
}

# Usage
# remove_worktree security/auth/secrets-management ~/projects/medianest-security-secrets
```

## 4. IDE and Development Setup

### VS Code Workspace Configuration

```json
// medianest-multi-worktree.code-workspace
{
  "folders": [
    {
      "name": "Main (develop)",
      "path": "./medianest"
    },
    {
      "name": "Security - Secrets",
      "path": "./medianest-security-secrets"
    },
    {
      "name": "Security - JWT",
      "path": "./medianest-security-jwt"
    },
    {
      "name": "Perf - API",
      "path": "./medianest-perf-api"
    },
    {
      "name": "Perf - Frontend",
      "path": "./medianest-perf-frontend"
    },
    {
      "name": "Perf - Database",
      "path": "./medianest-perf-db"
    },
    {
      "name": "Refactor - Architecture",
      "path": "./medianest-refactor-arch"
    }
  ],
  "settings": {
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "eslint.workingDirectories": [
      "medianest",
      "medianest-security-secrets",
      "medianest-security-jwt",
      "medianest-perf-api",
      "medianest-perf-frontend",
      "medianest-perf-db",
      "medianest-refactor-arch"
    ],
    "files.exclude": {
      "**/node_modules": true,
      "**/.git": false
    },
    "search.exclude": {
      "**/node_modules": true
    }
  },
  "extensions": {
    "recommendations": [
      "ms-vscode.vscode-typescript-next",
      "bradlc.vscode-tailwindcss",
      "prisma.prisma",
      "ms-vscode.vscode-json"
    ]
  }
}
```

### Terminal Setup for Quick Navigation

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mn-main='cd ~/projects/medianest'
alias mn-sec-secrets='cd ~/projects/medianest-security-secrets'
alias mn-sec-jwt='cd ~/projects/medianest-security-jwt'
alias mn-sec-csp='cd ~/projects/medianest-security-csp'
alias mn-perf-api='cd ~/projects/medianest-perf-api'
alias mn-perf-fe='cd ~/projects/medianest-perf-frontend'
alias mn-perf-db='cd ~/projects/medianest-perf-db'
alias mn-ref-arch='cd ~/projects/medianest-refactor-arch'
alias mn-ref-err='cd ~/projects/medianest-refactor-error'
alias mn-test-sec='cd ~/projects/medianest-test-security'
alias mn-test-perf='cd ~/projects/medianest-test-performance'
alias mn-infra-docker='cd ~/projects/medianest-infra-docker'
alias mn-infra-mon='cd ~/projects/medianest-infra-monitoring'

# Quick test runner for current worktree
alias mn-test='npm run test -- --passWithNoTests'
alias mn-build='npm run build'
alias mn-lint='npm run lint'
alias mn-type='npm run typecheck'
```

## 5. Dependency Management Across Worktrees

### Package.json Sync Strategy

```bash
# Script to sync package.json changes across worktrees
sync_package_json() {
    local source_worktree="$HOME/projects/medianest"
    local target_worktrees=(
        "$HOME/projects/medianest-security-secrets"
        "$HOME/projects/medianest-security-jwt"
        "$HOME/projects/medianest-perf-api"
        # ... other worktrees
    )

    echo "Syncing package.json from main repository..."

    for target in "${target_worktrees[@]}"; do
        if [ -d "$target" ]; then
            echo "Syncing to $(basename $target)..."
            cd "$target"

            # Copy package.json if it's changed in main
            if [ "$source_worktree/package.json" -nt "./package.json" ]; then
                cp "$source_worktree/package.json" ./
                npm install
                echo "Updated dependencies in $(basename $target)"
            fi
        fi
    done
}
```

### Lock File Management

```bash
# Regenerate package-lock.json in each worktree
regenerate_locks() {
    local worktrees=(
        "$HOME/projects/medianest"
        "$HOME/projects/medianest-security-secrets"
        "$HOME/projects/medianest-perf-api"
        # ... other worktrees
    )

    for worktree in "${worktrees[@]}"; do
        if [ -d "$worktree" ]; then
            echo "Regenerating lock file in $(basename $worktree)..."
            cd "$worktree"
            rm -f package-lock.json
            npm install
        fi
    done
}
```

## 6. Testing Strategy Across Worktrees

### Test Isolation

```bash
# Each worktree should have independent test databases
setup_test_env() {
    local worktree_name=$(basename $PWD)
    local test_db_name="medianest_test_${worktree_name//[-]/_}"

    # Create worktree-specific test environment
    cp .env.example ".env.test"
    sed -i "s/medianest_test/${test_db_name}/g" .env.test

    # Set up test database
    DATABASE_URL="postgresql://user:pass@localhost:5432/${test_db_name}?schema=public" \
    npx prisma migrate deploy

    echo "Test environment set up for $worktree_name"
}
```

### Cross-Worktree Integration Testing

```bash
# Run integration tests that span multiple features
integration_test_suite() {
    echo "Running cross-worktree integration tests..."

    # Start with main repository
    cd ~/projects/medianest
    npm run test:integration

    # Test each feature branch integration
    for worktree in ~/projects/medianest-*; do
        if [ -d "$worktree" ]; then
            echo "Testing integration for $(basename $worktree)..."
            cd "$worktree"
            npm run test:integration || echo "Integration test failed for $(basename $worktree)"
        fi
    done
}
```

## 7. Git Configuration for Worktrees

### Global Git Configuration

```bash
# Configure git for better worktree handling
git config --global worktree.guessRemote true
git config --global fetch.writeCommitGraph true
git config --global core.untrackedCache true

# Set up commit templates for consistency
git config --global commit.template ~/.gitmessage

# Create commit message template
cat > ~/.gitmessage << 'EOF'
# <type>(<scope>): <subject>
#
# <body>
#
# <footer>
#
# Types: feat, fix, docs, style, refactor, perf, test, chore, security
# Scope: auth, api, frontend, db, integration, infra, config
# Subject: imperative mood, no period, max 50 chars
# Body: wrap at 72 chars, explain what and why
# Footer: reference issues, breaking changes
EOF
```

### Branch-specific Configuration

```bash
# Set up branch-specific hooks and settings
setup_branch_config() {
    local branch_type=$(git branch --show-current | cut -d'/' -f1)

    case $branch_type in
        "security")
            git config branch.$(git branch --show-current).merge-options "--no-ff"
            git config branch.$(git branch --show-current).description "Security enhancement branch - requires security review"
            ;;
        "perf")
            git config branch.$(git branch --show-current).merge-options "--no-ff"
            git config branch.$(git branch --show-current).description "Performance optimization branch - requires benchmark validation"
            ;;
        "refactor")
            git config branch.$(git branch --show-current).merge-options "--no-ff"
            git config branch.$(git branch --show-current).description "Refactoring branch - requires architecture review"
            ;;
    esac
}
```

## 8. Monitoring and Health Checks

### Worktree Health Check Script

```bash
#!/bin/bash
# ~/bin/worktree-health-check

check_worktree_health() {
    local worktree_path=$1
    cd "$worktree_path"

    echo "=== Health Check: $(basename $PWD) ==="

    # Check git status
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  Uncommitted changes detected"
        git status --short
    else
        echo "✅ Git status clean"
    fi

    # Check for merge conflicts
    if git ls-files -u | grep -q "^"; then
        echo "❌ Merge conflicts detected"
        git ls-files -u
    else
        echo "✅ No merge conflicts"
    fi

    # Check branch sync with develop
    git fetch origin develop --quiet
    local behind=$(git rev-list --count HEAD..origin/develop)
    local ahead=$(git rev-list --count origin/develop..HEAD)

    if [ $behind -gt 0 ]; then
        echo "⚠️  Behind develop by $behind commits"
    else
        echo "✅ Up to date with develop"
    fi

    if [ $ahead -gt 0 ]; then
        echo "📝 Ahead of develop by $ahead commits"
    fi

    # Check npm dependencies
    if [ package.json -nt node_modules ]; then
        echo "⚠️  Dependencies may be out of date"
    else
        echo "✅ Dependencies up to date"
    fi

    # Check test status
    if npm run test -- --passWithNoTests --silent > /dev/null 2>&1; then
        echo "✅ Tests passing"
    else
        echo "❌ Tests failing"
    fi

    echo "========================="
    echo
}

# Check all worktrees
for worktree in ~/projects/medianest-*; do
    if [ -d "$worktree" ]; then
        check_worktree_health "$worktree"
    fi
done
```

## 9. Backup and Recovery

### Worktree Backup Strategy

```bash
# Create snapshots of all worktrees
backup_worktrees() {
    local backup_dir="$HOME/backups/medianest-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    echo "Creating backup at $backup_dir"

    for worktree in ~/projects/medianest*; do
        if [ -d "$worktree" ]; then
            local worktree_name=$(basename "$worktree")
            echo "Backing up $worktree_name..."

            # Create archive excluding node_modules and .git
            tar czf "$backup_dir/${worktree_name}.tar.gz" \
                --exclude='node_modules' \
                --exclude='.git' \
                -C "$(dirname "$worktree")" \
                "$worktree_name"
        fi
    done

    echo "Backup completed: $backup_dir"
}

# Recovery function
restore_worktree() {
    local backup_file=$1
    local restore_path=$2

    echo "Restoring from $backup_file to $restore_path"

    mkdir -p "$(dirname "$restore_path")"
    tar xzf "$backup_file" -C "$(dirname "$restore_path")"

    cd "$restore_path"
    npm install

    echo "Restore completed"
}
```

## 10. Performance Optimization

### Worktree Performance Tips

```bash
# Enable Git partial clone for faster operations
git config --global core.preloadindex true
git config --global core.fscache true
git config --global gc.auto 256

# Use shallow clones for worktrees that don't need full history
git worktree add --no-checkout ../temp-worktree branch-name
cd ../temp-worktree
git checkout --depth=1 branch-name
```

### Disk Space Management

```bash
# Clean up worktree disk usage
cleanup_worktrees() {
    echo "Cleaning up worktree disk usage..."

    for worktree in ~/projects/medianest-*; do
        if [ -d "$worktree" ]; then
            cd "$worktree"

            # Clean npm cache
            npm cache clean --force

            # Remove node_modules if not recently modified
            if [ -d node_modules ] && [ $(find node_modules -mtime -1 | wc -l) -eq 0 ]; then
                echo "Removing stale node_modules in $(basename $PWD)"
                rm -rf node_modules
            fi

            # Git cleanup
            git gc --auto
        fi
    done

    echo "Cleanup completed"
}
```

## Summary Commands Reference

### Quick Setup (All Worktrees)

```bash
# Run this master setup script
curl -sSL https://raw.githubusercontent.com/your-repo/medianest/main/scripts/setup-worktrees.sh | bash
```

### Daily Operations

```bash
medianest-worktree-manager sync-all    # Sync all worktrees with develop
medianest-worktree-manager test-all    # Run tests in all worktrees
medianest-worktree-manager status-all  # Check status of all worktrees
worktree-health-check                  # Comprehensive health check
```

### Cleanup Operations

```bash
backup_worktrees                       # Create backup before cleanup
cleanup_worktrees                      # Clean disk space
remove_worktree branch-name path       # Remove completed worktree
```

---

**Coordination Note**: This worktree structure enables parallel development while maintaining clear separation of concerns. Each worktree can be developed independently while sharing the same git history and coordination through the develop branch.

**Next Steps**: Use these commands to set up the development environment and begin implementation according to the feature branch specifications.
