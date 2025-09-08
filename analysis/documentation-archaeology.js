#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocumentationArchaeologist {
  constructor() {
    this.results = {
      outdatedReadmes: [],
      deadDocumentation: [],
      brokenLinks: [],
      obsoleteChangelogs: [],
      unusedTemplates: [],
      inconsistentDocs: [],
      summary: {}
    };
  }

  async analyze() {
    console.log('📚 Starting Documentation Archaeology...');
    
    await this.findOutdatedReadmes();
    await this.findDeadDocumentation();
    await this.findBrokenLinks();
    await this.findObsoleteChangelogs();
    await this.findUnusedTemplates();
    await this.findInconsistentDocs();
    
    this.generateSummary();
    return this.results;
  }

  async findOutdatedReadmes() {
    console.log('📖 Finding outdated README files...');
    
    try {
      const readmeFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "README*" -o -name "readme*" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const readmeFile of readmeFiles) {
        const content = fs.readFileSync(readmeFile, 'utf8');
        const stats = fs.statSync(readmeFile);
        
        // Check for outdated indicators
        const outdatedIndicators = [
          { pattern: /node.*v?1[0-4]\./i, reason: 'References old Node.js versions' },
          { pattern: /npm.*[1-6]\./i, reason: 'References old npm versions' },
          { pattern: /react.*1[0-6]\./i, reason: 'References old React versions' },
          { pattern: /typescript.*[1-3]\./i, reason: 'References old TypeScript versions' },
          { pattern: /coming soon|todo|tbd|placeholder/i, reason: 'Contains placeholder content' },
          { pattern: /http:\/\/localhost:\d+/g, reason: 'Contains hardcoded localhost URLs' },
          { pattern: /\[x\]/g, reason: 'Contains completed checkboxes (may be outdated)' },
          { pattern: /201[0-9]|202[0-2]/g, reason: 'Contains old year references' }
        ];
        
        const issues = [];
        for (const indicator of outdatedIndicators) {
          if (indicator.pattern.test(content)) {
            issues.push(indicator.reason);
          }
        }
        
        // Check if README is very old
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        if (stats.mtime < threeMonthsAgo) {
          issues.push(`Not updated in ${Math.floor((new Date() - stats.mtime) / (1000 * 60 * 60 * 24))} days`);
        }
        
        if (issues.length > 0) {
          this.results.outdatedReadmes.push({
            file: readmeFile,
            issues,
            lastModified: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding outdated READMEs: ${error.message}`);
    }
  }

  async findDeadDocumentation() {
    console.log('💀 Finding dead documentation...');
    
    try {
      const docFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*.md" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const docFile of docFiles) {
        const content = fs.readFileSync(docFile, 'utf8');
        const filename = path.basename(docFile);
        
        // Skip well-known files
        if (['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE.md'].includes(filename.toUpperCase())) {
          continue;
        }
        
        // Check if doc references removed features
        const deadFeaturePatterns = [
          /deprecated|removed|deleted|obsolete/i,
          /no longer|not supported|legacy/i,
          /old version|previous version/i
        ];
        
        const isDead = deadFeaturePatterns.some(pattern => pattern.test(content));
        
        if (isDead) {
          this.results.deadDocumentation.push({
            file: docFile,
            reason: 'References deprecated/removed features',
            size: content.length,
            lastModified: fs.statSync(docFile).mtime.toISOString()
          });
        }
        
        // Check if doc describes code that no longer exists
        const codeReferences = content.match(/`([^`]+)`/g) || [];
        let missingReferences = 0;
        
        for (const ref of codeReferences.slice(0, 10)) { // Limit to avoid too many checks
          const cleanRef = ref.replace(/`/g, '');
          if (cleanRef.includes('.') && !this.isCodeReferenceValid(cleanRef)) {
            missingReferences++;
          }
        }
        
        if (missingReferences > 2) {
          this.results.deadDocumentation.push({
            file: docFile,
            reason: `${missingReferences} code references may no longer exist`,
            size: content.length,
            lastModified: fs.statSync(docFile).mtime.toISOString()
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding dead documentation: ${error.message}`);
    }
  }

  async findBrokenLinks() {
    console.log('🔗 Finding broken links in documentation...');
    
    try {
      const docFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*.md" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const docFile of docFiles) {
        const content = fs.readFileSync(docFile, 'utf8');
        
        // Find markdown links
        const linkPattern = /\[([^\]]+)\]\(([^\)]+)\)/g;
        const links = [...content.matchAll(linkPattern)];
        
        for (const link of links) {
          const [fullMatch, linkText, linkUrl] = link;
          
          // Check internal file links
          if (linkUrl.startsWith('./') || linkUrl.startsWith('../') || !linkUrl.includes('://')) {
            const resolvedPath = path.resolve(path.dirname(docFile), linkUrl);
            
            if (!fs.existsSync(resolvedPath)) {
              this.results.brokenLinks.push({
                file: docFile,
                linkText,
                linkUrl,
                reason: 'File does not exist',
                line: this.getLineNumber(content, link.index)
              });
            }
          }
        }
        
        // Find references to files that might not exist
        const fileReferences = content.match(/`[^`]*\.[a-z]{2,4}`/g) || [];
        for (const ref of fileReferences) {
          const filename = ref.replace(/`/g, '');
          if (!this.doesFileExistInProject(filename)) {
            this.results.brokenLinks.push({
              file: docFile,
              linkText: filename,
              linkUrl: filename,
              reason: 'Referenced file may not exist',
              line: this.getLineNumber(content, content.indexOf(ref))
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding broken links: ${error.message}`);
    }
  }

  async findObsoleteChangelogs() {
    console.log('📋 Finding obsolete changelogs...');
    
    try {
      const changelogFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*CHANGE*" -o -name "*change*" -o -name "*HISTORY*" -o -name "*history*" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const changelogFile of changelogFiles) {
        const content = fs.readFileSync(changelogFile, 'utf8');
        const stats = fs.statSync(changelogFile);
        
        // Check if changelog hasn't been updated in a long time
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        if (stats.mtime < sixMonthsAgo) {
          // Check if there have been recent commits
          try {
            const recentCommits = execSync('git log --since="3 months ago" --oneline | wc -l', 
              { cwd: path.dirname(changelogFile), encoding: 'utf8' });
            const commitCount = parseInt(recentCommits.trim());
            
            if (commitCount > 10) { // Many commits but no changelog updates
              this.results.obsoleteChangelogs.push({
                file: changelogFile,
                reason: `Not updated in ${Math.floor((new Date() - stats.mtime) / (1000 * 60 * 60 * 24))} days despite ${commitCount} recent commits`,
                lastModified: stats.mtime.toISOString(),
                recentCommits: commitCount
              });
            }
          } catch (gitError) {
            // If not in a git repo, just flag as old
            this.results.obsoleteChangelogs.push({
              file: changelogFile,
              reason: `Very old changelog (${Math.floor((new Date() - stats.mtime) / (1000 * 60 * 60 * 24))} days)`,
              lastModified: stats.mtime.toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding obsolete changelogs: ${error.message}`);
    }
  }

  async findUnusedTemplates() {
    console.log('📄 Finding unused documentation templates...');
    
    try {
      const templateFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*template*" -o -name "*Template*" -o -name "*.template.*" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const templateFile of templateFiles) {
        const filename = path.basename(templateFile);
        
        // Check if template is referenced anywhere
        if (!this.isTemplateReferenced(filename)) {
          this.results.unusedTemplates.push({
            file: templateFile,
            reason: 'Template not referenced in any documentation',
            size: fs.statSync(templateFile).size,
            lastModified: fs.statSync(templateFile).mtime.toISOString()
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused templates: ${error.message}`);
    }
  }

  async findInconsistentDocs() {
    console.log('🔄 Finding inconsistent documentation...');
    
    try {
      const docFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*.md" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      // Look for inconsistent API documentation
      const apiDocs = docFiles.filter(f => f.toLowerCase().includes('api'));
      
      for (const apiDoc of apiDocs) {
        const content = fs.readFileSync(apiDoc, 'utf8');
        
        // Find endpoint definitions
        const endpoints = [...content.matchAll(/(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s\n]+)/g)];
        
        for (const endpoint of endpoints) {
          const [fullMatch, path] = endpoint;
          
          // Check if endpoint exists in route files
          if (!this.doesEndpointExist(path)) {
            this.results.inconsistentDocs.push({
              file: apiDoc,
              issue: 'Documented endpoint may not exist',
              details: fullMatch,
              line: this.getLineNumber(content, endpoint.index)
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding inconsistent docs: ${error.message}`);
    }
  }

  isCodeReferenceValid(reference) {
    try {
      // Simple heuristic: check if reference appears in any source files
      const command = `grep -r "${reference}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.js" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 0;
    } catch (error) {
      return true; // Assume valid if we can't check
    }
  }

  doesFileExistInProject(filename) {
    try {
      const command = `find /home/kinginyellow/projects/medianest -name "${filename}" -not -path "*/node_modules/*" -not -path "*/dist/*" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 0;
    } catch (error) {
      return true;
    }
  }

  isTemplateReferenced(templateName) {
    try {
      const command = `grep -r "${templateName}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.md" --include="*.ts" --include="*.js" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 1; // More than just the template file itself
    } catch (error) {
      return true;
    }
  }

  doesEndpointExist(endpointPath) {
    try {
      // Look for route definitions in route files
      const routePattern = endpointPath.replace(/:[^/]+/g, '[^/]+'); // Replace params with regex
      const command = `grep -r "['\"]\/${routePattern}['\"]" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.js" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 0;
    } catch (error) {
      return true;
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  generateSummary() {
    this.results.summary = {
      totalOutdatedReadmes: this.results.outdatedReadmes.length,
      totalDeadDocumentation: this.results.deadDocumentation.length,
      totalBrokenLinks: this.results.brokenLinks.length,
      totalObsoleteChangelogs: this.results.obsoleteChangelogs.length,
      totalUnusedTemplates: this.results.unusedTemplates.length,
      totalInconsistentDocs: this.results.inconsistentDocs.length,
      totalIssues: this.results.outdatedReadmes.length + 
                   this.results.deadDocumentation.length + 
                   this.results.brokenLinks.length + 
                   this.results.obsoleteChangelogs.length + 
                   this.results.unusedTemplates.length + 
                   this.results.inconsistentDocs.length
    };
  }
}

// Run analysis
const archaeologist = new DocumentationArchaeologist();
archaeologist.analyze().then(results => {
  console.log('💾 Saving results...');
  fs.writeFileSync('/home/kinginyellow/projects/medianest/analysis/dead-docs/documentation-archaeology-results.json', 
    JSON.stringify(results, null, 2));
  console.log('✅ Documentation archaeology complete!');
  console.log('📊 Summary:', results.summary);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});