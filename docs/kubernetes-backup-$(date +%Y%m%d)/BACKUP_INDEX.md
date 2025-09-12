# Kubernetes Backup Index - $(date +%Y-%m-%d)

## Backed Up Files

### Kubernetes Manifests

- `backend-deployment.yaml` - Backend application deployment
- `frontend-deployment.yaml` - Frontend application deployment
- `database.yaml` - PostgreSQL and Redis database deployments
- `configmaps.yaml` - Application configuration maps
- `secrets.yaml` - Application secrets template
- `ingress.yaml` - Ingress configuration for external access
- `namespace.yaml` - Kubernetes namespace definition

### Deployment Scripts

- `deploy.sh` - Complete Kubernetes production deployment script
- `rollback.sh` - Kubernetes rollback and disaster recovery script

### Backup Reason

MediaNest architecture simplification - removing Kubernetes complexity in favor of Docker Compose deployment for single-instance use case.

### Original Location

- `/deployment/kubernetes/` - All manifest files
- `/deployment/scripts/deploy.sh` - Main deployment script
- `/deployment/scripts/rollback.sh` - Rollback script

### Restoration Instructions

If Kubernetes deployment is needed again:

1. Copy files back to original locations
2. Update image references and domain names
3. Ensure secrets are properly configured
4. Test deployment in staging environment first

### Dependencies Removed

- kubectl commands from GitHub Actions workflows
- KUBE_NAMESPACE environment variables
- Kubernetes health checks and monitoring setup
- Helm chart references (if any)
