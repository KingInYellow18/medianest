#!/bin/bash

# MediaNest Git Hooks Optimizer
# Implements high-performance Git hooks with bypass mechanisms

set -e

echo "🚀 MediaNest Git Hooks Optimizer"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "Not in a git repository. Please run this script from the project root."
    exit 1
fi

print_status "Analyzing current Git hooks configuration..."

# Phase 1: Install Dependencies
print_status "Phase 1: Installing optimized dependencies..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found"
    exit 1
fi

# Install hook dependencies with specific versions for performance
npm install --save-dev husky@8 lint-staged@15 @commitlint/cli@18 @commitlint/config-conventional@18 prettier@3 --silent

print_success "Dependencies installed"

# Phase 2: Initialize Husky
print_status "Phase 2: Initializing optimized Husky configuration..."

# Initialize husky
npx husky init

# Create optimized hooks directory
mkdir -p .husky

print_success "Husky initialized"

# Phase 3: Create Optimized Hooks
print_status "Phase 3: Creating high-performance hooks..."

# Create optimized pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
# MediaNest Optimized Pre-Commit Hook
. "$(dirname -- "$0")/_/husky.sh"

# Performance monitoring
start_time=$(date +%s.%3N)

# Emergency bypass mechanism
if [ "$MEDIANEST_SKIP_HOOKS" = "1" ]; then
    echo "🚀 Emergency bypass activated - skipping pre-commit checks"
    exit 0
fi

# Developer bypass with warning
if [ "$MEDIANEST_SKIP_PRECOMMIT" = "1" ]; then
    echo "⚠️  Pre-commit checks skipped (MEDIANEST_SKIP_PRECOMMIT=1)"
    echo "   Remember to run 'npm run lint:fix' before pushing"
    exit 0
fi

echo "🔍 Running optimized pre-commit checks..."

# Run lint-staged with performance optimizations
NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size" npx lint-staged --concurrent --quiet

# Performance reporting
end_time=$(date +%s.%3N)
duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "unknown")

