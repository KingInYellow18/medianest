#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const glob = require('glob');

class BuildTester {
  constructor() {
    this.results = {
      buildTests: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        buildTime: 0,
        buildSize: 0,
        warnings: 0,
      },
    };

    this.projectRoot = path.join(__dirname, '../../..');
    this.mkdocsConfig = path.join(this.projectRoot, 'mkdocs.yml');
    this.buildDir = path.join(this.projectRoot, 'site');
    this.docsDir = path.join(this.projectRoot, 'docs');
  }

  async runTests() {
    console.log(chalk.blue('🏗️ Starting build testing...\n'));

    // Test 1: Configuration validation
    await this.testConfigurationValidation();

    // Test 2: Clean build
    await this.testCleanBuild();

    // Test 3: Build output validation
    await this.testBuildOutput();

    // Test 4: Incremental build
    await this.testIncrementalBuild();

    // Test 5: Plugin functionality
    await this.testPluginFunctionality();

    // Test 6: Theme and assets
    await this.testThemeAndAssets();

    return this.generateReport();
  }

  async testConfigurationValidation() {
    console.log(chalk.blue('🔧 Testing configuration validation...'));

    const test = {
      name: 'Configuration Validation',
      type: 'config',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      // Check if mkdocs.yml exists
      if (!(await fs.pathExists(this.mkdocsConfig))) {
        test.issues.push({
          type: 'config-missing',
          severity: 'error',
          message: 'mkdocs.yml configuration file not found',
        });
        test.status = 'FAIL';
      } else {
        // Validate YAML syntax
        try {
          const configContent = await fs.readFile(this.mkdocsConfig, 'utf8');

          // Basic YAML validation - check for common issues
          if (configContent.includes('\t')) {
            test.issues.push({
              type: 'yaml-tabs',
              severity: 'warning',
              message: 'Configuration contains tabs - YAML should use spaces',
            });
            test.status = 'WARNING';
          }

          // Check required fields
          const requiredFields = ['site_name', 'nav', 'theme'];
          const missingFields = [];

          requiredFields.forEach((field) => {
            if (!configContent.includes(`${field}:`)) {
              missingFields.push(field);
            }
          });

          if (missingFields.length > 0) {
            test.issues.push({
              type: 'missing-required-fields',
              severity: 'error',
              message: `Missing required fields: ${missingFields.join(', ')}`,
            });
            test.status = 'FAIL';
          }

          // Test configuration with mkdocs config command
          try {
            const configOutput = execSync(`mkdocs config -f "${this.mkdocsConfig}"`, {
              cwd: this.projectRoot,
              encoding: 'utf8',
              timeout: 10000,
            });

            test.metrics.configValid = true;
            test.metrics.configLines = configContent.split('\n').length;
          } catch (configError) {
            test.issues.push({
              type: 'config-invalid',
              severity: 'error',
              message: `Configuration validation failed: ${configError.message}`,
            });
            test.status = 'FAIL';
          }
        } catch (yamlError) {
          test.issues.push({
            type: 'yaml-parse-error',
            severity: 'error',
            message: `YAML parsing failed: ${yamlError.message}`,
          });
          test.status = 'FAIL';
        }
      }

      // Check docs directory structure
      if (!(await fs.pathExists(this.docsDir))) {
        test.issues.push({
          type: 'docs-missing',
          severity: 'error',
          message: 'docs directory not found',
        });
        test.status = 'FAIL';
      } else {
        const indexMd = path.join(this.docsDir, 'index.md');
        if (!(await fs.pathExists(indexMd))) {
          test.issues.push({
            type: 'index-missing',
            severity: 'warning',
            message: 'index.md not found in docs directory',
          });
          test.status = 'WARNING';
        }

        // Count documentation files
        const markdownFiles = glob.sync('**/*.md', { cwd: this.docsDir });
        test.metrics.markdownFileCount = markdownFiles.length;
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](`${statusIcon} Configuration Validation - ${test.issues.length} issues`),
    );
  }

  async testCleanBuild() {
    console.log(chalk.blue('🧹 Testing clean build...'));

    const test = {
      name: 'Clean Build',
      type: 'build',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      // Clean previous build
      if (await fs.pathExists(this.buildDir)) {
        await fs.remove(this.buildDir);
      }

      // Time the build
      const buildStart = Date.now();

      try {
        const buildOutput = execSync(`mkdocs build -f "${this.mkdocsConfig}" --clean --strict`, {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 60000, // 60 second timeout
          stdio: 'pipe',
        });

        const buildTime = Date.now() - buildStart;
        test.metrics.buildTime = buildTime;
        this.results.summary.buildTime = buildTime;

        console.log(chalk.green(`Build completed in ${(buildTime / 1000).toFixed(2)}s`));

        // Check for warnings in build output
        const warnings = (buildOutput.match(/WARNING/g) || []).length;
        const errors = (buildOutput.match(/ERROR/g) || []).length;

        test.metrics.warnings = warnings;
        test.metrics.errors = errors;
        this.results.summary.warnings = warnings;

        if (errors > 0) {
          test.issues.push({
            type: 'build-errors',
            severity: 'error',
            message: `Build completed with ${errors} errors`,
          });
          test.status = 'FAIL';
        } else if (warnings > 0) {
          test.issues.push({
            type: 'build-warnings',
            severity: 'warning',
            message: `Build completed with ${warnings} warnings`,
          });
          test.status = 'WARNING';
        }

        // Check build time performance
        if (buildTime > 30000) {
          // 30 seconds
          test.issues.push({
            type: 'slow-build',
            severity: 'warning',
            message: `Build time is slow: ${(buildTime / 1000).toFixed(2)}s`,
          });
          test.status = 'WARNING';
        }

        test.buildOutput = buildOutput;
      } catch (buildError) {
        test.issues.push({
          type: 'build-failed',
          severity: 'error',
          message: `Build failed: ${buildError.message}`,
        });
        test.status = 'FAIL';
        test.buildError = buildError.message;
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](
        `${statusIcon} Clean Build - ${test.issues.length} issues, ${(test.metrics.buildTime / 1000).toFixed(2)}s`,
      ),
    );
  }

  async testBuildOutput() {
    console.log(chalk.blue('📋 Testing build output...'));

    const test = {
      name: 'Build Output Validation',
      type: 'output',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      if (!(await fs.pathExists(this.buildDir))) {
        test.issues.push({
          type: 'build-dir-missing',
          severity: 'error',
          message: 'Build directory not found - build may have failed',
        });
        test.status = 'FAIL';
      } else {
        // Analyze build output
        const stats = await this.analyzeBuildDirectory(this.buildDir);
        test.metrics = { ...test.metrics, ...stats };
        this.results.summary.buildSize = stats.totalSize;

        // Check essential files
        const essentialFiles = ['index.html', 'sitemap.xml'];
        const missingFiles = [];

        for (const file of essentialFiles) {
          const filePath = path.join(this.buildDir, file);
          if (!(await fs.pathExists(filePath))) {
            missingFiles.push(file);
          }
        }

        if (missingFiles.length > 0) {
          test.issues.push({
            type: 'missing-essential-files',
            severity: 'error',
            message: `Missing essential files: ${missingFiles.join(', ')}`,
          });
          test.status = 'FAIL';
        }

        // Check HTML files
        const htmlFiles = glob.sync('**/*.html', { cwd: this.buildDir });
        test.metrics.htmlFileCount = htmlFiles.length;

        if (htmlFiles.length === 0) {
          test.issues.push({
            type: 'no-html-files',
            severity: 'error',
            message: 'No HTML files found in build output',
          });
          test.status = 'FAIL';
        }

        // Check for broken HTML (basic validation)
        const brokenHtmlFiles = [];
        for (const htmlFile of htmlFiles.slice(0, 10)) {
          // Check first 10
          const htmlPath = path.join(this.buildDir, htmlFile);
          const htmlContent = await fs.readFile(htmlPath, 'utf8');

          // Basic HTML validation
          if (!htmlContent.includes('<!DOCTYPE html>')) {
            brokenHtmlFiles.push(htmlFile);
          } else if (!htmlContent.includes('<html') || !htmlContent.includes('</html>')) {
            brokenHtmlFiles.push(htmlFile);
          }
        }

        if (brokenHtmlFiles.length > 0) {
          test.issues.push({
            type: 'malformed-html',
            severity: 'warning',
            message: `${brokenHtmlFiles.length} HTML files may be malformed`,
          });
          test.status = 'WARNING';
        }

        // Check build size
        const buildSizeMB = stats.totalSize / (1024 * 1024);
        if (buildSizeMB > 100) {
          // 100MB threshold
          test.issues.push({
            type: 'large-build-size',
            severity: 'warning',
            message: `Large build size: ${buildSizeMB.toFixed(2)}MB`,
          });
          test.status = 'WARNING';
        }

        // Check asset optimization
        if (stats.largestFiles && stats.largestFiles.length > 0) {
          const largeAssets = stats.largestFiles.filter((f) => f.size > 1024 * 1024); // >1MB
          if (largeAssets.length > 0) {
            test.issues.push({
              type: 'large-assets',
              severity: 'info',
              message: `${largeAssets.length} assets larger than 1MB found`,
            });
          }
        }
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    const sizeMB = (test.metrics.totalSize / 1024 / 1024).toFixed(2);
    console.log(
      chalk[statusColor](`${statusIcon} Build Output - ${test.issues.length} issues, ${sizeMB}MB`),
    );
  }

  async testIncrementalBuild() {
    console.log(chalk.blue('♾️ Testing incremental build...'));

    const test = {
      name: 'Incremental Build',
      type: 'incremental',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      // Create a temporary file to test incremental builds
      const testFile = path.join(this.docsDir, 'test-incremental.md');
      const testContent = '# Test Incremental Build\n\nThis is a test file for incremental builds.';

      await fs.writeFile(testFile, testContent);

      // Time the incremental build
      const incrementalStart = Date.now();

      try {
        const buildOutput = execSync(`mkdocs build -f "${this.mkdocsConfig}"`, {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe',
        });

        const incrementalTime = Date.now() - incrementalStart;
        test.metrics.incrementalBuildTime = incrementalTime;

        // Check if the new file was built
        const builtFile = path.join(this.buildDir, 'test-incremental', 'index.html');
        if (await fs.pathExists(builtFile)) {
          test.metrics.incrementalBuildWorks = true;
        } else {
          test.issues.push({
            type: 'incremental-build-failed',
            severity: 'warning',
            message: 'Incremental build did not generate expected file',
          });
          test.status = 'WARNING';
        }

        // Compare build times (incremental should be faster)
        const originalBuildTime =
          this.results.buildTests.find((t) => t.name === 'Clean Build')?.metrics.buildTime || 0;
        if (originalBuildTime > 0 && incrementalTime >= originalBuildTime) {
          test.issues.push({
            type: 'incremental-not-faster',
            severity: 'info',
            message: 'Incremental build not significantly faster than clean build',
          });
        }

        test.metrics.speedImprovement =
          originalBuildTime > 0
            ? (((originalBuildTime - incrementalTime) / originalBuildTime) * 100).toFixed(1) + '%'
            : 'N/A';
      } catch (buildError) {
        test.issues.push({
          type: 'incremental-build-error',
          severity: 'error',
          message: `Incremental build failed: ${buildError.message}`,
        });
        test.status = 'FAIL';
      }

      // Clean up test file
      await fs.remove(testFile).catch(() => {});
      await fs.remove(path.join(this.buildDir, 'test-incremental')).catch(() => {});
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    const timeStr = test.metrics.incrementalBuildTime
      ? `${(test.metrics.incrementalBuildTime / 1000).toFixed(2)}s`
      : 'N/A';
    console.log(
      chalk[statusColor](
        `${statusIcon} Incremental Build - ${test.issues.length} issues, ${timeStr}`,
      ),
    );
  }

  async testPluginFunctionality() {
    console.log(chalk.blue('🔌 Testing plugin functionality...'));

    const test = {
      name: 'Plugin Functionality',
      type: 'plugins',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      // Read configuration to get enabled plugins
      const configContent = await fs.readFile(this.mkdocsConfig, 'utf8');

      // Extract plugins (simplified parsing)
      const pluginMatches = configContent.match(
        /plugins:\s*([\s\S]*?)(?=\n\w|markdown_extensions:|$)/,
      );
      const enabledPlugins = [];

      if (pluginMatches) {
        const pluginSection = pluginMatches[1];
        const pluginLines = pluginSection.match(/^\s*-\s*([\w-]+)/gm);
        if (pluginLines) {
          pluginLines.forEach((line) => {
            const plugin = line
              .replace(/^\s*-\s*/, '')
              .split(':')[0]
              .trim();
            enabledPlugins.push(plugin);
          });
        }
      }

      test.metrics.enabledPlugins = enabledPlugins;
      test.metrics.pluginCount = enabledPlugins.length;

      // Test specific plugin outputs
      const pluginTests = [];

      // Test search plugin
      if (enabledPlugins.includes('search')) {
        const searchIndex = path.join(this.buildDir, 'search', 'search_index.json');
        if (await fs.pathExists(searchIndex)) {
          const searchData = await fs.readJson(searchIndex);
          pluginTests.push({
            plugin: 'search',
            status: 'working',
            details: `Search index contains ${searchData?.docs?.length || 0} documents`,
          });
        } else {
          pluginTests.push({
            plugin: 'search',
            status: 'failed',
            details: 'Search index file not found',
          });
          test.issues.push({
            type: 'search-plugin-failed',
            severity: 'error',
            message: 'Search plugin did not generate search index',
          });
          test.status = 'FAIL';
        }
      }

      // Test git-revision-date-localized plugin
      if (enabledPlugins.includes('git-revision-date-localized')) {
        // Check if pages contain revision dates
        const htmlFiles = glob.sync('**/*.html', { cwd: this.buildDir });
        let pagesWithDates = 0;

        for (const htmlFile of htmlFiles.slice(0, 5)) {
          // Check first 5 pages
          const htmlPath = path.join(this.buildDir, htmlFile);
          const htmlContent = await fs.readFile(htmlPath, 'utf8');

          if (htmlContent.includes('last modified') || htmlContent.includes('updated')) {
            pagesWithDates++;
          }
        }

        pluginTests.push({
          plugin: 'git-revision-date-localized',
          status: pagesWithDates > 0 ? 'working' : 'unknown',
          details: `${pagesWithDates} of 5 tested pages contain revision dates`,
        });
      }

      // Test minify plugin
      if (enabledPlugins.includes('minify')) {
        // Check if HTML is minified (basic test)
        const indexPath = path.join(this.buildDir, 'index.html');
        if (await fs.pathExists(indexPath)) {
          const htmlContent = await fs.readFile(indexPath, 'utf8');
          const isMinified = !htmlContent.includes('\n  ') && htmlContent.length > 0;

          pluginTests.push({
            plugin: 'minify',
            status: isMinified ? 'working' : 'unknown',
            details: `HTML appears ${isMinified ? 'minified' : 'not minified'}`,
          });
        }
      }

      // Test social plugin (if enabled)
      if (enabledPlugins.includes('social')) {
        const socialImages = glob.sync('assets/images/social/**/*.png', { cwd: this.buildDir });
        pluginTests.push({
          plugin: 'social',
          status: socialImages.length > 0 ? 'working' : 'failed',
          details: `Generated ${socialImages.length} social images`,
        });

        if (socialImages.length === 0) {
          test.issues.push({
            type: 'social-plugin-failed',
            severity: 'warning',
            message: 'Social plugin did not generate any social images',
          });
          test.status = 'WARNING';
        }
      }

      test.metrics.pluginTests = pluginTests;

      // Count working vs failed plugins
      const workingPlugins = pluginTests.filter((p) => p.status === 'working').length;
      const failedPlugins = pluginTests.filter((p) => p.status === 'failed').length;

      test.metrics.workingPlugins = workingPlugins;
      test.metrics.failedPlugins = failedPlugins;

      if (failedPlugins > 0 && test.status === 'PASS') {
        test.status = 'WARNING';
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](
        `${statusIcon} Plugin Functionality - ${test.issues.length} issues, ${test.metrics.pluginCount} plugins`,
      ),
    );
  }

  async testThemeAndAssets() {
    console.log(chalk.blue('🎨 Testing theme and assets...'));

    const test = {
      name: 'Theme and Assets',
      type: 'theme',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      // Check CSS files
      const cssFiles = glob.sync('**/*.css', { cwd: this.buildDir });
      test.metrics.cssFileCount = cssFiles.length;

      if (cssFiles.length === 0) {
        test.issues.push({
          type: 'no-css-files',
          severity: 'error',
          message: 'No CSS files found in build output',
        });
        test.status = 'FAIL';
      }

      // Check JavaScript files
      const jsFiles = glob.sync('**/*.js', { cwd: this.buildDir });
      test.metrics.jsFileCount = jsFiles.length;

      // Check for essential theme files
      const themeFiles = ['assets/stylesheets/main.*.css', 'assets/javascripts/bundle.*.js'];

      const missingThemeFiles = [];
      for (const pattern of themeFiles) {
        const matchingFiles = glob.sync(pattern, { cwd: this.buildDir });
        if (matchingFiles.length === 0) {
          missingThemeFiles.push(pattern);
        }
      }

      if (missingThemeFiles.length > 0) {
        test.issues.push({
          type: 'missing-theme-files',
          severity: 'warning',
          message: `Missing theme files: ${missingThemeFiles.join(', ')}`,
        });
        test.status = 'WARNING';
      }

      // Check image assets
      const imageFiles = glob.sync('**/*.{png,jpg,jpeg,gif,svg,ico}', { cwd: this.buildDir });
      test.metrics.imageFileCount = imageFiles.length;

      // Check for favicon
      const faviconExists =
        (await fs.pathExists(path.join(this.buildDir, 'assets/images/favicon.ico'))) ||
        (await fs.pathExists(path.join(this.buildDir, 'favicon.ico')));

      test.metrics.hasFavicon = faviconExists;
      if (!faviconExists) {
        test.issues.push({
          type: 'missing-favicon',
          severity: 'info',
          message: 'Favicon not found',
        });
      }

      // Check for logo
      const logoExists =
        (await fs.pathExists(path.join(this.buildDir, 'assets/images/logo.svg'))) ||
        (await fs.pathExists(path.join(this.buildDir, 'assets/images/logo.png')));

      test.metrics.hasLogo = logoExists;
      if (!logoExists) {
        test.issues.push({
          type: 'missing-logo',
          severity: 'info',
          message: 'Logo not found',
        });
      }

      // Analyze CSS for potential issues
      if (cssFiles.length > 0) {
        let totalCssSize = 0;
        let cssIssues = 0;

        for (const cssFile of cssFiles.slice(0, 5)) {
          // Check first 5 CSS files
          const cssPath = path.join(this.buildDir, cssFile);
          const cssContent = await fs.readFile(cssPath, 'utf8');
          const cssSize = cssContent.length;
          totalCssSize += cssSize;

          // Check for common issues
          if (cssContent.includes('@import')) {
            cssIssues++;
          }
        }

        test.metrics.totalCssSize = totalCssSize;
        test.metrics.cssIssues = cssIssues;

        if (totalCssSize > 500 * 1024) {
          // 500KB
          test.issues.push({
            type: 'large-css-size',
            severity: 'warning',
            message: `Large total CSS size: ${(totalCssSize / 1024).toFixed(2)}KB`,
          });
          test.status = 'WARNING';
        }
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    this.updateTestSummary(test);
    this.results.buildTests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](
        `${statusIcon} Theme and Assets - ${test.issues.length} issues, ${test.metrics.cssFileCount} CSS, ${test.metrics.jsFileCount} JS`,
      ),
    );
  }

  async analyzeBuildDirectory(buildDir) {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {},
      largestFiles: [],
    };

    try {
      const files = glob.sync('**/*', { cwd: buildDir, nodir: true });

      for (const file of files) {
        const filePath = path.join(buildDir, file);
        const stat = await fs.stat(filePath);

        stats.totalFiles++;
        stats.totalSize += stat.size;

        const ext = path.extname(file).toLowerCase() || 'no-extension';
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;

        stats.largestFiles.push({ file, size: stat.size });
      }

      // Sort and keep top 10 largest files
      stats.largestFiles.sort((a, b) => b.size - a.size);
      stats.largestFiles = stats.largestFiles.slice(0, 10);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not analyze build directory: ${error.message}`));
    }

    return stats;
  }

  updateTestSummary(test) {
    if (test.status === 'PASS') {
      this.results.summary.passed++;
    } else if (test.status === 'WARNING') {
      this.results.summary.warnings++;
    } else {
      this.results.summary.failed++;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      buildTests: this.results.buildTests,
      analysis: this.analyzeResults(),
    };

    // Console summary
    console.log(chalk.blue('\n📊 Build Testing Summary:'));
    console.log(chalk.white(`Total tests: ${report.summary.totalTests}`));
    console.log(chalk.green(`Passed: ${report.summary.passed}`));
    console.log(chalk.yellow(`Warnings: ${report.summary.warnings}`));
    console.log(chalk.red(`Failed: ${report.summary.failed}`));
    console.log(chalk.white(`Build time: ${(report.summary.buildTime / 1000).toFixed(2)}s`));
    console.log(
      chalk.white(`Build size: ${(report.summary.buildSize / 1024 / 1024).toFixed(2)}MB`),
    );
    console.log(chalk.yellow(`Build warnings: ${report.summary.warnings}`));

    return report;
  }

  analyzeResults() {
    const analysis = {
      buildHealth: 'Excellent',
      criticalIssues: [],
      recommendations: [],
      performance: {},
    };

    // Determine build health
    if (this.results.summary.failed > 0) {
      analysis.buildHealth = 'Poor';
    } else if (this.results.summary.warnings > 2) {
      analysis.buildHealth = 'Fair';
    } else if (this.results.summary.warnings > 0) {
      analysis.buildHealth = 'Good';
    }

    // Identify critical issues
    this.results.buildTests.forEach((test) => {
      test.issues.forEach((issue) => {
        if (issue.severity === 'error') {
          analysis.criticalIssues.push({
            test: test.name,
            issue: issue.message,
          });
        }
      });
    });

    // Performance analysis
    analysis.performance = {
      buildTime: this.results.summary.buildTime,
      buildSize: this.results.summary.buildSize,
      buildSpeed:
        this.results.summary.buildTime < 15000
          ? 'Fast'
          : this.results.summary.buildTime < 30000
            ? 'Moderate'
            : 'Slow',
    };

    // Generate recommendations
    if (this.results.summary.buildTime > 30000) {
      analysis.recommendations.push(
        'Optimize build performance - consider reducing plugin usage or content size',
      );
    }

    if (this.results.summary.buildSize > 50 * 1024 * 1024) {
      analysis.recommendations.push('Consider optimizing assets and content to reduce build size');
    }

    const pluginTest = this.results.buildTests.find((t) => t.name === 'Plugin Functionality');
    if (pluginTest && pluginTest.metrics.failedPlugins > 0) {
      analysis.recommendations.push('Fix failed plugins to ensure full functionality');
    }

    if (analysis.criticalIssues.length > 0) {
      analysis.recommendations.push('Address critical build issues immediately');
    }

    return analysis;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `build-test-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new BuildTester();
  tester
    .runTests()
    .then((report) => {
      return tester.saveReport(report);
    })
    .then(() => {
      process.exit(tester.results.summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = BuildTester;
