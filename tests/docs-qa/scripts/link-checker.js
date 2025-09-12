#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const markdownLinkCheck = require('markdown-link-check');
const chalk = require('chalk');
const { execSync } = require('child_process');

class LinkChecker {
  constructor() {
    this.results = {
      totalFiles: 0,
      totalLinks: 0,
      brokenLinks: [],
      warnings: [],
      passed: 0,
      failed: 0,
    };

    this.config = {
      timeout: 30000,
      retryOn429: true,
      retryCount: 3,
      ignorePatterns: [
        /localhost/,
        /127\.0\.0\.1/,
        /example\.com/,
        /placeholder\./,
        /{{.*}}/, // Template variables
        /#$/, // Empty fragments
      ],
      allowedStatusCodes: [200, 301, 302, 403, 429], // 403 for rate-limited APIs
      baseUrl: 'https://docs.medianest.com',
    };
  }

  async checkMarkdownFiles() {
    console.log(chalk.blue('🔗 Starting comprehensive link validation...\n'));

    const docsPath = path.join(__dirname, '../../../docs');
    const markdownFiles = glob.sync('**/*.md', { cwd: docsPath });

    this.results.totalFiles = markdownFiles.length;

    for (const file of markdownFiles) {
      await this.checkFile(path.join(docsPath, file), file);
    }

    // Check MkDocs configuration links
    await this.checkMkDocsConfig();

    return this.generateReport();
  }

  async checkFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      return new Promise((resolve) => {
        markdownLinkCheck(
          content,
          {
            baseUrl: this.config.baseUrl,
            timeout: this.config.timeout,
            retryOn429: this.config.retryOn429,
            retryCount: this.config.retryCount,
            ignorePatterns: this.config.ignorePatterns,
          },
          (err, results) => {
            if (err) {
              console.error(chalk.red(`❌ Error checking ${relativePath}: ${err.message}`));
              this.results.failed++;
              resolve();
              return;
            }

            this.processFileResults(results, relativePath);
            resolve();
          },
        );
      });
    } catch (error) {
      console.error(chalk.red(`❌ Error reading file ${relativePath}: ${error.message}`));
      this.results.failed++;
    }
  }

  processFileResults(results, filePath) {
    let fileBrokenCount = 0;

    results.forEach((result) => {
      this.results.totalLinks++;

      if (result.status === 'dead') {
        fileBrokenCount++;
        this.results.brokenLinks.push({
          file: filePath,
          link: result.link,
          statusCode: result.statusCode,
          error: result.err,
        });
      } else if (result.status === 'error') {
        this.results.warnings.push({
          file: filePath,
          link: result.link,
          error: result.err,
        });
      } else {
        this.results.passed++;
      }
    });

    if (fileBrokenCount === 0) {
      console.log(chalk.green(`✅ ${filePath} - All ${results.length} links valid`));
    } else {
      console.log(chalk.red(`❌ ${filePath} - ${fileBrokenCount}/${results.length} links broken`));
      this.results.failed++;
    }
  }

  async checkMkDocsConfig() {
    console.log(chalk.blue('\n🔧 Checking MkDocs configuration...'));

    try {
      const configPath = path.join(__dirname, '../../../mkdocs.yml');
      const config = await fs.readFile(configPath, 'utf8');

      // Extract navigation structure and validate file references
      const navMatches = config.match(/nav:\s*([\s\S]*?)(?=\n\w|$)/);
      if (navMatches) {
        const navSection = navMatches[1];
        const fileRefs = navSection.match(/\s+[^:]+:\s+([^\s]+\.md)/g);

        if (fileRefs) {
          for (const ref of fileRefs) {
            const filePath = ref.split(':')[1].trim();
            const fullPath = path.join(__dirname, '../../../docs', filePath);

            if (!(await fs.pathExists(fullPath))) {
              this.results.brokenLinks.push({
                file: 'mkdocs.yml',
                link: filePath,
                statusCode: 404,
                error: 'Referenced file does not exist',
              });
            }
          }
        }
      }

      // Check external URLs in config
      const urlMatches = config.match(/https?:\/\/[^\s"']+/g);
      if (urlMatches) {
        console.log(chalk.blue(`Found ${urlMatches.length} external URLs in config`));
        // Note: Could implement URL checking here if needed
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error checking MkDocs config: ${error.message}`));
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.results.totalFiles,
        totalLinks: this.results.totalLinks,
        brokenLinksCount: this.results.brokenLinks.length,
        warningsCount: this.results.warnings.length,
        passRate: ((this.results.passed / this.results.totalLinks) * 100).toFixed(2) + '%',
      },
      brokenLinks: this.results.brokenLinks,
      warnings: this.results.warnings,
      status: this.results.brokenLinks.length === 0 ? 'PASS' : 'FAIL',
    };

    // Console output
    console.log(chalk.blue('\n📊 Link Check Summary:'));
    console.log(chalk.white(`Files checked: ${report.summary.totalFiles}`));
    console.log(chalk.white(`Total links: ${report.summary.totalLinks}`));
    console.log(chalk.white(`Pass rate: ${report.summary.passRate}`));

    if (report.summary.brokenLinksCount > 0) {
      console.log(chalk.red(`\n❌ ${report.summary.brokenLinksCount} broken links found:`));
      this.results.brokenLinks.forEach((link) => {
        console.log(chalk.red(`   ${link.file}: ${link.link} (${link.statusCode || 'N/A'})`));
      });
    } else {
      console.log(chalk.green('\n✅ All links are valid!'));
    }

    if (report.summary.warningsCount > 0) {
      console.log(chalk.yellow(`\n⚠️  ${report.summary.warningsCount} warnings:`));
      this.results.warnings.forEach((warning) => {
        console.log(chalk.yellow(`   ${warning.file}: ${warning.link}`));
      });
    }

    return report;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `link-check-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new LinkChecker();
  checker
    .checkMarkdownFiles()
    .then((report) => {
      return checker.saveReport(report);
    })
    .then(() => {
      process.exit(checker.results.brokenLinks.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = LinkChecker;
