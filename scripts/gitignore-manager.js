#!/usr/bin/env node
/**
 * GitIgnore Manager - Automatic branch-specific .gitignore switching
 *
 * This script manages branch-specific .gitignore files for MediaNest project
 * It combines the base .gitignore with branch-specific rules
 *
 * Usage:
 *   node scripts/gitignore-manager.js [branch-name]
 *
 * If no branch-name is provided, it uses the current git branch
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GitIgnoreManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.baseGitIgnore = path.join(this.projectRoot, '.gitignore');
    this.gitInfoExclude = path.join(this.projectRoot, '.git', 'info', 'exclude');
  }

  /**
   * Get current git branch
   */
  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();
    } catch (error) {
      console.error('Error getting current branch:', error.message);
      return null;
    }
  }

  /**
   * Get branch-specific gitignore file path
   */
  getBranchGitIgnorePath(branch) {
    return path.join(this.projectRoot, `.gitignore.${branch}`);
  }

  /**
   * Read file content safely
   */
  readFileSafe(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return '';
    } catch (error) {
      console.warn(`Warning: Could not read ${filePath}:`, error.message);
      return '';
    }
  }

  /**
   * Write content to .git/info/exclude
   */
  writeGitInfoExclude(content) {
    try {
      // Ensure .git/info directory exists
      const gitInfoDir = path.dirname(this.gitInfoExclude);
      if (!fs.existsSync(gitInfoDir)) {
        fs.mkdirSync(gitInfoDir, { recursive: true });
      }

      fs.writeFileSync(this.gitInfoExclude, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing .git/info/exclude:', error.message);
      return false;
    }
  }

  /**
   * Apply gitignore rules for specific branch
   */
  applyBranchRules(branch) {
    console.log(`🔄 Applying gitignore rules for branch: ${branch}`);

    // Read base .gitignore
    const baseContent = this.readFileSafe(this.baseGitIgnore);
    if (!baseContent) {
      console.error('❌ Could not read base .gitignore file');
      return false;
    }

    // Read branch-specific rules
    const branchGitIgnorePath = this.getBranchGitIgnorePath(branch);
    const branchContent = this.readFileSafe(branchGitIgnorePath);

    // Combine base and branch-specific rules
    let combinedContent = baseContent;

    if (branchContent) {
      combinedContent += `\\n\\n# ===================================\\n`;
      combinedContent += `# BRANCH-SPECIFIC RULES FOR: ${branch.toUpperCase()}\\n`;
      combinedContent += `# ===================================\\n`;
      combinedContent += branchContent;
      console.log(`📋 Found branch-specific rules for ${branch}`);
    } else {
      console.log(`ℹ️  No branch-specific rules found for ${branch}`);
    }

    // Write combined rules to .git/info/exclude
    if (this.writeGitInfoExclude(combinedContent)) {
      console.log(`✅ Successfully applied gitignore rules for branch: ${branch}`);
      return true;
    } else {
      console.error(`❌ Failed to apply gitignore rules for branch: ${branch}`);
      return false;
    }
  }

  /**
   * List available branch-specific gitignore files
   */
  listBranchRules() {
    const gitignoreFiles = fs
      .readdirSync(this.projectRoot)
      .filter((file) => file.startsWith('.gitignore.'))
      .map((file) => file.replace('.gitignore.', ''));

    if (gitignoreFiles.length > 0) {
      console.log('📂 Available branch-specific rules:');
      gitignoreFiles.forEach((branch) => {
        const filePath = this.getBranchGitIgnorePath(branch);
        const stats = fs.statSync(filePath);
        console.log(`   • ${branch} (${stats.size} bytes)`);
      });
    } else {
      console.log('ℹ️  No branch-specific gitignore files found');
    }

    return gitignoreFiles;
  }

  /**
   * Show current gitignore status
   */
  showStatus() {
    const currentBranch = this.getCurrentBranch();
    const branchRules = this.listBranchRules();

    console.log('\\n📊 GitIgnore Manager Status:');
    console.log(`   Current branch: ${currentBranch || 'unknown'}`);
    console.log(`   Available branch rules: ${branchRules.length}`);
    console.log(`   Git info/exclude exists: ${fs.existsSync(this.gitInfoExclude) ? '✅' : '❌'}`);

    if (currentBranch && branchRules.includes(currentBranch)) {
      console.log(`   Branch-specific rules: ✅ Available for ${currentBranch}`);
    } else if (currentBranch) {
      console.log(`   Branch-specific rules: ⚠️  Not available for ${currentBranch}`);
    }
  }

  /**
   * Main execution method
   */
  run(targetBranch = null) {
    console.log('🚀 MediaNest GitIgnore Manager\\n');

    const branch = targetBranch || this.getCurrentBranch();

    if (!branch) {
      console.error('❌ Could not determine target branch');
      process.exit(1);
    }

    // Show status first
    this.showStatus();
    console.log('');

    // Apply rules for the target branch
    const success = this.applyBranchRules(branch);

    if (success) {
      console.log('\\n🎉 GitIgnore rules updated successfully!');
      process.exit(0);
    } else {
      console.log('\\n💥 Failed to update gitignore rules');
      process.exit(1);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new GitIgnoreManager();
  const targetBranch = process.argv[2];

  // Handle special commands
  if (targetBranch === '--status' || targetBranch === '-s') {
    manager.showStatus();
    process.exit(0);
  }

  if (targetBranch === '--list' || targetBranch === '-l') {
    manager.listBranchRules();
    process.exit(0);
  }

  if (targetBranch === '--help' || targetBranch === '-h') {
    console.log(`
🚀 MediaNest GitIgnore Manager

Usage:
  node scripts/gitignore-manager.js [branch-name]   Apply rules for specific branch
  node scripts/gitignore-manager.js --status        Show current status
  node scripts/gitignore-manager.js --list          List available branch rules
  node scripts/gitignore-manager.js --help          Show this help

Examples:
  node scripts/gitignore-manager.js develop         Apply develop branch rules
  node scripts/gitignore-manager.js staging         Apply staging branch rules  
  node scripts/gitignore-manager.js main            Apply main branch rules
  node scripts/gitignore-manager.js                 Apply rules for current branch
`);
    process.exit(0);
  }

  // Run the manager
  manager.run(targetBranch);
}

module.exports = GitIgnoreManager;
