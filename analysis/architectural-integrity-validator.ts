#!/usr/bin/env ts-node
/**
 * MediaNest Architectural Integrity Validator
 * Comprehensive analysis tool for detecting structural issues, circular dependencies, and architectural anti-patterns
 * 
 * COORDINATION NAMESPACE: FINAL_DEBT_SCAN_2025_09_09
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface DependencyNode {
  id: string;
  path: string;
  imports: string[];
  exports: string[];
  layer: ArchitecturalLayer;
  type: 'module' | 'service' | 'controller' | 'repository' | 'middleware' | 'util' | 'type' | 'config';
}

interface CircularDependency {
  cycle: string[];
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface LayerViolation {
  violator: string;
  violatee: string;
  violatorLayer: ArchitecturalLayer;
  violateeLayer: ArchitecturalLayer;
  severity: 'critical' | 'major' | 'minor';
  description: string;
}

interface CouplingMetric {
  module: string;
  afferentCoupling: number; // Ca - incoming dependencies
  efferentCoupling: number; // Ce - outgoing dependencies  
  instability: number; // I = Ce / (Ca + Ce)
  abstractness: number; // A - ratio of abstract to concrete
  distance: number; // D = |A + I - 1|
  severity: 'good' | 'concerning' | 'critical';
}

type ArchitecturalLayer = 
  | 'presentation'     // Controllers, routes, middleware
  | 'business'         // Services, domain logic
  | 'data'            // Repositories, database clients
  | 'infrastructure'  // Configuration, external integrations
  | 'shared'          // Utilities, types, constants
  | 'unknown';

class ArchitecturalValidator {
  private nodes: Map<string, DependencyNode> = new Map();
  private projectRoot: string;
  private sourceDirectories: string[];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.sourceDirectories = [
      path.join(projectRoot, 'backend/src'),
      path.join(projectRoot, 'frontend/src'),
      path.join(projectRoot, 'shared/src')
    ];
  }

  async validate(): Promise<{
    circularDependencies: CircularDependency[];
    layerViolations: LayerViolation[];
    couplingMetrics: CouplingMetric[];
    architecturalReport: string;
  }> {
    console.log('🏗️ ARCHITECTURAL INTEGRITY VALIDATION STARTED');
    console.log('===============================================\n');

    // Step 1: Build dependency graph
    console.log('📊 Building dependency graph...');
    await this.buildDependencyGraph();
    console.log(`✅ Analyzed ${this.nodes.size} modules\n`);

    // Step 2: Detect circular dependencies
    console.log('🔄 Detecting circular dependencies...');
    const circularDependencies = this.detectCircularDependencies();
    console.log(`${circularDependencies.length > 0 ? '⚠️' : '✅'} Found ${circularDependencies.length} circular dependencies\n`);

    // Step 3: Validate layer architecture
    console.log('🏛️ Validating layer architecture...');
    const layerViolations = this.validateLayerArchitecture();
    console.log(`${layerViolations.length > 0 ? '⚠️' : '✅'} Found ${layerViolations.length} layer violations\n`);

    // Step 4: Calculate coupling metrics
    console.log('🔗 Calculating coupling metrics...');
    const couplingMetrics = this.calculateCouplingMetrics();
    console.log(`📊 Analyzed coupling for ${couplingMetrics.length} modules\n`);

    // Step 5: Generate comprehensive report
    console.log('📝 Generating architectural report...');
    const architecturalReport = this.generateArchitecturalReport(
      circularDependencies,
      layerViolations,
      couplingMetrics
    );

    return {
      circularDependencies,
      layerViolations,
      couplingMetrics,
      architecturalReport
    };
  }

  private async buildDependencyGraph(): Promise<void> {
    const allFiles: string[] = [];

    // Collect all TypeScript files
    for (const dir of this.sourceDirectories) {
      if (fs.existsSync(dir)) {
        const files = this.getAllTsFiles(dir);
        allFiles.push(...files);
      }
    }

    console.log(`   Found ${allFiles.length} TypeScript files`);

    // Analyze each file
    for (const filePath of allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const node = this.analyzeFile(filePath, content);
        this.nodes.set(node.id, node);
      } catch (error) {
        console.warn(`   ⚠️ Failed to analyze ${filePath}: ${error}`);
      }
    }
  }

  private getAllTsFiles(dir: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(item)) {
        files.push(...this.getAllTsFiles(fullPath));
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private analyzeFile(filePath: string, content: string): DependencyNode {
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    const layer = this.determineLayer(filePath);
    const type = this.determineModuleType(filePath, content);
    
    const relativePath = path.relative(this.projectRoot, filePath);
    
    return {
      id: relativePath,
      path: filePath,
      imports,
      exports,
      layer,
      type
    };
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Match ES6 imports
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match require statements
    const requireRegex = /require\s*\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Match named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Match export { ... } statements
    const exportBlockRegex = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const exportNames = match[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]);
      exports.push(...exportNames);
    }
    
    return exports;
  }

  private determineLayer(filePath: string): ArchitecturalLayer {
    const normalizedPath = filePath.toLowerCase();
    
    if (normalizedPath.includes('/controllers/') || normalizedPath.includes('/routes/') || normalizedPath.includes('/middleware/')) {
      return 'presentation';
    }
    if (normalizedPath.includes('/services/') || normalizedPath.includes('/domain/')) {
      return 'business';
    }
    if (normalizedPath.includes('/repositories/') || normalizedPath.includes('/db/') || normalizedPath.includes('/database/')) {
      return 'data';
    }
    if (normalizedPath.includes('/config/') || normalizedPath.includes('/integrations/')) {
      return 'infrastructure';
    }
    if (normalizedPath.includes('/utils/') || normalizedPath.includes('/types/') || normalizedPath.includes('/shared/')) {
      return 'shared';
    }
    
    return 'unknown';
  }

  private determineModuleType(filePath: string, content: string): DependencyNode['type'] {
    const normalizedPath = filePath.toLowerCase();
    
    if (normalizedPath.includes('controller')) return 'controller';
    if (normalizedPath.includes('service')) return 'service';
    if (normalizedPath.includes('repository')) return 'repository';
    if (normalizedPath.includes('middleware')) return 'middleware';
    if (normalizedPath.includes('config')) return 'config';
    if (normalizedPath.includes('types') || normalizedPath.includes('.d.ts')) return 'type';
    if (normalizedPath.includes('utils') || normalizedPath.includes('helper')) return 'util';
    
    return 'module';
  }

  private detectCircularDependencies(): CircularDependency[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: CircularDependency[] = [];
    
    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        const severity = this.determineCycleSeverity(cycle);
        
        circularDeps.push({
          cycle,
          severity,
          description: `Circular dependency detected: ${cycle.join(' → ')}`
        });
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const importPath of node.imports) {
          const resolvedPath = this.resolveImportPath(nodeId, importPath);
          if (resolvedPath) {
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
    
    return circularDeps;
  }

  private determineCycleSeverity(cycle: string[]): 'high' | 'medium' | 'low' {
    const hasCoreModule = cycle.some(nodeId => {
      const node = this.nodes.get(nodeId);
      return node && ['service', 'controller', 'repository'].includes(node.type);
    });
    
    if (hasCoreModule && cycle.length <= 3) return 'high';
    if (hasCoreModule || cycle.length <= 5) return 'medium';
    return 'low';
  }

  private resolveImportPath(fromNode: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromNode);
      const resolvedPath = path.resolve(this.projectRoot, fromDir, importPath);
      
      // Try different extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const withExt = resolvedPath + ext;
        const relativePath = path.relative(this.projectRoot, withExt);
        if (this.nodes.has(relativePath)) {
          return relativePath;
        }
      }
      
      // Try index files
      for (const ext of ['.ts', '.tsx']) {
        const indexPath = path.join(resolvedPath, 'index' + ext);
        const relativePath = path.relative(this.projectRoot, indexPath);
        if (this.nodes.has(relativePath)) {
          return relativePath;
        }
      }
    }
    
    // Handle absolute imports (simplified)
    if (importPath.startsWith('@/') || importPath.startsWith('@medianest/')) {
      // This would require more sophisticated resolution based on tsconfig paths
      // For now, we'll skip these to avoid false positives
      return null;
    }
    
    return null;
  }

  private validateLayerArchitecture(): LayerViolation[] {
    const violations: LayerViolation[] = [];
    
    // Define allowed layer dependencies (lower can depend on higher)
    const layerHierarchy: Record<ArchitecturalLayer, ArchitecturalLayer[]> = {
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
          if (targetNode) {
            if (!allowedDependencies.includes(targetNode.layer) && targetNode.layer !== node.layer) {
              const severity = this.determineViolationSeverity(node.layer, targetNode.layer);
              violations.push({
                violator: nodeId,
                violatee: targetNodeId,
                violatorLayer: node.layer,
                violateeLayer: targetNode.layer,
                severity,
                description: `${node.layer} layer should not depend on ${targetNode.layer} layer`
              });
            }
          }
        }
      }
    }
    
    return violations;
  }

  private determineViolationSeverity(fromLayer: ArchitecturalLayer, toLayer: ArchitecturalLayer): 'critical' | 'major' | 'minor' {
    // Critical: data depending on presentation or business
    if (fromLayer === 'data' && ['presentation', 'business'].includes(toLayer)) return 'critical';
    
    // Major: infrastructure depending on presentation or business
    if (fromLayer === 'infrastructure' && ['presentation', 'business'].includes(toLayer)) return 'major';
    
    // Major: shared depending on anything else
    if (fromLayer === 'shared' && toLayer !== 'shared') return 'major';
    
    return 'minor';
  }

  private calculateCouplingMetrics(): CouplingMetric[] {
    const metrics: CouplingMetric[] = [];
    
    for (const [nodeId, node] of this.nodes) {
      const afferentCoupling = this.calculateAfferentCoupling(nodeId);
      const efferentCoupling = node.imports.length;
      const totalCoupling = afferentCoupling + efferentCoupling;
      const instability = totalCoupling === 0 ? 0 : efferentCoupling / totalCoupling;
      const abstractness = this.calculateAbstractness(node);
      const distance = Math.abs(abstractness + instability - 1);
      
      const severity = this.determineCouplingseverity(instability, distance, totalCoupling);
      
      metrics.push({
        module: nodeId,
        afferentCoupling,
        efferentCoupling,
        instability,
        abstractness,
        distance,
        severity
      });
    }
    
    return metrics;
  }

  private calculateAfferentCoupling(targetNodeId: string): number {
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

  private calculateAbstractness(node: DependencyNode): number {
    const content = fs.readFileSync(node.path, 'utf-8');
    
    // Count interfaces, abstract classes, and type definitions
    const abstractPatterns = [
      /interface\s+\w+/g,
      /abstract\s+class\s+\w+/g,
      /type\s+\w+\s*=/g,
      /export\s+type\s+\w+/g
    ];
    
    let abstractCount = 0;
    let concreteCount = 0;
    
    for (const pattern of abstractPatterns) {
      const matches = content.match(pattern);
      if (matches) abstractCount += matches.length;
    }
    
    // Count concrete implementations
    const concretePatterns = [
      /class\s+\w+/g,
      /function\s+\w+/g,
      /const\s+\w+\s*=/g,
      /export\s+const\s+\w+/g
    ];
    
    for (const pattern of concretePatterns) {
      const matches = content.match(pattern);
      if (matches) concreteCount += matches.length;
    }
    
    const total = abstractCount + concreteCount;
    return total === 0 ? 0 : abstractCount / total;
  }

  private determineCouplingDensity(instability: number, distance: number, totalCoupling: number): 'good' | 'concerning' | 'critical' {
    // Critical: high instability with high coupling
    if (instability > 0.8 && totalCoupling > 20) return 'critical';
    
    // Critical: high distance from main sequence
    if (distance > 0.7) return 'critical';
    
    // Concerning: moderate issues
    if (instability > 0.6 || distance > 0.4 || totalCoupling > 15) return 'concerning';
    
    return 'good';
  }

  private generateArchitecturalReport(
    circularDeps: CircularDependency[],
    layerViolations: LayerViolation[],
    couplingMetrics: CouplingMetric[]
  ): string {
    const report = [];
    
    report.push('🏗️ MEDIANEST ARCHITECTURAL INTEGRITY REPORT');
    report.push('==========================================\n');
    
    // Executive Summary
    report.push('📊 EXECUTIVE SUMMARY');
    report.push('-------------------');
    report.push(`Total Modules Analyzed: ${this.nodes.size}`);
    report.push(`Circular Dependencies: ${circularDeps.length} (${circularDeps.filter(cd => cd.severity === 'high').length} high severity)`);
    report.push(`Layer Violations: ${layerViolations.length} (${layerViolations.filter(lv => lv.severity === 'critical').length} critical)`);
    
    const criticalCoupling = couplingMetrics.filter(cm => cm.severity === 'critical').length;
    const concerningCoupling = couplingMetrics.filter(cm => cm.severity === 'concerning').length;
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
    
    // Detailed Findings
    if (circularDeps.length > 0) {
      report.push('🔄 CIRCULAR DEPENDENCIES');
      report.push('------------------------');
      circularDeps.forEach((cd, index) => {
        report.push(`${index + 1}. ${cd.severity.toUpperCase()}: ${cd.description}`);
      });
      report.push('');
    }
    
    if (layerViolations.length > 0) {
      report.push('🏛️ LAYER ARCHITECTURE VIOLATIONS');
      report.push('--------------------------------');
      layerViolations.forEach((lv, index) => {
        report.push(`${index + 1}. ${lv.severity.toUpperCase()}: ${lv.description}`);
        report.push(`   ${lv.violator} → ${lv.violatee}`);
      });
      report.push('');
    }
    
    // Top Coupling Issues
    const topCouplingIssues = couplingMetrics
      .filter(cm => cm.severity !== 'good')
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 10);
    
    if (topCouplingIssues.length > 0) {
      report.push('🔗 TOP COUPLING ISSUES');
      report.push('--------------------');
      topCouplingIssues.forEach((cm, index) => {
        report.push(`${index + 1}. ${cm.severity.toUpperCase()}: ${cm.module}`);
        report.push(`   Instability: ${cm.instability.toFixed(2)}, Distance: ${cm.distance.toFixed(2)}`);
        report.push(`   Afferent: ${cm.afferentCoupling}, Efferent: ${cm.efferentCoupling}`);
      });
      report.push('');
    }
    
    // Recommendations
    report.push('💡 RECOMMENDATIONS');
    report.push('-----------------');
    
    if (circularDeps.length > 0) {
      report.push('• Break circular dependencies by introducing interfaces or extracting common dependencies');
    }
    
    if (layerViolations.length > 0) {
      report.push('• Fix layer violations by moving dependencies to appropriate layers');
      report.push('• Consider dependency inversion for upward dependencies');
    }
    
    if (topCouplingIssues.length > 0) {
      report.push('• Reduce coupling by applying Single Responsibility Principle');
      report.push('• Extract interfaces and use dependency injection');
      report.push('• Consider splitting large modules into smaller, focused ones');
    }
    
    report.push('• Implement architectural tests to prevent regression');
    report.push('• Regular architectural reviews and refactoring');
    
    return report.join('\n');
  }

  // Fix method name typo
  private determineCouplingSpeed(instability: number, distance: number, totalCoupling: number): 'good' | 'concerning' | 'critical' {
    return this.determineCouplingDensity(instability, distance, totalCoupling);
  }
}

// Main execution
async function main() {
  const projectRoot = process.cwd();
  const validator = new ArchitecturalValidator(projectRoot);
  
  try {
    const results = await validator.validate();
    
    // Write detailed report
    const reportPath = path.join(projectRoot, 'analysis', 'architectural-integrity-report.md');
    fs.writeFileSync(reportPath, results.architecturalReport);
    
    // Write JSON results for tooling integration
    const jsonPath = path.join(projectRoot, 'analysis', 'architectural-integrity-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    
    console.log('✅ ARCHITECTURAL VALIDATION COMPLETE');
    console.log('====================================\n');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`📁 JSON results saved to: ${jsonPath}\n`);
    
    // Print summary
    console.log(results.architecturalReport.split('\n').slice(0, 20).join('\n'));
    
    if (results.circularDependencies.length > 0 || results.layerViolations.length > 0) {
      process.exit(1); // Exit with error code for CI/CD integration
    }
    
  } catch (error) {
    console.error('❌ Architectural validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ArchitecturalValidator };