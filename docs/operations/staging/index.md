# Staging Deployment Operations

**🚀 COMPREHENSIVE STAGING DEPLOYMENT HUB**

This directory contains all staging deployment procedures, validation
checklists, and deployment decision frameworks for MediaNest staging
environments.

## 🎯 STAGING DEPLOYMENT WORKFLOW

### Core Deployment Documents

- **[Deployment Checklist](deployment-checklist.md)** - Complete 7-phase staging
  deployment checklist
- **[Preflight Validation](preflight-validation.md)** - Pre-flight validation
  procedures with GO/NO-GO criteria
- **[Staging Deployment Report](staging-deployment-20250912.md)** - Historical
  staging deployment analysis and lessons learned

### Critical Staging Operations

- **[Emergency Decision Framework](../emergency/deployment-decision-20250912.md)** -
  NO-GO decision analysis and remediation
- **[Infrastructure Recovery](../emergency/docker-recovery-summary.md)** -
  Container infrastructure validation
- **[Monitoring Setup](../monitoring/setup.md)** - Staging environment
  monitoring configuration

## 📋 STAGING DEPLOYMENT PHASES

### Phase 1: Pre-Flight Validation ⏱️ 15-30 minutes

```bash
# Run comprehensive pre-flight checks
./scripts/staging-preflight-check.sh

# Validate environment configuration
npm run env:validate:staging

# Check infrastructure readiness
docker compose -f docker-compose.staging.yml config --quiet
```

**Success Criteria:**

- [ ] All services configured and accessible
- [ ] Database connectivity validated
- [ ] Environment variables complete
- [ ] Port mappings conflict-free
- [ ] Docker infrastructure operational

### Phase 2: Infrastructure Preparation ⏱️ 10-20 minutes

```bash
# Deploy infrastructure services
docker compose -f docker-compose.staging.yml up -d postgres redis

# Wait for services to be healthy
./scripts/wait-for-services.sh

# Run database migrations
npm run db:migrate:staging
```

### Phase 3: Application Deployment ⏱️ 5-10 minutes

```bash
# Build and deploy application services
docker compose -f docker-compose.staging.yml up -d backend frontend

# Verify service startup
docker compose ps
```

### Phase 4: Health Validation ⏱️ 5-10 minutes

```bash
# Test critical endpoints
curl -f http://staging.medianest.com/api/health
curl -f http://staging.medianest.com/api/metrics

# Run smoke tests
npm run test:smoke:staging
```

### Phase 5: Integration Testing ⏱️ 10-15 minutes

```bash
# Run integration test suite
npm run test:integration:staging

# Validate API endpoints
npm run test:api:staging
```

### Phase 6: Performance Validation ⏱️ 5-10 minutes

```bash
# Basic performance validation
npm run test:perf:staging

# Load test critical paths
./scripts/staging-load-test.sh
```

### Phase 7: Go-Live Decision ⏱️ 5 minutes

```bash
# Generate deployment report
./scripts/generate-staging-report.sh

# Make GO/NO-GO decision based on criteria
./scripts/staging-go-no-go-check.sh
```

## 🚨 GO/NO-GO DECISION FRAMEWORK

### ✅ GO CONDITIONS

- [ ] **All 7 phases completed successfully**
- [ ] **Health endpoints return 200 responses**
- [ ] **Database connectivity confirmed**
- [ ] **No critical errors in application logs**
- [ ] **Performance metrics within acceptable ranges**
- [ ] **Security validation passed**
- [ ] **Rollback plan tested and ready**

### 🚫 NO-GO CONDITIONS

- ❌ **Any service fails to start or reports unhealthy**
- ❌ **Database connectivity issues**
- ❌ **Critical security vulnerabilities detected**
- ❌ **Performance significantly degraded**
- ❌ **Integration tests failing**
- ❌ **Missing environment configuration**
- ❌ **Rollback plan not validated**

### ⚠️ CONDITIONAL GO

