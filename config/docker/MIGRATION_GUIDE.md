# 🔄 Docker Consolidation Migration Guide

## Overview

This guide covers migration from the **25+ fragmented Docker files** to the new **consolidated 3-path structure**.

## 🎯 Migration Summary

| **Before** | **After** |
|------------|-----------|
| 25+ Docker files | 1 Dockerfile + 3 compose files |
| Mixed Flask/Python + Node.js | Standardized Node.js 20 + Express |
| Inconsistent environments | Unified dev/test/prod paths |
| Manual environment setup | Automated environment variables |

## 📁 File Mapping

### Replaced Docker Files

```bash
# Backend Dockerfiles (REMOVED)
❌ backend/Dockerfile
❌ backend/Dockerfile.prod  
❌ backend/Dockerfile.production
❌ backend/Dockerfile.production-secure
❌ backend/Dockerfile.optimized
❌ backend/Dockerfile.emergency

# Frontend Dockerfiles (REMOVED)
❌ frontend/Dockerfile
❌ frontend/Dockerfile.prod
❌ frontend/Dockerfile.production  
❌ frontend/Dockerfile.optimized

# Root Dockerfiles (REMOVED)
❌ Dockerfile
❌ Dockerfile.test
❌ Dockerfile.simple
❌ Dockerfile.backend-standalone
❌ Dockerfile.frontend-standalone
❌ Dockerfile.optimized
❌ Dockerfile.performance-optimized
❌ Dockerfile.performance-optimized-v2
❌ Dockerfile.production-secure
❌ Dockerfile.quick

# Compose files (REMOVED)
❌ docker-compose.yml
❌ docker-compose.dev.yml (root)
❌ docker-compose.test.yml (root)
❌ docker-compose.prod.yml (root)
❌ docker-compose.production.yml
❌ docker-compose.hardened.yml
❌ docker-compose.optimized.yml
❌ docker-compose.orchestration.yml
❌ docker-compose.secure.yml
```

### New Consolidated Structure

```bash
# Single consolidated Dockerfile
✅ config/docker/Dockerfile.consolidated

# Three environment-specific compose files
✅ config/docker/docker-compose.dev.yml
✅ config/docker/docker-compose.test.yml  
✅ config/docker/docker-compose.prod.yml

# Supporting files
✅ config/docker/ecosystem.config.js
✅ config/docker/docker-environment.env.template
✅ config/docker/.dockerignore
✅ config/docker/README.md
✅ config/docker/MIGRATION_GUIDE.md
```

## 🚀 Step-by-Step Migration

### Phase 1: Backup Current Configuration

```bash
# Create backup directory
mkdir -p migration-backup/$(date +%Y%m%d)

# Backup existing Docker files
find . -name "Dockerfile*" -exec cp {} migration-backup/$(date +%Y%m%d)/ \;
find . -name "docker-compose*.yml" -exec cp {} migration-backup/$(date +%Y%m%d)/ \;

# Backup environment files
cp .env* migration-backup/$(date +%Y%m%d)/ 2>/dev/null || true
```

### Phase 2: Set Up New Environment

```bash
# Copy environment template
cp config/docker/docker-environment.env.template docker-environment.env

# Edit environment variables for your setup
nano docker-environment.env

# Create secrets directory for production
mkdir -p secrets/
echo "your_production_db_url" > secrets/database_url
echo "your_jwt_secret" > secrets/jwt_secret
# ... (add other secrets as needed)

# Set proper permissions
chmod 600 secrets/*
```

### Phase 3: Update CI/CD Pipelines

#### GitHub Actions

**Before:**
```yaml
# .github/workflows/old-docker.yml
- name: Build backend
  run: docker build -f backend/Dockerfile.prod -t backend .
  
- name: Build frontend  
  run: docker build -f frontend/Dockerfile.prod -t frontend .
```

**After:**
```yaml
# .github/workflows/new-docker.yml
- name: Build backend
  run: docker build -f config/docker/Dockerfile.consolidated --target backend-production -t backend .
  
- name: Build frontend
  run: docker build -f config/docker/Dockerfile.consolidated --target frontend-production -t frontend .
```

#### Jenkins Pipeline

**Before:**
```groovy
stage('Build') {
    docker.build("backend", "-f backend/Dockerfile.prod .")
    docker.build("frontend", "-f frontend/Dockerfile.prod .")
}
```

**After:**
```groovy
stage('Build') {
    docker.build("backend", "-f config/docker/Dockerfile.consolidated --target backend-production .")
    docker.build("frontend", "-f config/docker/Dockerfile.consolidated --target frontend-production .")
}
```

### Phase 4: Update Development Workflows

#### Local Development

**Before:**
```bash
# Old development setup
docker-compose up -d
```

**After:**
```bash
# New development setup
docker-compose -f config/docker/docker-compose.dev.yml --env-file docker-environment.env up -d
```

#### Testing

**Before:**
```bash
# Old testing
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

**After:**
```bash
# New testing
docker-compose -f config/docker/docker-compose.test.yml up --abort-on-container-exit
```

#### Production Deployment

**Before:**
```bash
# Old production
docker-compose -f docker-compose.production.yml up -d
```

**After:**
```bash
# New production
docker-compose -f config/docker/docker-compose.prod.yml --env-file docker-environment.env up -d
```

### Phase 5: Technology Stack Alignment

#### Backend Technology Migration

The consolidation standardizes on **Node.js + Express** (removing Flask/Python confusion):

**Dockerfile Changes:**
- Base image: `python:3.11-slim` → `node:20-alpine`
- Runtime: Flask → Express/Node.js
- Dependencies: requirements.txt → package.json
- Health checks: Flask endpoints → Express endpoints

**If you have Python dependencies:**
1. Port Python functionality to Node.js
2. Use microservices for Python-specific tasks
3. Update API contracts and interfaces

#### Frontend Alignment

**Next.js Configuration:**
- Standardized on Next.js 14
- Consistent build targets across environments
- Optimized static generation

### Phase 6: Environment Variable Consolidation

#### Before (Multiple .env files)
```bash
# Development
.env.development
.env.local

