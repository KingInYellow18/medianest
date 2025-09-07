# MediaNest Production Deployment Guide

Comprehensive production deployment package for MediaNest - a unified web portal for managing Plex media server and related services.

## 🚀 Quick Start

### Prerequisites
- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker with registry access
- Helm 3.x
- Node.js 20+ (for local development)

### Rapid Deployment

```bash
# 1. Clone and navigate to deployment directory
cd deployment

# 2. Configure environment
cp environment/.env.production.template environment/.env.production
# Edit .env.production with your values

# 3. Generate secrets
./scripts/generate-secrets.sh

# 4. Deploy to production
./scripts/deploy.sh --domain your-domain.com

# 5. Verify deployment
./scripts/smoke-tests.sh --domain your-domain.com
```

## 📋 Deployment Components

### Container Images
- **Backend**: Multi-stage Node.js/Express API (<300MB)
- **Frontend**: Next.js standalone build (<200MB)
- **Database**: PostgreSQL 15 with optimization
- **Cache**: Redis 7 with persistence

### Kubernetes Resources
- **Namespace**: Isolated production environment
- **Deployments**: Auto-scaling backend (3-10 pods) and frontend (2-6 pods)
- **Services**: Internal communication and load balancing
- **Ingress**: SSL termination and routing with rate limiting
- **ConfigMaps**: Environment-specific configuration
- **Secrets**: Secure credential management
- **PersistentVolumes**: Database and cache storage
- **HPA**: Horizontal Pod Autoscaling based on CPU/memory

### Security Features
- Non-root container execution
- Read-only root filesystems
- Network policies for microsegmentation
- Secret management with rotation
- SSL/TLS with Let's Encrypt
- Security headers and CSP
- Rate limiting and DDoS protection
- Container vulnerability scanning

## 🗂️ Directory Structure

```
deployment/
├── production-checklist.md          # Comprehensive deployment checklist
├── README.md                         # This guide
├── kubernetes/                       # Kubernetes manifests
│   ├── namespace.yaml               # Namespace and network policies
│   ├── backend-deployment.yaml      # Backend deployment and HPA
│   ├── frontend-deployment.yaml     # Frontend deployment and HPA
│   ├── database.yaml                # PostgreSQL and Redis
│   ├── secrets.yaml                 # Secret templates
│   ├── configmaps.yaml              # Configuration maps
│   └── ingress.yaml                 # Ingress and SSL configuration
├── scripts/                          # Deployment and maintenance scripts
│   ├── deploy.sh                    # Main deployment script
│   ├── rollback.sh                  # Emergency rollback procedures
│   ├── smoke-tests.sh               # Post-deployment verification
│   └── performance-baseline.sh      # Performance baseline testing
├── environment/                      # Environment configuration
│   └── .env.production.template     # Production environment template
└── monitoring/                       # Monitoring and alerting
    ├── prometheus.yaml              # Metrics collection
    ├── grafana.yaml                 # Dashboards and visualization
    └── alertmanager.yaml            # Alert routing and notifications
```

## ⚙️ Configuration

### Environment Variables

Copy and configure the production environment template:

```bash
cp deployment/environment/.env.production.template deployment/environment/.env.production
```

Key configuration sections:
- **Database**: PostgreSQL connection and pool settings
- **Cache**: Redis configuration and clustering
- **Security**: JWT secrets, encryption keys, session config
- **External APIs**: Plex integration, TMDB, SMTP
- **Performance**: Rate limiting, caching, timeouts
- **Monitoring**: Metrics collection and alerting

### Kubernetes Secrets

Secrets are managed through:
1. **Template-based**: Update `kubernetes/secrets.yaml` with generated values
2. **External Secrets**: Integration with HashiCorp Vault or AWS Secrets Manager
3. **Sealed Secrets**: GitOps-friendly encrypted secrets

## 🚀 Deployment Process

### 1. Pre-Deployment

```bash
# Check prerequisites
./scripts/deploy.sh --help

# Validate configuration
export DOMAIN=your-domain.com
export API_DOMAIN=api.your-domain.com

# Generate and configure secrets
./scripts/generate-secrets.sh
# Update kubernetes/secrets.yaml with generated values
```

### 2. Infrastructure Setup

```bash
# Create namespace and network policies
kubectl apply -f kubernetes/namespace.yaml

# Apply configuration
kubectl apply -f kubernetes/configmaps.yaml
kubectl apply -f kubernetes/secrets.yaml
```

### 3. Database Deployment

```bash
# Deploy PostgreSQL and Redis
kubectl apply -f kubernetes/database.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s -n medianest-prod
```

### 4. Application Deployment

```bash
# Build and push container images
docker build -f backend/Dockerfile.prod -t your-registry/medianest/backend:latest .
docker build -f frontend/Dockerfile.prod -t your-registry/medianest/frontend:latest .

# Deploy applications
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml

# Setup ingress and SSL
kubectl apply -f kubernetes/ingress.yaml
```

