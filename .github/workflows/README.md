# GitHub Actions Workflows - Sync Coordinator System

This directory contains the comprehensive GitHub Actions workflow automation system for MediaNest, implementing the **sync-coordinator** mode for multi-package synchronization and version alignment.

## Workflow Overview

### 1. Multi-Package Sync Coordinator (`sync-coordinator.yml`)

**Purpose**: Orchestrates synchronization and version alignment across multiple packages (backend, frontend, shared).

**Triggers**:
- Push to main branches: `main`, `development`, `test`, `claude-flow`
- Pull requests to main branches
- Daily scheduled runs (2 AM UTC)
- Manual workflow dispatch with options

**Key Features**:
- **Change Detection**: Automatically detects which packages have changed
- **Version Alignment**: Ensures package versions are properly aligned
- **Dependency Sync**: Synchronizes dependencies across packages
- **Quality Gates**: Runs comprehensive testing and validation
- **Cross-Package Integration**: Validates package interdependencies

**Jobs**:
1. `detect-changes` - Identifies modified packages using path filters
2. `version-alignment` - Checks and aligns package versions
3. `dependency-sync` - Synchronizes and updates dependencies
4. `quality-gates` - Runs tests, linting, and builds
5. `cross-package-integration` - Validates package relationships
6. `notify-completion` - Provides workflow status summary

### 2. Branch Protection & Quality Gates (`branch-protection.yml`)

**Purpose**: Enforces branch protection rules and quality standards.

**Triggers**:
- Pull requests to protected branches
- Push events to protected branches

**Key Features**:
- **Security Scanning**: Automated vulnerability and secret detection
- **Code Quality Assessment**: TypeScript compilation, linting, testing
- **Integration Testing**: Cross-package validation
- **Branch Policy Enforcement**: Naming conventions and PR requirements
- **Deployment Readiness**: Pre-deployment validation checks

**Jobs**:
1. `security-scan` - Scans for sensitive files and hardcoded secrets
2. `code-quality` - Runs quality checks per package
3. `integration-tests` - Cross-package integration validation
4. `branch-policy-enforcement` - Enforces naming and PR conventions
5. `deployment-readiness` - Validates deployment prerequisites
6. `status-check` - Final status evaluation and reporting

### 3. Deployment Pipeline (`deployment.yml`)

**Purpose**: Manages deployments to different environments based on branch strategy.

**Triggers**:
- Push to deployment branches: `main`, `development`, `test`
- Manual workflow dispatch with environment selection

**Environment Mapping**:
- `main` → `production`
- `development` → `staging`
- `test` → `test`

**Key Features**:
- **Multi-Stage Deployment**: Build → Test → Deploy pipeline
- **Environment-Specific Configuration**: Tailored settings per environment
- **Docker Image Building**: Containerized deployment strategy
- **Health Checks**: Post-deployment validation
- **Rollback Capability**: Built-in rollback mechanisms

**Jobs**:
1. `determine-environment` - Maps branch to target environment
2. `build-and-test` - Builds and tests all packages
3. `docker-build` - Creates container images for services
4. `deploy` - Deploys to target environment
5. `notify` - Sends deployment status notifications

### 4. Existing Branch Protection (`branch-protection.yml`)

**Purpose**: Legacy branch protection with conventional commit enforcement.

**Key Features**:
- Conventional commit message validation
- Direct push prevention to main
- PR requirement validation
- Security and dependency scanning
- Automated status reporting

## Configuration Files

### CODEOWNERS

Defines code ownership and review requirements:
- **Global owners**: `@maintainers`
- **Package-specific teams**: `@backend-team`, `@frontend-team`
- **Specialized reviews**: `@security-team`, `@devops-team`
- **Documentation**: `@documentation-team`

## Workflow Configuration

### Environment Variables

```yaml
NODE_VERSION: '18'
CACHE_KEY_SUFFIX: v1
DOCKER_REGISTRY: ghcr.io
IMAGE_NAME: medianest
```

### Secrets Required

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- Additional secrets may be required for specific deployments

### Branch Strategy Integration

The workflows implement the 4-branch MediaNest strategy:

```
main (production) ← development (staging) ← test ← feature branches
                 ← claude-flow (AI development)
```

## Usage Examples

### Manual Sync Coordination

```bash
# Trigger sync for all packages
gh workflow run sync-coordinator.yml

# Sync specific packages
gh workflow run sync-coordinator.yml -f target_packages="backend,frontend"

# Force sync mode
gh workflow run sync-coordinator.yml -f sync_mode="force-sync"
```

### Manual Deployment

```bash
# Deploy to staging
gh workflow run deployment.yml -f environment="staging"

# Deploy to production (with force)
gh workflow run deployment.yml -f environment="production" -f force_deploy="true"
```

## Monitoring and Troubleshooting

### Workflow Status

- Check workflow runs in the Actions tab
- Review job-specific logs for detailed information
- Artifacts are stored for 30-90 days depending on type

### Common Issues

1. **Package Not Found**: Workflows handle missing packages gracefully
2. **Dependency Conflicts**: Automatic conflict detection and reporting
3. **Test Failures**: Individual package failures don't block others
4. **Deployment Failures**: Automatic rollback capabilities

### Artifacts

- **Alignment Reports**: Package synchronization analysis
- **Coverage Reports**: Test coverage per package
- **Deployment Manifests**: Environment-specific configurations
- **Build Artifacts**: Compiled packages and containers

## Integration with Branch Architecture

These workflows directly support the MediaNest 4-branch strategy:

- **Automated Quality Gates**: Prevent broken code from reaching main branches
- **Environment-Specific Deployments**: Automatic deployment to appropriate environments
- **Cross-Package Validation**: Ensures multi-package consistency
- **Security Enforcement**: Prevents secrets and vulnerabilities from being merged

## Maintenance

### Regular Tasks

1. **Dependency Updates**: Weekly automated dependency checks
2. **Security Scans**: Daily security vulnerability scanning
3. **Performance Monitoring**: Regular benchmark execution
4. **Artifact Cleanup**: Automated cleanup of old build artifacts

### Workflow Updates

When updating workflows:
1. Test changes in feature branches
2. Use workflow dispatch for manual testing
3. Monitor for any breaking changes in package structure
4. Update documentation accordingly

## Support

For workflow issues:
1. Check the Actions tab for detailed logs
2. Review artifact outputs for specific failures
3. Consult the BRANCH_ARCHITECTURE.md for strategy details
4. Contact the DevOps team for infrastructure issues