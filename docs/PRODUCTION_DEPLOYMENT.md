# MediaNest Production Deployment Guide

This guide covers the complete process of deploying MediaNest to a production homelab environment with proper security, SSL/TLS, and backup configuration.

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Docker 20.10+ and Docker Compose V2
- Domain name pointing to your server
- At least 4GB RAM and 20GB storage
- Open ports: 80 (HTTP), 443 (HTTPS)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/medianest.git
cd medianest

# Generate secrets
./scripts/generate-docker-secrets.sh

# Configure environment
cp .env.production.example .env.production
# Edit .env.production with your domain and settings

# Setup SSL certificates
DOMAIN_NAME=media.yourdomain.com CERTBOT_EMAIL=admin@yourdomain.com ./scripts/setup-ssl.sh

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Detailed Setup Process

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    docker.io \
    docker-compose \
    openssl \
    curl \
    git \
    htop \
    tmux

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Domain Configuration

Ensure your domain is properly configured:
- A record pointing to your server's IP
- Optional: CNAME for www subdomain
- Firewall rules allowing ports 80 and 443

### 3. Generate Secrets

```bash
# Run the secret generation script
./scripts/generate-docker-secrets.sh

# Follow the prompts to configure:
# - Database passwords
# - Redis password
# - JWT/encryption keys
# - Plex OAuth credentials
```

The script creates a `secrets/` directory with all required secrets:
```
secrets/
├── database_url
├── postgres_password
├── redis_url
├── redis_password
├── nextauth_secret
├── jwt_secret
├── encryption_key
├── plex_client_id
└── plex_client_secret
```

### 4. Environment Configuration

```bash
# Copy production template
cp .env.production.example .env.production

# Edit configuration
nano .env.production
```

Key settings to update:
- `DOMAIN_NAME`: Your actual domain
- `FRONTEND_URL`: https://yourdomain.com
- `BACKEND_URL`: https://yourdomain.com
- `NEXTAUTH_URL`: https://yourdomain.com
- Email settings for SSL certificates

### 5. SSL/TLS Setup

```bash
# Set environment variables
export DOMAIN_NAME=media.yourdomain.com
export CERTBOT_EMAIL=admin@yourdomain.com

# Run SSL setup script
./scripts/setup-ssl.sh

# For testing/staging certificates:
export STAGING=true
./scripts/setup-ssl.sh
```

The script will:
1. Generate temporary self-signed certificates
2. Start nginx with HTTP challenge support
3. Obtain Let's Encrypt certificates
4. Configure automatic renewal
5. Reload nginx with production certificates

### 6. Deploy Application

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### 7. Initial Configuration

1. Access MediaNest at https://yourdomain.com
2. Login with Plex OAuth
3. Change default admin password
4. Configure external services (Overseerr, Uptime Kuma)

### 8. Setup Backups

```bash
# Test backup script
./scripts/backup.sh

# Setup automatic backups (cron)
crontab -e
# Add: 0 2 * * * /path/to/medianest/scripts/backup.sh >> /var/log/medianest-backup.log 2>&1

# Or use systemd timer (already configured by SSL script)
sudo systemctl enable medianest-backup.timer
sudo systemctl start medianest-backup.timer
```

## Security Configuration

### Docker Secrets

All sensitive data is stored as Docker secrets:
- Database passwords
- JWT signing keys
- OAuth credentials
- Encryption keys

### Nginx Security Headers

The production nginx configuration includes:
- HSTS with preload
- CSP (Content Security Policy)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

### Rate Limiting

Multiple rate limit zones:
- API: 100 requests/minute
- Auth: 5 requests/minute
- YouTube: 5 requests/hour
- Static: 200 requests/minute

### SSL/TLS Configuration

- TLS 1.2 and 1.3 only
- Strong cipher suites
- OCSP stapling
- Session caching
- DH parameters (2048-bit)

## Maintenance

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f postgres