- **Minor non-blocking issues identified**
- **Non-critical services experiencing issues**
- **Performance slightly outside normal ranges**
- **Minor configuration adjustments needed**

## 🔧 TROUBLESHOOTING QUICK REFERENCE

### Common Staging Issues

#### 1. Database Connection Failures

```bash
# Check database service status
docker compose logs postgres

# Validate connection string
psql $DATABASE_URL -c "SELECT 1;"

# Reset database connections
docker compose restart postgres backend
```

#### 2. Service Discovery Issues

```bash
# Check Docker network configuration
docker network ls
docker network inspect medianest-staging

# Verify service names and ports
docker compose ps
```

#### 3. Environment Variable Issues

```bash
# Validate staging environment
./scripts/env-validator.sh staging

# Compare with development environment
diff .env.development .env.staging
```

#### 4. Port Conflicts

```bash
# Check port availability
netstat -tulpn | grep -E "(3001|4001|5432|6379)"

# Resolve port conflicts
./scripts/resolve-port-conflicts.sh
```

## 📊 DEPLOYMENT METRICS

### Performance Benchmarks

- **Total Deployment Time**: 45-75 minutes (target)
- **Service Startup**: <30 seconds per service
- **Health Check Response**: <500ms
- **Database Migration**: <2 minutes
- **Integration Test Suite**: <10 minutes

### Success Criteria

- **Deployment Success Rate**: >95%
- **Zero-Downtime Deployment**: Target achievement
- **Rollback Time**: <5 minutes if needed
- **Health Check Pass Rate**: 100%

## 🔄 ROLLBACK PROCEDURES

### Emergency Rollback (if deployment fails)

```bash
# Quick rollback to previous stable version
./scripts/emergency-rollback.sh

# Verify services are healthy
./scripts/health-check-all.sh

# Update status page
./scripts/update-status-page.sh "Rollback completed"
```

### Planned Rollback

```bash
# Graceful rollback with maintenance window
./scripts/planned-rollback.sh --version=previous --notify-users

# Validate rollback success
npm run test:smoke:staging
```

## 📞 ESCALATION PROCEDURES

### Level 1: Development Team

- **Contact**: Development team lead
- **Response Time**: 15 minutes
- **Scope**: Application-level issues, configuration problems

### Level 2: Infrastructure Team

- **Contact**: DevOps/Infrastructure team
- **Response Time**: 30 minutes
- **Scope**: Infrastructure issues, service connectivity

### Level 3: Emergency Response

- **Contact**: Emergency coordinator
- **Response Time**: 60 minutes
- **Scope**: Critical system failures, security incidents

### Communication Channels

- **Slack**: #staging-deployments
- **Email**: staging-ops@medianest.com
- **Status Page**: status.medianest.com
- **Incident Management**: [Emergency Response Hub](../emergency/index.md)

## 🔗 RELATED DOCUMENTATION

### Deployment Resources

- **[Infrastructure Setup](../../deployment/infrastructure/)** - Infrastructure
  configuration
- **[CI/CD Pipeline](../../deployment/ci-cd/)** - Automated deployment
  configuration
- **[Monitoring Setup](../monitoring/)** - Observability and alerting
- **[Security Configuration](../../security/)** - Security hardening procedures

### Emergency Resources

- **[Emergency Response](../emergency/index.md)** - Crisis management procedures
- **[Recovery Procedures](../emergency/recovery-completion-report.md)** - System
  recovery methodology
- **[Docker Recovery](../emergency/docker-recovery-summary.md)** - Container
  infrastructure recovery

---

**🚀 FOR STAGING DEPLOYMENT: Start with Pre-Flight Validation checklist**

**📋 FOR DECISION MAKING: Use GO/NO-GO criteria for deployment decisions**

**🚨 FOR EMERGENCIES: Reference Emergency Response Hub for crisis procedures**

**Last Updated**: 2025-09-13  
**Document Owner**: MediaNest Operations Team
