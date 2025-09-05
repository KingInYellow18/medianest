#!/usr/bin/env node

/**
 * Development Workflow Optimization Script
 * Provides automated development workflow tasks and dependency management
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class DevWorkflowManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.workspaces = ['frontend', 'backend', 'shared'];
    this.logFile = path.join(this.projectRoot, 'logs', 'dev-workflow.log');
    this.ensureLogsDirectory();
  }

  /**
   * Ensure logs directory exists
   */
  ensureLogsDirectory() {
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Log message to console and file
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}\n`;
    
    console.log(`[${level}] ${message}`);
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.warn('Failed to write to log file:', error.message);
    }
  }

  /**
   * Execute command and log output
   */
  execCommand(command, options = {}) {
    this.log(`Executing: ${command}`);
    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        ...options,
      });
      this.log(`Command completed successfully`);
      return result;
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Check Node.js and npm versions
   */
  checkNodeVersion() {
    this.log('Checking Node.js and npm versions...');
    
    const nodeVersion = this.execCommand('node --version').trim();
    const npmVersion = this.execCommand('npm --version').trim();
    
    this.log(`Node.js version: ${nodeVersion}`);
    this.log(`npm version: ${npmVersion}`);
    
    // Check if Node.js version meets requirements
    const requiredNodeVersion = '20.0.0';
    const currentNodeVersion = nodeVersion.replace('v', '');
    
    if (!this.isVersionGreaterOrEqual(currentNodeVersion, requiredNodeVersion)) {
      throw new Error(`Node.js ${requiredNodeVersion} or higher required. Current: ${nodeVersion}`);
    }
    
    return { node: nodeVersion, npm: npmVersion };
  }

  /**
   * Compare version strings
   */
  isVersionGreaterOrEqual(current, required) {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;
      
      if (currentPart > requiredPart) return true;
      if (currentPart < requiredPart) return false;
    }
    
    return true;
  }

  /**
   * Install dependencies for all workspaces
   */
  async installDependencies() {
    this.log('Installing dependencies for all workspaces...');
    
    const startTime = performance.now();
    
    try {
      this.execCommand('npm install', { stdio: 'inherit' });
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Dependencies installed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Failed to install dependencies: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Update dependencies to latest compatible versions
   */
  async updateDependencies() {
    this.log('Updating dependencies to latest compatible versions...');
    
    const startTime = performance.now();
    
    try {
      // Update root dependencies
      this.log('Updating root dependencies...');
      this.execCommand('npm update', { stdio: 'inherit' });
      
      // Update workspace dependencies
      for (const workspace of this.workspaces) {
        this.log(`Updating ${workspace} dependencies...`);
        this.execCommand(`npm update --workspace=${workspace}`, { stdio: 'inherit' });
      }
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Dependencies updated successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Failed to update dependencies: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Audit dependencies for security vulnerabilities
   */
  async auditDependencies() {
    this.log('Auditing dependencies for security vulnerabilities...');
    
    try {
      const auditResult = this.execCommand('npm audit --json');
      const audit = JSON.parse(auditResult);
      
      this.log(`Security audit completed:`);
      this.log(`  Total vulnerabilities: ${audit.metadata?.vulnerabilities?.total || 0}`);
      this.log(`  High vulnerabilities: ${audit.metadata?.vulnerabilities?.high || 0}`);
      this.log(`  Critical vulnerabilities: ${audit.metadata?.vulnerabilities?.critical || 0}`);
      
      if (audit.metadata?.vulnerabilities?.total > 0) {
        this.log('Running automatic fix for vulnerabilities...');
        this.execCommand('npm audit fix', { stdio: 'inherit' });
      }
      
      return audit;
    } catch (error) {
      this.log(`Security audit failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Clean build artifacts and node_modules
   */
  async clean() {
    this.log('Cleaning build artifacts and dependencies...');
    
    try {
      this.execCommand('npm run clean', { stdio: 'inherit' });
      this.log('Clean completed successfully');
    } catch (error) {
      this.log(`Clean failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Type check all workspaces
   */
  async typeCheck() {
    this.log('Running TypeScript type checking...');
    
    const startTime = performance.now();
    
    try {
      this.execCommand('npm run type-check', { stdio: 'inherit' });
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Type checking completed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Type checking failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Lint all workspaces
   */
  async lint() {
    this.log('Running linting...');
    
    const startTime = performance.now();
    
    try {
      this.execCommand('npm run lint', { stdio: 'inherit' });
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Linting completed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Linting failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Run tests for all workspaces
   */
  async test() {
    this.log('Running tests...');
    
    const startTime = performance.now();
    
    try {
      this.execCommand('npm test', { stdio: 'inherit' });
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Tests completed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Tests failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Build all workspaces
   */
  async build() {
    this.log('Building all workspaces...');
    
    const startTime = performance.now();
    
    try {
      this.execCommand('npm run build', { stdio: 'inherit' });
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`Build completed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`Build failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Setup development environment
   */
  async setup() {
    this.log('Setting up development environment...');
    
    try {
      this.checkNodeVersion();
      await this.installDependencies();
      await this.auditDependencies();
      
      // Generate Prisma client
      this.log('Generating Prisma client...');
      this.execCommand('npm run db:generate', { stdio: 'inherit' });
      
      // Run type checking to ensure everything is working
      await this.typeCheck();
      
      this.log('Development environment setup completed successfully');
    } catch (error) {
      this.log(`Development environment setup failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Full CI/CD pipeline check
   */
  async ciCheck() {
    this.log('Running full CI/CD pipeline check...');
    
    const startTime = performance.now();
    
    try {
      await this.typeCheck();
      await this.lint();
      await this.test();
      await this.build();
      
      const duration = Math.round(performance.now() - startTime);
      this.log(`CI/CD pipeline check completed successfully in ${duration}ms`);
    } catch (error) {
      this.log(`CI/CD pipeline check failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Check workspace dependency consistency
   */
  checkDependencyConsistency() {
    this.log('Checking dependency consistency across workspaces...');
    
    const rootPackage = JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
    );
    
    const issues = [];
    
    for (const workspace of this.workspaces) {
      const workspacePackagePath = path.join(this.projectRoot, workspace, 'package.json');
      
      if (!fs.existsSync(workspacePackagePath)) {
        this.log(`Workspace package.json not found: ${workspacePackagePath}`, 'WARN');
        continue;
      }
      
      const workspacePackage = JSON.parse(fs.readFileSync(workspacePackagePath, 'utf8'));
      
      // Check for version mismatches
      const allDeps = {
        ...rootPackage.dependencies,
        ...rootPackage.devDependencies,
      };
      
      const workspaceDeps = {
        ...workspacePackage.dependencies,
        ...workspacePackage.devDependencies,
      };
      
      for (const [dep, version] of Object.entries(workspaceDeps)) {
        if (version !== '*' && allDeps[dep] && allDeps[dep] !== version) {
          issues.push(`${workspace}: ${dep} version mismatch (workspace: ${version}, root: ${allDeps[dep]})`);
        }
      }
    }
    
    if (issues.length > 0) {
      this.log('Dependency consistency issues found:', 'WARN');
      issues.forEach(issue => this.log(`  ${issue}`, 'WARN'));
    } else {
      this.log('All workspace dependencies are consistent');
    }
    
    return issues;
  }
}

// CLI interface
async function main() {
  const workflow = new DevWorkflowManager();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'setup':
        await workflow.setup();
        break;
      case 'install':
        await workflow.installDependencies();
        break;
      case 'update':
        await workflow.updateDependencies();
        break;
      case 'audit':
        await workflow.auditDependencies();
        break;
      case 'clean':
        await workflow.clean();
        break;
      case 'type-check':
        await workflow.typeCheck();
        break;
      case 'lint':
        await workflow.lint();
        break;
      case 'test':
        await workflow.test();
        break;
      case 'build':
        await workflow.build();
        break;
      case 'ci':
        await workflow.ciCheck();
        break;
      case 'check-deps':
        workflow.checkDependencyConsistency();
        break;
      case 'check-node':
        workflow.checkNodeVersion();
        break;
      default:
        console.log(`
MediaNest Development Workflow Manager

Usage: node scripts/dev-workflow.js <command>

Commands:
  setup       - Complete development environment setup
  install     - Install dependencies for all workspaces
  update      - Update dependencies to latest compatible versions
  audit       - Audit dependencies for security vulnerabilities
  clean       - Clean build artifacts and node_modules
  type-check  - Run TypeScript type checking
  lint        - Run linting for all workspaces
  test        - Run tests for all workspaces
  build       - Build all workspaces
  ci          - Run full CI/CD pipeline check
  check-deps  - Check dependency consistency across workspaces
  check-node  - Check Node.js and npm versions

Examples:
  node scripts/dev-workflow.js setup
  node scripts/dev-workflow.js ci
  node scripts/dev-workflow.js check-deps
        `);
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DevWorkflowManager;