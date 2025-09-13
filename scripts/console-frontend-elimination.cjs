#!/usr/bin/env node

/**
 * Frontend Console Elimination Script
 * 
 * Specifically targets frontend scripts with high console usage
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FrontendConsoleEliminator {
  constructor() {
    this.projectRoot = '/home/kinginyellow/projects/medianest';
    this.totalProcessed = 0;
    this.totalRemoved = 0;
    this.errors = [];
    
    // Target frontend script directories specifically
    this.targetDirs = [
      '/frontend/scripts',
      '/frontend/src',
      '/frontend/pages',
      '/frontend/components'
    ];
  }

  /**
   * Get console count for specific paths
   */
  getCount(paths) {
    try {
      const cmd = `grep -r "console\\." --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" ${paths} 2>/dev/null | wc -l`;
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      return parseInt(result, 10);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Find all frontend files to process
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
    return validExts.includes(ext);
  }

  /**
   * Process a single file - comment out ALL console statements
   */
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      let modified = false;
      let removedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip already commented lines
        if (line.trim().startsWith('//')) {
          continue;
        }

        // Check for console statements
        if (/console\.\w+\s*\(/.test(line)) {
          // Comment out the entire line
          lines[i] = line.replace(/^(\s*)/, '$1// SECURITY: Console statement removed - ');
          modified = true;
          removedCount++;
        }
      }

      if (modified) {
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        const relativePath = path.relative(this.projectRoot, filePath);
        console.log(`✅ Processed: ${relativePath} (removed: ${removedCount})`);
        
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
   * Run the elimination process
   */
  async run() {
    console.log('🚨 FRONTEND CONSOLE SECURITY ELIMINATION');
    console.log('========================================');
    
    // Get initial count
    const initialCount = this.getCount(this.targetDirs.map(d => this.projectRoot + d).join(' '));
    console.log(`📊 Initial frontend console statements: ${initialCount}`);
    
    // Find files to process
    const files = this.findTargetFiles();
    console.log(`📁 Found ${files.length} frontend files to process`);
    
    if (files.length === 0) {
      console.log('⚠️  No frontend files found to process');
      return;
    }

    // Process files
    console.log('\n🔧 Processing frontend files...\n');
    for (const file of files) {
      this.processFile(file);
    }

    // Get final count
    const finalCount = this.getCount(this.targetDirs.map(d => this.projectRoot + d).join(' '));
    
    // Report results
    console.log('\n========================================');
    console.log('🎯 FRONTEND CONSOLE ELIMINATION COMPLETE');
    console.log('========================================');
    console.log(`📊 Files processed: ${this.totalProcessed}`);
    console.log(`🗑️  Console statements removed: ${this.totalRemoved}`);
    console.log(`📉 Initial count: ${initialCount}`);
    console.log(`📈 Final count: ${finalCount}`);
    console.log(`💯 Reduction: ${initialCount - finalCount} (${Math.round(((initialCount - finalCount) / initialCount) * 100)}%)`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(error => console.log(`   ${error}`));
    }

    return {
      initialCount,
      finalCount,
      processed: this.totalProcessed,
      removed: this.totalRemoved,
      errors: this.errors
    };
  }
}

// Run if called directly
if (require.main === module) {
  const eliminator = new FrontendConsoleEliminator();
  eliminator.run().catch(console.error);
}

module.exports = FrontendConsoleEliminator;