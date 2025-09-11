#!/usr/bin/env node

/**
 * GitHub Issues Creation Script
 * Automatically creates GitHub issues from MediaNest TODO analysis
 *
 * Usage: node create-github-issues.js [--dry-run] [--category=<category>]
 *
 * Environment Variables:
 * - GITHUB_TOKEN: Personal access token with repo permissions
 * - GITHUB_REPO: Repository in format 'owner/repo'
 * - GITHUB_API_URL: GitHub API URL (defaults to api.github.com)
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  token: process.env.GITHUB_TOKEN,
  repo: process.env.GITHUB_REPO || 'your-org/medianest',
  apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  dryRun: process.argv.includes('--dry-run'),
  category: process.argv.find((arg) => arg.startsWith('--category='))?.split('=')[1],
  templatesDir: path.join(__dirname, '../github-issue-templates'),
};

// Validate required configuration
if (!config.token && !config.dryRun) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: config.token,
  baseUrl: config.apiUrl,
});

// Issue templates mapping
const issueTemplates = {
  'authentication-security': {
    file: 'authentication-security.md',
    label: 'security',
    milestone: 'Security & Authentication',
    assignee: null,
  },
  'performance-monitoring': {
    file: 'performance-monitoring.md',
    label: 'performance',
    milestone: 'Performance & Monitoring',
    assignee: null,
  },
  'notification-system': {
    file: 'notification-system.md',
    label: 'notifications',
    milestone: 'Notification System',
    assignee: null,
  },
  'media-management': {
    file: 'media-management.md',
    label: 'media',
    milestone: 'Media Management',
    assignee: null,
  },
  administrative: {
    file: 'administrative.md',
    label: 'admin',
    milestone: 'Administrative Features',
    assignee: null,
  },
  integration: {
    file: 'integration.md',
    label: 'integration',
    milestone: 'External Integrations',
    assignee: null,
  },
};

/**
 * Parse issue templates and extract individual issues
 */
