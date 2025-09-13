#!/usr/bin/env node

/**
 * Complete Console Elimination Script
 * 
 * AGGRESSIVE APPROACH: Remove console statements entirely
 * Focuses on production-ready code only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CompleteConsoleEliminator {
  constructor() {
    this.projectRoot = '/home/kinginyellow/projects/medianest';
    this.totalProcessed = 0;
    this.totalRemoved = 0;
    this.errors = [];
    
    // Target all source directories
    this.targetDirs = [
      '/backend/src',
      '/frontend/src',
      '/frontend/scripts', 
      '/shared/src',
      '/src/services'
    ];
  }

  /**
   * Get console count for verification
   */
  getCount() {
    try {
      const paths = this.targetDirs.map(d => this.projectRoot + d).join(' ');
      const cmd = `grep -r "console\\." --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" ${paths} 2>/dev/null | wc -l`;
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      return parseInt(result, 10);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Find all files to process
   */
  findTargetFiles() {
    const files = [];
    
    for (const dir of this.targetDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        this.walkDirectory(fullPath, files);
      }
    }
    
    return files.filter(file => this.shouldProcessFile(file));
  }

  /**
   * Recursively walk directory
   */
  walkDirectory(dir, files) {
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.walkDirectory(fullPath, files);
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
  }

  /**
   * Check if file should be processed
   */
  shouldProcessFile(filePath) {
    const ext = path.extname(filePath);
    const validExts = ['.js', '.jsx', '.ts', '.tsx'];
    const isValidExt = validExts.includes(ext);
    
    // Skip test files and config files
    const isTestFile = /\.(test|spec)\./i.test(filePath);
    const isConfigFile = /\.config\./i.test(filePath);
    
    return isValidExt && !isTestFile && !isConfigFile;
  }

  /**
   * Process a single file - completely remove console statements
   */
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const originalLength = lines.length;
      let removedCount = 0;
      
      // Filter out lines with console statements
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        
        // Keep lines that don't have console statements
        if (!/console\.\w+\s*\(/.test(line)) {
          return true;
        }
        
        // Remove lines with console statements (except for critical errors in try/catch)
        if (/console\.error/.test(line) && /catch\s*\(/.test(content)) {
          // Keep console.error in catch blocks for critical error handling
          return true;
        }
        
        removedCount++;
        return false;
      });

      if (removedCount > 0) {
        const newContent = filteredLines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        const relativePath = path.relative(this.projectRoot, filePath);
        console.log(`✅ Processed: ${relativePath} (removed ${removedCount} lines)`);
        
        this.totalRemoved += removedCount;
      }
      
      this.totalProcessed++;
      
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      this.errors.push(errorMsg);
    }
  }

  /**
   * Clean up commented console statements too
   */
  cleanCommentedConsole(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      let removedCount = 0;
      
      // Remove commented console statements that were added by previous runs
      const filteredLines = lines.filter(line => {
        if (/\/\/\s*SECURITY:\s*.*console/i.test(line)) {
          removedCount++;
          return false;
        }
        return true;
      });

      if (removedCount > 0) {
        const newContent = filteredLines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        return removedCount;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Run the complete elimination process
   */
  async run() {
    console.log('🚨 COMPLETE CONSOLE SECURITY ELIMINATION');
    console.log('==========================================');
    
    // Get initial count
    const initialCount = this.getCount();
    console.log(`📊 Initial console statements: ${initialCount}`);
    
    // Find files to process
    const files = this.findTargetFiles();
    console.log(`📁 Found ${files.length} files to process`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found to process');
      return;
    }

    // Process files
    console.log('\n🔧 Processing files...\n');
    
    let totalCommentedRemoved = 0;
    for (const file of files) {
      // First clean up commented console statements
      const commentedRemoved = this.cleanCommentedConsole(file);
      totalCommentedRemoved += commentedRemoved;
      
      // Then process remaining console statements
      this.processFile(file);
    }

    // Get final count
    const finalCount = this.getCount();
    
    // Report results
    console.log('\n==========================================');
    console.log('🎯 COMPLETE CONSOLE ELIMINATION FINISHED');
    console.log('==========================================');
    console.log(`📊 Files processed: ${this.totalProcessed}`);
    console.log(`🗑️  Console lines removed: ${this.totalRemoved}`);
    console.log(`🧹 Commented lines cleaned: ${totalCommentedRemoved}`);
    console.log(`📉 Initial count: ${initialCount}`);
    console.log(`📈 Final count: ${finalCount}`);
    
    if (finalCount < initialCount) {
      const reduction = initialCount - finalCount;
      const percentage = Math.round((reduction / initialCount) * 100);
      console.log(`💯 Total reduction: ${reduction} statements (${percentage}%)`);
    }
    
    // Security assessment
    if (finalCount < 50) {
      console.log(`✅ SECURITY STATUS: LOW RISK (${finalCount} remaining)`);
    } else if (finalCount < 100) {
      console.log(`⚠️  SECURITY STATUS: MEDIUM RISK (${finalCount} remaining)`);
    } else {
      console.log(`🚨 SECURITY STATUS: HIGH RISK (${finalCount} remaining)`);
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(error => console.log(`   ${error}`));
    }

    // Hook notification
    try {
      execSync(`npx claude-flow@alpha hooks notify --message "Complete console elimination: ${initialCount} -> ${finalCount} statements"`, 
        { cwd: this.projectRoot });
    } catch (error) {
      console.log('Note: Could not send hook notification');
    }

    return {
      initialCount,
      finalCount,
      processed: this.totalProcessed,
      removed: this.totalRemoved,
      cleaned: totalCommentedRemoved,
      errors: this.errors
    };
  }
}

// Run if called directly
if (require.main === module) {
  const eliminator = new CompleteConsoleEliminator();
  eliminator.run().catch(console.error);
}

module.exports = CompleteConsoleEliminator;