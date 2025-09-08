# MediaNest Deployment Documentation

Comprehensive deployment and operational documentation for MediaNest, covering all aspects of production deployment, development setup, and maintenance.

## 📚 Documentation Overview

This directory contains complete guides for deploying and operating MediaNest in various environments:

### 🚀 Deployment Guides

| Guide                                                           | Description                                         | Target Audience           |
| --------------------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| [Production Deployment Guide](./production-deployment-guide.md) | Complete production deployment using Docker Compose | System Administrators     |
| [Development Setup](./development-setup.md)                     | Local development environment setup                 | Developers                |
| [Self-Hosted Installation](./self-hosted-installation.md)       | Self-hosting on your own infrastructure             | Self-hosters, Small Teams |

### 🔧 Operational Guides

| Guide                                                           | Description                                | Target Audience      |
| --------------------------------------------------------------- | ------------------------------------------ | -------------------- |
| [Configuration Management](./configuration-management.md)       | Environment configs, secrets, and settings | DevOps Engineers     |
| [Monitoring & Logging Setup](./monitoring-logging-setup.md)     | Observability and monitoring configuration | SREs, Administrators |
| [Backup & Recovery Procedures](./backup-recovery-procedures.md) | Data protection and disaster recovery      | Administrators       |
| [Troubleshooting Guide](./troubleshooting-guide.md)             | Common issues and solutions                | Support Teams        |

## 🎯 Quick Start

### For Administrators (Production)

1. Start with [Production Deployment Guide](./production-deployment-guide.md)
2. Configure [Monitoring & Logging](./monitoring-logging-setup.md)
3. Set up [Backup & Recovery](./backup-recovery-procedures.md)

### For Developers (Development)

1. Follow [Development Setup](./development-setup.md)
2. Reference [Configuration Management](./configuration-management.md) for environment setup
3. Use [Troubleshooting Guide](./troubleshooting-guide.md) when issues arise

### For Self-Hosters (Personal/Small Team)

1. Use [Self-Hosted Installation](./self-hosted-installation.md) for automated setup
2. Configure basic monitoring per [Monitoring Setup](./monitoring-logging-setup.md)
3. Set up regular backups per [Backup Procedures](./backup-recovery-procedures.md)

## 📋 Pre-Deployment Checklist

### System Requirements

