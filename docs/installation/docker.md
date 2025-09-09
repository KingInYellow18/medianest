# Docker Installation

Docker is the recommended way to install and run MediaNest. This guide covers installation using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- 4GB RAM minimum (8GB recommended)
- 20GB disk space minimum

## Quick Start with Docker Compose

### 1. Create Directory Structure

```bash
mkdir -p ~/medianest/{config,data,media}
cd ~/medianest
```

### 2. Download Docker Compose File

```bash
wget https://raw.githubusercontent.com/medianest/medianest/main/docker-compose.yml
```

### 3. Configure Environment

Create `.env` file:

```bash
# Database Configuration
POSTGRES_DB=medianest
POSTGRES_USER=medianest
POSTGRES_PASSWORD=your_secure_password_here

# MediaNest Configuration
MEDIANEST_SECRET_KEY=your_secret_key_here
MEDIANEST_DEBUG=false
MEDIANEST_MEDIA_PATH=/media

# Plex Integration (Optional)
PLEX_SERVER_URL=http://your-plex-server:32400
PLEX_TOKEN=your_plex_token_here

# Network Configuration
PORT=8080
```

### 4. Start Services

```bash
docker compose up -d
```

### 5. Initialize Database

```bash
docker compose exec medianest python manage.py migrate
docker compose exec medianest python manage.py createsuperuser
```

### 6. Access MediaNest

Open http://localhost:8080 in your browser.

## Advanced Configuration

### Custom Docker Compose

```yaml
version: '3.8'

services:
  medianest:
    image: medianest/medianest:latest
    ports:
      - "8080:8000"
    volumes:
      - ./config:/app/config
      - ./data:/app/data
      - /path/to/your/media:/media:ro
    environment:
      - DATABASE_URL=postgresql://medianest:password@db:5432/medianest
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=medianest
      - POSTGRES_USER=medianest
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Resource Limits

```yaml
services:
  medianest:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 8080
lsof -i :8080

# Change port in docker-compose.yml
ports:
  - "8081:8000"  # Use port 8081 instead
```

#### Permission Issues
```bash
# Fix file permissions
sudo chown -R 1000:1000 ./config ./data
```

#### Database Connection Issues
```bash
# Check database logs
docker compose logs db

# Reset database
docker compose down -v
docker compose up -d
```

### Logs and Debugging

```bash
# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# View specific service logs
docker compose logs medianest
```

## Updating MediaNest

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Run database migrations
docker compose exec medianest python manage.py migrate
```

## Backup and Restore

### Backup
```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup database
docker compose exec -T db pg_dump -U medianest medianest > backups/$(date +%Y%m%d)/database.sql

# Backup configuration
cp -r config backups/$(date +%Y%m%d)/
```

### Restore
```bash
# Restore database
docker compose exec -T db psql -U medianest medianest < backups/20240101/database.sql

# Restore configuration
cp -r backups/20240101/config .
```

## Next Steps

- [Manual Installation](manual.md) - Install without Docker
- [Configuration Guide](configuration.md) - Detailed configuration options
- [Environment Variables](environment.md) - Complete environment reference