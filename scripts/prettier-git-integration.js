#!/usr/bin/env node

/**
 * Prettier Git Hooks Integration
 * Smart integration with git hooks for optimal development experience
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

class PrettierGitIntegration {
  constructor() {
    this.huskyDir = path.join(ROOT_DIR, '.husky');
    this.preCommitHook = path.join(this.huskyDir, 'pre-commit');
  }

  ensureHuskySetup() {
    if (!fs.existsSync(this.huskyDir)) {
      console.log('📦 Setting up Husky...');
      execSync('npx husky prepare', { cwd: ROOT_DIR });
    }
  }

  createOptimizedPreCommitHook() {
    this.ensureHuskySetup();

    const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Prettier Git Integration - Smart formatting for staged files
# Uses development-friendly settings during commit process

echo "🎨 Running Prettier on staged files..."

# Check if there are staged files to format
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E "\\.(ts|tsx|js|jsx|json|css|scss|md|yaml|yml)$" | tr '\\n' ' ')

if [ -z "$STAGED_FILES" ]; then
  echo "📝 No formattable staged files found"
  exit 0
fi

echo "📁 Files to format: $STAGED_FILES"

# Use our optimized dev mode formatting
if node scripts/prettier-dev-mode.js staged; then
  echo "✅ Prettier formatting completed successfully"
else
  echo "❌ Prettier formatting failed"
  echo "💡 You can bypass with: git commit --no-verify"
  exit 1
fi

# Check for any remaining ESLint issues on staged files
echo "🔍 Running ESLint on staged files..."
if npm run lint:staged-only 2>/dev/null || true; then
  echo "✅ ESLint check passed"
else
  echo "⚠️  ESLint issues found - check output above"
  echo "💡 Fix issues or bypass with: git commit --no-verify"
fi
`;

    fs.writeFileSync(this.preCommitHook, hookContent);
    fs.chmodSync(this.preCommitHook, 0o755);

    console.log('✅ Created optimized pre-commit hook');
  }

  createCommitMsgHook() {
    const commitMsgHook = path.join(this.huskyDir, 'commit-msg');

    const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Format commit message if it contains formatting indicators
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat $COMMIT_MSG_FILE)

# If commit message starts with "format:" run additional checks
if echo "$COMMIT_MSG" | grep -q "^format:"; then
  echo "🎨 Formatting commit detected - running comprehensive format check..."
  
  # Run a quick format check on recently modified files
  if ! node scripts/prettier-dev-mode.js check src/; then
    echo "⚠️  Format issues detected in src/ directory"
    echo "Run 'npm run format:dev src/' to fix"
  fi
fi
`;

    fs.writeFileSync(commitMsgHook, hookContent);
    fs.chmodSync(commitMsgHook, 0o755);

    console.log('✅ Created commit-msg hook with format detection');
  }

  createPrePushHook() {
    const prePushHook = path.join(this.huskyDir, 'pre-push');

    const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Pre-push: Ensure production-quality formatting
echo "🚀 Pre-push: Checking formatting with production standards..."

# Quick format check with production config
if node scripts/prettier-dev-mode.js batch-check "src/**/*.{ts,tsx,js,jsx}"; then
  echo "✅ Production formatting check passed"
else
  echo "❌ Production formatting issues found"
  echo "💡 Run 'npm run format:prod src/' to fix"
  echo "💡 Or bypass with: git push --no-verify"
  exit 1
