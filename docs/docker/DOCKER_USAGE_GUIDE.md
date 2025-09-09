# MediaNest Docker Usage Guide

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ with BuildKit enabled
- Docker Compose 2.0+
- 8GB+ RAM recommended
- 20GB+ free disk space

### Environment Setup
```bash
# Enable BuildKit (required)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Clone and navigate to project
cd /path/to/medianest
```

## 🏗️ Building Images

### Production Build
```bash
# Build all production services
./config/docker/build-optimization.sh --production --optimize size --cache registry

# Build specific service
./config/docker/build-optimization.sh --target backend-production --optimize size

# With monitoring
./config/docker/build-optimization.sh --target monitoring --cache local
```

### Development Build
```bash
# Development environment
./config/docker/build-optimization.sh --development --cache local

# With debugging enabled
./config/docker/build-optimization.sh --development --verbose
```

### Advanced Build Options
```bash
# Size-optimized build
./config/docker/build-optimization.sh --production --optimize size --cache registry

# Speed-optimized build
./config/docker/build-optimization.sh --production --optimize speed --parallel

# Security-hardened build
./config/docker/build-optimization.sh --production --optimize balanced --cache registry
```

## 🐳 Docker Compose Deployment

### Development Environment
```bash
# Start development stack
docker-compose -f config/docker/docker-compose.consolidated.yml --profile dev up

# With database tools
docker-compose -f config/docker/docker-compose.consolidated.yml --profile dev --profile tools up

# Background execution
docker-compose -f config/docker/docker-compose.consolidated.yml --profile dev up -d
```

### Production Environment
```bash
# Production deployment
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d

# With SSL (configure certificates first)
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod --profile ssl up -d

# Scale services
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d --scale backend=2
```

### Full Stack with Monitoring
```bash
# Complete observability stack
docker-compose -f config/docker/docker-compose.consolidated.yml --profile full up -d

# Access monitoring:
# - Grafana: http://localhost:3001
# - Prometheus: http://localhost:9090
# - Application: http://localhost
```

## 🔧 Configuration

### Environment Variables

#### Required for Production
```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/medianest
POSTGRES_PASSWORD=secure_password

# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key
NEXTAUTH_SECRET=your-nextauth-secret

# External Services  
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret
```

#### Optional Configuration
```bash
# Performance
NODE_OPTIONS="--max-old-space-size=1024"
REDIS_URL=redis://redis:6379

# Monitoring
ENABLE_MONITORING=true
GRAFANA_ADMIN_PASSWORD=admin

# Paths
DATA_PATH=./data
BACKUP_PATH=./backups
```

### Service Configuration Files

#### Create .env file
```bash
# Production environment
cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://medianest:secure_password@postgres:5432/medianest
JWT_SECRET=your-very-long-random-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
NEXTAUTH_SECRET=your-nextauth-secret-key
NEXTAUTH_URL=https://your-domain.com
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret
EOF
```

## 🧪 Testing

### Run Test Suite
```bash
# Complete test suite with fresh database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile test up test-runner

# Integration tests only
docker-compose -f config/docker/docker-compose.consolidated.yml --profile test run --rm test-runner npm run test:integration

# E2E tests with browsers
docker-compose -f config/docker/docker-compose.consolidated.yml --profile test run --rm test-runner npm run test:e2e
```

### Test with Coverage
```bash
# Generate coverage reports
docker-compose -f config/docker/docker-compose.consolidated.yml --profile test run --rm test-runner npm run test:coverage

# View results in ./coverage/
```

## 🚨 Database Operations

### Migrations
```bash
# Run migrations
docker-compose -f config/docker/docker-compose.consolidated.yml run --rm migration-runner

# Or with environment variable
RUN_MIGRATIONS=true docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up backend
```

### Database Access
```bash
# Connect to production database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec postgres psql -U medianest -d medianest

# Development database with pgAdmin (profile: tools)
# Access: http://localhost:8080
# Email: dev@medianest.local
# Password: devpassword
```

### Backup and Restore
```bash
# Backup database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec postgres pg_dump -U medianest medianest > backup.sql

# Restore database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec -T postgres psql -U medianest -d medianest < backup.sql
```

## 📊 Monitoring and Debugging

### Health Checks
```bash
# Check service health
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod ps

# Manual health check
curl http://localhost/api/health
curl http://localhost:3001/api/health
```

### Logs
```bash
# View all logs
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod logs -f

# Service-specific logs
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod logs -f backend
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod logs -f frontend

# Nginx access logs
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec nginx tail -f /var/log/nginx/access.log
```

