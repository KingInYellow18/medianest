# MediaNest Infrastructure

**⚠️ Current Status: Development/Repair Phase - Deployment Issues Present**

The MediaNest Infrastructure provides deployment configurations, database initialization scripts, reverse proxy setup, and container orchestration for the MediaNest application stack.

## 🚨 Known Issues

- **Docker Build Failures**: Cannot build due to TypeScript compilation errors
- **Database Migrations**: Schema inconsistencies preventing clean deployments
- **Service Dependencies**: Container startup order and health check issues
- **SSL Configuration**: Certificate management needs improvement

## 📋 Purpose

The infrastructure module provides:

- **Container Orchestration**: Docker Compose configurations for all environments
- **Database Setup**: PostgreSQL initialization and migration scripts
- **Reverse Proxy**: Nginx configuration for production deployments
- **Monitoring**: Health checks and service monitoring setup
- **Security**: SSL/TLS configuration and security hardening
- **Backup & Recovery**: Database backup and restoration scripts

## 🏗️ Architecture

```
infrastructure/
├── database/           # Database configuration
│   ├── init.sql       # Database initialization
│   ├── seed.sql       # Seed data
│   └── backup.sh      # Backup scripts
├── nginx/             # Reverse proxy configuration
│   ├── nginx.conf     # Main nginx configuration
│   ├── sites/         # Site-specific configurations
│   └── ssl/           # SSL certificate handling
└── scripts/           # Deployment and utility scripts
    ├── deploy.sh      # Deployment automation
    ├── backup.sh      # System backup
    └── health-check.sh # Service monitoring
```

## 🐳 Docker Configuration

### Environment-Specific Compositions

#### Development (`docker-compose.yml`)

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - '3000:3000'
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - '3001:3001'
    depends_on:
      - database
      - redis

  database:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/database:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
```

#### Production (`docker-compose.prod.yml`)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./infrastructure/nginx:/etc/nginx/conf.d
      - ./ssl:/etc/ssl/certs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    expose:
      - '3000'

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    expose:
      - '3001'
    environment:
      - NODE_ENV=production
```

### Service Dependencies

```yaml
# Dependency chain
nginx → frontend → backend → database
↘️ redis ↙️
```

## 🗄️ Database Setup

### PostgreSQL Configuration

```sql
-- infrastructure/database/init.sql
CREATE DATABASE medianest;
CREATE USER medianest_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Schema Management

- **Prisma Migrations**: Version-controlled schema changes
- **Seed Data**: Initial application data
- **Backup Strategy**: Automated daily backups
- **Recovery Procedures**: Point-in-time recovery capability

### Database Scripts

```bash
# Initialize database
./infrastructure/database/init.sh

# Run migrations
docker exec medianest_backend npm run prisma:migrate

# Create backup
./infrastructure/scripts/backup.sh

# Restore from backup
./infrastructure/scripts/restore.sh backup_file.sql
```

## 🌐 Nginx Reverse Proxy

### Main Configuration

```nginx
# infrastructure/nginx/nginx.conf
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name medianest.local;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name medianest.local;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/medianest.crt;
    ssl_certificate_key /etc/ssl/private/medianest.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Frontend routes
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://backend;
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

### Security Configuration

```nginx
# Security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

## 🚀 Deployment

### Quick Start (⚠️ Currently Broken)

```bash
# Clone repository
git clone <repository-url>
cd medianest

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Build and start services (WILL FAIL)
docker-compose -f docker-compose.prod.yml up -d --build
```

### Production Deployment Steps

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Environment Configuration

```bash
# Create environment file
cp .env.production.example .env.production

