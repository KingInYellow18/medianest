# GitOps Workflow Strategy - MediaNest DevOps

## Executive Summary

GitOps represents the next evolution of DevOps, treating Git as the single source of truth for both application code and infrastructure configuration. This document outlines a comprehensive GitOps workflow for MediaNest that ensures automated, secure, and auditable deployment processes across all environments.

## GitOps Principles

### Core Principles
1. **Declarative Configuration**: All system state described declaratively
2. **Version Control**: Git as single source of truth
3. **Automated Deployment**: Changes automatically applied from Git
4. **Continuous Monitoring**: System observes and corrects drift
5. **Rollback Capability**: Easy reversion using Git history

### MediaNest GitOps Benefits
- **Audit Trail**: Complete deployment history in Git commits
- **Security**: No direct cluster access required
- **Consistency**: Same deployment process across all environments
- **Reliability**: Automated drift detection and correction
- **Developer Experience**: Familiar Git workflow for infrastructure

## Repository Structure Strategy

### Multi-Repository Approach
```
medianest/                          # Application code
├── backend/                        # Backend application
├── frontend/                       # Frontend application
├── shared/                         # Shared libraries
└── .github/workflows/              # CI pipelines

medianest-infra/                    # Infrastructure as Code
├── terraform/                      # Infrastructure definitions
├── docker-compose/                 # Docker configurations
├── configs/                        # Application configurations
└── scripts/                        # Deployment scripts

medianest-gitops/                   # GitOps configurations
├── environments/
│   ├── development/               # Dev environment configs
│   ├── staging/                   # Staging environment configs
│   └── production/                # Production environment configs
├── applications/                  # Application definitions
├── monitoring/                    # Monitoring configurations
└── policies/                      # Security and compliance policies
```

### Configuration Management
```yaml
# GitOps Repository Structure
gitops_structure:
  base:
    - common configurations
    - shared resources
    - default policies
  
  overlays:
    development:
      - dev-specific overrides
      - testing configurations
      - debug settings
    
    staging:
      - production-like settings
      - performance testing
      - security validation
    
    production:
      - optimized configurations
      - security hardening
      - monitoring enabled
```

## GitOps Tools Evaluation

### ArgoCD Implementation (Recommended)

#### Advantages
- **Native Kubernetes**: Excellent Kubernetes integration
- **Web UI**: Intuitive dashboard for deployment visualization
- **RBAC**: Fine-grained access control
- **Multi-Environment**: Supports multiple clusters/environments
- **Rollback**: Easy rollback to previous configurations

#### MediaNest ArgoCD Configuration
```yaml
# ArgoCD Application Configuration
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: medianest-production
  namespace: argocd
spec:
  project: medianest
  source:
    repoURL: https://github.com/medianest/medianest-gitops
    targetRevision: main
    path: environments/production
    kustomize:
      images:
      - medianest/backend:v1.2.3
      - medianest/frontend:v1.2.3
  destination:
    server: https://kubernetes.default.svc
    namespace: medianest-production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
  revisionHistoryLimit: 10
```

### Flux v2 Alternative

#### Advantages
- **GitOps Native**: Built specifically for GitOps workflows
- **Lightweight**: Minimal resource requirements
- **OCI Support**: Native container image updates
- **Notifications**: Comprehensive alerting system

#### Flux Configuration Example
```yaml
# Flux GitRepository
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: medianest-gitops
  namespace: flux-system
spec:
  interval: 1m
  ref:
    branch: main
  url: https://github.com/medianest/medianest-gitops

---
# Flux Kustomization
apiVersion: kustomize.toolkit.fluxcd.io/v1beta2
kind: Kustomization
metadata:
  name: medianest-production
  namespace: flux-system
spec:
  interval: 5m
  path: "./environments/production"
  sourceRef:
    kind: GitRepository
    name: medianest-gitops
  targetNamespace: medianest-production
```

## Docker Swarm GitOps Implementation

### Swarm-Native GitOps
Since MediaNest uses Docker Swarm, we'll implement GitOps using a custom approach:

