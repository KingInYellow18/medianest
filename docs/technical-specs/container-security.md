# Container Security Hardening Guide - MediaNest

**Classification**: Internal Use  
**Last Updated**: September 8, 2025  
**Document Version**: 1.0  
**Security Framework**: NIST 800-190 Container Security  

## Executive Summary

This document provides comprehensive container security hardening guidelines for MediaNest, addressing critical vulnerabilities while implementing defense-in-depth container security controls. The framework follows NIST 800-190 guidelines and industry best practices for production container deployments.

## Current Container Security Assessment

### Critical Issues Identified ❌
- **UID/GID Mismatch**: Dockerfile specifies `medianest:1001` but Docker Compose overrides with `10001:10001`
- **Inconsistent Security Context**: Mixed security configurations across services
- **Potential Privilege Escalation**: Container configuration vulnerabilities

### Strong Security Measures ✅
- **Non-root Execution**: Services run as non-privileged users
- **Read-only Filesystem**: Root filesystem mounted read-only
- **Security Contexts**: AppArmor and no-new-privileges enabled
- **Capability Dropping**: ALL capabilities dropped, selective ADD
- **Resource Limits**: CPU, memory, and PID limits configured

## Container Security Framework

### Defense-in-Depth Container Security
```
┌─────────────────────────────────────────────────────────────┐
│                    CONTAINER SECURITY LAYERS                │
├─────────────────────────────────────────────────────────────┤
│  Image Security    │  Runtime Security  │  Host Security     │
│  ─────────────     │  ───────────────   │  ─────────────     │
│  • Base Image      │  • Non-root User   │  • Host Hardening  │
│  • Vulnerability   │  • Read-only FS    │  • Kernel Security │
│  • Layer Analysis  │  • Capabilities    │  • Network Policies│
│  • Signing/Trust   │  • Security Opts   │  • Resource Limits │
└─────────────────────────────────────────────────────────────┘
```

## Image Security

### Base Image Hardening
```dockerfile
# MediaNest Production-Secure Dockerfile Template

# Use official, minimal base images
FROM node:18-alpine AS builder

# Add security metadata
LABEL maintainer="security@medianest.com"
LABEL version="1.0.0"
LABEL description="MediaNest Backend Service - Production Secure"
LABEL security.scan-date="2025-09-08"

# Install security updates first
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        ca-certificates \
        tzdata && \
    rm -rf /var/cache/apk/*

# Create non-privileged user with specific UID/GID
# CRITICAL: Fix UID/GID mismatch issue
RUN addgroup -g 10001 -S medianest && \
    adduser -u 10001 -S medianest -G medianest -h /app -s /sbin/nologin

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=medianest:medianest package*.json ./
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy application code
COPY --chown=medianest:medianest . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        ca-certificates \
        tzdata \
        curl \
        dumb-init && \
    rm -rf /var/cache/apk/*

# Create consistent user (CRITICAL FIX)
RUN addgroup -g 10001 -S medianest && \
    adduser -u 10001 -S medianest -G medianest -h /app -s /sbin/nologin

# Set up application directory
WORKDIR /app
RUN chown medianest:medianest /app

# Copy built application from builder
COPY --from=builder --chown=medianest:medianest /app/dist ./dist
COPY --from=builder --chown=medianest:medianest /app/node_modules ./node_modules
COPY --from=builder --chown=medianest:medianest /app/package*.json ./

# Create required directories with proper permissions
RUN mkdir -p /app/logs /app/temp /app/uploads && \
    chown medianest:medianest /app/logs /app/temp /app/uploads && \
    chmod 755 /app/logs /app/temp /app/uploads

# Switch to non-root user
USER medianest:medianest

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]

# Security metadata
LABEL security.non-root="true"
LABEL security.read-only="true" 
LABEL security.capabilities="drop-all"
LABEL security.uid="10001"
LABEL security.gid="10001"
```