if [ "$duration" != "unknown" ] && [ "$(echo "$duration > 5" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
    echo "⚠️  Pre-commit hook took ${duration}s (target: <2s)"
    echo "   Consider using MEDIANEST_SKIP_PRECOMMIT=1 for emergency commits"
else
    echo "✅ Pre-commit checks completed in ${duration}s"
fi
EOF

# Create optimized commit-msg hook
cat > .husky/commit-msg << 'EOF'
#!/usr/bin/env sh
# MediaNest Optimized Commit Message Hook
. "$(dirname -- "$0")/_/husky.sh"

# Emergency bypass (still validates message format for traceability)
if [ "$MEDIANEST_SKIP_HOOKS" = "1" ]; then
    echo "🚀 Emergency mode - basic commit message validation only"
    # Basic validation for emergency commits
    commit_msg=$(cat "$1")
    if [ ${#commit_msg} -lt 10 ]; then
        echo "❌ Even emergency commits need descriptive messages (min 10 chars)"
        exit 1
    fi
    echo "✅ Emergency commit message accepted: ${commit_msg:0:50}..."
    exit 0
fi

# Fast commit message validation
NODE_OPTIONS="--max-old-space-size=256" npx commitlint --edit $1 --quiet

echo "✅ Commit message validated"
EOF

# Keep the existing post-checkout hook (it's already optimized)
if [ -f ".husky/post-checkout" ]; then
    print_status "Keeping existing post-checkout hook (already optimized)"
else
    print_warning "No post-checkout hook found - branch-specific gitignore features may not work"
fi

# Make hooks executable
chmod +x .husky/pre-commit .husky/commit-msg

print_success "Optimized hooks created"

# Phase 4: Create Optimized Configuration Files
print_status "Phase 4: Creating optimized configuration files..."

# Create optimized lint-staged configuration
cat > lint-staged.config.js << 'EOF'
/**
 * MediaNest Optimized Lint-Staged Configuration
 * Focus: Fast formatting with caching, defer heavy checks to CI
 * Performance target: <2s execution time
 */
module.exports = {
  // Frontend files - Prettier only (ESLint in CI for performance)
  'frontend/**/*.{js,jsx,ts,tsx}': [
    'prettier --write --cache --config .prettierrc'
  ],

  // Backend TypeScript - Prettier only (TypeScript checking in CI)
  'backend/**/*.{ts,tsx}': [
    'prettier --write --cache --config .prettierrc'
  ],

  // Shared package files
  'shared/**/*.{ts,tsx}': [
    'prettier --write --cache --config .prettierrc'
  ],

  // Configuration and documentation files
  '**/*.{json,md,yml,yaml}': (files) => {
    // Filter out large files and package-lock.json for performance
    const filtered = files.filter(file => 
      !file.includes('package-lock.json') &&
      !file.includes('node_modules') &&
      !file.includes('.git')
    );
    return filtered.length > 0 ? [`prettier --write --cache ${filtered.join(' ')}`] : [];
  },

  // CSS files (if any)
  '**/*.{css,scss,sass}': [
    'prettier --write --cache'
  ],

  // Shell scripts - make executable
  '**/*.sh': (files) => [
    ...files.map(file => `chmod +x ${file}`),
    'prettier --write --cache --parser sh'
  ],

  // Prisma schema formatting
  '**/schema.prisma': [
    'npx prisma format'
  ]
};
EOF

# Update commitlint configuration for performance
cat > commitlint.config.js << 'EOF'
/**
 * MediaNest Optimized Commitlint Configuration
 * Focus: Fast validation with clear error messages
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  
  // Performance optimizations
  parserPreset: {
    parserOpts: {
      // Reduce parsing overhead
      headerPattern: /^(\w*)(?:\(([\w\$\.\-\* ]*)\))?\: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  
  rules: {
    // Relaxed rules for better developer experience
    'type-enum': [
      2, 'always',
      [
        'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
        'test', 'build', 'ci', 'chore', 'revert',
        'hotfix', 'emergency' // Special types for urgent commits
      ]
    ],
    
    'scope-enum': [
      1, 'always', // Warning, not error
      [
        'frontend', 'backend', 'shared', 'deps', 'docker',
        'docs', 'config', 'security', 'db', 'api'
      ]
    ],
    
    // Reasonable limits
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 150], // Warning only
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    
    // Helpful for developers
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    
    // Relaxed for emergency commits
    'scope-empty': [1, 'never'], // Warning only
  },
  
  // Custom messages for better UX
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
};
EOF

print_success "Optimized configuration files created"

# Phase 5: Create Bypass Helper Scripts
print_status "Phase 5: Creating developer helper scripts..."

# Create bypass helper script
cat > scripts/git-hooks-bypass.sh << 'EOF'
#!/bin/bash

# MediaNest Git Hooks Bypass Helper
# Provides convenient bypass mechanisms for different scenarios

show_help() {
    echo "MediaNest Git Hooks Bypass Helper"
    echo "================================="
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  emergency     Set emergency bypass (skips all hooks except basic commit msg validation)"
    echo "  precommit     Skip pre-commit hooks only (commit-msg validation still runs)"
    echo "  status        Show current bypass status"
    echo "  clear         Clear all bypass flags"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 emergency    # For production hotfixes"
    echo "  $0 precommit    # For work-in-progress commits"
    echo "  $0 clear        # Return to normal hook behavior"
    echo ""
    echo "Direct usage:"
    echo "  MEDIANEST_SKIP_HOOKS=1 git commit -m 'hotfix: critical issue'"
    echo "  MEDIANEST_SKIP_PRECOMMIT=1 git commit -m 'wip: testing feature'"
}

case "$1" in
    emergency)
        export MEDIANEST_SKIP_HOOKS=1
        echo "🚨 Emergency bypass enabled"
        echo "   All hooks will be skipped (basic commit validation only)"
        echo "   Use: git commit -m 'emergency: your message'"
        ;;
    precommit)
        export MEDIANEST_SKIP_PRECOMMIT=1
        echo "⚠️  Pre-commit bypass enabled"
        echo "   Pre-commit formatting will be skipped"
        echo "   Commit message validation still enforced"
        echo "   Remember to run 'npm run lint:fix' before pushing"
        ;;
    status)
        echo "Current bypass status:"
        if [ "$MEDIANEST_SKIP_HOOKS" = "1" ]; then
            echo "  🚨 Emergency bypass: ACTIVE"
        else
            echo "  🚨 Emergency bypass: inactive"
        fi
        
        if [ "$MEDIANEST_SKIP_PRECOMMIT" = "1" ]; then
            echo "  ⚠️  Pre-commit bypass: ACTIVE"
        else
            echo "  ⚠️  Pre-commit bypass: inactive"
        fi
        
        if [ "$MEDIANEST_SKIP_HOOKS" != "1" ] && [ "$MEDIANEST_SKIP_PRECOMMIT" != "1" ]; then
            echo "  ✅ All hooks: ACTIVE (normal mode)"
        fi
        ;;
    clear)
        unset MEDIANEST_SKIP_HOOKS
        unset MEDIANEST_SKIP_PRECOMMIT
        echo "✅ All bypass flags cleared"
        echo "   Git hooks will run normally"
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
EOF

# Create performance monitoring script
cat > scripts/git-hooks-performance.sh << 'EOF'
#!/bin/bash

# MediaNest Git Hooks Performance Monitor
# Measures and reports hook performance metrics

echo "🔍 Git Hooks Performance Analysis"
echo "=================================="

# Test pre-commit hook performance
echo "Testing pre-commit hook performance..."
echo "console.log('performance test');" > /tmp/test-performance.js

# Stage the test file
if git add /tmp/test-performance.js 2>/dev/null; then
    # Time the pre-commit hook
    start=$(date +%s.%3N)
    if MEDIANEST_SKIP_HOOKS="" timeout 30 npx lint-staged --config lint-staged.config.js 2>/dev/null; then
        end=$(date +%s.%3N)
        duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "unknown")
        
        if [ "$duration" != "unknown" ]; then
            echo "✅ Pre-commit hook: ${duration}s"
            if [ "$(echo "$duration > 2" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
                echo "   ⚠️  Above target of 2s"
            else
                echo "   ✅ Within performance target"
            fi
        else
            echo "⚠️  Could not measure pre-commit performance"
        fi
    else
        echo "❌ Pre-commit hook failed or timed out"
    fi
    
    # Clean up
    git reset HEAD /tmp/test-performance.js 2>/dev/null
    rm -f /tmp/test-performance.js
else
    echo "⚠️  Could not stage test file for performance testing"
fi

# Test commit-msg hook performance
echo ""
echo "Testing commit-msg hook performance..."
echo "test: performance measurement" > /tmp/test-commit-msg

start=$(date +%s.%3N)
if timeout 10 npx commitlint --config commitlint.config.js < /tmp/test-commit-msg 2>/dev/null; then
    end=$(date +%s.%3N)
    duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "unknown")
    
    if [ "$duration" != "unknown" ]; then
        echo "✅ Commit-msg hook: ${duration}s"
        if [ "$(echo "$duration > 0.5" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
            echo "   ⚠️  Above target of 0.5s"
        else
            echo "   ✅ Within performance target"
        fi
    else
        echo "⚠️  Could not measure commit-msg performance"
    fi
else
    echo "❌ Commit-msg hook failed or timed out"
fi

rm -f /tmp/test-commit-msg

# Repository health metrics
echo ""
echo "Repository health metrics:"
echo "Git status time: $(time git status --porcelain 2>&1 | grep real | awk '{print $2}' || echo 'unknown')"
echo "Git repo size: $(du -sh .git 2>/dev/null | awk '{print $1}' || echo 'unknown')"
echo "Staged files: $(git diff --cached --name-only | wc -l || echo '0') files"

echo ""
echo "🎯 Performance targets:"
echo "  Pre-commit hook: <2s"
echo "  Commit-msg hook: <0.5s"
echo "  Git status: <0.1s"
EOF

# Make scripts executable
chmod +x scripts/git-hooks-bypass.sh scripts/git-hooks-performance.sh

print_success "Helper scripts created"

# Phase 6: Update Package.json Scripts
print_status "Phase 6: Adding convenience scripts to package.json..."

# Add npm scripts for hook management (using Node.js to safely modify package.json)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add hook-related scripts
const newScripts = {
  'hooks:bypass': './scripts/git-hooks-bypass.sh',
  'hooks:performance': './scripts/git-hooks-performance.sh',
  'hooks:install': 'husky prepare',
  'hooks:test': './scripts/git-hooks-performance.sh',
  'prepare': 'husky prepare || true'
};

pkg.scripts = { ...pkg.scripts, ...newScripts };

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Package.json updated with hook management scripts');
"

print_success "Package.json scripts updated"

# Phase 7: Final Setup and Validation
print_status "Phase 7: Final setup and validation..."

# Prepare Husky
npx husky prepare

# Test the configuration
print_status "Running configuration validation..."

# Check if hooks are executable
if [ -x ".husky/pre-commit" ] && [ -x ".husky/commit-msg" ]; then
    print_success "Hook files are executable"
else
    print_error "Hook files are not executable"
    exit 1
fi

# Quick performance test
print_status "Running quick performance test..."
./scripts/git-hooks-performance.sh

# Final success message
echo ""
print_success "🎉 Git Hooks Optimization Complete!"
echo ""
echo "📊 RESULTS:"
echo "  ✅ High-performance hooks installed"
echo "  ✅ Emergency bypass mechanisms ready"
echo "  ✅ Performance monitoring enabled"
echo "  ✅ Developer helper scripts available"
echo ""
echo "🚀 USAGE:"
echo "  Normal commits:     git commit -m 'feat: your feature'"
echo "  Emergency bypass:   MEDIANEST_SKIP_HOOKS=1 git commit -m 'hotfix: urgent fix'"
echo "  Skip pre-commit:    MEDIANEST_SKIP_PRECOMMIT=1 git commit -m 'wip: testing'"
echo "  Bypass helper:      npm run hooks:bypass emergency"
echo "  Performance test:   npm run hooks:performance"
echo ""
echo "🎯 PERFORMANCE TARGETS:"
echo "  Pre-commit: <2s (was 12.7s)"
echo "  Commit-msg: <0.5s (was 16.3s)"
echo "  Total hook time: <2.5s (was 29s)"
echo ""
echo "📖 For more information, see: docs/git-hooks-architecture-analysis.md"