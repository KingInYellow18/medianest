# Manual Installation Guide

This guide covers installing MediaNest manually without Docker, giving you full control over the installation process.

## Prerequisites

### System Requirements

- Linux, macOS, or Windows
- Node.js 18.x or higher
- PostgreSQL 14+
- Redis 6.0+ (optional but recommended)
- Git (for source installation)

### Required Tools

```bash
# Node.js and npm
node --version  # Should be 18.x+
npm --version   # Should be 8.x+

# PostgreSQL
psql --version  # Should be 14+

# Redis (optional)
redis-server --version  # Should be 6.0+
```

## Installation Methods

### Method 1: From Source (Recommended for Development)

#### 1. Clone Repository

```bash
git clone https://github.com/medianest/medianest.git
cd medianest
```

#### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

#### 3. Build Application

```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ../backend
npm run build

cd ..
```

### Method 2: From NPM Package (Coming Soon)

```bash
npm install -g @medianest/server
```

## Database Setup

### 1. Install PostgreSQL

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### CentOS/RHEL

```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### macOS

```bash
brew install postgresql
brew services start postgresql
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE medianest;
CREATE USER medianest WITH ENCRYPTED PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;

# Enable required extensions
\c medianest
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\q
```

### 3. Configure Database Connection

Create database configuration:

```bash
# Copy example configuration
cp backend/config/database.example.js backend/config/database.js
```

Edit `backend/config/database.js`:

```javascript
module.exports = {
  development: {
    host: 'localhost',
    port: 5432,
    database: 'medianest',
    username: 'medianest',
    password: 'your_password_here',
    dialect: 'postgres',
    logging: console.log,
  },
  production: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'medianest',
    username: process.env.DB_USER || 'medianest',
    password: process.env.DB_PASS || 'your_password_here',
    dialect: 'postgres',
    logging: false,
  },
};
```

## Redis Setup (Optional)

### 1. Install Redis

#### Ubuntu/Debian

```bash
sudo apt install redis-server
```

#### CentOS/RHEL

```bash
sudo yum install redis
sudo systemctl enable redis
sudo systemctl start redis
```

#### macOS

```bash
brew install redis
brew services start redis
```

### 2. Configure Redis

Edit `/etc/redis/redis.conf`:

```
# Bind to localhost
bind 127.0.0.1

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Set password (optional)
requirepass your_redis_password
```

Restart Redis:

```bash
sudo systemctl restart redis
```

## Application Configuration

### 1. Environment Configuration

Create environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Application
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://medianest:your_password_here@localhost:5432/medianest

# Redis (optional)
REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your_jwt_secret_here_min_32_chars
SESSION_SECRET=your_session_secret_here_min_32_chars

# Media Storage
MEDIA_ROOT=/var/lib/medianest/media
UPLOAD_MAX_SIZE=100mb
THUMBNAIL_QUALITY=80

# External APIs (optional)
TMDB_API_KEY=your_tmdb_api_key
TVDB_API_KEY=your_tvdb_api_key

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/medianest
```

### 2. Create Required Directories

```bash
# Create media and data directories
sudo mkdir -p /var/lib/medianest/{media,data,cache}
sudo mkdir -p /var/log/medianest

# Set ownership (replace 'medianest' with your user)
sudo chown -R medianest:medianest /var/lib/medianest
sudo chown -R medianest:medianest /var/log/medianest

# Set permissions
chmod 755 /var/lib/medianest
chmod 755 /var/log/medianest
```

## Database Initialization

### 1. Run Migrations

```bash
cd backend
npm run migrate:up
```

### 2. Seed Initial Data (Optional)

```bash
npm run seed
```

### 3. Create Administrator Account

```bash
npm run create:admin
# Follow the prompts to create admin user
```

## Process Management

### Method 1: PM2 (Recommended for Production)

#### Install PM2

```bash
npm install -g pm2
```

#### Create PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'medianest',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/medianest/error.log',
      out_file: '/var/log/medianest/out.log',
      log_file: '/var/log/medianest/combined.log',
      time: true,
    },
  ],
};
```

#### Start Application

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### Method 2: Systemd Service

Create `/etc/systemd/system/medianest.service`:

```ini
[Unit]
Description=MediaNest Application
Documentation=https://docs.medianest.com
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=medianest
Group=medianest
WorkingDirectory=/opt/medianest/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=medianest
Environment=NODE_ENV=production
EnvironmentFile=/opt/medianest/.env

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable medianest
sudo systemctl start medianest

# Check status
sudo systemctl status medianest
```

## Web Server Configuration

### Nginx Configuration

Create `/etc/nginx/sites-available/medianest`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Static file serving
    location /static {
        alias /var/lib/medianest/media;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API and application proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/medianest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Hardening

### 1. Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Block direct access to database and redis ports
sudo ufw deny 5432
sudo ufw deny 6379

# Enable firewall
sudo ufw enable
```

### 2. SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

### 3. File Permissions

```bash
# Set secure permissions
chmod 600 .env
chmod -R 755 /var/lib/medianest
chmod -R 644 /var/log/medianest
```

## Monitoring and Logging

### 1. Log Rotation

Create `/etc/logrotate.d/medianest`:

```
/var/log/medianest/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 medianest medianest
    postrotate
        systemctl reload medianest
    endscript
}
```

### 2. Health Monitoring

Create health check script `/opt/medianest/scripts/health-check.sh`:

```bash
#!/bin/bash
curl -f http://localhost:3000/api/health || exit 1
```

Add to crontab:

```bash
# Check health every 5 minutes
*/5 * * * * /opt/medianest/scripts/health-check.sh
```

## Backup Strategy

### 1. Database Backup Script

Create `/opt/medianest/scripts/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/medianest"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U medianest -h localhost medianest | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
```

### 2. Media Backup

```bash
#!/bin/bash
rsync -av --delete /var/lib/medianest/media/ /backup/medianest-media/
```

### 3. Automated Backup Schedule

Add to crontab:

```bash
# Database backup daily at 2 AM
0 2 * * * /opt/medianest/scripts/backup-db.sh

# Media backup weekly on Sunday at 3 AM
0 3 * * 0 /opt/medianest/scripts/backup-media.sh
```

## Verification and Testing

### 1. Application Health

```bash
# Check application status
curl http://localhost:3000/api/health

# Check logs
tail -f /var/log/medianest/combined.log
```

### 2. Database Connection

```bash
# Test database connection
psql -U medianest -h localhost -d medianest -c "SELECT version();"
```

### 3. Performance Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Basic performance test
ab -n 1000 -c 10 http://localhost:3000/
```

## Troubleshooting

### Common Issues

#### Permission Denied Errors

```bash
# Fix ownership
sudo chown -R medianest:medianest /var/lib/medianest
sudo chown -R medianest:medianest /var/log/medianest
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
nc -zv localhost 5432
```

#### Memory Issues

```bash
# Monitor memory usage
free -h
ps aux | grep node | head -10
```

### Log Locations

- Application logs: `/var/log/medianest/`
- PostgreSQL logs: `/var/log/postgresql/`
- Nginx logs: `/var/log/nginx/`
- System logs: `journalctl -u medianest`

For additional help, see the [Troubleshooting Guide](../troubleshooting/index.md).

## Next Steps

After successful installation:

1. Complete the [First Time Setup](../getting-started/first-setup.md)
2. Configure [Environment Variables](environment.md)
3. Review [Security Best Practices](../security/index.md)
4. Set up [Monitoring](../monitoring/index.md)