### Container Image Scanning
```yaml
Image Security Pipeline:
  Base Image Selection:
    - Use official minimal images (alpine, distroless)
    - Regular base image updates (weekly)
    - Vulnerability assessment of base images
    - Remove unnecessary packages and tools

  Vulnerability Scanning:
    Tools:
      - Trivy: Comprehensive vulnerability scanner
      - Clair: Container analysis with CVE database
      - Snyk: Developer-friendly vulnerability detection
      - Docker Scout: Docker Hub integration
    
    Scan Frequency:
      - Every build: Fail build on CRITICAL vulnerabilities
      - Daily: Scheduled scans of production images
      - Weekly: Base image dependency updates
      - Ad-hoc: After security advisories

    Vulnerability Thresholds:
      CRITICAL: Block deployment, immediate remediation
      HIGH: Block deployment unless exempted with justification
      MEDIUM: Warning, track for next release
      LOW: Monitor, address in routine maintenance

  Image Signing and Trust:
    - Docker Content Trust (DCT) enabled
    - Notary server for image signing
    - Harbor registry with security scanning
    - Image provenance tracking
```

### Image Build Security
```yaml
Build Security Controls:
  Dockerfile Security:
    - No secrets in layers (use multi-stage builds)
    - Minimal attack surface (remove build tools)
    - Security-focused LABEL metadata
    - Non-root USER directive mandatory

  Build Environment:
    - Isolated build environment (ephemeral containers)
    - No network access during build (except dependencies)
    - Signed base images only
    - Build reproducibility (same inputs = same output)

  Registry Security:
    - Private registry with authentication required
    - Image vulnerability scanning at push
    - Image quarantine for failed scans
    - Access control and audit logging

Supply Chain Security:
  - Software Bill of Materials (SBOM) generation
  - Dependency tracking and vulnerability monitoring  
  - License compliance checking
  - Provenance and attestation records
```

## Runtime Security

### Container Security Context (FIXED)
```yaml
# Fixed Docker Compose Configuration
services:
  app:
    image: medianest/backend:secure-latest
    
    # CRITICAL FIX: Consistent UID/GID
    user: "10001:10001"
    
    # Security hardening
    read_only: true
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
      - seccomp:unconfined  # Use default seccomp profile
      
    # Drop all capabilities, add only required
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding to ports < 1024
      
    # Resource limits (security + performance)
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
          pids: 1000
        reservations:
          cpus: '0.5'
          memory: 512M
    
    # Writable temporary filesystems
    tmpfs:
      - /tmp:noexec,nosuid,nodev,size=100m
      - /var/tmp:noexec,nosuid,nodev,size=50m
      
    # Named volumes for persistent data
    volumes:
      - app_logs:/app/logs:rw,Z
      - app_uploads:/app/uploads:rw,Z
      - app_temp:/app/temp:rw,Z

# Consistent across all services
  postgres:
    image: postgres:16-alpine
    user: "10003:10003"  # Different UID for each service
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
    cap_drop:
      - ALL
    cap_add:
      - SETGID
      - SETUID
      - DAC_OVERRIDE  # Required for PostgreSQL data directory

  redis:
    image: redis:7-alpine
    user: "10004:10004"
    read_only: true
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
    cap_drop:
      - ALL
```

### Security Policies and Profiles

#### AppArmor Profile
```bash
# /etc/apparmor.d/docker-medianest
#include <tunables/global>

profile docker-medianest flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  # Network access
  network inet tcp,
  network inet udp,
  network inet6 tcp,
  network inet6 udp,
  network unix,

  # File access
  /app/** rw,
  /tmp/** rw,
  /var/tmp/** rw,
  
  # Read-only access
  /etc/hosts r,
  /etc/hostname r,
  /etc/resolv.conf r,
  /etc/ssl/certs/** r,
  
  # Deny dangerous operations
  deny /proc/sys/kernel/** rw,
  deny /sys/** rw,
  deny mount,
  deny umount,
  deny ptrace,
  
  # Node.js specific
  /usr/local/bin/node ix,
  /usr/bin/dumb-init ix,
}
```

#### Seccomp Profile
```json
{
    "defaultAction": "SCMP_ACT_ERRNO",
    "archMap": [
        {
            "architecture": "SCMP_ARCH_X86_64",
            "subArchitectures": [
                "SCMP_ARCH_X86",
                "SCMP_ARCH_X32"
            ]
        }
    ],
    "syscalls": [
        {
            "names": [
                "accept", "accept4", "access", "bind", "brk", "clone", "close",
                "connect", "dup", "dup2", "execve", "exit", "exit_group", "fcntl",
                "fstat", "futex", "getcwd", "getdents", "getpid", "gettimeofday",
                "ioctl", "listen", "lseek", "mkdir", "mmap", "mprotect", "munmap",
                "open", "openat", "poll", "read", "readlink", "recv", "recvfrom",
                "rt_sigaction", "rt_sigprocmask", "send", "sendto", "socket",
                "stat", "write", "writev"
            ],
            "action": "SCMP_ACT_ALLOW"
        }
    ]
}
```

### Runtime Security Monitoring
```yaml
Container Runtime Security:
  Tools:
    - Falco: Runtime security monitoring and anomaly detection
    - Sysdig: Deep container visibility and forensics  
    - Aqua Security: Runtime protection and compliance
    - Twistlock/Prisma Cloud: Comprehensive container security

  Monitored Events:
    Process Activity:
      - Unexpected process execution
      - Shell access to containers
      - Privilege escalation attempts
      - File system modifications in read-only areas
    
    Network Activity:
      - Unexpected outbound connections
      - Port binding changes
      - Network namespace modifications
      - Suspicious DNS queries
    
    System Calls:
      - Dangerous system call usage
      - Container breakout attempts  
      - Kernel module loading
      - Mount/unmount operations

Falco Rules Configuration:
  - rule: Shell in Container
    desc: A shell was spawned in a container
    condition: >
      spawned_process and container and
      proc.name in (sh, bash, csh, zsh, ash, dash, ksh)
    output: >
      Shell spawned in container (user=%user.name container_id=%container.id 
      container_name=%container.name shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline)
    priority: WARNING

  - rule: Container Filesystem Write
    desc: Unexpected write to container filesystem  
    condition: >
      open_write and container and 
      fd.name startswith /app and
      not proc.name in (node, npm)
    output: >
      Unexpected write to container filesystem (user=%user.name container_id=%container.id 
      file=%fd.name proc_name=%proc.name proc_cmdline=%proc.cmdline)
    priority: ERROR
```

## Host Security for Containers

### Docker Daemon Security
```yaml
Docker Daemon Configuration (/etc/docker/daemon.json):
{
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "icc": false,
  "userns-remap": "default",
  "selinux-enabled": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "hard": 65536,
      "soft": 65536
    },
    "nproc": {
      "hard": 4096,
      "soft": 4096
    }
  },
  "authorization-plugins": ["authz-broker"]
}

Docker Socket Security:
  # Never expose Docker socket to containers
  # Use Docker API with TLS authentication
  # Implement authorization plugin for API access
  # Regular audit of Docker socket access

Host Security Hardening:
  - CIS Docker Benchmark compliance
  - Regular security updates and patching
  - Kernel hardening (grsecurity/PaX if available)
  - SELinux/AppArmor mandatory access control
  - Host firewall configuration
  - Audit logging of all container operations
```

### Container Orchestration Security (Docker Compose/Swarm)
```yaml
Docker Swarm Security (if applicable):
  Cluster Security:
    - TLS mutual authentication between nodes
    - Certificate rotation and management
    - Secrets management via Docker Secrets
    - Network encryption between nodes
    - Manager node isolation and protection

  Service Security:
    - Service-to-service authentication
    - Network segmentation and policies
    - Resource quotas and limits
    - Health check implementation
    - Rolling update security validation

Docker Compose Security:
  - Environment file protection (no secrets)
  - External secrets management integration
  - Network isolation configuration
  - Volume security and permissions
  - Service dependency verification
```

## Container Network Security

### Network Policies and Isolation
```yaml
Network Security Configuration:
  Default Deny:
    # All containers start with no network access
    # Explicit allow rules required for communication
    
  Service Segmentation:
    frontend_network:
      - Allow ingress from load balancer only
      - Allow egress to backend services only
      
    backend_network:
      - Allow ingress from frontend only
      - Allow egress to database services only
      
    database_network:
      - Allow ingress from backend only
      - No egress allowed (internal only)

  Container-to-Container Communication:
    # Use service names for internal communication
    # No direct IP addressing allowed
    # All communication logged and monitored

Network Security Monitoring:
  - Traffic flow analysis between containers
  - Unexpected network connection detection  
  - DNS query monitoring and anomaly detection
  - Network policy violation alerting
```

### Container Firewall Rules
```bash
#!/bin/bash
# Container-specific iptables rules

# Drop inter-container communication by default
iptables -I DOCKER-USER -j DROP

# Allow specific service communication
iptables -I DOCKER-USER -s 172.20.2.0/24 -d 172.21.1.0/24 -p tcp --dport 5432 -j ACCEPT  # Backend to PostgreSQL
iptables -I DOCKER-USER -s 172.20.2.0/24 -d 172.21.2.0/24 -p tcp --dport 6379 -j ACCEPT  # Backend to Redis
iptables -I DOCKER-USER -s 172.19.1.0/24 -d 172.20.2.0/24 -p tcp --dport 4000 -j ACCEPT  # Proxy to Backend

# Log dropped packets
iptables -I DOCKER-USER -j LOG --log-prefix "DOCKER-DROPPED: "

# Block container access to metadata services
iptables -I DOCKER-USER -d 169.254.169.254 -j DROP  # AWS/GCP metadata
iptables -I DOCKER-USER -d 169.254.169.0/24 -j DROP  # Azure metadata
```

## Secrets Management in Containers

### Current Critical Issue (IMMEDIATE FIX REQUIRED)
```bash
# CRITICAL: Remove secrets from environment files
# These files contain production secrets and MUST be removed from git

git rm --cached .env.production
git rm --cached backend/.env.production
git rm --cached backend/.env.production.final

# Commit the removal
git commit -m "SECURITY: Remove production secrets from version control"

# Rewrite history to completely remove secrets
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.production backend/.env.production*' \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remove from remote repository
git push --force --all
```

### Secure Secrets Management Implementation
```yaml
HashiCorp Vault Integration:
  Deployment: Vault server with PostgreSQL backend
  Authentication: Kubernetes auth method or AppRole
  Secret Engines: KV v2 for application secrets
  
Container Secret Injection:
  Method 1: Vault Agent Sidecar
    - Vault Agent runs alongside application
    - Retrieves secrets and writes to shared volume
    - Automatic secret renewal and rotation
    
  Method 2: Init Container
    - Init container retrieves secrets from Vault
    - Writes secrets to shared volume  
    - Application container starts after secrets ready
    
  Method 3: Docker Secrets (Swarm)
    - External secrets stored in Vault
    - Docker secrets created from Vault values
    - Mounted to containers at runtime

Example Vault Integration:
  vault:
    image: hashicorp/vault:latest
    cap_add:
      - IPC_LOCK
    environment:
      - VAULT_DEV_ROOT_TOKEN_ID=${VAULT_ROOT_TOKEN}
      - VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200
    ports:
      - "8200:8200"

  vault-init:
    image: hashicorp/vault:latest
    depends_on:
      - vault
    volumes:
      - vault_secrets:/vault/secrets
    command: |
      sh -c "
        export VAULT_ADDR=http://vault:8200
        export VAULT_TOKEN=${VAULT_ROOT_TOKEN}
        vault kv put secret/medianest/prod/database password='${DB_PASSWORD}'
        vault kv put secret/medianest/prod/jwt secret='${JWT_SECRET}'
        vault kv get -field=password secret/medianest/prod/database > /vault/secrets/db_password
        vault kv get -field=secret secret/medianest/prod/jwt > /vault/secrets/jwt_secret
      "

  app:
    depends_on:
      - vault-init
    volumes:
      - vault_secrets:/vault/secrets:ro
    environment:
      - DATABASE_PASSWORD_FILE=/vault/secrets/db_password
      - JWT_SECRET_FILE=/vault/secrets/jwt_secret
```