### Performance Monitoring
```bash
# Container stats
docker stats

# Service metrics
curl http://localhost/metrics
curl http://localhost:9090  # Prometheus
curl http://localhost:3001  # Grafana
```

### Debugging
```bash
# Debug mode (development)
DEBUG=medianest:* docker-compose -f config/docker/docker-compose.consolidated.yml --profile dev up

# Connect to running container
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec backend sh
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec frontend sh

# Node.js debugger (development)
# Connect to localhost:9229 with your debugger
```

## 🛠️ Maintenance

### Cache Management
```bash
# Clean build cache
./config/docker/build-optimization.sh --clean-cache all

# Clean Docker system
docker system prune -af
docker volume prune -f

# Clean specific cache
./config/docker/build-optimization.sh --clean-cache local
```

### Updates and Upgrades
```bash
# Update base images
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod pull

# Rebuild with latest dependencies
./config/docker/build-optimization.sh --production --optimize size --no-cache

# Rolling update (zero downtime)
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d --force-recreate --no-deps backend
```

### Security Scanning
```bash
# Run security scanner
docker-compose -f config/docker/docker-compose.consolidated.yml run --rm security-scanner

# Manual security audit
docker run --rm -v $(pwd):/app aquasec/trivy fs /app
```

## 🚀 Production Deployment

### Pre-deployment Checklist
```bash
# 1. Test build
./config/docker/build-optimization.sh --production --optimize size

# 2. Run tests
docker-compose -f config/docker/docker-compose.consolidated.yml --profile test up test-runner

# 3. Security scan
docker-compose -f config/docker/docker-compose.consolidated.yml run --rm security-scanner

# 4. Backup database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec postgres pg_dump -U medianest medianest > pre-deploy-backup.sql
```

### Zero-Downtime Deployment
```bash
# 1. Pull latest images
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod pull

# 2. Rolling update backend
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d --force-recreate --no-deps backend

# 3. Rolling update frontend
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d --force-recreate --no-deps frontend

# 4. Update nginx config if needed
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d --force-recreate --no-deps nginx
```

### SSL Certificate Setup
```bash
# 1. Create SSL volume
docker volume create ssl_certificates

# 2. Copy certificates
docker run --rm -v ssl_certificates:/ssl -v $(pwd)/certs:/certs alpine cp -R /certs/* /ssl/

# 3. Update nginx configuration for HTTPS
# Edit config/nginx/medianest.conf to enable HTTPS server block

# 4. Restart with SSL
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod --profile ssl up -d
```

## ⚙️ Customization

### Custom Build Arguments
```bash
# Custom Node.js version
./config/docker/build-optimization.sh --target backend-production --build-arg NODE_VERSION=18

# Custom security level
./config/docker/build-optimization.sh --target backend-production --build-arg SECURITY_LEVEL=hardened

# Custom optimization
./config/docker/build-optimization.sh --target backend-production --build-arg OPTIMIZATION_LEVEL=speed
```

### Environment-Specific Overrides
```bash
# Create environment-specific compose file
cat > docker-compose.override.yml << 'EOF'
version: '3.8'
services:
  backend:
    environment:
      - DEBUG=medianest:*
    volumes:
      - ./custom-config:/app/config
EOF

# Use override
docker-compose -f config/docker/docker-compose.consolidated.yml -f docker-compose.override.yml --profile prod up
```

## 🆘 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear all cache and retry
./config/docker/build-optimization.sh --clean-cache all
./config/docker/build-optimization.sh --production --optimize size --no-cache

# Check disk space
df -h
docker system df
```

#### Container Won't Start
```bash
# Check logs
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod logs backend

# Check health
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec backend /app/entrypoint.sh health

# Debug mode
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod run --rm backend sh
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec backend nc -z postgres 5432

# Check database status
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod exec postgres pg_isready -U medianest

# Reset database
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod down -v
docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d postgres
```

### Performance Issues
```bash
# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check container limits
docker inspect $(docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod ps -q backend) | grep -A 5 Memory

# Optimize memory settings
NODE_OPTIONS="--max-old-space-size=1024" docker-compose -f config/docker/docker-compose.consolidated.yml --profile prod up -d backend
```

## 📞 Support

### Getting Help
- **Documentation**: `/docs/DOCKER_ARCHITECTURE_DESIGN.md`
- **Health Checks**: `curl http://localhost/api/health`
- **Logs**: `docker-compose logs -f`
- **Metrics**: `curl http://localhost/metrics`

### Reporting Issues
Include the following information:
1. Docker version: `docker --version`
2. Compose version: `docker-compose --version`
3. Build logs: `./config/docker/build-optimization.sh --verbose`
4. Runtime logs: `docker-compose logs`
5. System resources: `docker system df && free -h`