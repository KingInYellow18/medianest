#!/usr/bin/env node

/**
 * Security-focused dependency update script for MediaNest
 * Addresses known vulnerabilities while maintaining compatibility
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 MediaNest Security Dependency Update Script');
console.log('===============================================\n');

// Function to run commands and log output
function runCommand(command, description, cwd = process.cwd()) {
  console.log(`📋 ${description}...`);
  try {
    const output = execSync(command, {
      cwd,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    console.error(error.message);
    return false;
  }
}

// Function to update package.json versions safely
function updatePackageVersions(packagePath, updates) {
  try {
    console.log(`📦 Updating versions in ${packagePath}...`);
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    let changed = false;
    Object.entries(updates).forEach(([packageName, newVersion]) => {
      if (pkg.devDependencies && pkg.devDependencies[packageName]) {
        console.log(`  - ${packageName}: ${pkg.devDependencies[packageName]} → ${newVersion}`);
        pkg.devDependencies[packageName] = newVersion;
        changed = true;
      } else if (pkg.dependencies && pkg.dependencies[packageName]) {
        console.log(`  - ${packageName}: ${pkg.dependencies[packageName]} → ${newVersion}`);
        pkg.dependencies[packageName] = newVersion;
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`✅ Updated ${packagePath}\n`);
      return true;
    } else {
      console.log(`ℹ️  No updates needed for ${packagePath}\n`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to update ${packagePath}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  const backendDir = path.join(__dirname, '..', 'backend');
  const backendPkgPath = path.join(backendDir, 'package.json');

  // 1. Update vulnerable backend dependencies to secure versions
  console.log('🔧 Phase 1: Updating Backend Dependencies\n');

  const backendUpdates = {
    // Update vitest and related packages to latest secure versions
    vitest: '^2.1.5',
    '@vitest/ui': '^2.1.5',
    '@vitest/coverage-v8': '^2.1.5',
    vite: '^5.4.8',

    // Update ioredis-mock to avoid tmp vulnerability
    'ioredis-mock': '^8.9.0',

    // Additional security updates
    axios: '^1.7.7', // Latest secure version
    helmet: '^7.1.0', // Latest version
    'express-rate-limit': '^7.4.0', // Latest version
  };

  updatePackageVersions(backendPkgPath, backendUpdates);

  // 2. Clean install in backend
  console.log('🧹 Phase 2: Clean Installation\n');

  // Remove node_modules and package-lock.json for clean install
  runCommand('rm -rf node_modules package-lock.json', 'Cleaning backend dependencies', backendDir);

  // Fresh npm install
  runCommand('npm install', 'Installing updated backend dependencies', backendDir);

  // 3. Run security audit
  console.log('🔍 Phase 3: Security Audit\n');
  runCommand('npm audit', 'Running security audit', backendDir);

  // 4. Fix remaining auto-fixable issues
  console.log('🔧 Phase 4: Auto-fix remaining issues\n');
  runCommand('npm audit fix', 'Auto-fixing remaining issues', backendDir);

  // 5. Update root level if needed
  console.log('🏠 Phase 5: Root Dependencies\n');
  const rootDir = path.join(__dirname, '..');
  runCommand('npm update', 'Updating root dependencies', rootDir);

  console.log('🎉 Security update completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Test the application thoroughly');
  console.log('2. Run npm audit to verify no critical vulnerabilities remain');
  console.log('3. Update CI/CD pipelines if needed');
  console.log('4. Document any breaking changes');
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}
