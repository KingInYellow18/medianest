# MediaNest 🎬

> **Production-ready unified web portal for managing Plex media server and related services**

[![Production Status](https://img.shields.io/badge/status-production-green)]() [![Docker Ready](https://img.shields.io/badge/docker-ready-blue)]() [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## 🚀 Quick Deploy

MediaNest is a production-ready media management portal that consolidates Plex media server access, request management, and system monitoring into a single secure interface.

### One-Command Deployment

```bash
# Clone and deploy
git clone https://github.com/your-org/medianest.git
cd medianest

# Configure environment
cp .env.example .env
# Edit .env with your production settings

# Production deployment
docker-compose up -d

# Access at http://localhost:3000
```

## 🏗️ Architecture

MediaNest uses a modern three-tier architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Services      │
│                 │    │                 │    │                 │
│ • React + TS    │◄──►│ • Node.js + TS  │◄──►│ • PostgreSQL    │
│ • TailwindCSS   │    │ • Express       │    │ • Redis         │
│ • Component Lib │    │ • Prisma ORM    │    │ • File Storage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ✨ Production Features

- **🔐 Plex OAuth Integration** - Secure single sign-on authentication
- **📺 Media Request Management** - Overseerr integration for content requests  
- **📊 Real-time Monitoring** - System health and performance dashboards
- **🎯 Queue Management** - YouTube content downloading and processing
- **⚡ High Performance** - Optimized for production workloads
- **🛡️ Enterprise Security** - JWT authentication, rate limiting, comprehensive logging
- **📱 Mobile Ready** - Responsive design with accessibility compliance

## 🔧 Production Setup

### Prerequisites

- **Docker & Docker Compose** (recommended)
- **Node.js** 20+ (for manual deployment)
- **PostgreSQL** 14+
- **Redis** 6+

### Environment Configuration

```bash
# Required environment variables
PLEX_CLIENT_ID=your_plex_client_id
PLEX_CLIENT_SECRET=your_plex_client_secret
DATABASE_URL=postgresql://user:password@localhost:5432/medianest
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key
```

### Docker Deployment (Recommended)

```bash
# Production deployment
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=2
```

### Manual Deployment

```bash
# Install dependencies
npm install

# Build all services
npm run build

# Database setup
npm run db:setup

# Start production server
npm start
```

## 🎯 Production Commands

```bash
# Build for production
npm run build

# Start production servers
npm start

# Database operations
npm run db:setup
npm run db:migrate

# Docker operations
npm run docker:build
npm run docker:prod

# Maintenance
npm run clean
```

## 🔄 Updates & Maintenance

### Updating MediaNest

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup & Recovery

```bash
# Database backup
docker exec medianest_db pg_dump -U postgres medianest > backup.sql

# Restore database
docker exec -i medianest_db psql -U postgres medianest < backup.sql
```

## 📊 Monitoring

MediaNest includes built-in health checks and monitoring:

- **Health Endpoint**: `GET /api/health`
- **Metrics Endpoint**: `GET /api/metrics`
- **Real-time Dashboard**: Available in the web interface

### Production Monitoring

```bash
# Check service health
curl http://localhost:3000/api/health

# View application logs
docker-compose logs backend

# Monitor resource usage
docker stats medianest_backend medianest_frontend
```

## 🛡️ Security

MediaNest implements enterprise-grade security:

- **JWT Authentication** with secure token rotation
- **Rate Limiting** to prevent abuse
- **CORS Protection** for cross-origin requests
- **Input Validation** and sanitization
- **Secure Headers** and HTTPS enforcement

## 📈 Performance

Optimized for production workloads:

- **CDN Ready** - Static assets optimized for CDN delivery
- **Database Optimization** - Efficient queries and connection pooling
- **Caching Strategy** - Redis-based caching for improved performance
- **Horizontal Scaling** - Supports load balancing and multiple instances

## 🔗 External Integrations

MediaNest connects to:

- **Plex Media Server** - Primary media management
- **Overseerr** - Media request handling
- **YouTube API** - Content downloading (optional)

### Configuration

Set up integrations in your `.env` file:

```bash
# Plex Configuration
PLEX_SERVER_URL=https://your-plex-server.com
PLEX_TOKEN=your_plex_token

# Overseerr Integration
OVERSEERR_URL=https://your-overseerr.com
OVERSEERR_API_KEY=your_overseerr_api_key
```

## 📄 License

MediaNest is open source software licensed under the MIT License.

## 🆘 Support

For production support:

- Check the health endpoint: `/api/health`
- Review application logs via Docker or log files
- Verify environment configuration
- Ensure all required services are running

---

<div align="center">

**Production-ready media management for modern deployments**

[Quick Deploy](#-quick-deploy) • [Configuration](#-production-setup) • [Monitoring](#-monitoring)

</div>