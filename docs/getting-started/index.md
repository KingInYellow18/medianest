# Getting Started with MediaNest

Welcome to MediaNest! This guide will help you get up and running with the MediaNest platform, whether you're a developer looking to contribute, or someone setting up the system for your home media server.

## What is MediaNest?

MediaNest is a unified web portal for managing Plex media server and related services. It provides:

- **Centralized Dashboard**: Monitor all your media services from one place
- **Media Management**: Search, browse, and request new content
- **Service Integration**: Connect to Plex, Overseerr, Uptime Kuma, and YouTube
- **User Management**: Role-based access control with Plex OAuth
- **Real-time Updates**: Live status updates via WebSocket connections

## Architecture Overview

MediaNest follows a monolithic architecture optimized for 10-20 concurrent users:

```
┌─────────────────────────────────────────────────────────────────┐
│                         MediaNest System                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)     │  Backend (Express + TypeScript)   │
│  - React 18                │  - RESTful APIs                    │
│  - Real-time WebSocket     │  - WebSocket handlers              │
│  - NextAuth.js             │  - JWT authentication              │
│  - Tailwind CSS            │  - Prisma ORM                      │
└─────────────────────────────────────────────────────────────────┘
                                     │
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                               │
│  PostgreSQL 15.x           │  Redis 7.x                        │
│  - User data               │  - Sessions & cache               │
│  - Media requests          │  - Rate limiting                   │
│  - Service configs         │  - Background jobs                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Socket.io** for real-time updates
- **NextAuth.js** for authentication
- **Zod** for validation

### Backend

- **Node.js 20.x** with TypeScript
- **Express.js** web framework
- **Prisma ORM** with PostgreSQL
- **Socket.io** for WebSocket support
- **Redis** for caching and sessions
- **BullMQ** for background jobs
- **Winston** for logging

### Infrastructure

- **Docker & Docker Compose** for deployment
- **PostgreSQL 15** as primary database
- **Redis 7** for cache and job queues
- **Nginx** as reverse proxy (optional)

## Key Features

### ✅ Implemented Features

- **Authentication & Authorization**
  - Plex OAuth login with PIN-based flow
  - Role-based access control (Admin/User)
  - Remember me functionality with secure tokens
  - Session management with JWT

- **Dashboard & Monitoring**
  - Real-time service status updates
  - Connection health monitoring
  - Service performance metrics
  - WebSocket-based live updates

- **Media Management**
  - Plex library browsing
  - Media search and filtering
  - Request submission via Overseerr
  - User-specific request tracking

- **Service Integrations**
  - Plex Server (OAuth, library access)
  - Overseerr (media requests)
  - Uptime Kuma (service monitoring)

### 🚧 In Progress

- **YouTube Downloads** (Phase 4)
  - Playlist download with yt-dlp
  - User-isolated downloads
  - Progress tracking via WebSocket
  - Integration with Plex collections

### 📋 Planned Features

- **Admin Panel** (Phase 5)
  - User management interface
  - Service configuration UI
  - System settings management

- **Advanced Features**
  - Advanced search filters
  - Download scheduling
  - Notification system
  - Mobile-responsive design

## Quick Navigation

### For Developers

- [Quick Start Guide](./quickstart.md) - Get running in 5 minutes
- [Development Setup](./development-setup.md) - Detailed development environment setup
- [Development Workflow](../developers/workflow.md) - How to contribute effectively
- [Contribution Guidelines](../developers/contributing.md) - Code standards and processes

### For System Administrators

- [Production Deployment](../deployment/) - Docker-based deployment guide
- [Configuration Reference](../ENVIRONMENT_VARIABLES.md) - All environment variables
- [Troubleshooting](../troubleshooting/common-issues.md) - Common problems and solutions

### For API Developers

- [API Documentation](../api/) - Complete API reference
- [WebSocket Events](../api/websockets.md) - Real-time event documentation
- [Authentication Guide](../api/authentication.md) - JWT and session handling

## System Requirements

### Development Environment

- **Node.js**: 20.x LTS (required)
- **Docker**: 24.x with Compose V2
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space (more for YouTube downloads)
- **OS**: Linux, macOS, or Windows with WSL2

### Production Environment

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended for heavy usage
- **Storage**: 20GB+ (depends on YouTube downloads)
- **Network**: Stable internet connection for external services

## External Service Requirements

MediaNest integrates with external services that you'll need to configure:

### Required Services

- **Plex Media Server**: Your media server instance
- **PostgreSQL Database**: Can be containerized or external
- **Redis Server**: Can be containerized or external

### Optional Services

- **Overseerr**: For media request management
- **Uptime Kuma**: For service monitoring
- **Nginx**: For reverse proxy and SSL termination

## Security Considerations

MediaNest implements security best practices:

- **Authentication**: Plex OAuth with secure PIN-based flow
- **Encryption**: AES-256-GCM for sensitive data storage
- **Transport Security**: HTTPS/TLS for all communications
- **Access Control**: Role-based permissions with user isolation
- **Input Validation**: Comprehensive validation using Zod schemas
- **Rate Limiting**: Redis-based rate limiting for API endpoints
- **Session Security**: HTTP-only cookies with secure flags

## Performance Characteristics

Designed for home and small office use:

- **Concurrent Users**: Optimized for 10-20 users
- **Response Times**: <200ms for cached data, <500ms for database queries
- **Resource Usage**: ~512MB RAM, minimal CPU usage
- **Storage**: Efficient database design with proper indexing
- **Caching**: Redis-based caching for frequently accessed data

## Next Steps

1. **Quick Setup**: Follow the [Quick Start Guide](./quickstart.md) to get MediaNest running locally in 5 minutes
2. **Development**: Read the [Development Setup Guide](./development-setup.md) for detailed development environment configuration
3. **Contributing**: Review the [Contribution Guidelines](../developers/contributing.md) to start contributing
4. **Deployment**: See the [Deployment Guide](../deployment/) for production deployment instructions

## Getting Help

- **Documentation Issues**: Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
- **Development Questions**: See [Development Workflow](../developers/workflow.md)
- **Bug Reports**: Use the GitHub issue tracker with detailed reproduction steps
- **Feature Requests**: Discuss in GitHub Discussions before implementation

---

**Ready to get started?** Head to the [Quick Start Guide](./quickstart.md) to set up MediaNest in 5 minutes!
