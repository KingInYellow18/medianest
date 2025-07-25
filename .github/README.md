# GitHub Workflow Automation Documentation

This directory contains GitHub Actions workflows and configuration for automated PR management, multi-reviewer coordination, and quality assurance for the MediaNest project.

## 🚀 Overview

The GitHub automation system provides:

- **Pull Request Management**: Automated review assignment, status tracking, and merge coordination
- **Quality Gates**: Automated linting, type checking, testing, and security scanning
- **Branch Protection**: Enforced rules for main and develop branches
- **Issue Triage**: Automated labeling, assignment, and lifecycle management
- **CI/CD Pipeline**: Automated testing, building, and deployment

## 📁 Files Structure

```
.github/
├── workflows/
│   ├── pr-manager.yml           # Main PR management and review coordination
│   ├── branch-protection.yml    # Branch protection and rules enforcement
│   ├── auto-labeler.yml         # Automatic labeling and issue triage
│   ├── ci-cd.yml               # Complete CI/CD pipeline
│   └── issue-triage.yml        # Advanced issue management
├── ISSUE_TEMPLATE/
│   ├── bug_report.md           # Bug report template
│   ├── feature_request.md      # Feature request template
│   └── question.md             # Question template
├── PULL_REQUEST_TEMPLATE.md    # Pull request template
├── CODEOWNERS                  # Code ownership rules
├── branch-protection-config.json # Branch protection settings
└── README.md                   # This documentation
```

## 🔧 Workflow Details

### 1. PR Manager (`pr-manager.yml`)

**Triggers**: PR opened/reopened/synchronized, PR reviews, issue comments

**Features**:
- Automatic reviewer assignment based on file changes
- Quality checks (linting, type checking, testing)
- Review coordination and status tracking
- Auto-merge capability for approved PRs with `auto-merge` label

**Jobs**:
- `setup-reviewers`: Assigns appropriate reviewers based on changed files
- `quality-checks`: Runs linting, type checking, and tests
- `review-coordination`: Updates PR status and manages merge-ready state
- `auto-merge`: Automatically merges PRs when conditions are met

### 2. Branch Protection (`branch-protection.yml`)

**Triggers**: Push to main/develop, PRs to main/develop, weekly schedule

**Features**:
- Conventional commit message validation
- Direct push prevention to main branch
- PR requirement validation
- Security and dependency scanning

**Jobs**:
- `enforce-branch-rules`: Validates commits and PR requirements
- `security-scan`: Trivy vulnerability scanning and secret detection
- `dependency-review`: Reviews new dependencies for security issues
- `branch-protection-status`: Generates protection status reports

### 3. Auto Labeler (`auto-labeler.yml`)

**Triggers**: PR opened/synchronized, issues opened/edited, issue comments

**Features**:
- Automatic PR labeling based on file changes and title
- Issue triage and priority assignment
- Stale issue/PR management
- Comment command processing (`/approve`, `/merge`, `/label`, `/assign`)

**Jobs**:
- `auto-label-pr`: Labels PRs based on changes and type
- `auto-triage-issues`: Automatically triages and labels new issues
- `manage-stale-items`: Marks and closes stale issues/PRs
- `comment-commands`: Processes slash commands in comments

### 4. CI/CD Pipeline (`ci-cd.yml`)

**Triggers**: Push to main/develop, PRs, manual workflow dispatch

**Features**:
- Comprehensive testing for backend and frontend
- Docker image building and publishing
- Automated deployment to staging and production
- Security scanning and dependency auditing

**Jobs**:
- `setup`: Detects changes and determines deployment needs
- `test-backend`: Complete backend testing with database
- `test-frontend`: Frontend testing and building
- `security-scan`: Security vulnerability scanning
- `build-images`: Docker image building and publishing
- `deploy-staging`: Staging environment deployment
- `deploy-production`: Production deployment with release creation

### 5. Issue Triage (`issue-triage.yml`)

**Triggers**: Issues opened/edited/labeled, issue comments, weekly schedule

**Features**:
- Advanced issue analysis and auto-assignment
- Template compliance validation
- Issue lifecycle management
- Weekly reporting
- Automatic closure of resolved issues

**Jobs**:
- `auto-triage`: Intelligent issue analysis and assignment
- `validate-issue`: Template compliance checking
- `manage-issue-lifecycle`: Status updates based on activity
- `weekly-issue-report`: Automated weekly issue statistics
- `close-resolved-issues`: Auto-close based on resolution keywords

## 🏷️ Label System