# Testing  
.env.test
.env.test.local

# Production
.env.production
.env.production.local
```

#### After (Single template)
```bash
# Single source of truth
docker-environment.env (from template)

# Environment-specific overrides via compose files
# Production secrets via Docker secrets
```

**Variable Mapping:**
```bash
# Database
DATABASE_URL → Same (but via secrets in prod)
DB_HOST, DB_PORT, DB_NAME → Consolidated into DATABASE_URL

# Redis  
REDIS_HOST, REDIS_PORT → Consolidated into REDIS_URL

# Authentication
JWT_SECRET → JWT_SECRET_FILE (production)
SESSION_SECRET → NEXTAUTH_SECRET_FILE (production)
```

## 🧪 Testing Migration

### Validation Script

```bash
# Run comprehensive build test
./config/docker/build-scripts/test-consolidated-build.sh

# Test each environment
docker-compose -f config/docker/docker-compose.dev.yml config
docker-compose -f config/docker/docker-compose.test.yml config  
docker-compose -f config/docker/docker-compose.prod.yml config
```

### Performance Validation

**Expected Improvements:**
- ✅ Build time: 25-50% faster (layer caching)
- ✅ Image size: 40-60% smaller (multi-stage builds)
- ✅ Cache hit rate: >85% (optimized layering)
- ✅ Consistency: 100% (single Dockerfile)

### Security Validation

```bash
# Check for secrets in images
docker history --no-trunc medianest/backend:test | grep -i secret
docker history --no-trunc medianest/frontend:test | grep -i secret

# Validate non-root users
docker run --rm medianest/backend:test whoami  # Should output: medianest
docker run --rm medianest/frontend:test whoami # Should output: medianest

# Check file permissions
docker run --rm medianest/backend:test ls -la /app
```

## 🔧 Troubleshooting Migration Issues

### Common Issues & Solutions

#### 1. Build Context Too Large

**Error:** `failed to read dockerfile: file too large`

**Solution:**
```bash
# Check .dockerignore is in place
ls -la config/docker/.dockerignore

# Verify context size reduction
du -sh . --exclude=node_modules --exclude=.git
```

#### 2. Port Conflicts

**Error:** `bind: address already in use`

**Solution:**
```bash
# Update port mappings in docker-environment.env
# Or stop conflicting services
docker ps | grep 3000
docker ps | grep 4000
```

#### 3. Volume Mount Issues

**Error:** `no such file or directory`

**Solution:**
```bash
# Ensure directories exist
mkdir -p backend/logs backend/uploads
mkdir -p frontend/.next

# Check volume paths in compose files
docker-compose -f config/docker/docker-compose.dev.yml config | grep volumes -A 10
```

#### 4. Environment Variable Issues

**Error:** `Cannot read property of undefined`

**Solution:**
```bash
# Validate environment file
cat docker-environment.env

# Check variable interpolation
docker-compose -f config/docker/docker-compose.dev.yml config | grep environment -A 20
```

### Rollback Procedure

If migration fails, you can rollback:

```bash
# Stop new containers
docker-compose -f config/docker/docker-compose.dev.yml down

# Restore old files
cp migration-backup/$(date +%Y%m%d)/* .

# Restart with old configuration
docker-compose up -d
```

## 📈 Post-Migration Validation

### Performance Metrics

Run this script to validate performance improvements:

```bash
#!/bin/bash
# performance-validation.sh

echo "🔍 Measuring build performance..."

# Time full build
time docker build -f config/docker/Dockerfile.consolidated --target backend-production -t test-backend .
time docker build -f config/docker/Dockerfile.consolidated --target frontend-production -t test-frontend .

# Check image sizes
echo "📊 Image sizes:"
docker images | grep test-backend
docker images | grep test-frontend

# Test cache effectiveness
echo "⚡ Testing cache effectiveness..."
time docker build -f config/docker/Dockerfile.consolidated --target backend-production -t test-backend-cached .
```

### Security Audit

```bash
# Run security scan
docker scout cves medianest/backend:latest
docker scout cves medianest/frontend:latest

# Check runtime security
docker run --rm medianest/backend:latest ps aux
docker run --rm medianest/frontend:latest ps aux
```

## 🎯 Success Criteria

Migration is successful when:

- ✅ All 3 environments (dev/test/prod) build successfully
- ✅ Performance targets met (<5min build, <200MB images)
- ✅ Security scans pass (no HIGH/CRITICAL vulnerabilities)
- ✅ All services health checks pass
- ✅ CI/CD pipelines updated and working
- ✅ Development workflows functional
- ✅ Production deployment verified

## 🚀 Next Steps

After successful migration:

1. **Clean up old files**
   ```bash
   # Remove old Docker files (after verification)
   rm -f Dockerfile*
   rm -f docker-compose*.yml
   ```

2. **Update documentation**
   - README files
   - Deployment guides  
   - Developer onboarding

3. **Train team members**
   - New Docker commands
   - Environment setup
   - Troubleshooting procedures

4. **Monitor performance**
   - Build times in CI/CD
   - Image registry usage
   - Runtime performance

---

**Migration Timeline:** 1-2 hours for setup + testing  
**Risk Level:** Low (rollback available)  
**Impact:** High (improved performance, maintainability, security)