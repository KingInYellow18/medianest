# MediaNest Docker Compose Configuration

This directory contains a consolidated Docker Compose configuration system that replaces the previous fragmented setup with a clean, maintainable architecture.

## 📁 File Structure

```
├── docker-compose.yml           # Base configuration (shared across all environments)
├── docker-compose.dev.yml       # Development environment overrides  
├── docker-compose.prod.yml      # Production environment overrides
├── .env.example                 # Environment variables template
├── docker-scripts/
│   ├── deploy.sh               # Automated deployment script
│   └── setup-secrets.sh        # Docker secrets management
└── README-Docker-Compose.md    # This documentation
```

## 🚀 Quick Start

### Development Environment
```bash
# Copy environment template
cp .env.example .env.dev

# Edit environment variables for development
nano .env.dev

# Deploy development environment
./docker-scripts/deploy.sh dev --profiles=dev-tools
# OR manually:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Production Environment
```bash
# Copy environment template
cp .env.example .env

# Configure production variables
nano .env

# Setup Docker secrets for production
./docker-scripts/setup-secrets.sh

# Deploy with monitoring and backup
./docker-scripts/deploy.sh prod --monitoring --backup
# OR manually:
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring --profile backup up -d
```

## 🏗️ Architecture Overview

### Base Configuration (`docker-compose.yml`)
- **PostgreSQL 16**: Primary database with health checks
- **Redis 7**: Caching layer with persistence 
- **Application**: MediaNest app server with multi-stage build
- **Networks**: Isolated internal network (172.25.0.0/24)
- **Volumes**: Persistent storage for data, logs, uploads
- **Health Checks**: Comprehensive service health monitoring

### Development Overrides (`docker-compose.dev.yml`)
- **Hot Reload**: Source code mounted for live development
- **Debug Ports**: Exposed Node.js debugging (9229) and Prisma Studio (5555)
- **Development Tools**:
  - Adminer (database management) - `http://localhost:8080`
  - Redis Commander (Redis management) - `http://localhost:8081`
  - MailHog (email testing) - `http://localhost:8025`
  - File Browser (upload management) - `http://localhost:8082`
- **Relaxed Security**: No read-only filesystems, exposed database ports
- **Development Database**: Separate dev database with test data seeds

### Production Overrides (`docker-compose.prod.yml`)
- **Security Hardening**: 
  - Read-only filesystems with tmpfs mounts
  - Dropped capabilities with minimal required permissions
  - User namespacing (non-root execution)
  - AppArmor and security options
- **Secrets Management**: Docker secrets for sensitive data
- **Network Isolation**: Internal network with public proxy network
- **Monitoring Stack**: Prometheus + Grafana (optional profile)
- **SSL/TLS**: Automatic certificate management with Let's Encrypt
- **Backup Services**: Automated database backups
- **Security Scanning**: Trivy vulnerability scanning

## 🔧 Environment Configuration

### Environment Variables
All environments support these key variables:

```bash
# Build Configuration
NODE_ENV=production|development
BUILD_TARGET=backend-production|development
DOCKERFILE=Dockerfile.performance-optimized-v2
SECURITY_LEVEL=standard|hardened

# Database
POSTGRES_DB=medianest
POSTGRES_USER=medianest
POSTGRES_PASSWORD=secure_password

# Application
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_secret_here
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_char_key

# Features
ENABLE_MONITORING=true|false
ENABLE_DEBUG=true|false
LOG_LEVEL=info|debug|warn|error
```

### Docker Compose Profiles

**Development Profiles:**
- `dev-tools`: Enable all development services (Adminer, Redis Commander, etc.)

**Production Profiles:**
- `monitoring`: Enable Prometheus + Grafana monitoring stack
- `backup`: Enable automated database backup service
- `ssl-init`: Initialize SSL certificates with Let's Encrypt
- `security-scan`: Enable Trivy security scanning

## 📊 Service Details

### Core Services (Always Running)

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| postgres | 5432* | PostgreSQL 16 database | `pg_isready` |
| redis | 6379* | Redis 7 cache | `redis-cli ping` |
| app | 3000/3001 | MediaNest application | HTTP health endpoint |

*Port only exposed in development

### Development Services (Profile: dev-tools)

| Service | Port | Description | Credentials |
|---------|------|-------------|-------------|
| adminer | 8080 | Database administration | N/A |
| redis-commander | 8081 | Redis management | admin/admin |
| mailcatcher | 8025 | Email testing | N/A |
| filebrowser | 8082 | File upload management | Check config |
| nginx-dev | 8000 | Development proxy | N/A |

### Production Services

| Service | Port | Profile | Description |
|---------|------|---------|-------------|
| nginx | 80/443 | default | Reverse proxy with SSL |
| prometheus | - | monitoring | Metrics collection |
| grafana | - | monitoring | Visualization dashboard |
| backup | - | backup | Automated DB backups |
| trivy | - | security-scan | Vulnerability scanning |
| certbot | - | ssl-init | SSL certificate management |

## 🛠️ Management Commands

### Deployment Script Usage
```bash
# Deploy development with all dev tools
./docker-scripts/deploy.sh dev --profiles=dev-tools

# Deploy production with full stack
./docker-scripts/deploy.sh prod --build --monitoring --backup --ssl

# Clean deployment (removes containers and volumes)
./docker-scripts/deploy.sh prod --clean

# Dry run (show commands without executing)
./docker-scripts/deploy.sh prod --dry-run
```

### Manual Docker Compose Commands
```bash
# Development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-tools up -d

# Production environment  
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring up -d

# Stop services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f app

# Scale services (production)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale app=3
```

### Secrets Management
```bash
# Setup all secrets interactively
./docker-scripts/setup-secrets.sh --interactive

# Auto-generate secrets
./docker-scripts/setup-secrets.sh --auto

# List current secrets
./docker-scripts/setup-secrets.sh --list

# Remove all secrets
./docker-scripts/setup-secrets.sh --remove
```

## 🔒 Security Features

### Production Security Hardening
- **Read-only Filesystems**: Containers run with read-only root filesystems
- **Capability Dropping**: All unnecessary Linux capabilities removed
- **User Namespacing**: Services run as non-root users
- **Network Isolation**: Internal services isolated from external access
- **Docker Secrets**: Sensitive data managed via Docker's secret management
- **Security Scanning**: Automated vulnerability scanning with Trivy
- **Resource Limits**: CPU, memory, and PID limits for all services

### Network Security
- **Internal Network**: Services communicate via isolated bridge network
- **Public Network**: Only NGINX proxy exposed to public network
- **Fixed IP Addressing**: Predictable internal IP allocation
- **No Direct Database Access**: Database only accessible via internal network

## 📈 Monitoring & Observability

### Prometheus Metrics
- Application metrics exposed on `/metrics`
- Database metrics via postgres_exporter
- Redis metrics via redis_exporter
- Container metrics via cAdvisor

### Grafana Dashboards
- Pre-configured dashboards for all services
- Custom MediaNest application metrics
- Infrastructure monitoring (CPU, memory, disk, network)
- Alert rules for critical thresholds

### Logging
- Structured JSON logging for all services
- Log rotation and compression
- Centralized log collection ready for ELK stack integration

## 🔄 Backup & Recovery

### Automated Backups
- Daily PostgreSQL dumps at 2:00 AM
- Backup retention policy (7 daily, 4 weekly, 12 monthly)
- Backup integrity verification
- Compressed and encrypted backup files

### Disaster Recovery
- Database backup restoration procedures
- Volume snapshot capabilities
- Configuration backup and restore
- Documented recovery time objectives (RTO) and recovery point objectives (RPO)

## 🐛 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check service status
docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps

# View service logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs service_name

# Check health status
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec service_name healthcheck
```

**Database connection issues:**
```bash
# Test database connectivity
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec app nc -zv postgres 5432

# Check database logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs postgres
```

**Permission issues:**
```bash
# Fix volume permissions
sudo chown -R $(id -u):$(id -g) ./uploads ./logs

# Check Docker socket permissions
sudo usermod -aG docker $USER
```

### Health Checks
All services include comprehensive health checks:
- PostgreSQL: `pg_isready` command
- Redis: `redis-cli ping` command  
- Application: HTTP health endpoint check
- NGINX: HTTP endpoint availability

### Performance Tuning
- Adjust resource limits in compose files based on server capacity
- Configure PostgreSQL shared_buffers for your workload
- Set Redis maxmemory based on available RAM
- Use SSD storage for database and Redis volumes
- Enable Docker BuildKit for faster image builds

## 📚 Additional Resources

- [Docker Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Secrets Management](https://docs.docker.com/engine/swarm/secrets/)
- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)
- [NGINX Docker Documentation](https://hub.docker.com/_/nginx)

## 🤝 Contributing

When modifying the Docker Compose configuration:

1. **Test changes in development first**
2. **Update documentation for any new services or configuration**
3. **Ensure security practices are maintained in production configs**
4. **Add appropriate health checks for new services**
5. **Consider resource limits for all services**
6. **Test upgrade/downgrade procedures**

## 🏷️ Version History

- **v2.0.0**: Consolidated configuration system with environment overrides
- **v1.x.x**: Legacy fragmented Docker Compose files (deprecated)