#!/usr/bin/env node
/**
 * Bulk Console.log Replacement Script
 * 
 * This script replaces all console.log, console.error, console.warn, and console.info 
 * statements with proper logger calls using structured logging.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const BACKEND_DIR = path.resolve(__dirname, '..');
const LOGGER_IMPORT = "import { logger } from '../utils/logger';";
const LOGGER_IMPORT_REQUIRE = "const { logger } = require('../utils/logger');";

// Pattern mappings for console statements
const REPLACEMENT_PATTERNS = [
  // Basic console.log patterns
  {
    pattern: /console\.log\((.*?)\);/g,
    replacement: (match, content) => {
      if (content.includes('${') || content.includes('`')) {
        // Template literals or complex strings
        return `logger.info(${content});`;
      } else if (content.includes('Health check')) {
        // Health check specific
        return `logger.info('Health check event', { message: ${content} });`;
      } else {
        // Simple string
        return `logger.info(${content});`;
      }
    }
  },
  
  // Console.error patterns
  {
    pattern: /console\.error\((.*?)\);/g,
    replacement: (match, content) => {
      if (content.includes(',')) {
        const parts = content.split(',').map(p => p.trim());
        const message = parts[0];
        const data = parts.slice(1).join(', ');
        return `logger.error(${message}, { error: ${data} });`;
      }
      return `logger.error(${content});`;
    }
  },
  
  // Console.warn patterns
  {
    pattern: /console\.warn\((.*?)\);/g,
    replacement: (match, content) => `logger.warn(${content});`
  },
  
  // Console.info patterns  
  {
    pattern: /console\.info\((.*?)\);/g,
    replacement: (match, content) => `logger.info(${content});`
  },
  
  // Console.debug patterns
  {
    pattern: /console\.debug\((.*?)\);/g,
    replacement: (match, content) => `logger.debug(${content});`
  }
];

// Files to exclude from replacement
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/*.d.ts',
  '**/logs/**',
  '**/*.log',
  '**/scripts/verify-deployment.js' // Keep as console for deployment verification
];

// Check if file should be excluded
function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  });
}

// Check if file needs logger import
function needsLoggerImport(content, filePath) {
  const hasConsoleStatements = /console\.(log|error|warn|info|debug)/.test(content);
  const hasLoggerImport = /import.*logger.*from|require.*logger/.test(content);
  return hasConsoleStatements && !hasLoggerImport;
}

// Add logger import to file
function addLoggerImport(content, filePath) {
  const isTypeScript = filePath.endsWith('.ts');
  const isModule = content.includes('import ') || content.includes('export ');
  
  if (isTypeScript && isModule) {
    // TypeScript with ES6 imports
    const importStatement = "import { logger } from './utils/logger';\n";
    if (content.includes('import ')) {
      // Add after last import
      const lastImportIndex = content.lastIndexOf('import ');
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      return content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1);
    } else {
      return importStatement + content;
    }
  } else {
    // CommonJS require
    const requireStatement = "const { logger } = require('./utils/logger');\n";
    return requireStatement + content;
  }
}

// Process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let hasChanges = false;
    
    // Apply replacement patterns
    REPLACEMENT_PATTERNS.forEach(({ pattern, replacement }) => {
      const newContent = modifiedContent.replace(pattern, replacement);
      if (newContent !== modifiedContent) {
        hasChanges = true;
        modifiedContent = newContent;
      }
    });
    
    // Add logger import if needed
    if (hasChanges && needsLoggerImport(modifiedContent, filePath)) {
      modifiedContent = addLoggerImport(modifiedContent, filePath);
    }
    
    // Write back if changes were made
    if (hasChanges) {
      fs.writeFileSync(filePath, modifiedContent);
      console.log(`✅ Processed: ${path.relative(BACKEND_DIR, filePath)}`);
      return 1;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

// Main function
function main() {
  console.log('🚀 Starting console.log replacement...\n');
  
  // Find all TypeScript and JavaScript files
  const filePatterns = [
    'src/**/*.ts',
    'src/**/*.js',
    'scripts/**/*.ts', 
    'scripts/**/*.js'
  ];
  
  let totalFiles = 0;
  let processedFiles = 0;
  
  filePatterns.forEach(pattern => {
    const files = glob.sync(pattern, { cwd: BACKEND_DIR });
    
    files.forEach(file => {
      const fullPath = path.join(BACKEND_DIR, file);
      
      if (!shouldExcludeFile(fullPath)) {
        totalFiles++;
        processedFiles += processFile(fullPath);
      }
    });
  });
  
  console.log(`\n📊 Replacement complete:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files modified: ${processedFiles}`);
  console.log(`   Files unchanged: ${totalFiles - processedFiles}`);
  
  // Verify remaining console statements
  console.log('\n🔍 Checking for remaining console statements...');
  const remainingPattern = 'console\\.(log|error|warn|info|debug)';
  const { execSync } = require('child_process');
  
  try {
    const result = execSync(
      `grep -r "${remainingPattern}" src --include="*.ts" --include="*.js" | grep -v node_modules | wc -l`,
      { cwd: BACKEND_DIR, encoding: 'utf8' }
    );
    
    const remainingCount = parseInt(result.trim());
    console.log(`   Remaining console statements: ${remainingCount}`);
    
    if (remainingCount === 0) {
      console.log('✅ All console statements successfully replaced!');
    } else {
      console.log('⚠️  Some console statements may need manual review');
    }
  } catch (error) {
    console.log('⚠️  Could not verify remaining statements');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, REPLACEMENT_PATTERNS };