async function parseIssueTemplate(templatePath) {
  const content = await fs.readFile(templatePath, 'utf-8');
  const issues = [];

  // Split by issue headers (## Issue N:)
  const issueBlocks = content.split(/^## Issue \d+:/gm).slice(1);

  issueBlocks.forEach((block, index) => {
    const lines = block.trim().split('\n');
    const titleLine = lines[0]?.trim();

    if (!titleLine) return;

    // Extract metadata
    const title = titleLine;
    let file = '';
    let type = 'enhancement';
    let priority = 'medium';
    let labels = [];

    // Parse metadata from the block
    const metadataRegex = /\*\*(File|Type|Priority|Labels)\*\*:\s*(.+)/g;
    let match;

    while ((match = metadataRegex.exec(block)) !== null) {
      const [, key, value] = match;
      switch (key.toLowerCase()) {
        case 'file':
          file = value.replace(/`/g, '');
          break;
        case 'type':
          type = value;
          break;
        case 'priority':
          priority = value;
          break;
        case 'labels':
          labels = value.split(', ').map((l) => l.trim());
          break;
      }
    }

    // Extract description (everything after the metadata until acceptance criteria)
    const descriptionMatch = block.match(
      /### Description\s*([\s\S]*?)(?=### Acceptance Criteria|$)/,
    );
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Extract acceptance criteria
    const criteriaMatch = block.match(/### Acceptance Criteria\s*([\s\S]*?)(?=###|$)/);
    const acceptanceCriteria = criteriaMatch ? criteriaMatch[1].trim() : '';

    issues.push({
      title,
      file,
      type,
      priority,
      labels,
      description,
      acceptanceCriteria,
      body: block,
    });
  });

  return issues;
}

/**
 * Create a GitHub issue
 */
async function createGitHubIssue(issue, templateConfig) {
  const [owner, repo] = config.repo.split('/');

  // Prepare labels
  const allLabels = [
    templateConfig.label,
    `priority-${issue.priority}`,
    `type-${issue.type}`,
    ...issue.labels,
    'todo-conversion',
  ].filter(Boolean);

  // Prepare issue body
  const body = `${issue.description}

## File Location
${issue.file ? `\`${issue.file}\`` : 'Multiple files'}

## Acceptance Criteria
${issue.acceptanceCriteria}

## Additional Context
This issue was automatically generated from TODO comments in the codebase as part of the MediaNest cleanup process.

**Original TODO Location**: ${issue.file}  
**Priority**: ${issue.priority}  
**Type**: ${issue.type}  

---
*Auto-generated from TODO analysis - Phase 3 Cleanup*`;

  const issueData = {
    owner,
    repo,
    title: issue.title,
    body,
    labels: allLabels,
    assignees: templateConfig.assignee ? [templateConfig.assignee] : [],
  };

  if (config.dryRun) {
    console.log(`🔍 [DRY RUN] Would create issue:`, {
      title: issueData.title,
      labels: issueData.labels,
      file: issue.file,
    });
    return { html_url: 'dry-run', number: Math.floor(Math.random() * 1000) };
  }

  try {
    const response = await octokit.rest.issues.create(issueData);
    console.log(`✅ Created issue #${response.data.number}: ${issue.title}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create issue: ${issue.title}`, error.message);
    throw error;
  }
}

/**
 * Create milestone if it doesn't exist
 */
async function ensureMilestone(milestoneTitle, description) {
  if (config.dryRun) {
    console.log(`🔍 [DRY RUN] Would ensure milestone: ${milestoneTitle}`);
    return;
  }

  const [owner, repo] = config.repo.split('/');

  try {
    // Check if milestone exists
    const milestones = await octokit.rest.issues.listMilestones({ owner, repo });
    const existing = milestones.data.find((m) => m.title === milestoneTitle);

    if (existing) {
      console.log(`📋 Milestone exists: ${milestoneTitle}`);
      return existing;
    }

    // Create milestone
    const response = await octokit.rest.issues.createMilestone({
      owner,
      repo,
      title: milestoneTitle,
      description: description || `Issues related to ${milestoneTitle}`,
    });

    console.log(`📋 Created milestone: ${milestoneTitle}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create milestone: ${milestoneTitle}`, error.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting GitHub Issues Creation from TODO Analysis');
  console.log(`📁 Repository: ${config.repo}`);
  console.log(`🏃 Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);

  if (config.category) {
    console.log(`🎯 Category Filter: ${config.category}`);
  }

  const results = {
    created: [],
    failed: [],
    skipped: [],
  };

  // Process each template category
  for (const [categoryName, templateConfig] of Object.entries(issueTemplates)) {
    // Skip if category filter is specified and doesn't match
    if (config.category && config.category !== categoryName) {
      console.log(`⏭️  Skipping category: ${categoryName}`);
      continue;
    }

    console.log(`\n📂 Processing category: ${categoryName}`);

    try {
      // Ensure milestone exists
      await ensureMilestone(templateConfig.milestone);

      // Parse template file
      const templatePath = path.join(config.templatesDir, templateConfig.file);
      const issues = await parseIssueTemplate(templatePath);

      console.log(`📝 Found ${issues.length} issues in ${categoryName}`);

      // Create issues
      for (const issue of issues) {
        try {
          const createdIssue = await createGitHubIssue(issue, templateConfig);
          results.created.push({
            category: categoryName,
            issue: createdIssue,
            title: issue.title,
          });

          // Rate limiting - wait between requests
          if (!config.dryRun) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          results.failed.push({
            category: categoryName,
            title: issue.title,
            error: error.message,
          });
        }
      }
    } catch (error) {
      console.error(`❌ Failed to process category ${categoryName}:`, error.message);
      results.failed.push({
        category: categoryName,
        error: error.message,
      });
    }
  }

  // Print summary
  console.log('\n📊 Issue Creation Summary:');
  console.log(`✅ Created: ${results.created.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);

  if (results.created.length > 0) {
    console.log('\n🎯 Created Issues:');
    results.created.forEach((r) => {
      console.log(`  - ${r.title} (${r.category})`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Issues:');
    results.failed.forEach((r) => {
      console.log(`  - ${r.title || r.category}: ${r.error}`);
    });
  }

  // Generate summary report
  const reportPath = path.join(__dirname, '../issue-creation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Detailed report saved: ${reportPath}`);

  console.log('\n✨ Issue creation process completed!');

  if (config.dryRun) {
    console.log('\n💡 This was a dry run. To create issues for real, run without --dry-run flag');
    console.log('💡 Make sure to set GITHUB_TOKEN environment variable');
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  createGitHubIssue,
  parseIssueTemplate,
  config,
};