# Generate secrets
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
openssl rand -hex 32  # DATABASE_PASSWORD
```

#### 3. SSL Certificate Setup

```bash
# Using Let's Encrypt (recommended)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
sudo chown $USER:$USER ./ssl/*
```

#### 4. Database Setup

```bash
# Initialize database
docker-compose -f docker-compose.prod.yml up -d database
sleep 10

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run prisma:migrate
```

#### 5. Service Deployment

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Health Checks

```bash
# Check service health
curl -f http://localhost/api/health

# Check SSL
curl -k https://localhost/api/health

# Check database connectivity
docker-compose exec backend npm run db:check

# Check Redis
docker-compose exec redis redis-cli ping
```

## 🔧 Configuration Management

### Environment Variables

```bash
# Production environment (.env.production)
NODE_ENV=production

# Database
DATABASE_URL=postgresql://medianest_user:secure_password@database:5432/medianest
REDIS_URL=redis://redis:6379

# Application
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com/api

# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key
NEXTAUTH_SECRET=your-nextauth-secret

# External Services
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret
```

### Service Configuration

```yaml
# docker-compose.prod.yml environment
services:
  backend:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}

  frontend:
    environment:
      - NODE_ENV=production
      - NEXTAUTH_URL=${FRONTEND_URL}
      - NEXT_PUBLIC_API_URL=${BACKEND_URL}
```

## 📊 Monitoring & Logging

### Service Health Monitoring

```bash
# Infrastructure health check script
#!/bin/bash
services=("frontend" "backend" "database" "redis" "nginx")

for service in "${services[@]}"; do
  if docker-compose ps | grep -q "$service.*Up"; then
    echo "✅ $service is running"
  else
    echo "❌ $service is not running"
  fi
done
```

### Log Management

```yaml
# Centralized logging
services:
  backend:
    logging:
      driver: 'json-file'
      options:
        max-size: '100m'
        max-file: '3'

  frontend:
    logging:
      driver: 'json-file'
      options:
        max-size: '100m'
        max-file: '3'
```

### Monitoring Integration

- **Health Check Endpoints**: `/api/health`, `/api/metrics`
- **Uptime Kuma**: Service monitoring dashboard
- **Log Aggregation**: Centralized log collection
- **Alerting**: Email/Slack notifications for service failures

## 🔒 Security

### Container Security

```dockerfile
# Security best practices in Dockerfiles
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs
```

### Network Security

```yaml
# Docker network isolation
networks:
  frontend:
    external: false
  backend:
    external: false
  database:
    external: false
```

### Firewall Configuration

```bash
# UFW firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 💾 Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# infrastructure/scripts/backup.sh

BACKUP_DIR="/opt/medianest/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose exec -T database pg_dump -U medianest_user medianest > "$BACKUP_DIR/db_$DATE.sql"

# Application data backup
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" ./data

# Keep only last 7 days
find "$BACKUP_DIR" -type f -mtime +7 -delete
```

### Recovery Procedures

```bash
# Database recovery
docker-compose exec -T database psql -U medianest_user medianest < backup_file.sql

# Full system recovery
docker-compose down
tar -xzf data_backup.tar.gz
docker-compose up -d
```

## 🔗 Related Modules

- **[Backend](../backend/README.md)** - Express.js API server
- **[Frontend](../frontend/README.md)** - Next.js React application
- **[Shared](../shared/README.md)** - Common utilities and types
- **[Tests](../tests/README.md)** - Testing framework and E2E tests

## 🛠️ Maintenance

### Regular Tasks

```bash
# Weekly system update
sudo apt update && sudo apt upgrade -y

# Docker system cleanup
docker system prune -f

# Log rotation
docker-compose exec backend npm run logs:rotate

# Database optimization
docker-compose exec database psql -U medianest_user -c "VACUUM ANALYZE;"
```

### Performance Tuning

- **Database Indexing**: Regular index analysis
- **Container Resources**: Memory and CPU limits
- **Nginx Optimization**: Buffer sizes and caching
- **SSL Performance**: Session resumption and OCSP stapling

## 🐛 Troubleshooting

### Common Issues

1. **Service Won't Start**

   ```bash
   # Check container logs
   docker-compose logs service_name

   # Check resource usage
   docker stats

   # Restart service
   docker-compose restart service_name
   ```

2. **Database Connection Issues**

   ```bash
   # Test database connectivity
   docker-compose exec backend npm run db:test

   # Check PostgreSQL logs
   docker-compose logs database
   ```

3. **SSL Certificate Issues**

   ```bash
   # Check certificate validity
   openssl x509 -in ssl/cert.pem -text -noout

   # Test SSL connection
   openssl s_client -connect localhost:443
   ```

4. **Build Failures**

   ```bash
   # Clean Docker cache
   docker builder prune -a

   # Rebuild without cache
   docker-compose build --no-cache
   ```

### Performance Issues

- Monitor container resources with `docker stats`
- Check nginx access logs for slow requests
- Analyze database queries with `EXPLAIN`
- Monitor Redis memory usage

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/infrastructure-improvement`
3. Test changes in development environment
4. Document configuration changes
5. Update deployment procedures
6. Test backup and recovery procedures
7. Submit pull request with deployment notes

### Infrastructure Standards

- Use official Docker images when possible
- Implement proper health checks
- Follow security best practices
- Document all configuration changes
- Test disaster recovery procedures

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
