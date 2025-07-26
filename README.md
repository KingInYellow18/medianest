# MediaNest 🎬

> **A unified web portal for managing Plex media server and related services**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]() [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![Node.js](https://img.shields.io/badge/node.js-20+-green)](https://nodejs.org/)

## 🌟 Overview

MediaNest consolidates multiple media management tools into a single, secure, and user-friendly interface designed for friends and family who access your Plex media server. Built with modern full-stack technologies and enterprise-grade architecture, MediaNest provides seamless authentication, advanced media request management, and comprehensive system monitoring.

### ✨ Key Features

- **🔐 Unified Authentication** - Single sign-on with Plex OAuth integration
- **📺 Media Request Management** - Streamlined interface for content requests via Overseerr
- **📊 Real-time Monitoring** - Live system health and performance dashboards
- **🎯 Smart Queue Management** - Intelligent YouTube content downloading and processing
- **⚡ Modern Architecture** - TypeScript, React, Node.js with robust backend
- **🛡️ Enterprise Security** - JWT-based auth, rate limiting, and comprehensive logging
- **🔄 Real-time Updates** - WebSocket integration for live status updates
- **📱 Responsive Design** - Mobile-first UI with accessibility compliance

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and npm 10+
- **PostgreSQL** 14+
- **Redis** 6+
- **Plex Media Server** (for authentication)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/medianest.git
cd medianest

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
cd backend && npm run db:generate && npm run db:migrate

# Build for production
npm run build

# Start the application
npm start

# Open http://localhost:3000
```

## 🏗️ Architecture

MediaNest follows a modern monorepo structure with clear separation of concerns:

```
medianest/
├── backend/          # Node.js/Express API server
├── frontend/         # Next.js React application
├── shared/           # Shared types and utilities
└── package.json      # Workspace configuration
```

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM, TypeScript
- **Database**: PostgreSQL with Redis caching
- **Authentication**: JWT with Plex OAuth integration
- **Real-time**: Socket.IO for WebSocket connections

## ⚙️ Configuration

### Environment Variables

**Backend Configuration** (`.env`):
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/medianest"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secure-jwt-secret"
PLEX_CLIENT_ID="your-plex-client-id"
PLEX_CLIENT_SECRET="your-plex-client-secret"

# Services
OVERSEERR_URL="http://localhost:5055"
OVERSEERR_API_KEY="your-overseerr-api-key"

# Application
NODE_ENV="production"
PORT=8000
```

**Frontend Configuration** (`.env.local`):
```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

## 🐳 Docker Deployment

For easy deployment using Docker:

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t medianest .
docker run -p 3000:3000 -p 8000:8000 medianest
```

## 📊 Monitoring & Health

MediaNest includes built-in health monitoring and metrics:

- **Health Endpoint**: `GET /health` - System health status
- **Metrics Dashboard**: Real-time performance metrics
- **Error Logging**: Comprehensive error tracking with Winston
- **Performance Monitoring**: Response time and throughput metrics

## 🔒 Security Features

- **JWT Authentication** with secure token management
- **Rate Limiting** to prevent abuse
- **CORS Protection** with configurable origins
- **Input Validation** using Zod schemas
- **Helmet.js** for security headers
- **Encryption** for sensitive data storage

## 🔗 Integrations

### Supported Services

- **Plex Media Server** - Authentication and library access
- **Overseerr** - Media request management
- **Uptime Kuma** - Service monitoring
- **Sentry** - Error tracking (optional)

## 📝 API Documentation

The MediaNest API provides comprehensive endpoints for:

- **Authentication**: Login, logout, token refresh
- **Media Requests**: Create, manage, and track requests
- **System Health**: Monitor service status and performance
- **User Management**: Profile and settings management

## 🤝 Contributing

MediaNest is designed for production use but welcomes contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please:
- Check the [documentation](CLAUDE.md)
- Create an issue on GitHub
- Contact the development team

---

**MediaNest** - Simplifying media management for modern households 🏠✨