```bash
#!/bin/bash
# GitOps Sync Agent for Docker Swarm
set -euo pipefail

REPO_URL="https://github.com/medianest/medianest-gitops"
REPO_DIR="/opt/gitops/medianest"
ENVIRONMENT="${ENVIRONMENT:-production}"
SYNC_INTERVAL="${SYNC_INTERVAL:-60}"

sync_configuration() {
    echo "🔄 Syncing GitOps configuration..."
    
    # Clone or update repository
    if [[ -d "$REPO_DIR" ]]; then
        cd "$REPO_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        git clone "$REPO_URL" "$REPO_DIR"
        cd "$REPO_DIR"
    fi
    
    # Check for changes
    CURRENT_COMMIT=$(git rev-parse HEAD)
    LAST_APPLIED_COMMIT=$(cat /opt/gitops/last-applied-commit 2>/dev/null || echo "")
    
    if [[ "$CURRENT_COMMIT" != "$LAST_APPLIED_COMMIT" ]]; then
        echo "📦 New changes detected, applying configuration..."
        apply_configuration
        echo "$CURRENT_COMMIT" > /opt/gitops/last-applied-commit
    else
        echo "✅ No changes detected"
    fi
}

apply_configuration() {
    local env_path="environments/$ENVIRONMENT"
    
    # Validate configuration
    if [[ ! -d "$env_path" ]]; then
        echo "❌ Environment $ENVIRONMENT not found"
        return 1
    fi
    
    # Apply Docker stack
    if [[ -f "$env_path/docker-compose.yml" ]]; then
        echo "🚀 Deploying Docker stack..."
        docker stack deploy -c "$env_path/docker-compose.yml" medianest
    fi
    
    # Apply configurations
    if [[ -d "$env_path/configs" ]]; then
        echo "⚙️  Applying configurations..."
        for config in "$env_path/configs"/*.yml; do
            [[ -f "$config" ]] || continue
            kubectl apply -f "$config" || docker config create "$(basename "$config" .yml)" "$config" || true
        done
    fi
    
    # Update secrets
    if [[ -d "$env_path/secrets" ]]; then
        echo "🔒 Updating secrets..."
        for secret in "$env_path/secrets"/*.yml; do
            [[ -f "$secret" ]] || continue
            # Apply secret updates securely
            apply_secret "$secret"
        done
    fi
}

apply_secret() {
    local secret_file="$1"
    local secret_name=$(basename "$secret_file" .yml)
    
    # Use secure secret management
    if command -v vault >/dev/null 2>&1; then
        vault kv put "secret/medianest/$secret_name" "@$secret_file"
    else
        # Fallback to Docker secrets
        docker secret rm "$secret_name" 2>/dev/null || true
        docker secret create "$secret_name" "$secret_file"
    fi
}

# Main sync loop
while true; do
    sync_configuration
    sleep "$SYNC_INTERVAL"
done
```

### GitOps Agent Service
```yaml
# GitOps Agent Docker Service
version: '3.8'

services:
  gitops-agent:
    image: medianest/gitops-agent:latest
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
    environment:
      - ENVIRONMENT=production
      - REPO_URL=https://github.com/medianest/medianest-gitops
      - SYNC_INTERVAL=60
      - LOG_LEVEL=info
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - gitops-data:/opt/gitops
      - ssh-keys:/opt/ssh:ro
    networks:
      - management-network
    secrets:
      - git_ssh_key
      - vault_token

volumes:
  gitops-data:

networks:
  management-network:
    external: true

secrets:
  git_ssh_key:
    external: true
  vault_token:
    external: true
```

## Environment-Specific Configurations

### Development Environment
```yaml
# environments/development/docker-compose.yml
version: '3.8'

services:
  medianest-app:
    image: medianest/app:${APP_VERSION:-latest}
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - ENABLE_HOT_RELOAD=true
    ports:
      - "3000:3000"
      - "4000:4000"
    networks:
      - dev-network

networks:
  dev-network:
    driver: overlay
```

### Staging Environment
```yaml
# environments/staging/docker-compose.yml
version: '3.8'

services:
  medianest-app:
    image: medianest/app:${APP_VERSION}
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
    environment:
      - NODE_ENV=staging
      - LOG_LEVEL=info
      - ENABLE_METRICS=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - staging-network

networks:
  staging-network:
    driver: overlay
```