- [ ] Linux server (Ubuntu 22.04+ recommended)
- [ ] Docker 24.0+ and Docker Compose 2.20+
- [ ] Minimum 4GB RAM, 2 CPU cores, 50GB storage
- [ ] Domain name configured (for production)
- [ ] SSL certificate ready (Let's Encrypt or custom)

### Security Preparation

- [ ] Firewall configured (ports 80, 443, 22)
- [ ] SSH keys configured
- [ ] Secrets generated (JWT, encryption keys)
- [ ] Database credentials created
- [ ] Backup storage prepared

### Service Dependencies

- [ ] PostgreSQL database (can use containerized)
- [ ] Redis cache (can use containerized)
- [ ] Reverse proxy/load balancer (Nginx included)
- [ ] SSL termination (Let's Encrypt integration included)

## 🔄 Deployment Workflows

### Production Deployment

```bash
# 1. Clone repository
git clone <repository-url>
cd medianest

# 2. Configure environment
cp .env.example .env.production
# Edit configuration

# 3. Generate secrets
./scripts/generate-docker-secrets.sh

# 4. Deploy services
docker-compose -f docker-compose.prod.yml up -d

# 5. Set up SSL
docker-compose run --rm certbot certonly --webroot

# 6. Enable monitoring (optional)
docker-compose --profile monitoring up -d
```

### Development Setup

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd medianest
npm install

# 2. Start development services
docker-compose -f docker-compose.dev.yml up -d

# 3. Run development servers
npm run dev
```

### Self-Hosted Quick Install

```bash
# Automated installation
curl -fsSL https://install.medianest.com | bash -s -- \
  --domain medianest.yourdomain.com \
  --email admin@yourdomain.com
```

## 🛠️ Architecture Overview

### Production Architecture

```
Internet → Nginx (SSL/Proxy) → Frontend/Backend → Database/Cache
            ↓
         Monitoring ← Logs ← Applications
```

### Components

- **Nginx**: Reverse proxy, SSL termination, rate limiting
- **Backend**: Node.js API server with authentication
- **Frontend**: Next.js web application
- **PostgreSQL**: Primary database for user data and metadata
- **Redis**: Session storage and caching
- **Monitoring**: Prometheus, Grafana, Loki (optional)

## 📊 Monitoring & Observability

### Health Endpoints

- Backend: `https://yourdomain.com/api/health`
- Frontend: `https://yourdomain.com/api/health`
- Metrics: `https://yourdomain.com/metrics` (protected)

### Key Metrics

- **Application**: Response time, error rate, throughput
- **Infrastructure**: CPU, memory, disk, network usage
- **Business**: User sessions, download activity, storage usage

### Alerting

- Service downtime
- High error rates
- Resource exhaustion
- SSL certificate expiration
- Backup failures

## 🔐 Security Considerations

### Network Security

- TLS 1.2+ encryption for all connections
- Rate limiting on all endpoints
- Firewall rules restricting access
- Regular security updates

### Application Security

- JWT-based authentication
- Input validation and sanitization
- SQL injection protection
- XSS prevention
- CSRF protection

### Data Protection

- Encrypted secrets management
- Regular automated backups
- Point-in-time recovery capability
- Data retention policies

## 📈 Scaling Considerations

### Horizontal Scaling

```yaml
# Scale backend services
services:
  backend:
    deploy:
      replicas: 3
```

### Database Scaling

- Read replicas for heavy read workloads
- Connection pooling for concurrent users
- Database partitioning for large datasets

### Caching Strategy

- Redis for session storage
- Application-level caching
- CDN for static assets

## 🔄 Update Procedures

### Rolling Updates

```bash
# 1. Backup current state
./scripts/backup.sh

# 2. Pull latest changes
git pull origin main

# 3. Update containers
docker-compose pull
docker-compose up -d --build

# 4. Verify health
./scripts/health-check.sh
```

### Zero-Downtime Deployments

- Use multiple backend replicas
- Health check before routing traffic
- Graceful shutdown procedures
- Database migration strategies

## 🆘 Emergency Procedures

### Service Recovery

1. Check system resources (disk, memory, CPU)
2. Review application logs for errors
3. Restart failed services
4. Restore from backup if necessary
5. Escalate to development team if unresolved

### Data Recovery

1. Stop all services to prevent data corruption
2. Identify backup restore point
3. Restore database from backup
4. Verify data integrity
5. Restart services and monitor

## 📞 Support & Community

### Documentation

- Deployment guides in this directory
- API documentation: `/docs/api/`
- Contributing guide: `/CONTRIBUTING.md`

### Getting Help

- Check troubleshooting guide first
- Review GitHub issues for similar problems
- Create detailed bug reports with logs
- Join community discussions

### Contributing

- Fork repository and create feature branch
- Follow code style guidelines
- Add tests for new features
- Update documentation as needed
- Submit pull request for review

## 🗺️ Documentation Roadmap

### Current Version (v1.0)

- ✅ Basic deployment guides
- ✅ Configuration management
- ✅ Monitoring setup
- ✅ Backup procedures
- ✅ Troubleshooting guide

### Planned Improvements (v1.1)

- [ ] Kubernetes deployment guide
- [ ] Multi-region deployment
- [ ] Advanced monitoring configurations
- [ ] Performance tuning guide
- [ ] Security hardening checklist

### Future Enhancements (v2.0)

- [ ] Infrastructure as Code (Terraform)
- [ ] GitOps deployment workflows
- [ ] Advanced disaster recovery
- [ ] Compliance documentation
- [ ] Automated testing procedures

---

## 📖 Quick Reference

### Essential Commands

```bash
# Service management
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml restart

# Monitoring
docker-compose logs -f
docker-compose ps
docker stats

# Backup and restore
./scripts/backup.sh
./scripts/restore-backup.sh /path/to/backup

# SSL certificate renewal
docker-compose run --rm certbot renew
```

### Configuration Files

- **Environment**: `.env.production`
- **Docker Compose**: `docker-compose.prod.yml`
- **Nginx**: `infrastructure/nginx/nginx.prod.conf`
- **Database**: `infrastructure/database/postgresql.conf`

### Important Directories

- **Data**: `./data/` (persistent volumes)
- **Logs**: `./logs/` (application logs)
- **Backups**: `./backups/` (backup storage)
- **Secrets**: `./secrets/` (encrypted credentials)

This documentation is designed to be comprehensive yet accessible, providing clear guidance for deploying and maintaining MediaNest in production environments.
