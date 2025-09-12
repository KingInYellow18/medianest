# CI/CD Pipeline Documentation

## Overview

MediaNest uses GitHub Actions for continuous integration and deployment of documentation. This system ensures that all documentation changes are validated, tested, and automatically deployed to GitHub Pages.

## Pipeline Architecture

### 🚀 Deployment Pipeline (docs-deploy.yml)

The main deployment pipeline runs on pushes to the `main` branch and includes:

1. **Build Stage**
   - Python 3.11 and Node.js 18 setup
   - Dependency caching for faster builds
   - MkDocs build with strict mode
   - Smart change detection to skip unnecessary builds

2. **Deploy Stage**
   - Automatic deployment to GitHub Pages
   - Deployment status tracking
   - Environment protection

3. **Status Updates**
   - Deployment status badges
   - Build information generation
   - Comprehensive reporting

### 🔍 Validation Pipeline (docs-validation.yml)

The validation pipeline runs on pull requests and feature branches:

1. **Structure Validation**
   - Directory structure verification
   - MkDocs configuration validation
   - File naming conventions
   - Orphaned file detection

2. **Link Validation**
   - Internal link checking
   - External link verification (with retries)
   - Anchor link validation in built site

3. **Content Quality**
   - Spell checking with custom dictionary
   - Content quality metrics (readability, word count)
   - Security scanning for sensitive information

4. **Format Validation**
   - Markdown formatting standards
   - Header hierarchy validation
   - Line length and whitespace checks

## Configuration

### Environment Variables

| Variable         | Description               | Required | Default |
| ---------------- | ------------------------- | -------- | ------- |
| `PYTHON_VERSION` | Python version for builds | No       | `3.11`  |
| `NODE_VERSION`   | Node.js version           | No       | `18`    |

### Repository Secrets

| Secret         | Description            | Required   |
| -------------- | ---------------------- | ---------- |
| `GITHUB_TOKEN` | Automatic GitHub token | Yes (auto) |

### Branch Protection

Configure the following branch protection rules:

```yaml
# .github/branch-protection.yml
main:
  required_status_checks:
    strict: true
    contexts:
      - '🔍 Documentation Validation'
      - '📋 Validate Structure'
      - '🔗 Validate Links'
  enforce_admins: true
  required_pull_request_reviews:
    required_approving_review_count: 1
    dismiss_stale_reviews: true
```

## Scripts

### validate-docs.sh

Comprehensive documentation validation script with the following features:

**Usage:**

```bash
./scripts/validate-docs.sh [structure|content|format|all]
```

**Capabilities:**

- Directory structure validation
- Content quality analysis
- Markdown formatting checks
- MkDocs build testing
- Report generation

### check-links.sh

Advanced link checking script with:

**Usage:**

```bash
./scripts/check-links.sh [internal|external|all]
```

**Features:**

- Internal link verification
- External link checking with retries
- Anchor link validation
- Rate limiting for external checks
- JSON report generation

## Caching Strategy

### Build Caching

The pipeline implements intelligent caching:

```yaml
# Cache key generation
CACHE_KEY="docs-build-${OS}-${PYTHON_VERSION}-${DOCS_HASH}-${MKDOCS_HASH}-${REQUIREMENTS_HASH}"
```

**Cached Items:**

- MkDocs build output
- Python pip cache
- Node.js npm cache
- MkDocs internal cache

### Cache Invalidation

Caches are invalidated when:

- Documentation files change
- `mkdocs.yml` configuration changes
- Requirements file changes
- Force rebuild is requested

## Deployment Environments

### Production (GitHub Pages)

- **URL:** `https://{username}.github.io/{repository}/`
- **Branch:** `main`
- **Environment:** `github-pages`
- **Protection:** Requires successful validation

### Staging (Optional)

Configure staging environment for testing:

1. Create `gh-pages-staging` branch
2. Configure separate GitHub Pages source
3. Add staging deployment job

## Status Badges

### Available Badges

1. **Documentation Deployment**

   ```markdown
   [![Documentation](https://img.shields.io/github/deployments/username/repo/github-pages?label=docs&logo=github)](https://username.github.io/repo/)
   ```

2. **Build Status**

   ```markdown
   [![Docs Build](https://github.com/username/repo/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/username/repo/actions/workflows/docs-deploy.yml)
   ```

3. **Validation Status**
   ```markdown
   [![Docs Validation](https://github.com/username/repo/actions/workflows/docs-validation.yml/badge.svg)](https://github.com/username/repo/actions/workflows/docs-validation.yml)
   ```

### Badge Integration

Badges are automatically updated by the pipeline and can be added to:

- `README.md`
- Documentation homepage
- Pull request templates

## Monitoring and Alerts

### GitHub Actions Notifications

Configure notifications for:

- Failed deployments
- Validation errors
- External link issues

### Metrics Tracking

The system tracks:

- Build times
- Deployment frequency
- Link check results
- Content quality metrics

## Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   # Check MkDocs configuration
   mkdocs build --strict --verbose

   # Validate Python dependencies
   pip check
   ```

2. **Link Check Failures**

   ```bash
   # Test specific links manually
   curl -I https://example.com/path

   # Check internal link resolution
   ./scripts/check-links.sh internal
   ```

3. **Deployment Issues**
   ```bash
   # Verify GitHub Pages settings
   # Check repository permissions
   # Review deployment logs
   ```

### Debug Mode

Enable debug mode by adding to workflow:

```yaml
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Best Practices

### Documentation Standards

1. **File Organization**
   - Use lowercase filenames with dashes
   - Organize content in logical directories
   - Include appropriate frontmatter

2. **Content Quality**
   - Minimum 50 words per page
   - Clear heading hierarchy
   - Internal links for navigation

3. **External Links**
   - Regular validation
   - Use archived links when appropriate
   - Document link checking exceptions

### Workflow Optimization

1. **Performance**
   - Use caching effectively
   - Skip builds when unnecessary
   - Parallel job execution

2. **Reliability**
   - Implement retry logic
   - Handle external service failures
   - Provide meaningful error messages

3. **Maintainability**
   - Document configuration changes
   - Version control workflow files
   - Regular dependency updates

## Security Considerations

### Sensitive Information

The validation pipeline scans for:

- API keys and tokens
- Database URLs
- Private keys
- Passwords and secrets

### Access Control

- Use least-privilege permissions
- Protect sensitive branches
- Audit workflow changes

### External Dependencies

- Pin dependency versions
- Regular security updates
- Validate external links carefully

## Integration with Development Workflow

### Pre-commit Hooks

Consider adding local validation:

```bash
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: docs-validation
        name: Documentation Validation
        entry: ./scripts/validate-docs.sh
        language: script
        files: ^docs/.*\.md$
```

### IDE Integration

Configure your editor for:

- Markdown linting
- Link validation
- Spell checking
- YAML validation

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Page view tracking
   - Search analytics
   - User feedback collection

2. **Multi-language Support**
   - Internationalization pipeline
   - Translation validation
   - Language-specific deployments

3. **Performance Optimization**
   - Image optimization
   - CDN integration
   - Progressive loading

### Contributing

To improve the CI/CD pipeline:

1. Test changes in feature branches
2. Update documentation
3. Ensure backward compatibility
4. Monitor performance impact

## Support and Resources

- **GitHub Actions Documentation:** https://docs.github.com/actions
- **MkDocs Material:** https://squidfunk.github.io/mkdocs-material/
- **GitHub Pages:** https://pages.github.com/

For issues or questions about the CI/CD pipeline, please:

1. Check existing GitHub issues
2. Review workflow logs
3. Create detailed bug reports
4. Suggest improvements via pull requests
