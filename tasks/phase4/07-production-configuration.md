# Phase 4: Production Configuration and Hardening

**Status:** Not Started  
**Priority:** High  
**Dependencies:** Security audit completion  
**Estimated Time:** 4 hours

## Objective

Configure the application for secure production deployment in a homelab environment, implementing proper secret management, SSL/TLS, and production-ready settings.

## Background

Production configuration differs significantly from development. We need to ensure all sensitive data is properly protected and the application is configured for reliability.

## Tasks

### 1. Docker Secrets Implementation

- [ ] Convert .env files to Docker secrets
- [ ] Create secrets for all sensitive data
- [ ] Update docker-compose.yml for secrets
- [ ] Document secret rotation process
- [ ] Test secret access in containers
- [ ] Create backup encryption keys

### 2. Environment Configuration

- [ ] Set NODE_ENV=production everywhere
- [ ] Configure production database settings
- [ ] Set up production Redis configuration
- [ ] Configure production logging levels
- [ ] Set proper resource limits
- [ ] Enable production optimizations

### 3. SSL/TLS Certificate Setup

- [ ] Generate SSL certificates (Let's Encrypt)
- [ ] Configure Nginx for HTTPS
- [ ] Set up automatic renewal
- [ ] Configure SSL security settings
- [ ] Test certificate validity
- [ ] Document renewal process

### 4. Reverse Proxy Configuration

- [ ] Configure Nginx as reverse proxy
- [ ] Set up WebSocket proxying
- [ ] Configure security headers
- [ ] Enable gzip compression
- [ ] Set up rate limiting
- [ ] Configure access logs

### 5. Backup Configuration

- [ ] Set up database backup script
- [ ] Configure backup retention
- [ ] Create restore procedures
- [ ] Test backup/restore process
- [ ] Document recovery steps
- [ ] Automate backup scheduling

### 6. Monitoring and Alerts

- [ ] Configure production logging
- [ ] Set up log rotation
- [ ] Create health check endpoints
- [ ] Configure uptime monitoring
- [ ] Set up disk space alerts
- [ ] Document monitoring access

## Configuration Files

### Docker Secrets (docker-compose.prod.yml)

```yaml
version: '3.8'

secrets:
  db_password:
    external: true
  nextauth_secret:
    external: true
  plex_client_secret:
    external: true
  encryption_key:
    external: true

services:
  frontend:
    image: medianest/frontend:latest
    environment:
      NODE_ENV: production
      NEXTAUTH_URL: https://media.yourdomain.com
    secrets:
      - nextauth_secret
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  backend:
    image: medianest/backend:latest
    environment:
      NODE_ENV: production
      DATABASE_URL_FILE: /run/secrets/db_url
    secrets:
      - db_password
      - plex_client_secret
      - encryption_key
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Frontend proxy
    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /socket.io {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Backup Script

```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups/medianest"
DB_CONTAINER="medianest_postgres"
RETENTION_DAYS=30

# Create backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/medianest_backup_$DATE.sql.gz"

# Dump database
docker exec $DB_CONTAINER pg_dump -U medianest medianest_db | gzip > $BACKUP_FILE

# Clean old backups
find $BACKUP_DIR -name "medianest_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log result
echo "Backup completed: $BACKUP_FILE"
```

## Testing Requirements

- [ ] Test all secrets load correctly
- [ ] Verify HTTPS works properly
- [ ] Test WebSocket over WSS
- [ ] Verify backup/restore works
- [ ] Test under resource limits
- [ ] Verify logs rotate properly

## Success Criteria

- [ ] All secrets in Docker secrets
- [ ] HTTPS working with valid cert
- [ ] Security headers present
- [ ] Automated backups running
- [ ] Resource limits enforced
- [ ] Production optimizations active

## Notes

- Keep production config separate
- Document all production changes
- Test configuration thoroughly
- Plan for disaster recovery
- Monitor after deployment
