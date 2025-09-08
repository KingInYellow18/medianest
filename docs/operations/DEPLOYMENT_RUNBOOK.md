# MediaNest Deployment Runbook

**Classification**: Production Operations  
**Criticality**: High  
**Last Updated**: September 8, 2025  
**Review Frequency**: Monthly

## 🎯 Deployment Overview

This runbook provides comprehensive procedures for deploying MediaNest to production environments with zero downtime and rollback capabilities.

## 🚨 Pre-Deployment Checklist

### Environment Validation

- [ ] **Infrastructure Health**: All services operational
- [ ] **Database Connectivity**: PostgreSQL cluster accessible
- [ ] **Cache Availability**: Redis cluster operational
- [ ] **External APIs**: Plex and YouTube APIs accessible
- [ ] **SSL Certificates**: Valid and not expiring within 30 days
- [ ] **DNS Configuration**: Correct A/CNAME records
- [ ] **Load Balancer**: Health checks configured

### Security Verification

- [ ] **Secrets Rotation**: All secrets rotated within policy
- [ ] **Environment Variables**: Production values verified
- [ ] **Authentication**: Plex OAuth credentials validated
- [ ] **SSL/TLS**: Grade A+ SSL Labs rating
- [ ] **Security Headers**: OWASP compliance verified
- [ ] **Vulnerability Scan**: No critical vulnerabilities

### Code Quality Gates

- [ ] **Tests Passing**: All test suites green
- [ ] **Code Coverage**: >90% coverage maintained
- [ ] **Linting**: No ESLint/TypeScript errors
- [ ] **Security Scan**: CodeQL and dependency checks clear
- [ ] **Performance Tests**: Load tests passing
- [ ] **Smoke Tests**: Critical path validation

## 🚀 Deployment Procedures

### 1. Blue-Green Deployment

#### Phase 1: Green Environment Preparation

```bash
# 1. Create green environment
kubectl create namespace medianest-green

# 2. Deploy database migrations
kubectl exec -n medianest-green deployment/backend -- npm run db:migrate

# 3. Deploy application
kubectl apply -f k8s/green-deployment.yaml

# 4. Wait for readiness
kubectl wait --for=condition=ready pod -l app=medianest-backend-green --timeout=300s
```

#### Phase 2: Health Verification

```bash
# 1. Health check
curl -f https://green.medianest.app/api/v1/health

# 2. Smoke test critical endpoints
./scripts/smoke-test.sh green.medianest.app

# 3. Database connectivity test
kubectl exec deployment/backend-green -- npm run db:test

# 4. External API integration test
kubectl exec deployment/backend-green -- npm run integration:test
```

#### Phase 3: Traffic Switch

```bash
# 1. Update load balancer configuration
kubectl patch service medianest-lb -p '{"spec":{"selector":{"version":"green"}}}'

# 2. Verify traffic routing
curl -H "Host: medianest.app" http://load-balancer-ip/api/v1/health

# 3. Monitor error rates and response times
kubectl logs -f deployment/medianest-backend-green

# 4. Gradual traffic increase (if using canary)
./scripts/canary-rollout.sh --percentage 10,25,50,100
```

#### Phase 4: Blue Environment Cleanup

```bash
# 1. Wait for monitoring period (30 minutes)
sleep 1800

# 2. Scale down blue environment
kubectl scale deployment medianest-backend-blue --replicas=0

# 3. Clean up blue resources (after 24 hours)
kubectl delete namespace medianest-blue
```

### 2. Rolling Deployment (Alternative)

#### Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: medianest-backend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    spec:
      containers:
        - name: backend
          image: medianest/backend:v1.2.3
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 4000
            initialDelaySeconds: 60
            periodSeconds: 30
```

#### Deployment Commands

```bash
# 1. Update deployment image
kubectl set image deployment/medianest-backend backend=medianest/backend:v1.2.3

# 2. Monitor rollout
kubectl rollout status deployment/medianest-backend --timeout=600s

# 3. Verify all pods are ready
kubectl get pods -l app=medianest-backend

# 4. Health check
kubectl exec deployment/medianest-backend -- curl -f localhost:4000/api/v1/health
```

## 🔧 Database Migration Procedures

### Pre-Migration Validation

```bash
# 1. Backup current database
pg_dump -h $DB_HOST -U $DB_USER -d medianest > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Verify backup integrity
psql -h $DB_HOST -U $DB_USER -d medianest_test < backup-$(date +%Y%m%d-%H%M%S).sql

# 3. Check migration compatibility
npm run db:migrate:dry-run
```

### Migration Execution

```bash
# 1. Enable maintenance mode
kubectl patch configmap app-config -p '{"data":{"MAINTENANCE_MODE":"true"}}'

# 2. Wait for active connections to drain
kubectl exec deployment/backend -- ./scripts/wait-for-connections.sh

# 3. Run migrations
kubectl exec deployment/backend -- npm run db:migrate

# 4. Verify migration success
kubectl exec deployment/backend -- npm run db:verify

# 5. Disable maintenance mode
kubectl patch configmap app-config -p '{"data":{"MAINTENANCE_MODE":"false"}}'
```

### Post-Migration Validation

```bash
# 1. Data integrity check
kubectl exec deployment/backend -- npm run db:integrity-check

