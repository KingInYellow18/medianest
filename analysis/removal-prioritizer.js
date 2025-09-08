#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class RemovalPrioritizer {
  constructor() {
    this.results = {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      summary: {}
    };
  }

  async analyze() {
    console.log('🎯 Generating prioritized removal recommendations...');
    
    // Load results from previous analyses
    const deadCodeResults = this.loadResults('/home/kinginyellow/projects/medianest/analysis/dead-code/dead-code-results.json');
    const assetResults = this.loadResults('/home/kinginyellow/projects/medianest/analysis/unused-assets/asset-analysis-results.json');
    const docResults = this.loadResults('/home/kinginyellow/projects/medianest/analysis/dead-docs/documentation-archaeology-results.json');
    
    // Prioritize removals
    this.prioritizeDeadCode(deadCodeResults);
    this.prioritizeUnusedAssets(assetResults);
    this.prioritizeDeadDocs(docResults);
    
    this.generateSummary();
    return this.results;
  }

  loadResults(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      console.warn(`⚠️ Could not load ${filePath}: ${error.message}`);
    }
    return {};
  }

  prioritizeDeadCode(results) {
    if (!results || !results.unusedImports) return;
    
    // High Priority: Unused imports (easy wins, reduce bundle size)
    for (const unusedImport of results.unusedImports || []) {
      this.results.highPriority.push({
        type: 'unused-import',
        file: unusedImport.file,
        line: unusedImport.line,
        description: `Remove unused import: ${unusedImport.unusedName}`,
        impact: 'Bundle size reduction',
        effort: 'Low',
        risk: 'Low'
      });
    }
    
    // Medium Priority: Dead functions (may have hidden dependencies)
    for (const deadFunction of results.deadFunctions || []) {
      this.results.mediumPriority.push({
        type: 'dead-function',
        file: deadFunction.file,
        line: deadFunction.line,
        description: `Remove unused function: ${deadFunction.name}`,
        impact: 'Code clarity, maintenance burden',
        effort: 'Medium',
        risk: 'Medium'
      });
    }
    
    // Medium Priority: Dead classes
    for (const deadClass of results.deadClasses || []) {
      this.results.mediumPriority.push({
        type: 'dead-class',
        file: deadClass.file,
        line: deadClass.line,
        description: `Remove unused class: ${deadClass.name}`,
        impact: 'Code clarity, maintenance burden',
        effort: 'Medium',
        risk: 'Medium'
      });
    }
    
    // Low Priority: Dead routes (need thorough testing)
    for (const deadRoute of results.deadRoutes || []) {
      this.results.lowPriority.push({
        type: 'dead-route',
        file: deadRoute.file,
        line: deadRoute.line,
        description: `Remove unused route: ${deadRoute.route}`,
        impact: 'API surface reduction, security',
        effort: 'High',
        risk: 'High'
      });
    }
  }

  prioritizeUnusedAssets(results) {
    if (!results) return;
    
    // High Priority: Large unused images (immediate space savings)
    for (const image of (results.unusedImages || []).filter(img => img.size > 100000)) { // >100KB
      this.results.highPriority.push({
        type: 'unused-large-image',
        file: image.file,
        description: `Remove large unused image: ${path.basename(image.file)} (${Math.round(image.size / 1024)}KB)`,
        impact: 'Significant disk space savings',
        effort: 'Low',
        risk: 'Low',
        spaceKB: Math.round(image.size / 1024)
      });
    }
    
    // Medium Priority: Unused config files
    for (const config of results.unusedConfigs || []) {
      this.results.mediumPriority.push({
        type: 'unused-config',
        file: config.file,
        description: `Remove unused config: ${path.basename(config.file)}`,
        impact: 'Reduce configuration complexity',
        effort: 'Medium',
        risk: 'Medium'
      });
    }
    
    // Medium Priority: Small unused images
    for (const image of (results.unusedImages || []).filter(img => img.size <= 100000)) {
      this.results.mediumPriority.push({
        type: 'unused-small-image',
        file: image.file,
        description: `Remove small unused image: ${path.basename(image.file)} (${Math.round(image.size / 1024)}KB)`,
        impact: 'Minor space savings, cleanup',
        effort: 'Low',
        risk: 'Low',
        spaceKB: Math.round(image.size / 1024)
      });
    }
    
    // High Priority: Unused environment variables (potential security risk)
    for (const envVar of results.unusedEnvVars || []) {
      this.results.highPriority.push({
        type: 'unused-env-var',
        file: envVar.file,
        description: `Remove unused environment variable: ${envVar.variable}`,
        impact: 'Security, configuration clarity',
        effort: 'Low',
        risk: 'Low'
      });
    }
    
    // Low Priority: Old migrations (need careful review)
    for (const migration of results.unusedMigrations || []) {
      this.results.lowPriority.push({
        type: 'old-migration',
        file: migration.file,
        description: `Review old migration: ${path.basename(migration.file)} (${migration.age} days old)`,
        impact: 'Database cleanup',
        effort: 'High',
        risk: 'High'
      });
    }
    
    // High Priority: Orphaned files with "temp" or "backup" in name
    for (const orphan of (results.orphanedFiles || []).filter(f => 
      f.reason.includes('temp') || f.reason.includes('backup') || f.reason.includes('old')
    )) {
      this.results.highPriority.push({
        type: 'orphaned-temp-file',
        file: orphan.file,
        description: `Remove temporary/backup file: ${path.basename(orphan.file)}`,
        impact: 'Cleanup, reduce confusion',
        effort: 'Low',
        risk: 'Low'
      });
    }
  }

  prioritizeDeadDocs(results) {
    if (!results) return;
    
    // High Priority: Broken links (immediate UX impact)
    for (const brokenLink of results.brokenLinks || []) {
      this.results.highPriority.push({
        type: 'broken-link',
        file: brokenLink.file,
        line: brokenLink.line,
        description: `Fix/remove broken link: ${brokenLink.linkText} -> ${brokenLink.linkUrl}`,
        impact: 'Documentation usability',
        effort: 'Low',
        risk: 'Low'
      });
    }
    
    // Medium Priority: Outdated READMEs
    for (const readme of results.outdatedReadmes || []) {
      this.results.mediumPriority.push({
        type: 'outdated-readme',
        file: readme.file,
        description: `Update outdated README: ${readme.issues.join(', ')}`,
        impact: 'Developer onboarding, project perception',
        effort: 'Medium',
        risk: 'Low'
      });
    }
    
    // Medium Priority: Dead documentation
    for (const deadDoc of results.deadDocumentation || []) {
      this.results.mediumPriority.push({
        type: 'dead-documentation',
        file: deadDoc.file,
        description: `Remove/update dead documentation: ${deadDoc.reason}`,
        impact: 'Reduce developer confusion',
        effort: 'Medium',
        risk: 'Medium'
      });
    }
    
    // Low Priority: Unused templates
    for (const template of results.unusedTemplates || []) {
      this.results.lowPriority.push({
        type: 'unused-template',
        file: template.file,
        description: `Remove unused template: ${path.basename(template.file)}`,
        impact: 'Cleanup',
        effort: 'Low',
        risk: 'Medium'
      });
    }
    
    // High Priority: Obsolete changelogs (if many recent commits)
    for (const changelog of (results.obsoleteChangelogs || []).filter(c => c.recentCommits > 20)) {
      this.results.highPriority.push({
        type: 'obsolete-changelog',
        file: changelog.file,
        description: `Update obsolete changelog: ${changelog.reason}`,
        impact: 'User/developer communication',
        effort: 'Medium',
        risk: 'Low'
      });
    }
  }

  generateSummary() {
    const totalPotentialSpaceSavings = [
      ...this.results.highPriority,
      ...this.results.mediumPriority,
      ...this.results.lowPriority
    ].reduce((sum, item) => sum + (item.spaceKB || 0), 0);

    this.results.summary = {
      totalHighPriority: this.results.highPriority.length,
      totalMediumPriority: this.results.mediumPriority.length,
      totalLowPriority: this.results.lowPriority.length,
      totalRecommendations: this.results.highPriority.length + this.results.mediumPriority.length + this.results.lowPriority.length,
      potentialSpaceSavingsKB: totalPotentialSpaceSavings,
      quickWins: this.results.highPriority.filter(item => item.effort === 'Low').length,
      riskProfile: {
        lowRisk: [...this.results.highPriority, ...this.results.mediumPriority, ...this.results.lowPriority]
          .filter(item => item.risk === 'Low').length,
        mediumRisk: [...this.results.highPriority, ...this.results.mediumPriority, ...this.results.lowPriority]
          .filter(item => item.risk === 'Medium').length,
        highRisk: [...this.results.highPriority, ...this.results.mediumPriority, ...this.results.lowPriority]
          .filter(item => item.risk === 'High').length
      }
    };
  }
}

// Run analysis
const prioritizer = new RemovalPrioritizer();
prioritizer.analyze().then(results => {
  console.log('💾 Saving prioritized recommendations...');
  fs.writeFileSync('/home/kinginyellow/projects/medianest/analysis/removal-prioritizer-results.json', 
    JSON.stringify(results, null, 2));
  console.log('✅ Removal prioritization complete!');
  console.log('📊 Summary:', results.summary);
  
  console.log('\n🎯 Top Recommendations:');
  console.log(`   High Priority: ${results.summary.totalHighPriority} items`);
  console.log(`   Medium Priority: ${results.summary.totalMediumPriority} items`);
  console.log(`   Low Priority: ${results.summary.totalLowPriority} items`);
  console.log(`   Quick Wins: ${results.summary.quickWins} items`);
  console.log(`   Potential Space Savings: ${results.summary.potentialSpaceSavingsKB} KB`);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});