# MediaNest Production Deployment Guide

**Version:** 2.0  
**Last Updated:** September 2025  
**Status:** ✅ Production Ready

This is the **complete, assumption-free deployment guide** for MediaNest. Follow this guide step-by-step to deploy MediaNest successfully in any environment.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Deployment Process](#deployment-process)
- [Post-Deployment Validation](#post-deployment-validation)
- [Configuration Verification](#configuration-verification)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🔧 Prerequisites

### System Requirements

**Minimum Hardware Requirements:**
- **CPU:** 2 cores (4 cores recommended)
- **RAM:** 4GB (8GB recommended for production)
- **Storage:** 50GB free space (SSD recommended)
- **Network:** Stable internet connection with ports 80/443 accessible

**Operating System Support:**
- Ubuntu 20.04 LTS or 22.04 LTS (recommended)
- CentOS 8+ / RHEL 8+
- Debian 11+
- Docker-compatible Linux distribution

### Required Software Versions

Install these **exact versions** to ensure compatibility:

```bash
# Verify current versions with these commands:
docker --version          # Required: 24.0+
docker compose version    # Required: v2.20+
node --version           # Required: 20.x LTS
npm --version            # Required: 10.x+
git --version            # Required: 2.30+
```

### Network Requirements

**Firewall Configuration:**
```bash
# Incoming ports that MUST be open:
80/tcp     # HTTP (redirects to HTTPS)
443/tcp    # HTTPS (main application)
22/tcp     # SSH (for management)

# Optional monitoring ports (can be internal-only):
3001/tcp   # Grafana dashboard
9090/tcp   # Prometheus metrics
```

**DNS Requirements:**
- Domain name pointing to your server IP
- Ability to modify DNS records for SSL certificate validation

---

## ✅ Pre-Deployment Checklist

**Complete ALL items before proceeding:**

### System Preparation
- [ ] Server provisioned with minimum hardware requirements
- [ ] Operating system updated: `sudo apt update && sudo apt upgrade -y`
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH access configured with key-based authentication
- [ ] Domain name configured and DNS propagated

### User Setup
- [ ] Non-root user created: `sudo adduser medianest`
- [ ] User added to sudo group: `sudo usermod -aG sudo medianest`
- [ ] User added to docker group (will be done during Docker installation)

### Security Hardening
- [ ] SSH password authentication disabled (key-only)
- [ ] Fail2ban installed and configured
- [ ] Automatic security updates enabled

---

## 🔧 Environment Setup

### Step 1: Install Docker & Docker Compose

**Execute these commands as your non-root user:**

```bash
# Update package index
sudo apt update

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
exit
```

**Verification Commands:**
```bash
# After logging back in, verify installation:
docker --version
# Expected: Docker version 24.0.x or higher

docker compose version
# Expected: Docker Compose version v2.20.x or higher

# Test Docker without sudo:
docker run hello-world
# Should run without permission errors
```

### Step 2: Install Additional Tools

```bash
# Install essential tools
sudo apt install -y \
    git \
    curl \
    wget \
    unzip \
    jq \
    htop \
    ufw \
    fail2ban \
    nginx-full \
    certbot \
    python3-certbot-nginx

# Verify installations
git --version
curl --version
nginx -v
certbot --version
```

### Step 3: Configure Firewall

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Verify firewall status
sudo ufw status verbose
```

---

## 🚀 Deployment Process

### Step 1: Download and Prepare MediaNest

```bash
# Create application directory
sudo mkdir -p /opt/medianest
sudo chown $USER:$USER /opt/medianest

# Clone the repository
cd /opt/medianest
git clone https://github.com/yourusername/medianest.git .

# Verify download
ls -la
# Should show: README.md, package.json, docker-compose files, etc.
```

### Step 2: Create Directory Structure

```bash
# Create required directories with correct permissions
mkdir -p data/{postgres,redis,uploads,certbot/{webroot,ssl}}
mkdir -p logs/{backend,frontend,nginx,certbot}
mkdir -p backups/{postgres,redis}
mkdir -p secrets

# Set ownership
sudo chown -R $USER:$USER data logs backups secrets

# Set permissions
chmod 755 data logs backups
chmod 700 secrets
```

### Step 3: Generate Secrets

**Critical Security Step - Generate Strong Secrets:**

```bash
# Create the secrets generation script
cat > generate-secrets.sh << 'EOF'
#!/bin/bash
set -e

SECRETS_DIR="./secrets"
echo "🔐 Generating production secrets..."

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Generate database password (32 chars, alphanumeric + symbols)
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32 > "$SECRETS_DIR/postgres_password"

# Generate Redis password (32 chars, alphanumeric + symbols)
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32 > "$SECRETS_DIR/redis_password"

# Generate JWT secret (64 chars)
openssl rand -hex 32 > "$SECRETS_DIR/jwt_secret"

# Generate NextAuth secret (64 chars)
openssl rand -hex 32 > "$SECRETS_DIR/nextauth_secret"

# Generate encryption key (64 chars)
openssl rand -hex 32 > "$SECRETS_DIR/encryption_key"

# Generate database URL
DB_PASSWORD=$(cat "$SECRETS_DIR/postgres_password")
echo "postgresql://medianest:${DB_PASSWORD}@postgres:5432/medianest?sslmode=prefer&connection_limit=20&pool_timeout=30" > "$SECRETS_DIR/database_url"

# Generate Redis URL
REDIS_PASSWORD=$(cat "$SECRETS_DIR/redis_password")
echo "redis://:${REDIS_PASSWORD}@redis:6379" > "$SECRETS_DIR/redis_url"

# Set secure permissions
chmod 600 "$SECRETS_DIR"/*

echo "✅ Secrets generated successfully!"
echo "📁 Secrets stored in: $SECRETS_DIR/"
echo "🔒 File permissions set to 600 (owner read-only)"

# Display secret file list (not contents!)
echo ""
echo "Generated secret files:"
ls -la "$SECRETS_DIR/"
EOF

# Make script executable and run it
chmod +x generate-secrets.sh
./generate-secrets.sh
```

### Step 4: Configure Environment Variables

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit the environment file with your specific values
nano .env.production
```

**Update these REQUIRED values in `.env.production`:**

```bash
# Domain Configuration (REQUIRED)
DOMAIN_NAME=your-domain.com
FRONTEND_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=wss://your-domain.com

# CORS Configuration (REQUIRED)
CORS_ORIGIN=https://your-domain.com

# SSL Configuration (REQUIRED)
CERTBOT_EMAIL=your-email@domain.com

# Application Settings
NODE_ENV=production
LOG_LEVEL=warn
RUN_MIGRATIONS=true

# Data Paths (should match your directory structure)
DATA_PATH=/opt/medianest/data
LOG_PATH=/opt/medianest/logs
BACKUP_PATH=/opt/medianest/backups

# Optional: Plex OAuth (get from https://www.plex.tv/api/v2/pins)
PLEX_CLIENT_ID=your_plex_client_id
PLEX_CLIENT_SECRET=your_plex_client_secret
```

**Create additional secrets files for Plex (if using):**

```bash
# Only if you have Plex integration
echo "your_plex_client_id" > secrets/plex_client_id
echo "your_plex_client_secret" > secrets/plex_client_secret

# Grafana password for monitoring (optional)
openssl rand -base64 20 | tr -d "=+/" | cut -c1-16 > secrets/grafana_password

# Set permissions
chmod 600 secrets/*
```

### Step 5: SSL Certificate Setup

**Choose ONE method:**

#### Method A: Let's Encrypt (Recommended for public domains)

```bash
# Stop any running nginx
sudo systemctl stop nginx

# Generate certificate using standalone mode
sudo certbot certonly \
    --standalone \
    --email your-email@domain.com \
    --agree-tos \
    --no-eff-email \
    --domains your-domain.com

# Copy certificates to application directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem data/certbot/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem data/certbot/ssl/
sudo chown $USER:$USER data/certbot/ssl/*
```

#### Method B: Self-Signed Certificate (For testing/internal use)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout data/certbot/ssl/privkey.pem -out data/certbot/ssl/fullchain.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=your-domain.com"

# Set permissions
chmod 600 data/certbot/ssl/privkey.pem
chmod 644 data/certbot/ssl/fullchain.pem
```

### Step 6: Deploy MediaNest

**Option A: Automated Deployment (Recommended)**

```bash
# Complete automated production deployment
./deployment/scripts/deploy-compose.sh \
  --domain your-domain.com \
  --email your-email@domain.com \
  --ssl-method letsencrypt

# The script automatically handles:
# - SSL certificate generation and configuration
# - Environment variable setup
# - Secret generation and security
# - Database initialization and migrations
# - Service health verification
# - Nginx reverse proxy configuration
```

**Option B: Manual Deployment**

```bash
# Pull latest images
docker compose -f config/docker/docker-compose.prod.yml pull

# Build and start services
docker compose -f config/docker/docker-compose.prod.yml up -d --build

# Check deployment status
docker compose -f config/docker/docker-compose.prod.yml ps
```

**Script Options:**

```bash
# Available deployment script options:
./deployment/scripts/deploy-compose.sh [OPTIONS]

# Options:
  --domain DOMAIN          # Your domain name (required)
  --email EMAIL           # Email for SSL certificates (required)
  --ssl-method METHOD     # 'letsencrypt' or 'selfsigned' (default: letsencrypt)
  --backup-existing       # Backup existing installation before deployment
  --skip-ssl             # Skip SSL certificate setup
  --dev-mode             # Deploy in development mode
  --help                 # Show help information

# Examples:
./deployment/scripts/deploy-compose.sh --domain media.example.com --email admin@example.com
./deployment/scripts/deploy-compose.sh --domain localhost --ssl-method selfsigned --dev-mode
```

**Expected output - ALL services should show "Up" status:**
```
NAME                   IMAGE                    COMMAND                  STATUS              PORTS
medianest-nginx        nginx:alpine            "/docker-entrypoint.…"   Up 30 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
medianest-frontend     medianest-frontend      "docker-entrypoint.s…"   Up 45 seconds       3000/tcp
medianest-backend      medianest-backend       "docker-entrypoint.s…"   Up 60 seconds       4000/tcp
medianest-postgres     postgres:16-alpine      "docker-entrypoint.s…"   Up (healthy) 75 seconds   5432/tcp
medianest-redis        redis:7-alpine          "docker-entrypoint.s…"   Up (healthy) 75 seconds   6379/tcp
```

**Service Health Status:**

After deployment, verify all services are healthy:

```bash
# Check individual service health
docker compose -f config/docker/docker-compose.prod.yml exec backend curl -f http://localhost:4000/health
docker compose -f config/docker/docker-compose.prod.yml exec frontend curl -f http://localhost:3000/api/health

# Check database connectivity
docker compose -f config/docker/docker-compose.prod.yml exec postgres pg_isready -U medianest

# Check Redis connectivity
docker compose -f config/docker/docker-compose.prod.yml exec redis redis-cli ping
```

### Step 7: Initialize Database

**If using automated deployment script, this step is handled automatically.**

**For manual deployment:**

```bash
# Wait for database to be ready
echo "Waiting for database to start..."
while ! docker compose -f config/docker/docker-compose.prod.yml exec postgres pg_isready -U medianest -q; do
  sleep 2
done
echo "Database is ready!"

# Run database migrations
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:migrate

# Seed initial data (admin user, default settings)
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:seed

# Verify database initialization
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:check
```

**Database Verification:**

```bash
# Check database tables were created
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "\dt"

# Verify admin user exists
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT username, role FROM users WHERE role='admin';"

# Check database health
docker compose -f config/docker/docker-compose.prod.yml exec backend node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('✅ Database connected')).catch(err => console.error('❌ Database error:', err.message)).finally(() => process.exit());"
```

---

## ✅ Post-Deployment Validation

### Step 1: Service Health Checks

**Run these validation commands in order:**

```bash
# 1. Container status check
docker compose -f config/docker/docker-compose.prod.yml ps
# All services must show "Up" or "Up (healthy)"

# 2. Backend health check
curl -f http://localhost/api/health
# Expected response: {"status":"ok","timestamp":"2025-09-09T...","uptime":...}

# 3. Frontend health check
curl -f https://your-domain.com/api/health
# Expected response: Similar JSON with frontend status

# 4. Database connectivity test
docker compose -f config/docker/docker-compose.prod.yml exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect().then(() => {
  console.log('✅ Database connection successful');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
"

# 5. Redis connectivity test
docker compose -f config/docker/docker-compose.prod.yml exec redis redis-cli -a "$(cat secrets/redis_password)" ping
# Expected response: PONG
```

### Step 2: Application Access Tests

```bash
# Test HTTP to HTTPS redirect
curl -I http://your-domain.com
# Expected: HTTP 301 redirect to https://

# Test HTTPS access
curl -I https://your-domain.com
# Expected: HTTP 200 OK with security headers

# Test API endpoints
curl -f https://your-domain.com/api/health
curl -f https://your-domain.com/api/status
```

### Step 3: SSL Certificate Validation

```bash
# Check certificate validity
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
curl -sS https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com&hideResults=on
```

### Step 4: Performance Validation

```bash
# Check response times
time curl -s https://your-domain.com > /dev/null

# Check resource usage
docker stats --no-stream

# Check logs for errors
docker compose -f config/docker/docker-compose.prod.yml logs --tail=50 backend frontend
```

---

## 🔍 Configuration Verification

### Verify Environment Configuration

```bash
# Check environment variables are loaded correctly
docker compose -f config/docker/docker-compose.prod.yml exec backend node -e "
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('REDIS_URL set:', !!process.env.REDIS_URL);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
console.log('NEXTAUTH_SECRET set:', !!process.env.NEXTAUTH_SECRET);
"
```

### Verify Security Configuration

```bash
# Check security headers
curl -I https://your-domain.com | grep -E "(Strict-Transport|X-Frame-Options|X-Content-Type|Content-Security-Policy)"

# Verify secrets file permissions
ls -la secrets/
# All files should show: -rw------- (600 permissions)

# Check container security
docker compose -f config/docker/docker-compose.prod.yml exec backend whoami
# Should NOT be root
```

### Verify Network Configuration

```bash
# Check network connectivity between services
docker compose -f config/docker/docker-compose.prod.yml exec backend ping -c 1 postgres
docker compose -f config/docker/docker-compose.prod.yml exec backend ping -c 1 redis
docker compose -f config/docker/docker-compose.prod.yml exec frontend ping -c 1 backend
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Services Won't Start

**Symptoms:**
- Containers exit immediately
- "Connection refused" errors
- Services stuck in "Starting" state

**Diagnosis:**
```bash
# Check container logs
docker compose -f config/docker/docker-compose.prod.yml logs backend frontend postgres redis

# Check system resources
df -h  # Disk space
free -h  # Memory
docker system df  # Docker space usage
```

**Solutions:**
```bash
# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Restart with fresh containers
docker compose -f config/docker/docker-compose.prod.yml down
docker compose -f config/docker/docker-compose.prod.yml up -d --force-recreate
```

#### Issue 2: Database Connection Failures

**Symptoms:**
- "database connection failed" errors
- Backend health checks failing
- Migration errors

**Diagnosis:**
```bash
# Check PostgreSQL container
docker compose -f config/docker/docker-compose.prod.yml logs postgres

# Test database connection manually
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT version();"
```

**Solutions:**
```bash
# Verify database credentials
cat secrets/database_url
cat secrets/postgres_password

# Reset database if needed
docker compose -f config/docker/docker-compose.prod.yml down postgres
docker volume rm medianest_postgres_data
docker compose -f config/docker/docker-compose.prod.yml up -d postgres
```

#### Issue 3: SSL Certificate Problems

**Symptoms:**
- "SSL certificate error" in browser
- Certificate warnings
- HTTPS not working

**Diagnosis:**
```bash
# Check certificate files
ls -la data/certbot/ssl/
openssl x509 -in data/certbot/ssl/fullchain.pem -text -noout

# Check nginx configuration
docker compose -f config/docker/docker-compose.prod.yml exec nginx nginx -t
```

**Solutions:**
```bash
# Regenerate certificate
sudo certbot delete --cert-name your-domain.com
sudo certbot certonly --standalone --email your-email@domain.com --agree-tos -d your-domain.com

# Update certificate files
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem data/certbot/ssl/
sudo chown $USER:$USER data/certbot/ssl/*

# Restart nginx
docker compose -f config/docker/docker-compose.prod.yml restart nginx
```

#### Issue 4: High Memory Usage

**Symptoms:**
- System running out of memory
- Containers being killed (OOMKilled)
- Poor performance

**Diagnosis:**
```bash
# Check memory usage
free -h
docker stats --no-stream

# Check for memory leaks
docker compose -f config/docker/docker-compose.prod.yml exec backend node --expose-gc -e "
setInterval(() => {
  if (global.gc) global.gc();
  console.log('Memory usage:', process.memoryUsage());
}, 10000);
" &
```

**Solutions:**
```bash
# Restart services to clear memory
docker compose -f config/docker/docker-compose.prod.yml restart backend frontend

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Log Analysis

```bash
# View real-time logs
docker compose -f config/docker/docker-compose.prod.yml logs -f backend frontend

# Search for specific errors
docker compose -f config/docker/docker-compose.prod.yml logs backend | grep -i error

# Check log file sizes
du -sh logs/*

# Archive old logs if needed
find logs/ -name "*.log" -mtime +7 -exec gzip {} \;
```

---

## 🔄 Rollback Procedures

### Emergency Rollback

If deployment fails and you need to quickly rollback:

```bash
# Stop current deployment
docker compose -f config/docker/docker-compose.prod.yml down

# Rollback to previous version
git checkout HEAD~1

# Restore previous secrets (if you backed them up)
cp secrets.backup/* secrets/

# Restart with previous version
docker compose -f config/docker/docker-compose.prod.yml up -d

# Verify rollback
curl -f https://your-domain.com/api/health
```

### Planned Rollback

For planned rollbacks with database considerations:

```bash
# 1. Create backup before rollback
docker compose -f config/docker/docker-compose.prod.yml exec postgres pg_dump -U medianest medianest > backup-pre-rollback.sql

# 2. Stop services
docker compose -f config/docker/docker-compose.prod.yml down

# 3. Rollback code
git checkout PREVIOUS_STABLE_TAG

# 4. Rollback database if needed (CAUTION: DATA LOSS)
docker compose -f config/docker/docker-compose.prod.yml up -d postgres
sleep 10
docker compose -f config/docker/docker-compose.prod.yml exec -T postgres psql -U medianest medianest < backup-stable.sql

# 5. Start services
docker compose -f config/docker/docker-compose.prod.yml up -d

# 6. Verify rollback
docker compose -f config/docker/docker-compose.prod.yml ps
curl -f https://your-domain.com/api/health
```

---

## 📊 Monitoring & Maintenance

### Daily Health Checks

Create an automated health check script:

```bash
# Create health check script
cat > /opt/medianest/health-check.sh << 'EOF'
#!/bin/bash
echo "🏥 MediaNest Health Check - $(date)"

# Check container status
echo "📦 Container Status:"
docker compose -f config/docker/docker-compose.prod.yml ps

# Check application health
echo "🔍 Application Health:"
curl -s https://your-domain.com/api/health | jq '.' || echo "❌ Health check failed"

# Check disk usage
echo "💾 Disk Usage:"
df -h /opt/medianest

# Check memory usage
echo "🧠 Memory Usage:"
free -h

# Check SSL certificate expiry
echo "🔐 SSL Certificate:"
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

echo "✅ Health check complete"
EOF

chmod +x /opt/medianest/health-check.sh

# Add to crontab for daily execution
(crontab -l 2>/dev/null; echo "0 8 * * * /opt/medianest/health-check.sh >> /opt/medianest/logs/health-check.log 2>&1") | crontab -
```

### Backup Automation

```bash
# Create backup script
cat > /opt/medianest/backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/opt/medianest/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🗄️  Starting backup - $DATE"

# Database backup
echo "📊 Backing up database..."
docker compose -f config/docker/docker-compose.prod.yml exec -T postgres pg_dump -U medianest medianest | gzip > "$BACKUP_DIR/postgres/db_$DATE.sql.gz"

# Redis backup
echo "💾 Backing up Redis..."
docker compose -f config/docker/docker-compose.prod.yml exec redis redis-cli -a "$(cat secrets/redis_password)" --rdb /tmp/dump.rdb
docker cp medianest-redis:/tmp/dump.rdb "$BACKUP_DIR/redis/redis_$DATE.rdb"

# Uploads backup
echo "📁 Backing up uploads..."
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C data uploads

# Keep only last 7 days of backups
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "✅ Backup completed successfully"
EOF

chmod +x /opt/medianest/backup.sh

# Schedule daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/medianest/backup.sh >> /opt/medianest/logs/backup.log 2>&1") | crontab -
```

### Log Rotation

```bash
# Configure logrotate
sudo cat > /etc/logrotate.d/medianest << 'EOF'
/opt/medianest/logs/*/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        docker compose -f /opt/medianest/config/docker/docker-compose.prod.yml restart nginx backend frontend
    endscript
}
EOF
```

### Update Procedures

```bash
# Create update script
cat > /opt/medianest/update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Starting MediaNest update..."

# Create backup before update
./backup.sh

# Pull latest changes
git pull origin main

# Pull latest images
docker compose -f config/docker/docker-compose.prod.yml pull

# Update with zero downtime
docker compose -f config/docker/docker-compose.prod.yml up -d --build

# Run migrations if needed
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:migrate

# Health check
sleep 30
curl -f https://your-domain.com/api/health

echo "✅ Update completed successfully"
EOF

chmod +x /opt/medianest/update.sh
```

---

## 📞 Support & Additional Resources

### Quick Command Reference

```bash
# Start services
docker compose -f config/docker/docker-compose.prod.yml up -d

# Stop services
docker compose -f config/docker/docker-compose.prod.yml down

# View logs
docker compose -f config/docker/docker-compose.prod.yml logs -f backend frontend

# Restart specific service
docker compose -f config/docker/docker-compose.prod.yml restart backend

# Scale services
docker compose -f config/docker/docker-compose.prod.yml up -d --scale backend=2

# Execute commands in container
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:migrate

# View service status
docker compose -f config/docker/docker-compose.prod.yml ps
```

### Emergency Contacts

- **Server Provider:** Your hosting provider support
- **Domain Provider:** Your DNS provider support  
- **SSL Provider:** Let's Encrypt community forum
- **Application Support:** MediaNest GitHub issues

### Additional Documentation

- [Backend Configuration](backend/README.md)
- [Frontend Configuration](frontend/README.md)
- [Security Documentation](ARCHITECTURE.md#7-security-architecture)
- [Performance Documentation](ARCHITECTURE.md#10-performance--scalability)
- [API Documentation](docs/api/overview.md)

---

## ✅ Deployment Success Checklist

**Before considering deployment complete, verify ALL items:**

### Technical Validation
- [ ] All containers are running and healthy
- [ ] Database migrations completed successfully  
- [ ] SSL certificate is valid and HTTPS works
- [ ] Health endpoints return 200 OK
- [ ] Authentication system is working
- [ ] File uploads are functioning
- [ ] All external integrations are connected

### Security Validation  
- [ ] All secrets are properly generated and secured
- [ ] Firewall is configured and active
- [ ] Security headers are present in responses
- [ ] No default passwords are in use
- [ ] Container security best practices are implemented
- [ ] Fail2ban is configured and running

### Operational Validation
- [ ] Automated backups are scheduled and working
- [ ] Log rotation is configured
- [ ] Health monitoring is in place
- [ ] Update procedures are documented and tested
- [ ] Rollback procedures are tested
- [ ] DNS is properly configured

### Performance Validation
- [ ] Response times are under 2 seconds
- [ ] Memory usage is stable and reasonable
- [ ] Disk space usage is monitored
- [ ] Database queries are optimized
- [ ] SSL/TLS performance is acceptable

**🎉 Deployment Complete!**

Your MediaNest instance should now be fully operational at: `https://your-domain.com`

**Default Access:**
- **Main Application:** https://your-domain.com
- **API Health:** https://your-domain.com/api/health  
- **API Status:** https://your-domain.com/api/status

For ongoing maintenance, refer to the monitoring and maintenance sections above.

---

## 🚀 Docker Compose Architecture Overview

MediaNest uses a modern Docker Compose architecture optimized for both development and production deployment:

### Service Architecture

```
medianest-stack/
├── nginx (Reverse Proxy)
│   ├── SSL/TLS Termination
│   ├── Static File Serving
│   └── Rate Limiting & Security
│
├── frontend (Next.js Application)
│   ├── React 18+ with App Router
│   ├── Server-Side Rendering
│   └── WebSocket Client
│
├── backend (Express.js API)
│   ├── RESTful API Endpoints
│   ├── WebSocket Server (Socket.io)
│   ├── Background Job Processing
│   └── External Service Integrations
│
├── postgres (Database)
│   ├── PostgreSQL 16 with Alpine
│   ├── Automated Backups
│   └── Health Checks
│
└── redis (Cache & Queue)
    ├── Session Storage
    ├── Job Queue (BullMQ)
    └── Caching Layer
```

### Container Features

**Security:**
- All containers run as non-root users (1000:1000)
- Docker secrets for sensitive data
- Minimal Alpine-based images
- Security scanning and updates

**Reliability:**
- Health checks for all services
- Automatic restart policies
- Graceful shutdown handling
- Resource limits and monitoring

**Performance:**
- Multi-stage Docker builds
- Optimized image layers
- Connection pooling
- Efficient caching strategies

### Deployment Options

| Method | Use Case | Complexity | Features |
|--------|----------|------------|----------|
| **Automated Script** | Production | Low | SSL, monitoring, backups |
| **Manual Compose** | Development/Testing | Medium | Full control, customization |
| **Hybrid** | Staging/Custom | Medium | Partial automation |

---

*This deployment guide is designed to be comprehensive and assumption-free. If you encounter any issues not covered in this guide, please check the troubleshooting section or create an issue on the MediaNest GitHub repository.*