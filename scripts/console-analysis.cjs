#!/usr/bin/env node

/**
 * Console Statement Analysis Tool
 * 
 * Provides detailed analysis of console usage across the codebase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ConsoleAnalyzer {
  constructor() {
    this.projectRoot = '/home/kinginyellow/projects/medianest';
  }

  /**
   * Get comprehensive console statement analysis
   */
  getFullAnalysis() {
    console.log('🔍 CONSOLE STATEMENT SECURITY ANALYSIS');
    console.log('=====================================\n');

    // Total count across entire project
    const totalCount = this.getCount('/home/kinginyellow/projects/medianest');
    console.log(`📊 Total console statements (entire project): ${totalCount}`);

    // Source directories count
    const sourceCount = this.getCount([
      '/home/kinginyellow/projects/medianest/src',
      '/home/kinginyellow/projects/medianest/backend/src', 
      '/home/kinginyellow/projects/medianest/frontend'
    ].join(' '));
    console.log(`🎯 Console statements in source code: ${sourceCount}`);

    // Backend specific
    if (fs.existsSync('/home/kinginyellow/projects/medianest/backend/src')) {
      const backendCount = this.getCount('/home/kinginyellow/projects/medianest/backend/src');
      console.log(`⚙️  Backend console statements: ${backendCount}`);
    }

    // Frontend specific  
    if (fs.existsSync('/home/kinginyellow/projects/medianest/frontend')) {
      const frontendCount = this.getCount('/home/kinginyellow/projects/medianest/frontend');
      console.log(`🌐 Frontend console statements: ${frontendCount}`);
    }

    // Services specific
    if (fs.existsSync('/home/kinginyellow/projects/medianest/src/services')) {
      const servicesCount = this.getCount('/home/kinginyellow/projects/medianest/src/services');
      console.log(`🔧 Services console statements: ${servicesCount}`);
    }

    console.log('\n📈 BREAKDOWN BY CONSOLE METHOD:');
    this.getMethodBreakdown();

    console.log('\n📁 TOP FILES WITH MOST CONSOLE STATEMENTS:');
    this.getTopFiles();

    console.log('\n🚨 SECURITY RISK ASSESSMENT:');
    this.assessSecurityRisk(sourceCount);

    return {
      total: totalCount,
      source: sourceCount,
      risk: this.calculateRiskLevel(sourceCount)
    };
  }

  /**
   * Get count for specific path(s)
   */
  getCount(paths) {
    try {
      const cmd = `grep -r "console\\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${paths} 2>/dev/null | wc -l`;
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      return parseInt(result, 10);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get breakdown by console method
   */
  getMethodBreakdown() {
    const methods = ['log', 'error', 'warn', 'info', 'debug', 'table', 'count', 'time', 'timeEnd'];
    
    for (const method of methods) {
      try {
        const cmd = `grep -r "console\\.${method}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" /home/kinginyellow/projects/medianest/src /home/kinginyellow/projects/medianest/backend/src /home/kinginyellow/projects/medianest/frontend 2>/dev/null | wc -l`;
        const count = execSync(cmd, { encoding: 'utf8' }).trim();
        if (parseInt(count, 10) > 0) {
          const risk = this.getMethodRisk(method);
          console.log(`   console.${method}: ${count} (Risk: ${risk})`);
        }
      } catch (error) {
        // Continue
      }
    }
  }

  /**
   * Get risk level for console method
   */
  getMethodRisk(method) {
    const riskLevels = {
      'log': 'HIGH',
      'debug': 'HIGH', 
      'info': 'HIGH',
      'table': 'HIGH',
      'count': 'MEDIUM',
      'time': 'MEDIUM',
      'timeEnd': 'MEDIUM',
      'warn': 'MEDIUM',
      'error': 'LOW'
    };
    return riskLevels[method] || 'UNKNOWN';
  }

  /**
   * Get top files with most console statements
   */
  getTopFiles() {
    try {
      const cmd = `grep -r "console\\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" /home/kinginyellow/projects/medianest/src /home/kinginyellow/projects/medianest/backend/src /home/kinginyellow/projects/medianest/frontend 2>/dev/null | cut -d: -f1 | sort | uniq -c | sort -nr | head -10`;
      const result = execSync(cmd, { encoding: 'utf8' });
      
      if (result.trim()) {
        const lines = result.trim().split('\n');
        lines.forEach((line, index) => {
          const match = line.trim().match(/(\d+)\s+(.+)/);
          if (match) {
            const [, count, file] = match;
            const relativePath = path.relative(this.projectRoot, file);
            console.log(`   ${index + 1}. ${relativePath}: ${count} statements`);
          }
        });
      } else {
        console.log('   No files found with console statements in source directories');
      }
    } catch (error) {
      console.log('   Error analyzing top files');
    }
  }

  /**
   * Assess security risk
   */
  assessSecurityRisk(count) {
    const riskLevel = this.calculateRiskLevel(count);
    
    console.log(`   Risk Level: ${riskLevel}`);
    console.log(`   Statements: ${count}`);
    
    if (count > 500) {
      console.log('   ⚠️  CRITICAL: Immediate action required');
      console.log('   📋 Recommendations:');
      console.log('      - Run console elimination script immediately');
      console.log('      - Review all console.log statements for sensitive data');
      console.log('      - Implement proper logging system');
    } else if (count > 100) {
      console.log('   ⚠️  HIGH: Action needed soon');
      console.log('   📋 Recommendations:');
      console.log('      - Schedule console cleanup');
      console.log('      - Replace with proper logging');
    } else if (count > 20) {
      console.log('   ⚠️  MEDIUM: Monitor and plan cleanup');
    } else {
      console.log('   ✅ LOW: Acceptable level');
    }
  }

  /**
   * Calculate risk level
   */
  calculateRiskLevel(count) {
    if (count > 500) return 'CRITICAL';
    if (count > 100) return 'HIGH';
    if (count > 20) return 'MEDIUM';
    return 'LOW';
  }
}

// Run analysis
if (require.main === module) {
  const analyzer = new ConsoleAnalyzer();
  analyzer.getFullAnalysis();
}

module.exports = ConsoleAnalyzer;