# MediaNest Backend Deployment Specification

## Executive Summary

This document provides detailed deployment specifications for MediaNest's Express.js backend integration with the existing PR-1 foundation infrastructure. The deployment follows production-ready practices with comprehensive security, monitoring, and operational procedures.

---

## 1. Deployment Prerequisites

### 1.1 Infrastructure Requirements

**Host System:**

- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: Minimum 4GB, Recommended 8GB
- **CPU**: 2+ cores, Recommended 4+ cores
- **Storage**: 50GB+ available space
- **Network**: Static IP address with domain name

**Software Dependencies:**

```bash
# Docker & Docker Compose
docker --version          # >= 20.10.0
docker-compose --version  # >= 1.29.0

# System utilities
curl --version            # For health checks
openssl version           # For SSL certificates
git --version            # For repository management
```

**Firewall Configuration:**

```bash
# Required ports
80/tcp    # HTTP (redirect to HTTPS)
443/tcp   # HTTPS (main application)
22/tcp    # SSH (administration)

# Optional monitoring ports (restrict to monitoring network)
9090/tcp  # Prometheus (if using external monitoring)
3000/tcp  # Grafana (if using external monitoring)
```

### 1.2 Domain and DNS Configuration

**DNS Records Required:**

```dns
# A Record
your-domain.com.    IN  A     your-server-ip

# CNAME (optional, for www)
www.your-domain.com. IN CNAME your-domain.com.

# Verification
dig your-domain.com A
nslookup your-domain.com
```

**SSL Certificate Strategy:**

- **Development**: Self-signed certificates
- **Production**: Let's Encrypt via Certbot
- **Enterprise**: Commercial SSL certificates

---

## 2. Pre-Deployment Setup

### 2.1 Repository Preparation

```bash
# 1. Clone repository
git clone https://github.com/your-org/medianest.git
cd medianest

# 2. Switch to production branch
git checkout claude-flow2

# 3. Verify backend structure
ls -la backend/
ls -la backend/Dockerfile.prod
```

### 2.2 Environment Configuration

```bash
# 1. Copy environment template
cp BACKEND_ENVIRONMENT_TEMPLATE.env .env

# 2. Edit configuration
nano .env

# 3. Validate required variables
./scripts/validate-env.js
```

### 2.3 Docker Secrets Generation

```bash
# Generate all required secrets
./scripts/generate-docker-secrets.sh

# Verify secrets created
ls -la secrets/
```

**Generated Secrets:**

- `database_url` - PostgreSQL connection string
- `postgres_password` - Database password
- `redis_url` - Redis connection string
- `redis_password` - Redis password
- `jwt_secret` - JWT signing key (256-bit)
- `encryption_key` - AES-256-GCM key (32 bytes)
- `nextauth_secret` - NextAuth.js secret
- `plex_client_id` - Plex OAuth client ID
- `plex_client_secret` - Plex OAuth client secret
- `backup_encryption_key` - Backup encryption key

### 2.4 SSL Certificate Setup

```bash
# Initial certificate request (Let's Encrypt)
./infrastructure/scripts/setup-ssl-enhanced.sh your-domain.com admin@your-domain.com

# Verify certificates
ls -la /etc/letsencrypt/live/your-domain.com/
```

---

## 3. Deployment Execution

### 3.1 Build Process

```bash
# 1. Build production images
docker-compose -f docker-compose.prod.yml build --no-cache

# 2. Verify images created
docker images | grep medianest

# Expected images:
# medianest/backend:latest
# medianest/frontend:latest
# medianest/nginx:latest
# medianest/backup:latest
```

### 3.2 Database Initialization

```bash
# 1. Start database service only
docker-compose -f docker-compose.prod.yml up -d postgres redis

# 2. Wait for database to be ready
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U medianest

# 3. Run initial migration
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 4. Verify database schema
docker-compose -f docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "\dt"
```

### 3.3 Service Deployment

```bash
# 1. Deploy all services
docker-compose -f docker-compose.prod.yml up -d

# 2. Monitor startup logs
docker-compose -f docker-compose.prod.yml logs -f

# 3. Wait for all services to be healthy
./scripts/wait-for-services.sh
```

### 3.4 Service Startup Sequence

**Automated Startup Order:**

