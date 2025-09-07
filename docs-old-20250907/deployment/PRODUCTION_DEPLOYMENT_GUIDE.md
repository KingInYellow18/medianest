# MediaNest Production Deployment Guide

This comprehensive guide covers the complete setup and deployment of MediaNest in a production environment with security hardening, SSL/TLS configuration, and monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [SSL Certificate Setup](#ssl-certificate-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Docker Deployment](#docker-deployment)
7. [Nginx Configuration](#nginx-configuration)
8. [Security Hardening](#security-hardening)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Backup and Recovery](#backup-and-recovery)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements:**

- CPU: 2 cores
- RAM: 4GB
- Storage: 50GB SSD
- OS: Ubuntu 20.04 LTS or later / CentOS 8 or later

**Recommended Production:**

- CPU: 4+ cores
- RAM: 8GB+
- Storage: 100GB+ SSD
- OS: Ubuntu 22.04 LTS

### Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx htop fail2ban ufw git
```

## Server Setup

### 1. Security Configuration

```bash
# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Install and configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create fail2ban jail for nginx
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl restart fail2ban
```

### 2. User Setup

```bash
# Create application user
sudo useradd -m -s /bin/bash medianest
sudo usermod -aG docker medianest

# Create application directories
sudo mkdir -p /opt/medianest/{app,data,logs,backups}
sudo chown -R medianest:medianest /opt/medianest
```

### 3. System Optimization

```bash
# Optimize system limits
sudo tee -a /etc/security/limits.conf << 'EOF'
medianest soft nofile 65536
medianest hard nofile 65536
medianest soft nproc 4096
medianest hard nproc 4096
EOF

# Optimize kernel parameters
sudo tee -a /etc/sysctl.conf << 'EOF'
# Network optimization
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 10
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1

# Memory optimization
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF

sudo sysctl -p
```

## SSL Certificate Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot certonly --webroot \
  --webroot-path=/var/www/html \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d medianest.yourdomain.com \
  -d www.medianest.yourdomain.com

# Set up automatic renewal
sudo crontab -e
# Add line: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Custom SSL Certificate

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/{certs,private}

# Copy your certificate files
sudo cp your-certificate.crt /etc/ssl/certs/medianest.crt
sudo cp your-private-key.key /etc/ssl/private/medianest.key
sudo cp ca-bundle.crt /etc/ssl/certs/ca-certificates.crt

# Set proper permissions
sudo chmod 644 /etc/ssl/certs/medianest.crt
sudo chmod 600 /etc/ssl/private/medianest.key
sudo chown root:root /etc/ssl/certs/medianest.crt
sudo chown root:root /etc/ssl/private/medianest.key
```

### SSL Certificate Renewal Script

```bash
# Create renewal script
sudo tee /usr/local/bin/ssl-renew.sh << 'EOF'
#!/bin/bash

# Renew certificates
certbot renew --quiet

# Test nginx configuration
nginx -t

# Reload nginx if configuration is valid
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "SSL certificates renewed and nginx reloaded successfully"
else
    echo "nginx configuration test failed - not reloading"
    exit 1
fi

# Restart Docker containers if needed
cd /opt/medianest/app
docker-compose -f docker-compose.production.yml restart nginx
EOF

sudo chmod +x /usr/local/bin/ssl-renew.sh

# Add to crontab
echo "0 3 * * * /usr/local/bin/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1" | sudo crontab -
```

## Environment Configuration

### 1. Clone and Setup Application

```bash
# Switch to application user
sudo su - medianest

# Clone repository
cd /opt/medianest
git clone https://github.com/yourusername/medianest.git app
cd app

# Copy and configure environment
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `/opt/medianest/app/.env` with production values:

```bash
# Essential configurations to update:

# Database
DATABASE_URL=postgresql://medianest_user:SECURE_PASSWORD@postgres:5432/medianest_prod

# Redis
REDIS_URL=redis://:SECURE_REDIS_PASSWORD@redis:6379

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-generated-jwt-secret
SESSION_SECRET=your-generated-session-secret

# Domain configuration
BASE_URL=https://medianest.yourdomain.com
CORS_ORIGIN=https://medianest.yourdomain.com,https://www.medianest.yourdomain.com

# External services
PLEX_URL=http://your-plex-server:32400
PLEX_TOKEN=your-plex-token
OVERSEERR_URL=http://your-overseerr:5055
OVERSEERR_API_KEY=your-overseerr-api-key

# SMTP configuration
SMTP_HOST=smtp.yourmailserver.com
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

### 3. Generate Secure Secrets

```bash
# Generate strong secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.secrets
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env.secrets
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.secrets

# Set proper permissions
chmod 600 .env .env.secrets
```

## Database Setup

### 1. Initialize Database

```bash
# Create database initialization script
mkdir -p database/init

tee database/init/01-init.sql << 'EOF'
-- Create database and user
CREATE DATABASE medianest_prod;
CREATE USER medianest_user WITH ENCRYPTED PASSWORD 'SECURE_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE medianest_prod TO medianest_user;
ALTER USER medianest_user CREATEDB;

-- Create extensions
\c medianest_prod;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO medianest_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medianest_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medianest_user;
EOF
```

### 2. Database Security Configuration

```bash
# Create database security configuration
tee database/init/02-security.sql << 'EOF'
-- Security configurations
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Performance optimizations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

SELECT pg_reload_conf();
EOF
```

## Docker Deployment

### 1. Build and Deploy

```bash
cd /opt/medianest/app

# Build production image
docker-compose -f docker-compose.production.yml build

# Start core services
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
sleep 30

# Run database migrations
docker-compose -f docker-compose.production.yml run --rm app npm run migrate:prod

# Start all services
docker-compose -f docker-compose.production.yml up -d
```

### 2. Health Checks

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs app
docker-compose -f docker-compose.production.yml logs postgres
docker-compose -f docker-compose.production.yml logs redis
docker-compose -f docker-compose.production.yml logs nginx

# Test application health
curl -f http://localhost:3000/health
```

### 3. SSL Certificate Integration

```bash
# Copy SSL certificates to Docker volume
sudo cp /etc/letsencrypt/live/medianest.yourdomain.com/fullchain.pem /opt/medianest/app/ssl/certs/medianest.crt
sudo cp /etc/letsencrypt/live/medianest.yourdomain.com/privkey.pem /opt/medianest/app/ssl/private/medianest.key

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

## Nginx Configuration

### 1. Install and Configure Nginx

```bash
# Install nginx
sudo apt install -y nginx

# Copy production configuration
sudo cp config/production/nginx.conf.template /etc/nginx/sites-available/medianest
sudo ln -s /etc/nginx/sites-available/medianest /etc/nginx/sites-enabled/

# Remove default configuration
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Start nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Configure Nginx Security

```bash
# Create additional security configurations
sudo tee /etc/nginx/conf.d/security.conf << 'EOF'
# Hide nginx version
server_tokens off;

# Buffer overflow protection
client_body_buffer_size 1k;
client_header_buffer_size 1k;
client_max_body_size 10M;
large_client_header_buffers 2 1k;

# Timeout configurations
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 5s 5s;
send_timeout 10s;

# Limit connections
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=5r/s;
EOF

sudo nginx -t && sudo systemctl reload nginx
```

## Security Hardening

### 1. Application Security

```bash
# Create security monitoring script
tee /usr/local/bin/security-monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/medianest/security.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check for failed login attempts
FAILED_LOGINS=$(grep "authentication failed" /opt/medianest/app/logs/*.log | wc -l)
if [ "$FAILED_LOGINS" -gt 10 ]; then
    echo "[$DATE] WARNING: High number of failed login attempts: $FAILED_LOGINS" >> $LOG_FILE
fi

# Check for suspicious API requests
SUSPICIOUS_REQUESTS=$(grep -E "(DROP|DELETE|INSERT|UPDATE).*WHERE.*OR.*1.*=.*1" /var/log/nginx/*.log | wc -l)
if [ "$SUSPICIOUS_REQUESTS" -gt 0 ]; then
    echo "[$DATE] ALERT: Potential SQL injection attempts detected: $SUSPICIOUS_REQUESTS" >> $LOG_FILE
fi

# Check for unusual traffic patterns
HIGH_TRAFFIC=$(tail -n 1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -1 | awk '{print $1}')
if [ "$HIGH_TRAFFIC" -gt 100 ]; then
    echo "[$DATE] WARNING: High traffic from single IP: $HIGH_TRAFFIC requests" >> $LOG_FILE
fi
EOF

chmod +x /usr/local/bin/security-monitor.sh

# Add to crontab
echo "*/5 * * * * /usr/local/bin/security-monitor.sh" | sudo crontab -
```

### 2. Database Security

```bash
# Create database security script
tee /usr/local/bin/db-security.sh << 'EOF'
#!/bin/bash

# Backup pg_hba.conf
docker exec medianest_postgres_prod cp /var/lib/postgresql/data/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf.backup

# Apply security configurations
docker exec medianest_postgres_prod psql -U postgres -c "
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'pg_log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_min_duration_statement = '1000';
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
SELECT pg_reload_conf();
"
EOF

chmod +x /usr/local/bin/db-security.sh
```

### 3. Container Security

```bash
# Create container security scan script
tee /usr/local/bin/container-security-scan.sh << 'EOF'
#!/bin/bash

SCAN_DATE=$(date '+%Y-%m-%d')
SCAN_DIR="/opt/medianest/security-reports"
mkdir -p $SCAN_DIR

# Scan for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $SCAN_DIR:/reports \
    aquasec/trivy:latest image \
    --format json \
    --output /reports/trivy-scan-$SCAN_DATE.json \
    medianest_app_prod

# Generate summary report
echo "Security Scan Report - $SCAN_DATE" > $SCAN_DIR/summary-$SCAN_DATE.txt
echo "=================================" >> $SCAN_DIR/summary-$SCAN_DATE.txt

if [ -f "$SCAN_DIR/trivy-scan-$SCAN_DATE.json" ]; then
    HIGH_VULNERABILITIES=$(jq '.Results[].Vulnerabilities[]? | select(.Severity == "HIGH") | .VulnerabilityID' $SCAN_DIR/trivy-scan-$SCAN_DATE.json | wc -l)
    CRITICAL_VULNERABILITIES=$(jq '.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' $SCAN_DIR/trivy-scan-$SCAN_DATE.json | wc -l)

    echo "Critical Vulnerabilities: $CRITICAL_VULNERABILITIES" >> $SCAN_DIR/summary-$SCAN_DATE.txt
    echo "High Vulnerabilities: $HIGH_VULNERABILITIES" >> $SCAN_DIR/summary-$SCAN_DATE.txt

    if [ "$CRITICAL_VULNERABILITIES" -gt 0 ]; then
        echo "CRITICAL: Immediate action required!" >> $SCAN_DIR/summary-$SCAN_DATE.txt
    fi
fi
EOF

chmod +x /usr/local/bin/container-security-scan.sh

# Schedule weekly security scans
echo "0 2 * * 0 /usr/local/bin/container-security-scan.sh" | sudo crontab -
```

## Monitoring and Logging

### 1. Log Management

```bash
# Configure log rotation
sudo tee /etc/logrotate.d/medianest << 'EOF'
/opt/medianest/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker-compose -f /opt/medianest/app/docker-compose.production.yml restart app
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
EOF
```

### 2. System Monitoring

```bash
# Create monitoring script
tee /usr/local/bin/system-monitor.sh << 'EOF'
#!/bin/bash

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MONITOR_LOG="/var/log/medianest/system-monitor.log"

# CPU and Memory usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f"), $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}' | sed 's/%//')

# Docker container status
CONTAINERS_RUNNING=$(docker ps | wc -l)
CONTAINERS_TOTAL=$(docker ps -a | wc -l)

# Database connections
DB_CONNECTIONS=$(docker exec medianest_postgres_prod psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;" | xargs)

# Log monitoring data
echo "[$TIMESTAMP] CPU: ${CPU_USAGE}% | Memory: ${MEMORY_USAGE}% | Disk: ${DISK_USAGE}% | Containers: ${CONTAINERS_RUNNING}/${CONTAINERS_TOTAL} | DB Connections: ${DB_CONNECTIONS}" >> $MONITOR_LOG

# Alert thresholds
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "[$TIMESTAMP] ALERT: High CPU usage: ${CPU_USAGE}%" >> $MONITOR_LOG
fi

if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
    echo "[$TIMESTAMP] ALERT: High memory usage: ${MEMORY_USAGE}%" >> $MONITOR_LOG
fi

if [ "$DISK_USAGE" -gt 85 ]; then
    echo "[$TIMESTAMP] ALERT: High disk usage: ${DISK_USAGE}%" >> $MONITOR_LOG
fi
EOF

chmod +x /usr/local/bin/system-monitor.sh

# Schedule monitoring every 5 minutes
echo "*/5 * * * * /usr/local/bin/system-monitor.sh" | sudo crontab -
```

### 3. Application Health Monitoring

```bash
# Create health monitoring script
tee /usr/local/bin/health-monitor.sh << 'EOF'
#!/bin/bash

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HEALTH_LOG="/var/log/medianest/health-monitor.log"
ALERT_EMAIL="admin@yourdomain.com"

# Check application health
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
DB_HEALTH=$(docker exec medianest_postgres_prod pg_isready -U postgres)
REDIS_HEALTH=$(docker exec medianest_redis_prod redis-cli ping)

# Log health status
echo "[$TIMESTAMP] App: $APP_HEALTH | DB: $DB_HEALTH | Redis: $REDIS_HEALTH" >> $HEALTH_LOG

# Check for failures
if [ "$APP_HEALTH" != "200" ]; then
    echo "[$TIMESTAMP] CRITICAL: Application health check failed (HTTP $APP_HEALTH)" >> $HEALTH_LOG
    # Send alert email (requires mail command)
    # echo "MediaNest application health check failed" | mail -s "MediaNest Alert" $ALERT_EMAIL
fi

if [[ "$DB_HEALTH" != *"accepting connections"* ]]; then
    echo "[$TIMESTAMP] CRITICAL: Database health check failed" >> $HEALTH_LOG
fi

if [ "$REDIS_HEALTH" != "PONG" ]; then
    echo "[$TIMESTAMP] CRITICAL: Redis health check failed" >> $HEALTH_LOG
fi
EOF

chmod +x /usr/local/bin/health-monitor.sh

# Schedule health monitoring every minute
echo "* * * * * /usr/local/bin/health-monitor.sh" | sudo crontab -
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
tee /usr/local/bin/backup-database.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/medianest/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="medianest_backup_$TIMESTAMP.sql"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
docker exec medianest_postgres_prod pg_dump -U medianest_user medianest_prod > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Remove old backups
find $BACKUP_DIR -name "medianest_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "$(date): Database backup completed: $BACKUP_FILE.gz" >> /var/log/medianest/backup.log

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_DIR/$BACKUP_FILE.gz" s3://your-backup-bucket/database/
EOF

chmod +x /usr/local/bin/backup-database.sh

# Schedule daily backups at 3 AM
echo "0 3 * * * /usr/local/bin/backup-database.sh" | sudo crontab -
```

### 2. Application Data Backup

```bash
# Create application backup script
tee /usr/local/bin/backup-application.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/medianest/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
APP_BACKUP="medianest_app_$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files and configuration
tar -czf "$BACKUP_DIR/$APP_BACKUP" \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    -C /opt/medianest app/

# Log backup completion
echo "$(date): Application backup completed: $APP_BACKUP" >> /var/log/medianest/backup.log

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "medianest_app_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-application.sh

# Schedule weekly application backups
echo "0 4 * * 0 /usr/local/bin/backup-application.sh" | sudo crontab -
```

### 3. Restore Procedures

```bash
# Create restore script
tee /usr/local/bin/restore-database.sh << 'EOF'
#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Warning: This will replace the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 1
fi

# Stop application
cd /opt/medianest/app
docker-compose -f docker-compose.production.yml stop app

# Restore database
zcat "$BACKUP_FILE" | docker exec -i medianest_postgres_prod psql -U medianest_user medianest_prod

# Start application
docker-compose -f docker-compose.production.yml start app

echo "Database restore completed from: $BACKUP_FILE"
EOF

chmod +x /usr/local/bin/restore-database.sh
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /etc/ssl/certs/medianest.crt -text -noout | grep "Not After"

# Test SSL configuration
openssl s_client -connect medianest.yourdomain.com:443 -servername medianest.yourdomain.com

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
```

#### 2. Database Connection Issues

```bash
# Check database connectivity
docker exec medianest_postgres_prod pg_isready -U medianest_user

# View database logs
docker logs medianest_postgres_prod

# Check active connections
docker exec medianest_postgres_prod psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 3. Application Performance Issues

```bash
# Check container resource usage
docker stats

# View application logs
docker logs medianest_app_prod

# Check for memory leaks
docker exec medianest_app_prod cat /proc/meminfo
```

#### 4. Network Issues

```bash
# Test internal container communication
docker exec medianest_app_prod ping postgres
docker exec medianest_app_prod ping redis

# Check port accessibility
netstat -tulpn | grep -E ':(80|443|3000|5432|6379)'

# Test external API connectivity
docker exec medianest_app_prod curl -I http://plex.local:32400
```

### Log Analysis

```bash
# Analyze nginx access logs
tail -f /var/log/nginx/medianest_access.log | grep -E '(4[0-9][0-9]|5[0-9][0-9])'

# Monitor application errors
tail -f /opt/medianest/app/logs/error.log

# Check system resources
htop

# Monitor disk usage
watch -n 5 df -h
```

### Performance Optimization

```bash
# Optimize Docker containers
docker system prune -a

# Update container images
cd /opt/medianest/app
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d

# Analyze slow queries
docker exec medianest_postgres_prod psql -U postgres -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Security Checklist

- [ ] SSL certificates installed and configured
- [ ] Firewall rules configured (UFW)
- [ ] Fail2ban configured for intrusion prevention
- [ ] Strong passwords and secrets generated
- [ ] Database access restricted
- [ ] Regular security updates scheduled
- [ ] Container vulnerability scanning enabled
- [ ] Log monitoring and alerting configured
- [ ] Backup and recovery procedures tested
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] CSP policy configured
- [ ] HTTPS redirect enforced
- [ ] Non-root user configured for application
- [ ] Docker daemon secured
- [ ] Network segmentation implemented

## Maintenance Schedule

### Daily

- [ ] Check system health and logs
- [ ] Verify backups completed
- [ ] Monitor application performance

### Weekly

- [ ] Review security logs
- [ ] Run container security scans
- [ ] Check SSL certificate status
- [ ] Update system packages

### Monthly

- [ ] Review and rotate secrets
- [ ] Analyze performance metrics
- [ ] Test backup restoration
- [ ] Update application dependencies

### Quarterly

- [ ] Full security audit
- [ ] Disaster recovery testing
- [ ] Capacity planning review
- [ ] Update deployment procedures

This guide provides a comprehensive foundation for deploying MediaNest in production. Always test changes in a staging environment before applying them to production.
