#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DeadCodeAnalyzer {
  constructor() {
    this.results = {
      unusedImports: [],
      deadFunctions: [],
      deadClasses: [],
      unreferencedFiles: [],
      deadRoutes: [],
      unusedTypes: [],
      summary: {}
    };
  }

  async analyze() {
    console.log('🔍 Starting Dead Code Analysis...');
    
    // Find all TypeScript/JavaScript source files
    const sourceFiles = this.findSourceFiles();
    console.log(`📁 Found ${sourceFiles.length} source files to analyze`);
    
    // Analyze imports and exports
    await this.analyzeImportsExports(sourceFiles);
    
    // Find dead functions and classes
    await this.findDeadCode(sourceFiles);
    
    // Find unused routes
    await this.findUnusedRoutes();
    
    // Generate summary
    this.generateSummary();
    
    return this.results;
  }

  findSourceFiles() {
    const command = `find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -path "*/backups" -prune -o -path "*/coverage" -prune -o -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -print`;
    const output = execSync(command, { encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f);
  }

  async analyzeImportsExports(files) {
    console.log('📦 Analyzing imports and exports...');
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        // Find imports
        const imports = lines
          .map((line, index) => ({ line: line.trim(), number: index + 1 }))
          .filter(({ line }) => line.startsWith('import ') && !line.includes('// @ts-'))
          .map(({ line, number }) => ({
            file,
            line: number,
            content: line,
            type: 'import'
          }));
        
        // Find exports
        const exports = lines
          .map((line, index) => ({ line: line.trim(), number: index + 1 }))
          .filter(({ line }) => line.startsWith('export '))
          .map(({ line, number }) => ({
            file,
            line: number,
            content: line,
            type: 'export'
          }));
        
        // Check for unused imports (basic heuristic)
        for (const imp of imports) {
          const importMatch = imp.content.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
          if (importMatch) {
            const [, namedImports, namespaceImport, defaultImport, modulePath] = importMatch;
            
            if (namedImports) {
              const names = namedImports.split(',').map(n => n.trim());
              for (const name of names) {
                const cleanName = name.replace(/\s+as\s+\w+$/, '').trim();
                if (!this.isNameUsedInFile(content, cleanName)) {
                  this.results.unusedImports.push({
                    ...imp,
                    unusedName: cleanName,
                    modulePath
                  });
                }
              }
            }
            
            if (defaultImport && !this.isNameUsedInFile(content, defaultImport)) {
              this.results.unusedImports.push({
                ...imp,
                unusedName: defaultImport,
                modulePath
              });
            }
            
            if (namespaceImport && !this.isNameUsedInFile(content, namespaceImport)) {
              this.results.unusedImports.push({
                ...imp,
                unusedName: namespaceImport,
                modulePath
              });
            }
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error analyzing ${file}: ${error.message}`);
      }
    }
  }

  isNameUsedInFile(content, name) {
    // Simple heuristic - check if name appears outside of import statements
    const lines = content.split('\n');
    const nonImportLines = lines.filter(line => !line.trim().startsWith('import '));
    const restOfFile = nonImportLines.join('\n');
    
    // Check for various usage patterns
    const patterns = [
      new RegExp(`\\b${name}\\b`, 'g'),
      new RegExp(`${name}\\.`, 'g'),
      new RegExp(`<${name}\\b`, 'g'),
      new RegExp(`${name}\\(`, 'g')
    ];
    
    return patterns.some(pattern => pattern.test(restOfFile));
  }

  async findDeadCode(files) {
    console.log('⚰️ Finding dead functions and classes...');
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Find function declarations
        const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g);
        for (const match of functionMatches) {
          const funcName = match[1] || match[2];
          if (funcName && !this.isFunctionUsedGlobally(files, funcName, file)) {
            this.results.deadFunctions.push({
              file,
              name: funcName,
              line: this.getLineNumber(content, match.index)
            });
          }
        }
        
        // Find class declarations
        const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)/g);
        for (const match of classMatches) {
          const className = match[1];
          if (!this.isClassUsedGlobally(files, className, file)) {
            this.results.deadClasses.push({
              file,
              name: className,
              line: this.getLineNumber(content, match.index)
            });
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error finding dead code in ${file}: ${error.message}`);
      }
    }
  }

  isFunctionUsedGlobally(files, funcName, sourceFile) {
    // Simple heuristic - check if function is used in any other file
    for (const file of files) {
      if (file === sourceFile) continue;
      
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(funcName) && (
          content.includes(`${funcName}(`) ||
          content.includes(`import.*${funcName}`) ||
          content.includes(`from.*${funcName}`)
        )) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  isClassUsedGlobally(files, className, sourceFile) {
    // Similar to function checking
    for (const file of files) {
      if (file === sourceFile) continue;
      
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(className) && (
          content.includes(`new ${className}`) ||
          content.includes(`extends ${className}`) ||
          content.includes(`import.*${className}`) ||
          content.includes(`<${className}`)
        )) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  async findUnusedRoutes() {
    console.log('🛣️ Finding unused routes...');
    
    try {
      // Find route files
      const routeFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*routes*" -name "*.ts" -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Find route definitions
        const routeMatches = content.matchAll(/router\.\w+\(['"]([^'"]+)['"], /g);
        for (const match of routeMatches) {
          const routePath = match[1];
          
          // Check if route is used in tests or referenced elsewhere
          if (!this.isRouteUsed(routePath)) {
            this.results.deadRoutes.push({
              file,
              route: routePath,
              line: this.getLineNumber(content, match.index)
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused routes: ${error.message}`);
    }
  }

  isRouteUsed(routePath) {
    try {
      // Check if route is referenced in tests or frontend code
      const command = `grep -r "${routePath}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 1; // More than just the definition
    } catch (error) {
      return true; // Assume used if we can't check
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  generateSummary() {
    this.results.summary = {
      totalUnusedImports: this.results.unusedImports.length,
      totalDeadFunctions: this.results.deadFunctions.length,
      totalDeadClasses: this.results.deadClasses.length,
      totalUnreferencedFiles: this.results.unreferencedFiles.length,
      totalDeadRoutes: this.results.deadRoutes.length,
      totalUnusedTypes: this.results.unusedTypes.length
    };
  }
}

// Run analysis
const analyzer = new DeadCodeAnalyzer();
analyzer.analyze().then(results => {
  console.log('💾 Saving results...');
  fs.writeFileSync('/home/kinginyellow/projects/medianest/analysis/dead-code/dead-code-results.json', 
    JSON.stringify(results, null, 2));
  console.log('✅ Dead code analysis complete!');
  console.log('📊 Summary:', results.summary);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});