#!/usr/bin/env node
/**
 * MediaNest Architectural Integrity Analyzer
 * Comprehensive analysis for detecting structural issues and architectural anti-patterns
 */

const fs = require('fs');
const path = require('path');

class ArchitecturalAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.nodes = new Map();
    this.sourceDirectories = [
      path.join(projectRoot, 'backend/src'),
      path.join(projectRoot, 'shared/src')
    ];
  }

  async analyze() {
    console.log('🏗️ ARCHITECTURAL INTEGRITY ANALYSIS STARTED');
    console.log('============================================\n');

    await this.buildDependencyGraph();
    const circularDeps = this.detectCircularDependencies();
    const layerViolations = this.validateLayerArchitecture();
    const couplingIssues = this.analyzeCoupling();

    return this.generateReport(circularDeps, layerViolations, couplingIssues);
  }

  async buildDependencyGraph() {
    console.log('📊 Building dependency graph...');
    
    const allFiles = [];
    for (const dir of this.sourceDirectories) {
      if (fs.existsSync(dir)) {
        allFiles.push(...this.getAllTsFiles(dir));
      }
    }

    console.log(`   Found ${allFiles.length} TypeScript files`);

    for (const filePath of allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const node = this.analyzeFile(filePath, content);
        this.nodes.set(node.id, node);
      } catch (error) {
        console.warn(`   ⚠️ Failed to analyze ${filePath}: ${error.message}`);
      }
    }

    console.log(`✅ Analyzed ${this.nodes.size} modules\n`);
  }

  getAllTsFiles(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(item)) {
          files.push(...this.getAllTsFiles(fullPath));
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      } catch (error) {
        // Skip files we can't access
        continue;
      }
    }
    
    return files;
  }

  analyzeFile(filePath, content) {
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    const layer = this.determineLayer(filePath);
    const type = this.determineModuleType(filePath);
    
    const relativePath = path.relative(this.projectRoot, filePath);
    
    return {
      id: relativePath,
      path: filePath,
      imports,
      exports,
      layer,
      type,
      size: content.length
    };
  }

  extractImports(content) {
    const imports = [];
    
    // Extract ES6 imports
    const importRegex = /import\s+(?:.*?from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Filter out external packages
      if (importPath.startsWith('.') || importPath.startsWith('@/') || importPath.startsWith('@medianest/')) {
        imports.push(importPath);
      }
    }
    
    // Extract require statements
    const requireRegex = /require\s*\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('@/') || importPath.startsWith('@medianest/')) {
        imports.push(importPath);
      }
    }
    
    return [...new Set(imports)]; // Remove duplicates
  }

  extractExports(content) {
    const exports = [];
    
    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Export statements
    const exportBlockRegex = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const exportNames = match[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]);
      exports.push(...exportNames);
    }
    
    // Default exports
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    return [...new Set(exports)];
  }

  determineLayer(filePath) {
    const normalizedPath = filePath.toLowerCase();
    
    if (normalizedPath.includes('/controllers/') || normalizedPath.includes('/routes/')) {
      return 'presentation';
    }
    if (normalizedPath.includes('/middleware/')) {
      return 'presentation'; // Middleware is part of presentation layer
    }
    if (normalizedPath.includes('/services/') || normalizedPath.includes('/domain/')) {
      return 'business';
    }
    if (normalizedPath.includes('/repositories/') || normalizedPath.includes('/db/') || normalizedPath.includes('/prisma/')) {
      return 'data';
    }
    if (normalizedPath.includes('/config/') || normalizedPath.includes('/integrations/')) {
      return 'infrastructure';
    }
    if (normalizedPath.includes('/utils/') || normalizedPath.includes('/types/') || normalizedPath.includes('/shared/') || normalizedPath.includes('/constants/')) {
      return 'shared';
    }
    
    return 'unknown';
  }

  determineModuleType(filePath) {
    const normalizedPath = filePath.toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('controller') || normalizedPath.includes('/controllers/')) return 'controller';
    if (fileName.includes('service') || normalizedPath.includes('/services/')) return 'service';
    if (fileName.includes('repository') || normalizedPath.includes('/repositories/')) return 'repository';
    if (fileName.includes('middleware') || normalizedPath.includes('/middleware/')) return 'middleware';
    if (fileName.includes('config') || normalizedPath.includes('/config/')) return 'config';
    if (fileName.includes('types') || fileName.endsWith('.d.ts')) return 'type';
    if (fileName.includes('utils') || fileName.includes('helper')) return 'util';
    if (fileName.includes('route')) return 'route';
    
    return 'module';
  }

  detectCircularDependencies() {
    console.log('🔄 Detecting circular dependencies...');
    
    const visited = new Set();
    const recursionStack = new Set();
    const circularDeps = [];
    
    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat(nodeId);
          circularDeps.push({
            cycle,
            severity: this.determineCycleSeverity(cycle),
            description: `Circular dependency: ${cycle.join(' → ')}`
          });
        }
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const importPath of node.imports) {
          const resolvedPath = this.resolveImportPath(nodeId, importPath);
          if (resolvedPath && resolvedPath !== nodeId) {
            dfs(resolvedPath, [...path, nodeId]);
          }
        }
      }
      
      recursionStack.delete(nodeId);
    };
    
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }
    
    console.log(`${circularDeps.length > 0 ? '⚠️' : '✅'} Found ${circularDeps.length} circular dependencies\n`);
    return circularDeps;
  }

  determineCycleSeverity(cycle) {
    const hasCoreModule = cycle.some(nodeId => {
      const node = this.nodes.get(nodeId);
      return node && ['service', 'controller', 'repository'].includes(node.type);
    });
    
    if (hasCoreModule && cycle.length <= 3) return 'high';
    if (hasCoreModule || cycle.length <= 5) return 'medium';
    return 'low';
  }

  resolveImportPath(fromNode, importPath) {
    if (importPath.startsWith('.')) {
      // Relative import
      const fromDir = path.dirname(fromNode);
      let resolvedPath = path.resolve(this.projectRoot, fromDir, importPath);
      resolvedPath = path.relative(this.projectRoot, resolvedPath);
      
      // Try different extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const withExt = resolvedPath + ext;
        if (this.nodes.has(withExt)) {
          return withExt;
        }
      }
      
      // Try index files
      for (const ext of ['.ts', '.tsx']) {
        const indexPath = path.join(resolvedPath, 'index' + ext);
        if (this.nodes.has(indexPath)) {
          return indexPath;
        }
      }
    }
    
    return null;
  }

  validateLayerArchitecture() {
    console.log('🏛️ Validating layer architecture...');
    
    const violations = [];
    
    // Define allowed dependencies (lower layers can depend on higher layers)
    const layerHierarchy = {
      'presentation': ['business', 'infrastructure', 'shared'],
      'business': ['data', 'infrastructure', 'shared'],
      'data': ['infrastructure', 'shared'],
      'infrastructure': ['shared'],
      'shared': [],
      'unknown': ['presentation', 'business', 'data', 'infrastructure', 'shared']
    };
    
    for (const [nodeId, node] of this.nodes) {
      const allowedDependencies = layerHierarchy[node.layer] || [];
      
      for (const importPath of node.imports) {
        const targetNodeId = this.resolveImportPath(nodeId, importPath);
        if (targetNodeId) {
          const targetNode = this.nodes.get(targetNodeId);
          if (targetNode && !allowedDependencies.includes(targetNode.layer) && targetNode.layer !== node.layer) {
            violations.push({
              violator: nodeId,
              violatee: targetNodeId,
              violatorLayer: node.layer,
              violateeLayer: targetNode.layer,
              severity: this.determineViolationSeverity(node.layer, targetNode.layer),
              description: `${node.layer} layer should not depend on ${targetNode.layer} layer`
            });
          }
        }
      }
    }
    
    console.log(`${violations.length > 0 ? '⚠️' : '✅'} Found ${violations.length} layer violations\n`);
    return violations;
  }

  determineViolationSeverity(fromLayer, toLayer) {
    if (fromLayer === 'data' && ['presentation', 'business'].includes(toLayer)) return 'critical';
    if (fromLayer === 'infrastructure' && ['presentation', 'business'].includes(toLayer)) return 'major';
    if (fromLayer === 'shared' && toLayer !== 'shared') return 'major';
    return 'minor';
  }

  analyzeCoupling() {
    console.log('🔗 Analyzing coupling metrics...');
    
    const couplingIssues = [];
    
    for (const [nodeId, node] of this.nodes) {
      const afferentCoupling = this.calculateAfferentCoupling(nodeId);
      const efferentCoupling = node.imports.length;
      const totalCoupling = afferentCoupling + efferentCoupling;
      
      // Identify problematic coupling
      if (totalCoupling > 20) {
        couplingIssues.push({
          module: nodeId,
          issue: 'High coupling',
          afferent: afferentCoupling,
          efferent: efferentCoupling,
          total: totalCoupling,
          severity: totalCoupling > 30 ? 'critical' : 'concerning'
        });
      }
      
      // Check for god objects (high afferent coupling)
      if (afferentCoupling > 15) {
        couplingIssues.push({
          module: nodeId,
          issue: 'God object (high afferent coupling)',
          afferent: afferentCoupling,
          efferent: efferentCoupling,
          total: totalCoupling,
          severity: afferentCoupling > 25 ? 'critical' : 'concerning'
        });
      }
      
      // Check for excessive dependencies (high efferent coupling)
      if (efferentCoupling > 15) {
        couplingIssues.push({
          module: nodeId,
          issue: 'Excessive dependencies (high efferent coupling)',
          afferent: afferentCoupling,
          efferent: efferentCoupling,
          total: totalCoupling,
          severity: efferentCoupling > 25 ? 'critical' : 'concerning'
        });
      }
    }
    
    console.log(`📊 Analyzed coupling for ${this.nodes.size} modules\n`);
    return couplingIssues;
  }

  calculateAfferentCoupling(targetNodeId) {
    let count = 0;
    
    for (const [nodeId, node] of this.nodes) {
      if (nodeId !== targetNodeId) {
        for (const importPath of node.imports) {
          const resolvedPath = this.resolveImportPath(nodeId, importPath);
          if (resolvedPath === targetNodeId) {
            count++;
            break;
          }
        }
      }
    }
    
    return count;
  }

  generateReport(circularDeps, layerViolations, couplingIssues) {
    const report = [];
    
    report.push('🏗️ MEDIANEST ARCHITECTURAL INTEGRITY REPORT');
    report.push('==========================================\n');
    
    // Executive Summary
    report.push('📊 EXECUTIVE SUMMARY');
    report.push('-------------------');
    report.push(`Total Modules Analyzed: ${this.nodes.size}`);
    report.push(`Circular Dependencies: ${circularDeps.length} (${circularDeps.filter(cd => cd.severity === 'high').length} high severity)`);
    report.push(`Layer Violations: ${layerViolations.length} (${layerViolations.filter(lv => lv.severity === 'critical').length} critical)`);
    
    const criticalCoupling = couplingIssues.filter(ci => ci.severity === 'critical').length;
    const concerningCoupling = couplingIssues.filter(ci => ci.severity === 'concerning').length;
    report.push(`Coupling Issues: ${criticalCoupling + concerningCoupling} (${criticalCoupling} critical, ${concerningCoupling} concerning)\n`);
    
    // Overall Health Score
    const maxScore = 100;
    let deductions = 0;
    deductions += circularDeps.filter(cd => cd.severity === 'high').length * 15;
    deductions += circularDeps.filter(cd => cd.severity === 'medium').length * 5;
    deductions += layerViolations.filter(lv => lv.severity === 'critical').length * 20;
    deductions += layerViolations.filter(lv => lv.severity === 'major').length * 10;
    deductions += criticalCoupling * 8;
    deductions += concerningCoupling * 3;
    
    const healthScore = Math.max(0, maxScore - deductions);
    const healthGrade = healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F';
    
    report.push(`🎯 ARCHITECTURAL HEALTH SCORE: ${healthScore}/100 (Grade: ${healthGrade})\n`);
    
    // Layer Distribution
    const layerStats = {};
    for (const [nodeId, node] of this.nodes) {
      layerStats[node.layer] = (layerStats[node.layer] || 0) + 1;
    }
    
    report.push('🏛️ LAYER DISTRIBUTION');
    report.push('--------------------');
    Object.entries(layerStats).forEach(([layer, count]) => {
      const percentage = ((count / this.nodes.size) * 100).toFixed(1);
      report.push(`${layer}: ${count} modules (${percentage}%)`);
    });
    report.push('');
    
    // Detailed Issues
    if (circularDeps.length > 0) {
      report.push('🔄 CIRCULAR DEPENDENCIES');
      report.push('------------------------');
      circularDeps.slice(0, 10).forEach((cd, index) => {
        report.push(`${index + 1}. ${cd.severity.toUpperCase()}: ${cd.description}`);
      });
      if (circularDeps.length > 10) {
        report.push(`... and ${circularDeps.length - 10} more`);
      }
      report.push('');
    }
    
    if (layerViolations.length > 0) {
      report.push('🚫 LAYER VIOLATIONS');
      report.push('------------------');
      layerViolations.slice(0, 10).forEach((lv, index) => {
        report.push(`${index + 1}. ${lv.severity.toUpperCase()}: ${lv.description}`);
        report.push(`   ${lv.violator} → ${lv.violatee}`);
      });
      if (layerViolations.length > 10) {
        report.push(`... and ${layerViolations.length - 10} more`);
      }
      report.push('');
    }
    
    if (couplingIssues.length > 0) {
      report.push('🔗 COUPLING ISSUES');
      report.push('-----------------');
      couplingIssues.slice(0, 10).forEach((ci, index) => {
        report.push(`${index + 1}. ${ci.severity.toUpperCase()}: ${ci.issue}`);
        report.push(`   Module: ${ci.module}`);
        report.push(`   Afferent: ${ci.afferent}, Efferent: ${ci.efferent}, Total: ${ci.total}`);
      });
      if (couplingIssues.length > 10) {
        report.push(`... and ${couplingIssues.length - 10} more`);
      }
      report.push('');
    }
    
    // Recommendations
    report.push('💡 ARCHITECTURAL RECOMMENDATIONS');
    report.push('--------------------------------');
    
    if (circularDeps.length > 0) {
      report.push('• CIRCULAR DEPENDENCIES:');
      report.push('  - Extract shared interfaces to break cycles');
      report.push('  - Use dependency inversion principle');
      report.push('  - Consider event-driven communication patterns');
      report.push('');
    }
    
    if (layerViolations.length > 0) {
      report.push('• LAYER VIOLATIONS:');
      report.push('  - Move violating dependencies to appropriate layers');
      report.push('  - Implement proper dependency inversion');
      report.push('  - Use interfaces to decouple layers');
      report.push('');
    }
    
    if (couplingIssues.length > 0) {
      report.push('• COUPLING ISSUES:');
      report.push('  - Apply Single Responsibility Principle');
      report.push('  - Extract smaller, focused modules');
      report.push('  - Use facade patterns for complex subsystems');
      report.push('  - Implement dependency injection');
      report.push('');
    }
    
    report.push('• GENERAL IMPROVEMENTS:');
    report.push('  - Implement architectural unit tests');
    report.push('  - Set up architectural fitness functions');
    report.push('  - Regular architectural reviews and refactoring');
    report.push('  - Document architectural decisions and constraints');
    
    return {
      report: report.join('\n'),
      summary: {
        totalModules: this.nodes.size,
        circularDependencies: circularDeps.length,
        layerViolations: layerViolations.length,
        couplingIssues: couplingIssues.length,
        healthScore,
        healthGrade,
        layerDistribution: layerStats
      },
      details: {
        circularDependencies: circularDeps,
        layerViolations,
        couplingIssues
      }
    };
  }
}