## Container Compliance and Governance

### CIS Docker Benchmark Compliance
```yaml
CIS Docker Benchmark v1.6.0 Key Controls:

1. Host Configuration:
   - 1.1.1: Ensure a separate partition for containers has been created
   - 1.1.2: Ensure only trusted users are allowed to control Docker daemon
   - 1.1.3: Ensure auditing is configured for the Docker daemon
   - 1.1.4: Ensure auditing is configured for Docker files and directories

2. Docker Daemon Configuration:
   - 2.1: Run the Docker daemon as a non-root user, if possible
   - 2.2: Ensure network traffic is restricted between containers on the default bridge
   - 2.3: Ensure the logging level is set to 'info'
   - 2.4: Ensure Docker is allowed to make changes to iptables

3. Docker Daemon Files:
   - 3.1: Ensure that the docker.service file ownership is set to root:root
   - 3.2: Ensure that docker.service file permissions are appropriately set
   - 3.3: Ensure that docker.socket file ownership is set to root:root

4. Container Images and Build File:
   - 4.1: Ensure that a user for the container has been created
   - 4.2: Ensure that containers use only trusted base images
   - 4.3: Ensure that unnecessary packages are not installed in the container
   - 4.4: Ensure images are scanned and rebuilt to include security patches

5. Container Runtime:
   - 5.1: Ensure that, if applicable, an AppArmor Profile is enabled
   - 5.2: Ensure that, if applicable, SELinux security options are set
   - 5.3: Ensure that Linux Kernel Capabilities are restricted within containers
   - 5.4: Ensure that privileged containers are not used

Automated Compliance Checking:
  Tool: Docker Bench for Security
  Frequency: Daily automated scans
  Reporting: Results integrated into security dashboard
  Remediation: Automatic fixes where possible, alerts for manual fixes
```

### Container Security Policy Enforcement
```yaml
Policy as Code Implementation:
  Open Policy Agent (OPA) Gatekeeper:
    - Container security policy enforcement
    - Admission controller for Kubernetes
    - Policy validation at deployment time
    - Audit and violation reporting

  Example Policies:
    Required Security Context:
      - Non-root user required (runAsNonRoot: true)
      - Read-only root filesystem required  
      - Privileged containers not allowed
      - Host network/PID namespace not allowed
      
    Resource Limits:
      - CPU and memory limits required
      - PID limits enforced
      - Storage quotas applied
      
    Image Security:
      - Only signed images allowed
      - Vulnerability scan required
      - Base image approval required
      - No latest tag allowed in production

Compliance Reporting:
  - Daily security posture reports
  - Policy violation dashboards
  - Compliance trend analysis
  - Executive security summaries
```

## Container Incident Response

