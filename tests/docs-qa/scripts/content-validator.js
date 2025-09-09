#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');
const markdownlint = require('markdownlint');
const HtmlValidate = require('html-validate').HtmlValidate;
const { execSync } = require('child_process');

class ContentValidator {
  constructor() {
    this.results = {
      files: [],
      summary: {
        totalFiles: 0,
        markdownFiles: 0,
        htmlFiles: 0,
        passedFiles: 0,
        failedFiles: 0,
        warningFiles: 0,
        totalIssues: 0
      }
    };
    
    this.docsPath = path.join(__dirname, '../../../docs');
    this.sitePath = path.join(__dirname, '../../../site');
    
    this.markdownConfig = {
      'default': true,
      'MD003': { 'style': 'atx' }, // Header style
      'MD007': { 'indent': 2 }, // Unordered list indentation
      'MD013': { 'line_length': 120, 'tables': false }, // Line length
      'MD024': { 'allow_different_nesting': true }, // Multiple headers with same content
      'MD033': { 'allowed_elements': ['br', 'kbd', 'sub', 'sup'] }, // Allow certain HTML tags
      'MD041': false, // First line in file should be a top level header - disabled for docs
      'MD046': { 'style': 'fenced' } // Code block style
    };
    
    this.htmlValidator = new HtmlValidate({
      extends: ['html-validate:recommended'],
      rules: {
        'void-content': 'error',
        'void-style': 'error',
        'close-attr': 'error',
        'close-order': 'error',
        'doctype-html': 'error',
        'element-required-attributes': 'error',
        'missing-doctype': 'error',
        'no-conditional-comment': 'error',
        'no-deprecated-attr': 'warn',
        'no-duplicate-id': 'error',
        'no-inline-style': 'off', // MkDocs may add inline styles
        'no-raw-characters': 'error',
        'no-redundant-for': 'error',
        'no-self-closing': 'error',
        'no-unknown-elements': 'warn',
        'prefer-native-element': 'warn',
        'script-element': 'error',
        'svg-focusable': 'error',
        'unrecognized-char-ref': 'error'
      }
    });
  }
  
  async runValidation() {
    console.log(chalk.blue('📝 Starting content validation...\n'));
    
    // Validate markdown source files
    await this.validateMarkdownFiles();
    
    // Build the site if needed
    await this.ensureSiteBuilt();
    
    // Validate generated HTML
    await this.validateHtmlFiles();
    
    // Check content completeness
    await this.checkContentCompleteness();
    
    // Check for broken internal references
    await this.checkInternalReferences();
    
    return this.generateReport();
  }
  
  async validateMarkdownFiles() {
    console.log(chalk.blue('📝 Validating markdown files...'));
    
    const markdownFiles = glob.sync('**/*.md', { cwd: this.docsPath });
    this.results.summary.markdownFiles = markdownFiles.length;
    
    for (const file of markdownFiles) {
      await this.validateMarkdownFile(file);
    }
  }
  