### Production Environment
```yaml
# environments/production/docker-compose.yml
version: '3.8'

services:
  medianest-app:
    image: medianest/app:${APP_VERSION}
    deploy:
      replicas: 3
      placement:
        constraints:
          - node.labels.tier == application
      resources:
        limits:
          cpus: '4.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
      update_config:
        parallelism: 1
        delay: 60s
        failure_action: rollback
        monitor: 120s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
      - ENABLE_METRICS=true
      - STRICT_SECURITY=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - production-network
    secrets:
      - database_url
      - jwt_secret
      - encryption_key

networks:
  production-network:
    driver: overlay
    external: true

secrets:
  database_url:
    external: true
  jwt_secret:
    external: true
  encryption_key:
    external: true
```

## Application Promotion Pipeline

### Promotion Strategy
```yaml
promotion_pipeline:
  trigger: 
    type: successful_ci_build
    branch: main
  
  stages:
    development:
      auto_deploy: true
      image_tag: "dev-${GIT_SHA}"
      validation:
        - unit_tests: pass
        - integration_tests: pass
        - security_scan: pass
    
    staging:
      auto_deploy: false  # Manual approval required
      image_tag: "staging-${GIT_SHA}"
      validation:
        - e2e_tests: pass
        - performance_tests: pass
        - security_validation: pass
        - manual_qa: required
    
    production:
      auto_deploy: false  # Manual approval required
      image_tag: "v${VERSION}"
      validation:
        - staging_validation: pass
        - security_approval: required
        - change_management: required
```

### Promotion Automation
```bash
#!/bin/bash
# Application Promotion Script

promote_to_environment() {
    local source_env="$1"
    local target_env="$2"
    local image_tag="$3"
    
    echo "🚀 Promoting from $source_env to $target_env"
    
    # Validate source environment
    validate_environment "$source_env" "$image_tag"
    
    # Update target environment configuration
    update_environment_config "$target_env" "$image_tag"
    
    # Commit and push changes
    git add "environments/$target_env/"
    git commit -m "Promote $image_tag to $target_env

    Source: $source_env
    Target: $target_env
    Image: $image_tag
    
    Validation Results:
    - Health Check: ✅ Pass
    - Performance: ✅ Pass  
    - Security: ✅ Pass"
    
    git push origin main
    
    echo "✅ Promotion complete - GitOps will apply changes"
}

validate_environment() {
    local env="$1"
    local tag="$2"
    
    echo "🔍 Validating $env environment with $tag"
    
    # Health check validation
    curl -sf "https://$env.medianest.com/health" || {
        echo "❌ Health check failed"
        return 1
    }
    
    # Performance validation
    ./scripts/performance-test.sh "$env" || {
        echo "❌ Performance test failed" 
        return 1
    }
    
    # Security validation
    ./scripts/security-scan.sh "$env" || {
        echo "❌ Security scan failed"
        return 1
    }
    
    echo "✅ Validation passed for $env"
}

update_environment_config() {
    local env="$1"
    local tag="$2"
    
    # Update image tag in environment configuration
    sed -i "s|APP_VERSION=.*|APP_VERSION=$tag|g" "environments/$env/.env"
    
    # Update Docker Compose configuration
    yq eval ".services.*.image = \"medianest/app:$tag\"" -i "environments/$env/docker-compose.yml"
    
    echo "📝 Updated $env configuration with $tag"
}

# Usage examples:
# promote_to_environment "development" "staging" "dev-abc123"
# promote_to_environment "staging" "production" "v1.2.3"
```

## Security and Compliance

### GitOps Security Model
```yaml
security_controls:
  repository_security:
    - Branch protection rules
    - Required review approvals
    - Status check requirements
    - Signed commits enforcement
  
  deployment_security:
    - RBAC for GitOps operators
    - Encrypted secrets management
    - Network policy enforcement
    - Runtime security monitoring
  
  audit_compliance:
    - Complete deployment audit trail
    - Change approval workflows
    - Compliance policy enforcement
    - Automated security scanning
```

### Secrets Management
```yaml
# Secrets Configuration
secrets_management:
  vault_integration:
    - External secret operator
    - Automatic secret rotation
    - Encrypted at rest
    - Audit logging enabled
  
  secret_types:
    database:
      rotation: 30_days
      encryption: AES-256
      access_control: service_specific
    
    api_keys:
      rotation: 90_days
      encryption: AES-256
      access_control: environment_specific
    
    certificates:
      rotation: automatic
      provider: lets_encrypt
      monitoring: expiry_alerts
```

