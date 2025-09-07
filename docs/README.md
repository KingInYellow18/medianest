# MediaNest Documentation

**Project Status:** Development Phase - Not Production Ready  
**Documentation Version:** 4.0 - Optimized Structure  
**Last Updated:** September 7, 2025

## 🚨 Important Notice

This project is currently in development phase. Some documentation may contain aspirational content that doesn't reflect current implementation status. Always verify claims against actual code implementation.

## Quick Navigation

### 🚀 Getting Started

- [Installation Guide](INSTALLATION.md) - Setup and prerequisites
- [User Guide](USER_GUIDE.md) - End-user documentation
- [Configuration](CONFIGURATION.md) - Environment and settings

### 🏗️ Development

- [Architecture Overview](ARCHITECTURE.md) - System design and patterns
- [API Reference](API.md) - Complete API documentation
- [Testing Guide](TESTING.md) - Testing strategies and setup

### 🔧 Operations

- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Security Guide](SECURITY.md) - Security architecture and best practices
- [Monitoring Guide](MONITORING.md) - Observability and metrics

### 📊 References

- [Performance Strategy](PERFORMANCE.md) - Optimization and benchmarks
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Contributing](CONTRIBUTING.md) - Development guidelines

## Project Overview

MediaNest is a media management platform that integrates with Plex and YouTube to provide unified media discovery and management capabilities.

### Core Features

- **Authentication:** JWT-based with secure session management
- **Media Integration:** Plex server and YouTube API integration
- **Dashboard:** Real-time media statistics and recommendations
- **Search:** Unified search across integrated platforms
- **Monitoring:** Comprehensive observability stack

### Technology Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Database:** PostgreSQL with Redis caching
- **Infrastructure:** Docker, Nginx, monitoring stack

## Build Status

⚠️ **Current Issues:**

- Vite build errors requiring resolution
- 42 security vulnerabilities in dependencies
- TypeScript compilation warnings

**Recommendation:** Resolve build issues before production deployment.

## Documentation Structure

This documentation is organized into focused, consolidated guides to reduce complexity and improve maintainability.

```
docs-optimized/
├── README.md              # This file - navigation hub
├── INSTALLATION.md        # Setup and prerequisites
├── USER_GUIDE.md         # End-user documentation
├── ARCHITECTURE.md       # System architecture
├── API.md                # API reference
├── DEPLOYMENT.md         # Production deployment
├── SECURITY.md           # Security guide
├── TESTING.md            # Testing strategies
├── MONITORING.md         # Observability
├── PERFORMANCE.md        # Performance guide
├── TROUBLESHOOTING.md    # Common issues
├── CONFIGURATION.md      # Environment setup
├── CONTRIBUTING.md       # Development guidelines
└── diagrams/            # Visual assets (if any)
```

## Support

For issues, questions, or contributions, please refer to the individual guide documents or the troubleshooting guide.

## License

MIT License - See project root for complete license details.
