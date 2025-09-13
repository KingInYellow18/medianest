#!/usr/bin/env node

/**
 * Console Security Elimination Script
 * 
 * CRITICAL SECURITY RISK MITIGATION:
 * Removes/replaces console.* statements that pose production security risks
 * 
 * STRATEGY:
 * 1. Comment out console.log/debug/info in production code
 * 2. Keep console.error for critical errors only  
 * 3. Replace with winston logger where appropriate
 * 4. Preserve test files and configuration files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ConsoleSecurityEliminator {
  constructor() {
    this.projectRoot = '/home/kinginyellow/projects/medianest';
    this.totalProcessed = 0;
    this.totalRemoved = 0;
    this.totalReplaced = 0;
    this.errors = [];
    
    // Directories to process (priority targets)
    this.targetDirs = [
      '/backend/src',
      '/frontend/src', 
      '/shared/src',
      '/src/services'
    ];
    
    // File patterns to include
    this.includePatterns = ['*.ts', '*.tsx', '*.js', '*.jsx'];
    
    // File patterns to exclude (keep console statements for debugging)
    this.excludePatterns = [
      '*.test.*',
      '*.spec.*', 
      '*.config.*',
      '**/tests/**',
      '**/test/**',
      '**/docs/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**'
    ];
    
    // Console methods to handle
    this.consoleMethods = {
      // Remove completely in production
      remove: ['log', 'debug', 'info', 'table', 'count', 'time', 'timeEnd', 'group', 'groupEnd'],
      // Keep but replace with logger
      replace: ['warn'], 
      // Keep as-is (critical errors)
      keep: ['error', 'assert']
    };
  }

  /**
   * Get initial count of console statements
   */
  getInitialCount() {
    try {
      const cmd = `grep -r "console\\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${this.projectRoot}/src ${this.projectRoot}/backend/src ${this.projectRoot}/frontend 2>/dev/null | wc -l`;
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      return parseInt(result, 10);
    } catch (error) {
      console.error('Error counting console statements:', error.message);
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
    const relativePath = path.relative(this.projectRoot, filePath);
    const ext = path.extname(filePath);
    
    // Check if file extension is included
    const isIncluded = this.includePatterns.some(pattern => 
      pattern.replace('*', '') === ext
    );
    
    if (!isIncluded) return false;
    
    // Check if file should be excluded
    const isExcluded = this.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    });
    
    return !isExcluded;
  }

  /**
   * Process a single file
   */
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const originalLines = content.split('\n');
      let modifiedLines = [...originalLines];
      let fileChanged = false;
      let removedCount = 0;
      let replacedCount = 0;

      for (let i = 0; i < modifiedLines.length; i++) {
        const line = modifiedLines[i];
        const result = this.processLine(line, filePath);
        
        if (result.modified) {
          modifiedLines[i] = result.newLine;
          fileChanged = true;
          
          if (result.action === 'remove') {
            removedCount++;
          } else if (result.action === 'replace') {
            replacedCount++;
          }
        }
      }

      if (fileChanged) {
        // Add logger import if needed and not present
        if ((removedCount > 0 || replacedCount > 0) && this.needsLoggerImport(modifiedLines.join('\n'), filePath)) {
          modifiedLines = this.addLoggerImport(modifiedLines, filePath);
        }
        
        const newContent = modifiedLines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        console.log(`✅ Processed: ${path.relative(this.projectRoot, filePath)} (removed: ${removedCount}, replaced: ${replacedCount})`);
        
        this.totalRemoved += removedCount;
        this.totalReplaced += replacedCount;
      }
      
      this.totalProcessed++;
      
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      this.errors.push(errorMsg);
    }
  }

  /**
   * Process a single line for console statements
   */
  processLine(line, filePath) {
    const trimmed = line.trim();
    
    // Skip commented lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return { modified: false };
    }

    // Match console.method patterns
    const consoleRegex = /console\.(\w+)\s*\(/g;
    let match;
    let newLine = line;
    let modified = false;
    let action = null;

    while ((match = consoleRegex.exec(line)) !== null) {
      const method = match[1];
      const fullMatch = match[0];
      
      if (this.consoleMethods.remove.includes(method)) {
        // Comment out the line
        if (!line.trim().startsWith('//')) {
          newLine = line.replace(/^(\s*)/, '$1// SECURITY: Removed console statement - ');
          modified = true;
          action = 'remove';
        }
      } else if (this.consoleMethods.replace.includes(method)) {
        // Replace with logger
        newLine = line.replace(`console.${method}`, 'logger.warn');
        modified = true;
        action = 'replace';
      }
      // Keep console.error and console.assert as-is
    }

    return { modified, newLine, action };
  }

  /**
   * Check if file needs logger import
   */
  needsLoggerImport(content, filePath) {
    // Check if logger is already imported
    const hasLoggerImport = /import.*logger.*from.*logger/.test(content) ||
                           /import.*\{.*logger.*\}.*from/.test(content) ||
                           /const.*logger.*=.*require/.test(content);
    
    // Check if there are logger references that would need import
    const hasLoggerUsage = /logger\.(warn|info|error|debug)/.test(content);
    
    return hasLoggerUsage && !hasLoggerImport;
  }

  /**
   * Add logger import to file
   */
  addLoggerImport(lines, filePath) {
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const isBackend = filePath.includes('/backend/');
    
    if (!isBackend) {
      // For frontend, we might need a different logger setup
      return lines;
    }

    // Find the best place to insert the import
    let insertIndex = 0;
    let foundImports = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && !foundImports) {
        foundImports = true;
        insertIndex = i;
      } else if (foundImports && !line.startsWith('import ') && line !== '') {
        insertIndex = i;
        break;
      }
    }

    const loggerImport = "import { logger } from '../utils/logger';";
    lines.splice(insertIndex, 0, loggerImport);
    
    return lines;
  }

  /**
   * Run the elimination process
   */
  async run() {
    console.log('🚨 STARTING CONSOLE SECURITY ELIMINATION');
    console.log('========================================');
    
    // Get initial count
    const initialCount = this.getInitialCount();
    console.log(`📊 Initial console statements in source dirs: ${initialCount}`);
    
    // Find files to process
    const files = this.findTargetFiles();
    console.log(`📁 Found ${files.length} files to process`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found to process');
      return;
    }

    // Process files
    console.log('\n🔧 Processing files...\n');
    for (const file of files) {
      this.processFile(file);
    }

    // Get final count
    const finalCount = this.getInitialCount();
    
    // Report results
    console.log('\n========================================');
    console.log('🎯 CONSOLE ELIMINATION COMPLETE');
    console.log('========================================');
    console.log(`📊 Files processed: ${this.totalProcessed}`);
    console.log(`🗑️  Console statements removed: ${this.totalRemoved}`);
    console.log(`🔄 Console statements replaced: ${this.totalReplaced}`);
    console.log(`📉 Initial count: ${initialCount}`);
    console.log(`📈 Final count: ${finalCount}`);
    console.log(`💯 Reduction: ${initialCount - finalCount} (${Math.round(((initialCount - finalCount) / initialCount) * 100)}%)`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(error => console.log(`   ${error}`));
    }

    // Hook notification
    try {
      execSync('npx claude-flow@alpha hooks notify --message "Console security elimination completed"', 
        { cwd: this.projectRoot });
    } catch (error) {
      console.log('Note: Could not send hook notification');
    }

    return {
      initialCount,
      finalCount,
      processed: this.totalProcessed,
      removed: this.totalRemoved,
      replaced: this.totalReplaced,
      errors: this.errors
    };
  }
}

// Run if called directly
if (require.main === module) {
  const eliminator = new ConsoleSecurityEliminator();
  eliminator.run().catch(console.error);
}

module.exports = ConsoleSecurityEliminator;