# Nginx access logs
docker exec medianest-nginx tail -f /var/log/nginx/access.log

# Application logs
tail -f logs/app/medianest.log
```

### Updating MediaNest

```bash
# Backup first!
./scripts/backup.sh

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
```

### Database Maintenance

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U medianest -d medianest

# Vacuum and analyze
docker-compose -f docker-compose.prod.yml exec postgres vacuumdb -U medianest -d medianest -z

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT pg_database_size('medianest');"
```

### SSL Certificate Renewal

Certificates auto-renew via systemd timer or cron. To manually renew:

```bash
# Check certificate expiry
openssl x509 -in infrastructure/nginx/ssl/fullchain.pem -noout -dates

# Manual renewal
./scripts/renew-ssl.sh

# Check renewal timer
sudo systemctl status medianest-ssl-renewal.timer
```

## Backup and Restore

### Automated Backups

Backups run daily at 2 AM and include:
- PostgreSQL database
- Redis data
- Uploaded files
- Configuration files

### Manual Backup

```bash
# Run backup
./scripts/backup.sh

# Backups stored in: /backups/medianest/
ls -la /backups/medianest/
```

### Restore from Backup

```bash
# List available backups
./scripts/restore-backup.sh

# Restore latest backup
./scripts/restore-backup.sh

# Restore specific backup
./scripts/restore-backup.sh 20231225_120000
```

## Monitoring

### Health Checks

- Application: https://yourdomain.com/api/health
- Database: Port 5432
- Redis: Port 6379
- Nginx: Port 80/443

### Resource Monitoring

```bash
# Docker stats
docker stats

# System resources
htop

# Disk usage
df -h
du -sh /var/lib/medianest/*

# Docker logs size
du -sh /var/lib/docker/containers/*/*-json.log
```

### Setting Up Alerts

Configure monitoring in your preferred system:
- Uptime Kuma (built-in integration)
- Prometheus/Grafana
- Netdata
- Zabbix

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check nginx config
   docker exec medianest-nginx nginx -t
   
   # Regenerate certificates
   ./scripts/setup-ssl.sh
   ```

2. **Database Connection Issues**
   ```bash
   # Check postgres logs
   docker-compose -f docker-compose.prod.yml logs postgres
   
   # Test connection
   docker exec medianest-postgres pg_isready -U medianest
   ```

3. **Permission Issues**
   ```bash
   # Fix volume permissions
   sudo chown -R 1000:1000 ./data
   sudo chown -R 1000:1000 ./logs
   ```

4. **Out of Memory**
   ```bash
   # Check memory usage
   free -h
   docker stats --no-stream
   
   # Adjust limits in docker-compose.prod.yml
   ```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
docker-compose -f docker-compose.prod.yml up

# Check specific service
docker-compose -f docker-compose.prod.yml exec app npm run debug
```

## Performance Tuning

### PostgreSQL Optimization

Edit `infrastructure/database/postgresql.conf`:
- Adjust `shared_buffers` (25% of RAM)
- Tune `effective_cache_size` (50-75% of RAM)
- Configure `max_connections` based on usage

### Redis Optimization

In `docker-compose.prod.yml`:
- Adjust `maxmemory` setting
- Configure persistence strategy
- Tune save intervals

### Nginx Optimization

- Enable gzip compression
- Configure cache headers
- Tune worker processes
- Adjust buffer sizes

## Security Hardening

### Additional Steps

1. **Firewall Configuration**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Fail2ban Setup**
   ```bash
   sudo apt install fail2ban
   # Configure for nginx and MediaNest
   ```

3. **Regular Updates**
   ```bash
   # System updates
   sudo apt update && sudo apt upgrade
   
   # Docker images
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Security Scanning**
   ```bash
   # Scan for vulnerabilities
   docker scan medianest:latest
   ```

## Support

For issues and questions:
1. Check application logs
2. Review this documentation
3. Search existing GitHub issues
4. Create new issue with logs and details

Remember to always backup before making changes!