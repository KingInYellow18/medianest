#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class UnusedAssetsAnalyzer {
  constructor() {
    this.results = {
      unusedImages: [],
      unusedFonts: [],
      unusedConfigs: [],
      unusedEnvVars: [],
      unusedMigrations: [],
      orphanedFiles: [],
      summary: {}
    };
  }

  async analyze() {
    console.log('🖼️ Starting Unused Assets Analysis...');
    
    await this.findUnusedImages();
    await this.findUnusedFonts();
    await this.findUnusedConfigs();
    await this.findUnusedEnvVars();
    await this.findUnusedMigrations();
    await this.findOrphanedFiles();
    
    this.generateSummary();
    return this.results;
  }

  async findUnusedImages() {
    console.log('🖼️ Finding unused images...');
    
    try {
      const imageFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -type f \\( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" -o -name "*.webp" \\) -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const imageFile of imageFiles) {
        const filename = path.basename(imageFile);
        const filenameWithoutExt = path.basename(imageFile, path.extname(imageFile));
        
        // Check if image is referenced in any source files
        if (!this.isAssetReferenced(filename) && !this.isAssetReferenced(filenameWithoutExt)) {
          this.results.unusedImages.push({
            file: imageFile,
            size: this.getFileSize(imageFile),
            type: path.extname(imageFile)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused images: ${error.message}`);
    }
  }

  async findUnusedFonts() {
    console.log('🔤 Finding unused fonts...');
    
    try {
      const fontFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -type f \\( -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.otf" -o -name "*.eot" \\) -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const fontFile of fontFiles) {
        const filename = path.basename(fontFile);
        const filenameWithoutExt = path.basename(fontFile, path.extname(fontFile));
        
        if (!this.isAssetReferenced(filename) && !this.isAssetReferenced(filenameWithoutExt)) {
          this.results.unusedFonts.push({
            file: fontFile,
            size: this.getFileSize(fontFile),
            type: path.extname(fontFile)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused fonts: ${error.message}`);
    }
  }

  async findUnusedConfigs() {
    console.log('⚙️ Finding unused config files...');
    
    try {
      const configFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -type f \\( -name "*.config.js" -o -name "*.config.ts" -o -name "*.config.json" -o -name "*rc.js" -o -name "*rc.json" -o -name "*.yml" -o -name "*.yaml" \\) -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      const wellKnownConfigs = [
        'package.json', 'tsconfig.json', 'eslint.config.js', '.eslintrc.json',
        'prettier.config.js', 'tailwind.config.ts', 'vite.config.ts',
        'vitest.config.ts', 'jest.config.js', 'playwright.config.ts'
      ];
      
      for (const configFile of configFiles) {
        const filename = path.basename(configFile);
        
        // Skip well-known config files
        if (wellKnownConfigs.some(known => filename.includes(known))) {
          continue;
        }
        
        // Check if config is referenced or imported
        if (!this.isConfigReferenced(configFile)) {
          this.results.unusedConfigs.push({
            file: configFile,
            size: this.getFileSize(configFile),
            lastModified: this.getLastModified(configFile)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused configs: ${error.message}`);
    }
  }

  async findUnusedEnvVars() {
    console.log('🌍 Finding unused environment variables...');
    
    try {
      const envFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -name ".env*" -type f -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const envFile of envFiles) {
        const content = fs.readFileSync(envFile, 'utf8');
        const envVars = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .map(line => line.split('=')[0])
          .filter(key => key);
        
        for (const envVar of envVars) {
          if (!this.isEnvVarUsed(envVar)) {
            this.results.unusedEnvVars.push({
              file: envFile,
              variable: envVar,
              context: 'Not found in source code'
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused env vars: ${error.message}`);
    }
  }

  async findUnusedMigrations() {
    console.log('🗄️ Finding unused migrations...');
    
    try {
      const migrationDirs = [
        '/home/kinginyellow/projects/medianest/backend/prisma/migrations',
        '/home/kinginyellow/projects/medianest/database/migrations',
        '/home/kinginyellow/projects/medianest/migrations'
      ];
      
      for (const migrationDir of migrationDirs) {
        if (fs.existsSync(migrationDir)) {
          const files = fs.readdirSync(migrationDir);
          
          // Look for old or unused migration files
          for (const file of files) {
            const filePath = path.join(migrationDir, file);
            const stats = fs.statSync(filePath);
            
            // Consider migrations older than 6 months as potentially unused
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            if (stats.mtime < sixMonthsAgo && !this.isMigrationReferenced(file)) {
              this.results.unusedMigrations.push({
                file: filePath,
                age: Math.floor((new Date() - stats.mtime) / (1000 * 60 * 60 * 24)),
                lastModified: stats.mtime.toISOString()
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding unused migrations: ${error.message}`);
    }
  }

  async findOrphanedFiles() {
    console.log('🏚️ Finding orphaned files...');
    
    try {
      // Look for files that might be orphaned
      const potentialOrphans = [
        'temp', 'tmp', 'backup', 'old', 'deprecated', 'unused', 'archive'
      ];
      
      for (const pattern of potentialOrphans) {
        const command = `find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -name "*${pattern}*" -type f -print`;
        const files = execSync(command, { encoding: 'utf8' }).trim().split('\n').filter(f => f);
        
        for (const file of files) {
          this.results.orphanedFiles.push({
            file,
            reason: `Contains '${pattern}' in filename`,
            size: this.getFileSize(file),
            lastModified: this.getLastModified(file)
          });
        }
      }
      
      // Look for files with very old timestamps
      const veryOldFiles = execSync(`find /home/kinginyellow/projects/medianest -path "*/node_modules" -prune -o -path "*/dist" -prune -o -type f -mtime +365 -print`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
      
      for (const file of veryOldFiles) {
        if (!file.includes('node_modules') && !file.includes('dist')) {
          this.results.orphanedFiles.push({
            file,
            reason: 'Very old file (>1 year)',
            size: this.getFileSize(file),
            lastModified: this.getLastModified(file)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error finding orphaned files: ${error.message}`);
    }
  }

  isAssetReferenced(assetName) {
    try {
      const command = `grep -r "${assetName}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.html" --include="*.css" --include="*.scss" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 0;
    } catch (error) {
      return true; // Assume referenced if we can't check
    }
  }

  isConfigReferenced(configFile) {
    const filename = path.basename(configFile);
    const filenameWithoutExt = path.basename(configFile, path.extname(configFile));
    
    try {
      // Check if config is imported or required
      const command = `grep -r "require.*${filenameWithoutExt}\\|import.*${filenameWithoutExt}\\|from.*${filenameWithoutExt}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.js" | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 0;
    } catch (error) {
      return true;
    }
  }

  isEnvVarUsed(envVar) {
    try {
      const patterns = [
        `process.env.${envVar}`,
        `process.env["${envVar}"]`,
        `process.env['${envVar}']`,
        `env.${envVar}`,
        `$\{${envVar}\}`,
        `\$${envVar}`
      ];
      
      for (const pattern of patterns) {
        const command = `grep -r "${pattern}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" | wc -l`;
        const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
        if (count > 0) return true;
      }
      return false;
    } catch (error) {
      return true;
    }
  }

  isMigrationReferenced(migrationFile) {
    try {
      const command = `grep -r "${migrationFile}" /home/kinginyellow/projects/medianest --exclude-dir=node_modules --exclude-dir=dist | wc -l`;
      const count = parseInt(execSync(command, { encoding: 'utf8' }).trim());
      return count > 1; // More than just the file itself
    } catch (error) {
      return true;
    }
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  getLastModified(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime.toISOString();
    } catch (error) {
      return null;
    }
  }

  generateSummary() {
    this.results.summary = {
      totalUnusedImages: this.results.unusedImages.length,
      totalUnusedFonts: this.results.unusedFonts.length,
      totalUnusedConfigs: this.results.unusedConfigs.length,
      totalUnusedEnvVars: this.results.unusedEnvVars.length,
      totalUnusedMigrations: this.results.unusedMigrations.length,
      totalOrphanedFiles: this.results.orphanedFiles.length,
      totalWastedSpace: [
        ...this.results.unusedImages,
        ...this.results.unusedFonts,
        ...this.results.unusedConfigs,
        ...this.results.orphanedFiles
      ].reduce((sum, item) => sum + (item.size || 0), 0)
    };
  }
}

// Run analysis
const analyzer = new UnusedAssetsAnalyzer();
analyzer.analyze().then(results => {
  console.log('💾 Saving results...');
  fs.writeFileSync('/home/kinginyellow/projects/medianest/analysis/unused-assets/asset-analysis-results.json', 
    JSON.stringify(results, null, 2));
  console.log('✅ Unused assets analysis complete!');
  console.log('📊 Summary:', results.summary);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});