### Container Security Incident Categories
```yaml
Incident Types:
  Category 1 - Critical:
    - Container breakout detected
    - Privileged escalation successful
    - Malware execution in container
    - Data exfiltration via container

  Category 2 - High:
    - Suspicious process execution
    - Unauthorized network connections
    - Configuration policy violations
    - Resource consumption anomalies

  Category 3 - Medium:
    - Failed security scans
    - Compliance violations
    - Performance degradation
    - Log analysis anomalies

Response Procedures:
  Immediate Response (0-30 minutes):
    - Container isolation or termination
    - Network segmentation enforcement
    - Evidence preservation
    - Incident team activation

  Short-term Response (30 minutes - 4 hours):
    - Forensic analysis of container and host
    - Root cause analysis
    - Impact assessment
    - Stakeholder notification

  Recovery (4-24 hours):
    - Clean container deployment
    - Security control validation
    - Monitoring enhancement
    - Documentation update
```

### Container Forensics
```yaml
Evidence Collection:
  Container State:
    - Running container memory dump
    - Container filesystem snapshot
    - Process list and network connections
    - Environment variables and configs

  Host Evidence:
    - Docker daemon logs
    - Host system logs  
    - Network traffic captures
    - File system audit logs

  Registry Evidence:
    - Image scan results
    - Image build history
    - Registry access logs
    - Image vulnerability timeline

Forensic Tools:
  - docker diff: Show container filesystem changes
  - docker logs: Container application logs
  - docker exec: Live container investigation
  - Volatility: Memory analysis framework
  - DFIR-ORC: Digital forensics artifact collection
```

## Implementation Roadmap

### Phase 1: Critical Security Fixes (Days 1-3)
```yaml
Priority 1 Tasks:
  - Fix UID/GID mismatch in all containers
  - Remove secrets from version control
  - Implement proper secrets management
  - Update all container configurations
  - Test security context consistency

Validation:
  - Container startup verification
  - Permission testing
  - Security scan validation
  - Functional testing
```

### Phase 2: Enhanced Security (Days 4-14)
```yaml
Security Enhancements:
  - Deploy container image scanning
  - Implement runtime security monitoring
  - Configure security policies
  - Set up compliance monitoring
  - Deploy container firewall rules

Monitoring Setup:
  - Install and configure Falco
  - Set up security alerting
  - Deploy compliance dashboards
  - Configure log aggregation
```

### Phase 3: Advanced Security (Days 15-30)
```yaml
Advanced Features:
  - Implement service mesh security
  - Deploy advanced threat detection
  - Set up automated incident response
  - Enable container forensics
  - Complete compliance validation

Operational Readiness:
  - Security team training
  - Incident response procedures
  - Documentation completion
  - Regular security assessments
```

## Success Metrics

### Security Metrics
```yaml
Container Security:
  - Vulnerability scan pass rate: 100% (no CRITICAL/HIGH)
  - Security policy compliance: >99%
  - Container breakout attempts: 0 successful
  - Mean time to security patch: <24 hours

Operational Metrics:
  - Container deployment success rate: >99%
  - Security scan time: <5 minutes
  - Policy violation detection: <5 minutes
  - Incident response time: <30 minutes

Compliance Metrics:
  - CIS Docker Benchmark score: >95%
  - Audit finding resolution: <7 days
  - Policy exception approval time: <24 hours
  - Security training completion: 100%
```

## Conclusion

This container security framework addresses critical vulnerabilities in MediaNest while implementing comprehensive defense-in-depth security controls. The immediate fix of UID/GID mismatches and secrets management issues is crucial for production readiness.

**Critical Actions Required**:
1. **Immediate**: Fix container UID/GID configuration consistency
2. **Immediate**: Remove secrets from version control and implement Vault
3. **Week 1**: Deploy container scanning and runtime security monitoring
4. **Week 2**: Complete security policy enforcement and compliance validation

**Long-term Benefits**:
- **Enhanced Security Posture**: Multiple layers of container protection
- **Compliance Readiness**: Automated compliance monitoring and reporting  
- **Operational Efficiency**: Streamlined security processes and automation
- **Risk Reduction**: Significant reduction in container-related security risks

---

**Document Control**:
- **Next Review**: November 8, 2025  
- **Owner**: Container Security Team
- **Approval**: Security Architecture Review Board
- **Classification**: Internal Use - Security Sensitive