### 5. Automated Deployment

Use the main deployment script for complete automation:

```bash
# Full deployment with all checks
./scripts/deploy.sh \
  --domain your-domain.com \
  --tag v1.0.0

# Skip image building (if images already exist)
./scripts/deploy.sh \
  --domain your-domain.com \
  --skip-build

# Skip database migrations
./scripts/deploy.sh \
  --domain your-domain.com \
  --skip-migrations
```

## 🔒 Security Configuration

### Container Security
- Non-root user execution (UID 1001)
- Read-only root filesystems with tmpfs for temporary files
- Minimal Alpine-based images
- Security context with dropped capabilities
- Resource limits and reservations

### Network Security
- Network policies restricting pod-to-pod communication
- Ingress with rate limiting and DDoS protection
- SSL/TLS termination with modern cipher suites
- CORS configuration for API endpoints

### Secret Management
- Kubernetes secrets with base64 encoding
- Environment variable injection
- Secret rotation procedures
- Docker secrets support for Swarm deployments

## 📊 Monitoring and Observability

### Metrics Collection
- Prometheus integration with application metrics
- Resource utilization monitoring
- Database and Redis performance metrics
- Custom business metrics

### Logging
- Structured JSON logging
- Log aggregation with centralized collection
- Log rotation and retention policies
- Error tracking and alerting

### Health Checks
- Kubernetes liveness, readiness, and startup probes
- Application health endpoints
- Database connectivity monitoring
- External service dependency checks

### Performance Monitoring
- Response time tracking
- Throughput metrics
- Error rate monitoring
- Resource utilization alerts

## 🔧 Maintenance and Operations

### Scaling

```bash
# Manual scaling
kubectl scale deployment medianest-backend --replicas=5 -n medianest-prod

# Auto-scaling configuration
kubectl get hpa -n medianest-prod
```

### Updates and Rollbacks

```bash
# Rolling update
kubectl set image deployment/medianest-backend backend=your-registry/medianest/backend:v1.1.0 -n medianest-prod

# Monitor rollout
kubectl rollout status deployment/medianest-backend -n medianest-prod

# Rollback if needed
./scripts/rollback.sh --application
```

### Backup and Recovery

```bash
# Database backup
kubectl exec postgres-pod -- pg_dump medianest > backup.sql

# Full state backup
./scripts/backup.sh --full

# Restore from backup
./scripts/rollback.sh --database --db-backup backup.sql
```

### Troubleshooting

```bash
# Check pod status
kubectl get pods -n medianest-prod -o wide

# View logs
kubectl logs -f deployment/medianest-backend -n medianest-prod

# Debug networking
kubectl exec -it medianest-backend-pod -- nslookup postgres-service

# Performance analysis
./scripts/performance-baseline.sh --domain your-domain.com
```

## 🔄 CI/CD Integration

### GitHub Actions
The included workflow (`.github/workflows/production-deploy.yml`) provides:
- Automated testing and security scanning
- Container image building and vulnerability assessment
- Kubernetes deployment with health checks
- Rollback on failure
- Slack/Discord notifications

### GitLab CI/CD
Adaptable pipeline configuration for GitLab environments with:
- Multi-stage deployments
- Environment-specific configurations
- Manual approval gates
- Deployment tracking

## 🧪 Testing and Validation

### Smoke Tests
```bash
# Run post-deployment smoke tests
./scripts/smoke-tests.sh \
  --domain your-domain.com \
  --api-domain api.your-domain.com
```

Tests include:
- Frontend and backend health checks
- Database and Redis connectivity
- SSL certificate validation
- Security headers verification
- Performance baseline establishment

### Performance Testing
```bash
# Establish performance baselines
./scripts/performance-baseline.sh \
  --domain your-domain.com \
  --load-test
```

## 📞 Support and Documentation

### Getting Help
- Check the deployment checklist: `production-checklist.md`
- Review troubleshooting logs in the results directory
- Monitor application health through Kubernetes dashboard
- Use smoke tests for quick health verification

### Documentation
- API documentation available at `/docs` endpoint
- Kubernetes resource documentation in manifest comments
- Environment variable documentation in `.env.template`
- Deployment script help via `--help` flags

## 🚨 Emergency Procedures

### Emergency Rollback
```bash
# Immediate service stop
./scripts/rollback.sh --emergency

# Application rollback only
./scripts/rollback.sh --application --revision 3

# Full rollback with database restore
./scripts/rollback.sh --full --db-backup ./backups/latest.sql
```

### Incident Response
1. **Assess Impact**: Check service status and error rates
2. **Immediate Response**: Stop traffic or rollback if critical
3. **Investigation**: Gather logs and metrics
4. **Resolution**: Apply fixes or complete rollback
5. **Post-Mortem**: Document and improve procedures

---

**Deployment Package Version**: 1.0.0  
**Last Updated**: 2025-09-06  
**Compatibility**: Kubernetes 1.24+, Node.js 20+