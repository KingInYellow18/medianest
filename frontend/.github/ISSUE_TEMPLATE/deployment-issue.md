---
name: Deployment Issue
about: Report a deployment or CI/CD pipeline issue
title: '[DEPLOY] '
labels: deployment, ci-cd, bug
assignees: ''
---

## Deployment Issue Summary

**Brief description of the deployment issue**

## Environment Details

- **Environment**: [staging/production]
- **Pipeline**: [GitHub Actions/Manual]
- **Commit SHA**:
- **Deployment Time**:
- **Pipeline Run**: [Link to GitHub Actions run]

## Issue Details

### Expected Behavior

What should have happened during deployment?

### Actual Behavior

What actually happened? What went wrong?

### Error Messages

```
Paste any error messages, logs, or stack traces here
```

### Pipeline Stage

Which stage of the CI/CD pipeline failed?

- [ ] Quality Gates (linting, type-checking)
- [ ] Security Scanning
- [ ] Tests (unit/integration/e2e)
- [ ] Build & Package
- [ ] Deployment
- [ ] Post-deployment validation
- [ ] Monitoring/Alerts

## Reproduction Steps

How can this issue be reproduced?

1.
2.
3.

## Impact Assessment

- **Severity**: [Critical/High/Medium/Low]
- **User Impact**: [Describe impact on users]
- **Service Availability**: [Up/Down/Degraded]
- **Rollback Required**: [Yes/No]

## Investigation Details

### Health Check Results

```
Paste health check results if available
```

### Performance Metrics

- Build time:
- Bundle size:
- Response time:

### Security Scan Results

- Critical vulnerabilities:
- High vulnerabilities:

## Attempted Solutions

What have you tried to resolve this issue?

- [ ] Reran deployment pipeline
- [ ] Checked environment variables
- [ ] Verified dependencies
- [ ] Reviewed recent changes
- [ ] Checked external service status

## Additional Context

Any additional information that might be relevant:

- Related PRs:
- Recent changes:
- External dependencies:
- Infrastructure changes:

## Checklist

- [ ] Issue has been reproduced
- [ ] Logs and error messages included
- [ ] Impact assessment completed
- [ ] Rollback plan considered
- [ ] Relevant team members notified

---

**For Emergency Issues**: If this is a critical production issue, please also:

1. Execute emergency rollback if needed
2. Notify the on-call team immediately
3. Update status page if applicable