// Main execution
async function main() {
  const projectRoot = process.cwd();
  const analyzer = new ArchitecturalAnalyzer(projectRoot);
  
  try {
    const results = await analyzer.analyze();
    
    // Ensure analysis directory exists
    const analysisDir = path.join(projectRoot, 'analysis');
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    // Write detailed report
    const reportPath = path.join(analysisDir, 'architectural-integrity-report.md');
    fs.writeFileSync(reportPath, results.report);
    
    // Write JSON results for tooling integration  
    const jsonPath = path.join(analysisDir, 'architectural-integrity-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    
    console.log('✅ ARCHITECTURAL VALIDATION COMPLETE');
    console.log('====================================\n');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`📁 JSON results saved to: ${jsonPath}\n`);
    
    // Print summary
    console.log('📊 FINAL SUMMARY:');
    console.log(`Health Score: ${results.summary.healthScore}/100 (${results.summary.healthGrade})`);
    console.log(`Total Issues: ${results.summary.circularDependencies + results.summary.layerViolations + results.summary.couplingIssues}`);
    
    if (results.summary.circularDependencies > 0 || results.summary.layerViolations > 0) {
      console.log('\n⚠️  ARCHITECTURAL ISSUES DETECTED - Review recommended');
      process.exit(1);
    } else {
      console.log('\n✅ ARCHITECTURAL INTEGRITY VALIDATED - No critical issues found');
    }
    
  } catch (error) {
    console.error('❌ Architectural validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ArchitecturalAnalyzer };