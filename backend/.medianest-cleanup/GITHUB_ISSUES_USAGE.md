# GitHub Issues Creation Guide

## Overview

This guide walks you through converting the 31 identified TODO comments into GitHub issues using the automated script.

## Prerequisites

### 1. Install Dependencies

```bash
cd .medianest-cleanup/scripts
npm init -y
npm install @octokit/rest
```

### 2. Set Up GitHub Token

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token with `repo` permissions
3. Set environment variable:

```bash
export GITHUB_TOKEN="your_github_token_here"
export GITHUB_REPO="owner/repository-name"  # e.g., "yourorg/medianest"
```

## Usage

### Dry Run (Recommended First)

Test the script without creating actual issues:

```bash
node create-github-issues.js --dry-run
```

### Create All Issues

```bash
node create-github-issues.js
```

### Create Issues by Category

```bash
# Security issues only (most critical)
node create-github-issues.js --category=authentication-security

# Performance issues
node create-github-issues.js --category=performance-monitoring

# Notification system
node create-github-issues.js --category=notification-system

# Media management
node create-github-issues.js --category=media-management

# Administrative features
node create-github-issues.js --category=administrative

# Integration features
node create-github-issues.js --category=integration
```

## Issue Categories Summary

| Category             | Issues | Priority | Effort         |
| -------------------- | ------ | -------- | -------------- |
| **Security**         | 3      | Critical | 2-3 days       |
| **Performance**      | 6      | High     | 3-4 days       |
| **Notifications**    | 9      | High     | 5-6 days       |
| **Media Management** | 8      | High     | 6-8 days       |
| **Administrative**   | 3      | Medium   | 2-3 days       |
| **Integration**      | 2      | Medium   | 3-4 days       |
| **Total**            | **31** | Mixed    | **21-28 days** |

## Recommended Execution Order

### Phase 1: Critical Security (Week 1)

```bash
node create-github-issues.js --category=authentication-security
```

- Webhook signature verification
- Security audit database logging
- Essential security controls

### Phase 2: Core Functionality (Week 2-3)

```bash
node create-github-issues.js --category=media-management
node create-github-issues.js --category=performance-monitoring
```

- Media search and request system
- Database and Redis monitoring
- Core user features

### Phase 3: Enhanced Features (Week 4-5)

```bash
node create-github-issues.js --category=notification-system
node create-github-issues.js --category=administrative
```

- Notification persistence and management
- User and service administration
- System monitoring

### Phase 4: Integrations (Week 6)

```bash
node create-github-issues.js --category=integration
```

- Plex server integration
- YouTube download functionality
- External service connections

## Generated GitHub Issues

The script will create issues with:

- **Proper labeling** (priority, type, category)
- **Detailed descriptions** with context
- **Acceptance criteria** checklists
- **Technical implementation** guidance
- **File location** references
- **Milestone assignment** by category

## Milestones Created

The script automatically creates these milestones:

- Security & Authentication
- Performance & Monitoring
- Notification System
- Media Management
- Administrative Features
- External Integrations

## Labels Applied

Each issue gets labeled with:

- **Priority**: `priority-critical`, `priority-high`, `priority-medium`
- **Type**: `type-security`, `type-feature`, `type-enhancement`
- **Category**: `security`, `performance`, `notifications`, `media`, `admin`, `integration`
- **Source**: `todo-conversion`

## Issue Templates Structure

Each issue includes:

1. **Description** - Context and current state
2. **File Location** - Exact file and line number
3. **Acceptance Criteria** - Detailed checklist
4. **Technical Implementation** - Implementation guidance
5. **Additional Context** - Priority and effort estimates

## Rate Limiting

The script includes:

- 1-second delay between issue creation
- Error handling and retry logic
- Progress reporting and summaries

## Post-Creation Tasks

After creating issues:

1. **Review and Prioritize**: Adjust issue priorities in GitHub
2. **Assign Team Members**: Assign issues to developers
3. **Update Milestones**: Adjust milestone dates
4. **Create Project Boards**: Organize issues in GitHub projects
5. **Clean Up TODOs**: Remove resolved TODO comments (see cleanup section)

## Monitoring Progress

Track progress using:

- GitHub milestone progress bars
- Issue burndown charts
- Project board kanban views
- Automated progress reporting

## Troubleshooting

### Common Issues

- **Token permissions**: Ensure `repo` scope is enabled
- **Rate limiting**: Script handles this automatically
- **Repository format**: Use `owner/repo` format
- **File not found**: Ensure you're in the correct directory

### Validation

```bash
# Verify token works
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Test repository access
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/$GITHUB_REPO
```

## Success Metrics

The script provides detailed reporting on:

- Issues created successfully
- Failed issue creation (with reasons)
- Processing time and rate limits
- Summary by category and priority

---

_This guide ensures systematic conversion of TODOs to trackable GitHub issues for the MediaNest cleanup process._