# 2. Performance validation
kubectl exec deployment/backend -- npm run db:performance-test

# 3. Application smoke test
./scripts/post-migration-smoke-test.sh
```

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

- **Response Time**: 95th percentile < 500ms
- **Error Rate**: < 0.1% for critical endpoints
- **Throughput**: Requests per second
- **CPU Usage**: < 70% average
- **Memory Usage**: < 80% of allocated
- **Database Connections**: < 80% of pool size

### Alert Configuration

```yaml
groups:
  - name: medianest.deployment
    rules:
      - alert: DeploymentHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected during deployment

      - alert: DeploymentHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected during deployment
```

### Dashboard Monitoring

```bash
# Grafana deployment dashboard
curl -X POST \
  -H "Content-Type: application/json" \
  -d @grafana-deployment-dashboard.json \
  http://admin:password@grafana:3000/api/dashboards/db
```

## 🔄 Rollback Procedures

### Automatic Rollback Triggers

- Error rate > 1% for 5 consecutive minutes
- 95th percentile latency > 2 seconds for 10 minutes
- Database connection failures > 10% for 2 minutes
- Health check failures > 50% of pods

### Manual Rollback Process

```bash
# 1. Immediate rollback to previous version
kubectl rollout undo deployment/medianest-backend

# 2. Wait for rollback completion
kubectl rollout status deployment/medianest-backend

# 3. Verify application health
kubectl exec deployment/medianest-backend -- curl -f localhost:4000/api/v1/health

# 4. Check database consistency
kubectl exec deployment/backend -- npm run db:consistency-check

# 5. Restore database if needed
psql -h $DB_HOST -U $DB_USER -d medianest < backup-pre-deployment.sql
```

### Rollback Verification

```bash
# 1. Run full smoke test suite
./scripts/smoke-test.sh production

# 2. Verify user authentication
./scripts/test-authentication.sh

# 3. Check external integrations
./scripts/test-external-apis.sh

# 4. Monitor error rates for 30 minutes
kubectl logs -f deployment/medianest-backend | grep ERROR
```

## 🛡️ Security Procedures

### Pre-Deployment Security Checks

```bash
# 1. Vulnerability scan
trivy image medianest/backend:v1.2.3

# 2. Secret scanning
gitleaks detect --source . --report-format json --report-path security-report.json

# 3. Dependency audit
npm audit --audit-level high

# 4. Container security scan
docker scout cves medianest/backend:v1.2.3
```

### Runtime Security Monitoring

```bash
# 1. Configure Falco rules
kubectl apply -f security/falco-rules.yaml

# 2. Enable admission controller
kubectl apply -f security/pod-security-policy.yaml

# 3. Network policy enforcement
kubectl apply -f security/network-policies.yaml
```

## 📋 Post-Deployment Procedures

### Verification Steps

1. **Health Checks**: All services responding correctly
2. **Feature Validation**: New features working as expected
3. **Performance Baseline**: Metrics within acceptable ranges
4. **User Acceptance**: Critical user journeys functional
5. **Monitoring Setup**: All alerts and dashboards operational

### Documentation Updates

```bash
# 1. Update deployment logs
./scripts/update-deployment-log.sh --version v1.2.3 --status success

# 2. Update configuration documentation
git add docs/configuration/
git commit -m "Update config docs for v1.2.3"

# 3. Generate release notes
./scripts/generate-release-notes.sh v1.2.2..v1.2.3 > RELEASE_NOTES.md
```

### Team Communication

```bash
# 1. Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ MediaNest v1.2.3 deployed successfully to production"}' \
  $SLACK_WEBHOOK_URL

# 2. Update status page
curl -X PUT \
  -H "Authorization: Bearer $STATUSPAGE_TOKEN" \
  -d '{"status": "operational"}' \
  https://api.statuspage.io/v1/pages/$PAGE_ID/components/$COMPONENT_ID
```

## 🚨 Emergency Procedures

### Critical Failure Response

1. **Immediate Actions**:

   - Execute rollback procedure
   - Enable maintenance mode
   - Notify on-call team
   - Update status page

2. **Investigation**:

   - Collect logs and metrics
   - Identify root cause
   - Document findings
   - Implement hotfix if needed

3. **Recovery**:
   - Test fix in staging
   - Deploy hotfix with accelerated process
   - Monitor for 2+ hours
   - Conduct post-incident review

### Emergency Contacts

- **Primary On-Call**: DevOps Team Lead
- **Secondary On-Call**: Senior Backend Engineer
- **Escalation**: Engineering Manager
- **External**: Infrastructure Provider Support

## 📊 Success Metrics

### Deployment Success Criteria

- Zero critical bugs in first 24 hours
- Response time degradation < 10%
- Error rate increase < 0.05%
- User satisfaction scores maintained
- All monitoring alerts operational

### Performance Benchmarks

- API response time: 95th percentile < 500ms
- Database query time: Average < 100ms
- Memory usage: < 512MB per pod
- CPU utilization: < 70% under normal load
- Cache hit rate: > 85%

---

**Generated by**: MediaNest SWARM Operations Agent  
**Approval Required**: DevOps Team Lead  
**Next Review**: October 8, 2025