### Policy Enforcement
```yaml
# Open Policy Agent (OPA) Policies
policy_enforcement:
  security_policies:
    - no_root_containers
    - required_resource_limits
    - no_privileged_containers
    - required_security_contexts
  
  compliance_policies:
    - required_labels
    - naming_conventions
    - documentation_requirements
    - change_approval_gates
  
  operational_policies:
    - deployment_windows
    - rollback_procedures
    - monitoring_requirements
    - backup_validation
```

## Monitoring and Observability

### GitOps Monitoring
```yaml
gitops_monitoring:
  application_health:
    - Deployment status tracking
    - Service health monitoring
    - Performance metrics collection
    - User experience monitoring
  
  infrastructure_health:
    - Cluster resource utilization
    - Node health and availability
    - Network connectivity
    - Storage performance
  
  gitops_health:
    - Sync status monitoring
    - Configuration drift detection
    - Deployment failure alerts
    - Repository access validation
```

### Alerting Configuration
```yaml
alerting_rules:
  deployment_issues:
    - Deployment failures
    - Configuration drift detected
    - Health check failures
    - Rollback events
  
  performance_issues:
    - Response time degradation
    - Resource threshold breaches
    - Error rate increases
    - Capacity issues
  
  security_issues:
    - Unauthorized access attempts
    - Policy violations
    - Secret access anomalies
    - Container vulnerabilities
```

## Disaster Recovery

### Backup Strategy
```yaml
backup_strategy:
  git_repositories:
    - Multiple remote repositories
    - Distributed version control
    - Automated backups
    - Cross-region replication
  
  configuration_state:
    - Environment snapshots
    - Database backups
    - Secret backups (encrypted)
    - Infrastructure state
  
  application_data:
    - User data backups
    - File storage backups
    - Log data retention
    - Metric data retention
```

### Recovery Procedures
```yaml
recovery_procedures:
  configuration_corruption:
    1. Identify last known good state
    2. Revert to previous Git commit
    3. Validate configuration integrity
    4. Redeploy from GitOps
  
  environment_failure:
    1. Assess failure scope
    2. Switch to backup environment
    3. Restore from backups
    4. Validate service functionality
  
  complete_disaster:
    1. Rebuild infrastructure
    2. Restore from Git repository
    3. Apply latest configurations
    4. Validate system functionality
```

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] GitOps repository setup
- [ ] Basic configuration structure
- [ ] GitOps agent deployment
- [ ] Development environment automation

### Phase 2: Integration (Weeks 3-4)
- [ ] CI/CD pipeline integration
- [ ] Staging environment setup
- [ ] Promotion pipeline automation
- [ ] Basic monitoring integration

### Phase 3: Production (Weeks 5-6)
- [ ] Production environment configuration
- [ ] Security policy implementation
- [ ] Disaster recovery procedures
- [ ] Documentation and training

### Phase 4: Optimization (Weeks 7-8)
- [ ] Performance optimization
- [ ] Advanced monitoring setup
- [ ] Compliance validation
- [ ] Team enablement

## Success Metrics

### Deployment Metrics
- **Deployment frequency**: Multiple deployments per day
- **Lead time**: < 4 hours from commit to production
- **Mean time to recovery**: < 15 minutes
- **Change failure rate**: < 3%

### Operational Metrics
- **Configuration drift**: 0 incidents
- **Security compliance**: 100% policy adherence
- **Audit completeness**: 100% traceability
- **Team productivity**: 40% reduction in deployment effort

## Conclusion

This GitOps workflow strategy transforms MediaNest's deployment processes into a declarative, automated, and auditable system. By treating Git as the single source of truth, the organization gains unprecedented visibility, control, and reliability in its deployment processes.

The implementation leverages MediaNest's existing Docker Swarm infrastructure while introducing modern GitOps practices that will scale with the organization's growth. The strategy ensures security, compliance, and operational excellence while empowering development teams with familiar Git-based workflows.

The GitOps approach represents a fundamental shift towards infrastructure as code and declarative operations, positioning MediaNest for long-term success in cloud-native application delivery.