1. **PostgreSQL** (30s startup) → Healthy
2. **Redis** (20s startup) → Healthy
3. **Backend** (60s startup) → Healthy
4. **Frontend** (45s startup) → Healthy
5. **Nginx** (30s startup) → Healthy

**Startup Verification:**

```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Expected output:
# medianest-postgres   Up (healthy)
# medianest-redis      Up (healthy)
# medianest-backend    Up (healthy)
# medianest-frontend   Up (healthy)
# medianest-nginx      Up (healthy)
```

---

## 4. Post-Deployment Verification

### 4.1 Health Check Validation

```bash
# 1. System health check
curl -f https://your-domain.com/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-01-21T10:00:00.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "plex": "healthy",
    "overseerr": "healthy"
  }
}

# 2. Service-specific health checks
curl -f http://localhost/nginx_status  # Nginx status
docker-compose exec postgres pg_isready -U medianest  # PostgreSQL
docker-compose exec redis redis-cli ping  # Redis
```

### 4.2 API Endpoint Testing

```bash
# 1. API responsiveness
curl -X GET https://your-domain.com/api/v1/health

# 2. Authentication endpoint
curl -X GET https://your-domain.com/api/v1/auth/plex/login

# 3. CORS validation
curl -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://your-domain.com/api/v1/health
```

### 4.3 WebSocket Connectivity

```bash
# WebSocket connection test
./scripts/test-websocket-connection.sh wss://your-domain.com/socket.io/

# Expected: Connection successful, Socket.IO handshake complete
```

### 4.4 External Service Integration

```bash
# 1. Plex connectivity
docker-compose -f docker-compose.prod.yml exec backend \
  node -e "
    const { plexService } = require('./dist/services/plex.service');
    plexService.testConnection()
      .then(() => console.log('Plex: Connected'))
      .catch(err => console.log('Plex: Error -', err.message));
  "

# 2. Database connectivity
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma db pull --print

# 3. Redis connectivity
docker-compose -f docker-compose.prod.yml exec backend \
  node -e "
    const redis = require('redis');
    const client = redis.createClient(process.env.REDIS_URL);
    client.connect()
      .then(() => console.log('Redis: Connected'))
      .catch(err => console.log('Redis: Error -', err.message));
  "
```

---

## 5. Operational Procedures

### 5.1 Log Monitoring

```bash
# Real-time log monitoring
docker-compose -f docker-compose.prod.yml logs -f backend

# Service-specific logs
docker-compose -f docker-compose.prod.yml logs nginx
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs redis

# Log rotation verification
ls -la logs/backend/
ls -la logs/nginx/
```

### 5.2 Performance Monitoring

```bash
# System resource usage
docker stats

# Service-specific metrics
curl -H "Authorization: Bearer $METRICS_TOKEN" \
     https://your-domain.com/metrics

# Database performance
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U medianest -d medianest -c "
    SELECT query, mean_time, calls
    FROM pg_stat_statements
    ORDER BY mean_time DESC LIMIT 10;"
```

### 5.3 Backup Verification

```bash
# Manual backup test
docker-compose -f docker-compose.prod.yml exec backup /scripts/backup.sh

# Verify backups created
ls -la backups/postgres/
ls -la backups/redis/
ls -la backups/files/

# Test backup restore (on test instance)
./scripts/test-backup-restore.sh latest
```

---

## 6. Security Hardening Checklist

### 6.1 Container Security

```bash
# Verify security settings
docker-compose -f docker-compose.prod.yml config | grep -A5 security_opt

# Expected security options:
# - no-new-privileges:true
# - User: 1001:1001 (non-root)
# - Capabilities: DROP ALL
# - Read-only secrets
```

### 6.2 Network Security

```bash
# Verify network isolation
docker network ls
docker network inspect medianest_backend-network
docker network inspect medianest_frontend-network

# Firewall verification
ufw status
iptables -L
```

### 6.3 SSL/TLS Configuration

```bash
# SSL certificate verification
curl -vI https://your-domain.com 2>&1 | grep -E "(SSL|TLS)"

# SSL rating test
curl -X GET "https://api.ssllabs.com/api/v3/analyze?host=your-domain.com&publish=off"

# Expected: Grade A or A+
```

---

## 7. Troubleshooting Guide

### 7.1 Common Issues