### Priority Labels
- `priority/low` - Minor issues, nice-to-have features
- `priority/medium` - Standard features and fixes
- `priority/high` - Critical issues, security vulnerabilities

### Component Labels
- `backend` - Backend API changes
- `frontend` - Frontend UI changes
- `shared` - Shared code changes
- `infrastructure` - DevOps/infrastructure changes
- `documentation` - Documentation updates

### Type Labels
- `bug` - Bug fixes
- `enhancement` - New features
- `refactor` - Code refactoring
- `tests` - Test improvements
- `performance` - Performance improvements
- `security` - Security-related changes

### Size Labels
- `size/XS` - < 10 lines changed
- `size/S` - 10-30 lines changed
- `size/M` - 30-100 lines changed
- `size/L` - 100-500 lines changed
- `size/XL` - > 500 lines changed

### Status Labels
- `needs-review` - Waiting for review
- `needs-info` - Needs more information
- `ready-to-merge` - Approved and ready for merge
- `work-in-progress` - Still being worked on
- `stale` - No recent activity

## 🛡️ Branch Protection Rules

### Main Branch (`main`)
- **Required Status Checks**: All CI/CD jobs must pass
- **Required Reviews**: 2 approving reviews required
- **Code Owner Reviews**: Required
- **Dismiss Stale Reviews**: Enabled
- **Require Last Push Approval**: Enabled
- **Conversation Resolution**: Required
- **Force Push**: Disabled
- **Deletions**: Disabled

### Develop Branch (`develop`)
- **Required Status Checks**: Core tests must pass
- **Required Reviews**: 1 approving review required
- **Code Owner Reviews**: Not required
- **Dismiss Stale Reviews**: Enabled
- **Conversation Resolution**: Required
- **Force Push**: Disabled
- **Deletions**: Disabled

## 👥 Code Ownership

The `CODEOWNERS` file defines review requirements:

- **Global**: @KingInYellow18 (fallback owner)
- **Backend**: @backend-team, specific teams for different areas
- **Frontend**: @frontend-team, @ui-team for components
- **Shared**: Both backend and frontend teams
- **Infrastructure**: @devops-team
- **Security**: @security-team for sensitive files
- **Documentation**: @docs-team

## 🚀 Getting Started

### For Contributors

1. **Create PRs**: Use the PR template and ensure good descriptions
2. **Follow Conventions**: Use conventional commit messages
3. **Wait for Reviews**: PRs require appropriate approvals
4. **Address Feedback**: Respond to review comments promptly
5. **Use Labels**: Apply appropriate labels to issues and PRs

### For Maintainers

1. **Set Up Teams**: Create GitHub teams matching CODEOWNERS
2. **Configure Secrets**: Add required secrets for deployment
3. **Enable Branch Protection**: Apply rules from `branch-protection-config.json`
4. **Review Settings**: Adjust workflow parameters as needed

### Comment Commands

Available for maintainers and collaborators:

- `/approve` - Approve the PR
- `/merge` - Merge the PR (if ready)
- `/label type/bug, priority/high` - Add labels
- `/assign username` - Assign to user

## 🔧 Configuration

### Environment Variables

The workflows support these environment variables:

- `NODE_VERSION`: Node.js version (default: 18)
- `REGISTRY`: Container registry (default: ghcr.io)
- `IMAGE_NAME`: Container image name

### Secrets Required

- `GITHUB_TOKEN`: Automatically provided
- Additional secrets for deployment (configure as needed)

### Customization

To customize the automation:

1. **Modify Workflows**: Edit YAML files in `.github/workflows/`
2. **Update Labels**: Change label schemes in `auto-labeler.yml`
3. **Adjust Protection**: Modify `branch-protection-config.json`
4. **Change Owners**: Update `.github/CODEOWNERS`

## 📊 Monitoring

The automation provides:

- **PR Status Comments**: Real-time status updates
- **Weekly Reports**: Issue and PR statistics
- **Security Scanning**: Vulnerability reports
- **Quality Gates**: Test and lint results

## 🆘 Troubleshooting

### Common Issues

1. **Tests Failing**: Check test logs in workflow runs
2. **Reviews Not Assigned**: Verify team membership and CODEOWNERS
3. **Auto-merge Not Working**: Ensure all conditions are met
4. **Labels Not Applied**: Check trigger conditions and permissions

### Debug Steps

1. Check workflow run logs in GitHub Actions
2. Verify repository settings and permissions
3. Ensure teams and users exist
4. Validate YAML syntax

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Code Owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Note**: This automation system is production-ready but may require customization based on your specific team structure and requirements. Update team names, usernames, and deployment configurations as needed.