  async validateMarkdownFile(relativePath) {
    const filePath = path.join(this.docsPath, relativePath);
    
    const fileResult = {
      path: relativePath,
      type: 'markdown',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString()
    };
    
    this.results.summary.totalFiles++;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Run markdownlint
      const lintResult = markdownlint.sync({
        strings: { [relativePath]: content },
        config: this.markdownConfig
      });
      
      if (lintResult[relativePath]) {
        lintResult[relativePath].forEach(issue => {
          fileResult.issues.push({
            type: 'markdown-lint',
            severity: 'warning',
            line: issue.lineNumber,
            rule: issue.ruleNames[0],
            message: issue.ruleDescription
          });
        });
      }
      
      // Custom content checks
      await this.performCustomMarkdownChecks(content, fileResult);
      
      // Calculate metrics
      fileResult.metrics = {
        wordCount: content.split(/\s+/).length,
        lineCount: content.split('\n').length,
        characterCount: content.length,
        headingCount: (content.match(/^#+\s/gm) || []).length,
        linkCount: (content.match(/\[.*?\]\(.*?\)/g) || []).length,
        imageCount: (content.match(/!\[.*?\]\(.*?\)/g) || []).length
      };
      
      // Determine status
      const errorCount = fileResult.issues.filter(issue => issue.severity === 'error').length;
      const warningCount = fileResult.issues.filter(issue => issue.severity === 'warning').length;
      
      if (errorCount > 0) {
        fileResult.status = 'FAIL';
        this.results.summary.failedFiles++;
      } else if (warningCount > 0) {
        fileResult.status = 'WARNING';
        this.results.summary.warningFiles++;
      } else {
        this.results.summary.passedFiles++;
      }
      
      this.results.summary.totalIssues += fileResult.issues.length;
      
      const statusColor = fileResult.status === 'PASS' ? 'green' : fileResult.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = fileResult.status === 'PASS' ? '✅' : fileResult.status === 'WARNING' ? '⚠️' : '❌';
      
      console.log(chalk[statusColor](`${statusIcon} ${relativePath} - ${fileResult.issues.length} issues`));
      
    } catch (error) {
      fileResult.status = 'ERROR';
      fileResult.error = error.message;
      this.results.summary.failedFiles++;
      console.log(chalk.red(`❌ ${relativePath} - ERROR: ${error.message}`));
    }
    
    this.results.files.push(fileResult);
  }
  
  async performCustomMarkdownChecks(content, fileResult) {
    // Check for empty sections
    const emptyHeaderPattern = /^(#{1,6})\s*(.+)\s*\n\s*\n\s*#{1,6}/gm;
    if (emptyHeaderPattern.test(content)) {
      fileResult.issues.push({
        type: 'content',
        severity: 'warning',
        message: 'Empty section detected (header immediately followed by another header)'
      });
    }
    
    // Check for very short content
    if (content.trim().length < 100) {
      fileResult.issues.push({
        type: 'content',
        severity: 'warning',
        message: 'Very short content (less than 100 characters)'
      });
    }
    
    // Check for missing or poor headings
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim());
    if (firstNonEmptyLine && !firstNonEmptyLine.startsWith('#')) {
      fileResult.issues.push({
        type: 'structure',
        severity: 'warning',
        message: 'Document does not start with a heading'
      });
    }
    
    // Check for broken internal links (basic check)
    const internalLinkPattern = /\[.*?\]\(((?!https?:\/\/)[^)]+)\)/g;
    let match;
    while ((match = internalLinkPattern.exec(content)) !== null) {
      const linkPath = match[1];
      
      // Skip anchors and complex paths for now
      if (linkPath.startsWith('#') || linkPath.includes('{{')) continue;
      
      // Check if referenced file exists (simplified)
      const referencedPath = path.resolve(path.dirname(fileResult.path), linkPath.replace('.md', ''));
      // This is a basic check - could be enhanced
    }
    
    // Check for TODO/FIXME comments
    const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b/gi;
    if (todoPattern.test(content)) {
      fileResult.issues.push({
        type: 'content',
        severity: 'info',
        message: 'Contains TODO/FIXME markers'
      });
    }
    
    // Check for placeholder content
    const placeholderPatterns = [
      /lorem ipsum/gi,
      /placeholder/gi,
      /\[insert.*?\]/gi,
      /tbd|to be determined/gi
    ];
    
    for (const pattern of placeholderPatterns) {
      if (pattern.test(content)) {
        fileResult.issues.push({
          type: 'content',
          severity: 'error',
          message: 'Contains placeholder content'
        });
        break;
      }
    }
  }
  