**Service Won't Start:**

```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource constraints
docker stats
df -h

# Verify secrets
ls -la secrets/
```

**Database Connection Issues:**

```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U medianest -d medianest -c "SELECT version();"

# Check database secrets
docker-compose -f docker-compose.prod.yml exec backend \
  cat /run/secrets/database_url
```

**SSL Certificate Issues:**

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Renew certificate
docker-compose -f docker-compose.prod.yml exec certbot certbot renew --dry-run
```

### 7.2 Recovery Procedures

**Service Recovery:**

```bash
# Restart failed service
docker-compose -f docker-compose.prod.yml restart service-name

# Full system restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

**Database Recovery:**

```bash
# Restore from backup
./scripts/restore-backup.sh postgres latest

# Verify data integrity
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma db push --accept-data-loss
```

---

## 8. Rollback Procedures

### 8.1 Version Rollback

```bash
# 1. Stop current services
docker-compose -f docker-compose.prod.yml down

# 2. Pull previous version
export VERSION=v1.0.0  # Previous stable version
docker-compose -f docker-compose.prod.yml pull

# 3. Start with previous version
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify rollback successful
curl -f https://your-domain.com/api/health
```

### 8.2 Database Rollback

```bash
# 1. Stop backend service
docker-compose -f docker-compose.prod.yml stop backend

# 2. Restore database backup
./scripts/restore-backup.sh postgres backup-date

# 3. Restart services
docker-compose -f docker-compose.prod.yml start backend

# 4. Verify data integrity
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma validate
```

---

## 9. Maintenance Procedures

### 9.1 Regular Maintenance Tasks

**Daily:**

- Monitor service health
- Check log errors
- Verify backup completion

**Weekly:**

- Update system packages
- Review security logs
- Performance analysis

**Monthly:**

- SSL certificate renewal
- Database maintenance
- Backup retention cleanup

### 9.2 Update Procedures

```bash
# 1. Backup current state
./scripts/backup.sh full

# 2. Pull latest changes
git pull origin claude-flow2

# 3. Build new images
docker-compose -f docker-compose.prod.yml build --no-cache

# 4. Rolling update
docker-compose -f docker-compose.prod.yml up -d --no-deps --build service-name

# 5. Verify update
./scripts/final-deployment-verification.sh
```

---

## 10. Monitoring and Alerting

### 10.1 Health Monitoring

**Automated Health Checks:**

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Endpoints**: `/api/health`, `/nginx_status`

### 10.2 Log Aggregation

**Log Locations:**

```bash
logs/backend/application-$(date +%Y-%m-%d).log
logs/nginx/access.log
logs/postgres/postgresql.log
logs/redis/redis.log
```

### 10.3 Performance Metrics

**Key Metrics to Monitor:**

- Response time < 100ms (95th percentile)
- Error rate < 1%
- CPU usage < 80%
- Memory usage < 85%
- Disk usage < 90%

---

## 11. Deployment Success Criteria

### 11.1 Functional Requirements

- [ ] All services healthy and responsive
- [ ] API endpoints returning expected responses
- [ ] Authentication flow working (Plex OAuth + PIN)
- [ ] WebSocket connections established
- [ ] Database queries executing successfully
- [ ] External service integrations functional

### 11.2 Performance Requirements

- [ ] Page load time < 2 seconds
- [ ] API response time < 200ms
- [ ] WebSocket latency < 100ms
- [ ] 99.9% uptime target
- [ ] Zero data loss during deployment

### 11.3 Security Requirements

- [ ] All traffic encrypted (HTTPS/WSS)
- [ ] Rate limiting active and effective
- [ ] No exposed sensitive information
- [ ] Security headers properly configured
- [ ] Docker containers running as non-root
- [ ] Secrets properly secured

---

## Conclusion

This deployment specification provides comprehensive procedures for deploying MediaNest's backend architecture in a production environment. The deployment follows industry best practices for:

- **Container Security**: Non-root users, capability dropping, secret management
- **Network Security**: Network isolation, TLS encryption, rate limiting
- **Operational Excellence**: Health monitoring, automated backups, graceful degradation
- **Reliability**: Graceful shutdowns, dependency management, rollback procedures

The backend is **production-ready** and can be deployed with confidence following these specifications.
