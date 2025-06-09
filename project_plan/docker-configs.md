# Docker Configuration Files

## docker-compose.yml (Development)

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:5000/api
      - REACT_APP_ENVIRONMENT=development
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - ./config:/app/config
    environment:
      - FLASK_ENV=development
      - FLASK_DEBUG=1
      - DATABASE_URL=sqlite:///dev.db
      - JWT_SECRET_KEY=dev-secret-key-change-in-production
      - UPTIME_KUMA_URL=http://uptime-kuma:3001
      - OVERSEERR_URL=http://overseerr:5055
      - NFS_MOUNT_PATH=/mnt/media
    depends_on:
      - uptime-kuma
      - overseerr

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.dev.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

  uptime-kuma:
    image: louislam/uptime-kuma:latest
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma-data:/app/data
    restart: unless-stopped

  overseerr:
    image: lscr.io/linuxserver/overseerr:latest
    ports:
      - "5055:5055"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/Chicago
    volumes:
      - overseerr-data:/config
    restart: unless-stopped

volumes:
  uptime-kuma-data:
  overseerr-data:
```

## docker-compose.prod.yml (Production)

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    expose:
      - "80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    expose:
      - "5000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - media-storage:/mnt/media
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=sqlite:////app/data/prod.db
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - UPTIME_KUMA_URL=http://uptime-kuma:3001
      - UPTIME_KUMA_API_KEY=${UPTIME_KUMA_API_KEY}
      - OVERSEERR_URL=http://overseerr:5055
      - OVERSEERR_API_KEY=${OVERSEERR_API_KEY}
      - NFS_MOUNT_PATH=/mnt/media
    restart: unless-stopped
    depends_on:
      - uptime-kuma
      - overseerr

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:latest
    expose:
      - "3001"
    volumes:
      - uptime-kuma-data:/app/data
    restart: unless-stopped

  overseerr:
    image: lscr.io/linuxserver/overseerr:latest
    expose:
      - "5055"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=${TIMEZONE:-UTC}
    volumes:
      - overseerr-data:/config
    restart: unless-stopped

volumes:
  uptime-kuma-data:
  overseerr-data:
  media-storage:
    driver: local
    driver_opts:
      type: nfs
      o: addr=${NFS_SERVER},rw
      device: ":${NFS_PATH}"
```

## Backend Dockerfile.dev

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
```

## Backend Dockerfile.prod

```dockerfile
# Multi-stage build for production
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    nfs-common \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /app/data /app/logs && \
    chown -R appuser:appuser /app/data /app/logs

USER appuser

# Add local packages to PATH
ENV PATH=/root/.local/bin:$PATH

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "run:app"]
```

## Frontend Dockerfile.dev

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

## Frontend Dockerfile.prod

```dockerfile
# Multi-stage build for production
FROM node:18-alpine as builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Nginx Configuration (Development)

```nginx
# docker/nginx/nginx.dev.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:5000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support for React dev server
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # API routes
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Nginx Configuration (Production)

```nginx
# docker/nginx/nginx.prod.conf
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/javascript;

    upstream backend {
        server backend:5000;
    }

    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";

        # Frontend static files
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Extra rate limiting for auth endpoints
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Environment Configuration

### .env.example

```bash
# Application
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here

# Database
DATABASE_URL=sqlite:///app.db

# External Services
UPTIME_KUMA_URL=http://localhost:3001
UPTIME_KUMA_API_KEY=your-uptime-kuma-api-key

OVERSEERR_URL=http://localhost:5055
OVERSEERR_API_KEY=your-overseerr-api-key

# Storage
NFS_SERVER=your-nfs-server-ip
NFS_PATH=/path/to/media/share
NFS_MOUNT_PATH=/mnt/media

# Timezone
TIMEZONE=America/Chicago

# Security (Production only)
SSL_CERT_PATH=/etc/ssl/certs/cert.pem
SSL_KEY_PATH=/etc/ssl/private/key.pem
```

## Backend requirements.txt

```txt
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-Migrate==4.0.5
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
Flask-Limiter==3.5.0
marshmallow==3.20.1
PyYAML==6.0.1
python-dotenv==1.0.0
yt-dlp==2023.12.30
requests==2.31.0
gunicorn==21.2.0
psutil==5.9.6
bcrypt==4.1.2
```

## Frontend package.json

```json
{
  "name": "media-management-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-hook-form": "^7.43.0",
    "axios": "^1.3.0",
    "tailwindcss": "^3.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^4.9.0",
    "react-scripts": "5.0.1",
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^5.16.0",
    "@testing-library/user-event": "^14.4.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

## Deployment Scripts

### deploy.sh

```bash
#!/bin/bash

set -e

echo "Starting deployment..."

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "Error: .env.prod file not found"
    exit 1
fi

# Load production environment variables
export $(cat .env.prod | xargs)

# Build and deploy
echo "Building images..."
docker-compose -f docker-compose.prod.yml build

echo "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

echo "Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec backend flask db upgrade

echo "Checking health..."
sleep 10
curl -f http://localhost/api/health || {
    echo "Health check failed"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
}

echo "Deployment completed successfully!"
```

### backup.sh

```bash
#!/bin/bash

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "Backing up database..."
docker-compose exec backend python -c "
import sqlite3
import shutil
shutil.copy('/app/data/prod.db', '/app/data/backup_${DATE}.db')
"

# Backup configuration
echo "Backing up configuration..."
cp -r config $BACKUP_DIR/config_$DATE

# Backup logs
echo "Backing up logs..."
cp -r logs $BACKUP_DIR/logs_$DATE

echo "Backup completed: $BACKUP_DIR"
```