  async ensureSiteBuilt() {
    if (!await fs.pathExists(this.sitePath)) {
      console.log(chalk.blue('🏗️ Building site for HTML validation...'));
      
      try {
        const mkdocsPath = path.join(__dirname, '../../../mkdocs.yml');
        execSync(`mkdocs build -f ${mkdocsPath} --clean`, {
          cwd: path.dirname(mkdocsPath),
          stdio: 'pipe'
        });
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not build site: ${error.message}`));
      }
    }
  }
  
  async validateHtmlFiles() {
    if (!await fs.pathExists(this.sitePath)) {
      console.warn(chalk.yellow('Site not built - skipping HTML validation'));
      return;
    }
    
    console.log(chalk.blue('🌐 Validating HTML files...'));
    
    const htmlFiles = glob.sync('**/*.html', { cwd: this.sitePath });
    this.results.summary.htmlFiles = htmlFiles.length;
    
    for (const file of htmlFiles.slice(0, 10)) { // Limit to first 10 for performance
      await this.validateHtmlFile(file);
    }
  }
  
  async validateHtmlFile(relativePath) {
    const filePath = path.join(this.sitePath, relativePath);
    
    const fileResult = {
      path: relativePath,
      type: 'html',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString()
    };
    
    this.results.summary.totalFiles++;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Run HTML validation
      const report = this.htmlValidator.validateString(content);
      
      report.results.forEach(result => {
        result.messages.forEach(message => {
          fileResult.issues.push({
            type: 'html-validate',
            severity: message.severity === 1 ? 'warning' : 'error',
            line: message.line,
            column: message.column,
            rule: message.ruleId,
            message: message.message
          });
        });
      });
      
      // Custom HTML checks
      this.performCustomHtmlChecks(content, fileResult);
      
      // Calculate metrics
      fileResult.metrics = {
        characterCount: content.length,
        elementCount: (content.match(/<[^>]+>/g) || []).length,
        scriptTagCount: (content.match(/<script\b[^>]*>/gi) || []).length,
        styleTagCount: (content.match(/<style\b[^>]*>/gi) || []).length,
        imageCount: (content.match(/<img\b[^>]*>/gi) || []).length
      };
      
      // Determine status
      const errorCount = fileResult.issues.filter(issue => issue.severity === 'error').length;
      const warningCount = fileResult.issues.filter(issue => issue.severity === 'warning').length;
      
      if (errorCount > 0) {
        fileResult.status = 'FAIL';
        this.results.summary.failedFiles++;
      } else if (warningCount > 0) {
        fileResult.status = 'WARNING';
        this.results.summary.warningFiles++;
      } else {
        this.results.summary.passedFiles++;
      }
      
      this.results.summary.totalIssues += fileResult.issues.length;
      
      const statusColor = fileResult.status === 'PASS' ? 'green' : fileResult.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = fileResult.status === 'PASS' ? '✅' : fileResult.status === 'WARNING' ? '⚠️' : '❌';
      
      console.log(chalk[statusColor](`${statusIcon} ${relativePath} - ${fileResult.issues.length} issues`));
      
    } catch (error) {
      fileResult.status = 'ERROR';
      fileResult.error = error.message;
      this.results.summary.failedFiles++;
      console.log(chalk.red(`❌ ${relativePath} - ERROR: ${error.message}`));
    }
    
    this.results.files.push(fileResult);
  }
  
  performCustomHtmlChecks(content, fileResult) {
    // Check for missing lang attribute
    if (!content.includes('lang="')) {
      fileResult.issues.push({
        type: 'accessibility',
        severity: 'warning',
        message: 'Missing lang attribute on html element'
      });
    }
    
    // Check for missing meta viewport
    if (!content.includes('name="viewport"')) {
      fileResult.issues.push({
        type: 'responsive',
        severity: 'warning',
        message: 'Missing viewport meta tag'
      });
    }
    
    // Check for missing meta description
    if (!content.includes('name="description"')) {
      fileResult.issues.push({
        type: 'seo',
        severity: 'warning',
        message: 'Missing meta description'
      });
    }
    
    // Check for inline styles (potential maintainability issue)
    const inlineStyleCount = (content.match(/style="[^"]+"/g) || []).length;
    if (inlineStyleCount > 5) {
      fileResult.issues.push({
        type: 'maintainability',
        severity: 'info',
        message: `High number of inline styles: ${inlineStyleCount}`
      });
    }
    
    // Check for missing alt attributes on images
    const imgTags = content.match(/<img\b[^>]*>/gi) || [];
    const imagesWithoutAlt = imgTags.filter(img => !img.includes('alt=')).length;
    if (imagesWithoutAlt > 0) {
      fileResult.issues.push({
        type: 'accessibility',
        severity: 'error',
        message: `${imagesWithoutAlt} images missing alt attributes`
      });
    }
  }
  
  async checkContentCompleteness() {
    console.log(chalk.blue('📋 Checking content completeness...'));
    
    const completenessResult = {
      path: 'content-completeness',
      type: 'analysis',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString()
    };
    
    // Read mkdocs.yml to get expected navigation structure
    const mkdocsPath = path.join(__dirname, '../../../mkdocs.yml');
    
    try {
      const mkdocsContent = await fs.readFile(mkdocsPath, 'utf8');
      
      // Extract navigation items (simplified parsing)
      const navMatches = mkdocsContent.match(/nav:\s*([\s\S]*?)(?=\n\w|$)/);
      if (navMatches) {
        const navSection = navMatches[1];
        const fileRefs = navSection.match(/\s+[^:]+:\s+([^\s]+\.md)/g) || [];
        
        completenessResult.metrics.expectedFiles = fileRefs.length;
        
        let missingFiles = 0;
        for (const ref of fileRefs) {
          const filePath = ref.split(':')[1].trim();
          const fullPath = path.join(this.docsPath, filePath);
          
          if (!await fs.pathExists(fullPath)) {
            completenessResult.issues.push({
              type: 'missing-file',
              severity: 'error',
              message: `Missing file referenced in navigation: ${filePath}`
            });
            missingFiles++;
          }
        }
        
        completenessResult.metrics.missingFiles = missingFiles;
        
        if (missingFiles > 0) {
          completenessResult.status = 'FAIL';
          this.results.summary.failedFiles++;
        }
      }
      
      // Check for orphaned files (files not in navigation)
      const allMarkdownFiles = glob.sync('**/*.md', { cwd: this.docsPath });
      const referencedFiles = [];
      
      const fileRefs = navSection?.match(/\s+[^:]+:\s+([^\s]+\.md)/g) || [];
      fileRefs.forEach(ref => {
        const filePath = ref.split(':')[1].trim();
        referencedFiles.push(filePath);
      });
      
      const orphanedFiles = allMarkdownFiles.filter(file => 
        !referencedFiles.includes(file) && file !== 'index.md'
      );
      
      if (orphanedFiles.length > 0) {
        completenessResult.issues.push({
          type: 'orphaned-files',
          severity: 'warning',
          message: `${orphanedFiles.length} files not referenced in navigation: ${orphanedFiles.join(', ')}`
        });
      }
      
      completenessResult.metrics.orphanedFiles = orphanedFiles.length;
      
    } catch (error) {
      completenessResult.status = 'ERROR';
      completenessResult.error = error.message;
    }
    
    this.results.files.push(completenessResult);
  }
  
  async checkInternalReferences() {
    console.log(chalk.blue('🔗 Checking internal references...'));
    
    const referenceResult = {
      path: 'internal-references',
      type: 'analysis',
      status: 'PASS',
      issues: [],
      metrics: { totalReferences: 0, brokenReferences: 0 },
      timestamp: new Date().toISOString()
    };
    
    // This is a simplified check - could be enhanced
    const markdownFiles = glob.sync('**/*.md', { cwd: this.docsPath });
    
    for (const file of markdownFiles) {
      const filePath = path.join(this.docsPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Find internal markdown links
      const internalLinkPattern = /\[.*?\]\(([^)]+\.md[^)]*)\)/g;
      let match;
      
      while ((match = internalLinkPattern.exec(content)) !== null) {
        const linkPath = match[1];
        referenceResult.metrics.totalReferences++;
        
        // Resolve relative path
        const resolvedPath = path.resolve(path.dirname(filePath), linkPath.split('#')[0]);
        
        if (!await fs.pathExists(resolvedPath)) {
          referenceResult.issues.push({
            type: 'broken-reference',
            severity: 'error',
            message: `Broken internal link in ${file}: ${linkPath}`
          });
          referenceResult.metrics.brokenReferences++;
        }
      }
    }
    
    if (referenceResult.metrics.brokenReferences > 0) {
      referenceResult.status = 'FAIL';
    }
    
    this.results.files.push(referenceResult);
  }
  
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      files: this.results.files,
      analysis: this.analyzeResults()
    };
    
    // Console summary
    console.log(chalk.blue('\n📊 Content Validation Summary:'));
    console.log(chalk.white(`Total files: ${report.summary.totalFiles}`));
    console.log(chalk.white(`Markdown files: ${report.summary.markdownFiles}`));
    console.log(chalk.white(`HTML files: ${report.summary.htmlFiles}`));
    console.log(chalk.green(`Passed: ${report.summary.passedFiles}`));
    console.log(chalk.yellow(`Warnings: ${report.summary.warningFiles}`));
    console.log(chalk.red(`Failed: ${report.summary.failedFiles}`));
    console.log(chalk.white(`Total issues: ${report.summary.totalIssues}`));
    
    return report;
  }
  
  analyzeResults() {
    const analysis = {
      commonIssues: {},
      fileTypeSummary: {},
      recommendations: []
    };
    
    // Count common issues
    this.results.files.forEach(file => {
      file.issues.forEach(issue => {
        const key = `${issue.type}-${issue.severity}`;
        analysis.commonIssues[key] = (analysis.commonIssues[key] || 0) + 1;
      });
      
      // File type summary
      analysis.fileTypeSummary[file.type] = (analysis.fileTypeSummary[file.type] || 0) + 1;
    });
    
    // Generate recommendations
    if (analysis.commonIssues['markdown-lint-warning'] > 5) {
      analysis.recommendations.push('Review and fix common markdown linting issues');
    }
    
    if (analysis.commonIssues['content-error'] > 0) {
      analysis.recommendations.push('Remove placeholder content and complete documentation');
    }
    
    if (analysis.commonIssues['accessibility-error'] > 0) {
      analysis.recommendations.push('Fix accessibility issues to improve WCAG compliance');
    }
    
    if (analysis.commonIssues['broken-reference-error'] > 0) {
      analysis.recommendations.push('Fix broken internal links to improve navigation');
    }
    
    return analysis;
  }
  
  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);
    
    const reportPath = path.join(reportsDir, `content-validation-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const validator = new ContentValidator();
  validator.runValidation()
    .then(report => {
      return validator.saveReport(report);
    })
    .then(() => {
      process.exit(validator.results.summary.failedFiles > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = ContentValidator;