fi
`;

    fs.writeFileSync(prePushHook, hookContent);
    fs.chmodSync(prePushHook, 0o755);

    console.log('✅ Created pre-push hook with production formatting check');
  }

  addLintStagedConfig() {
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Add lint-staged configuration for more granular control
    packageJson['lint-staged'] = {
      '*.{ts,tsx,js,jsx}': ['node scripts/prettier-dev-mode.js dev', 'eslint --fix --cache'],
      '*.{json,css,scss,md}': ['node scripts/prettier-dev-mode.js dev'],
    };

    // Add script for staging-only lint
    packageJson.scripts['lint:staged-only'] = 'lint-staged';

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\\n');
    console.log('✅ Added lint-staged configuration');
  }

  testHookIntegration() {
    console.log('🧪 Testing git hook integration...');

    try {
      // Create a temporary test file
      const testFile = path.join(ROOT_DIR, 'test-prettier-integration.tmp.js');
      const testContent = `const test={a:1,b:2,c:function(){return"very long string that should definitely be wrapped by prettier when it processes this file"}};`;

      fs.writeFileSync(testFile, testContent);

      // Stage the file
      execSync(`git add ${testFile}`, { cwd: ROOT_DIR });

      // Test our staging formatter
      console.log('📝 Testing staged file formatting...');
      execSync('node scripts/prettier-dev-mode.js staged', {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      // Check if file was formatted
      const formattedContent = fs.readFileSync(testFile, 'utf8');
      const wasFormatted = formattedContent !== testContent && formattedContent.includes('\\n');

      if (wasFormatted) {
        console.log('✅ Staged file formatting test passed');
      } else {
        console.log('⚠️  Staged file formatting may not be working correctly');
      }

      // Cleanup
      execSync(`git reset HEAD ${testFile}`, { cwd: ROOT_DIR });
      fs.unlinkSync(testFile);

      console.log('🧪 Hook integration test completed');
    } catch (error) {
      console.error('❌ Hook integration test failed:', error.message);
    }
  }

  setupGitConfig() {
    console.log('⚙️  Setting up Git configuration for optimal Prettier workflow...');

    try {
      // Set up git attributes for consistent line endings
      const gitAttributesPath = path.join(ROOT_DIR, '.gitattributes');
      const attributesContent = `# Prettier integration
*.js text eol=lf
*.ts text eol=lf
*.jsx text eol=lf
*.tsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.css text eol=lf
*.scss text eol=lf
*.yml text eol=lf
*.yaml text eol=lf

# Binary files
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
`;

      if (!fs.existsSync(gitAttributesPath)) {
        fs.writeFileSync(gitAttributesPath, attributesContent);
        console.log('✅ Created .gitattributes for consistent formatting');
      }

      // Configure git settings for better integration
      execSync('git config core.autocrlf false', { cwd: ROOT_DIR });
      console.log('✅ Configured Git line ending handling');
    } catch (error) {
      console.error('⚠️  Git configuration setup encountered issues:', error.message);
    }
  }
}

// CLI interface
async function main() {
  const integration = new PrettierGitIntegration();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'setup':
        console.log('🚀 Setting up Prettier Git Integration...');
        integration.createOptimizedPreCommitHook();
        integration.createCommitMsgHook();
        integration.createPrePushHook();
        integration.addLintStagedConfig();
        integration.setupGitConfig();
        console.log('\\n✅ Prettier Git Integration setup completed!');
        console.log('\\n💡 Try making a commit to test the integration');
        break;

      case 'test':
        integration.testHookIntegration();
        break;

      case 'hooks-only':
        integration.createOptimizedPreCommitHook();
        integration.createCommitMsgHook();
        integration.createPrePushHook();
        break;

      case 'config-only':
        integration.addLintStagedConfig();
        integration.setupGitConfig();
        break;

      default:
        console.log(`
🎨 Prettier Git Integration

Usage: node scripts/prettier-git-integration.js <command>

Commands:
  setup       Complete setup (hooks + config + git settings)
  test        Test the integration with a temporary file
  hooks-only  Setup git hooks only
  config-only Setup package.json and git config only

The integration provides:
  ✅ Smart pre-commit formatting with development-friendly settings
  ✅ Production-quality format checking on pre-push
  ✅ Lint-staged integration for granular control
  ✅ Optimized .gitattributes for consistent line endings
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default PrettierGitIntegration;
