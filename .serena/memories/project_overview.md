# MediaNest Project Overview

## Purpose
MediaNest is an Advanced Media Management Platform designed for digital asset management, file organization, and content management. It provides a comprehensive solution for managing media files with features like user authentication, file uploads, organization, and content delivery.

## Technology Stack

### Backend (Node.js/TypeScript)
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.6+
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL 15 (via Prisma ORM)
- **Cache**: Redis 7
- **Authentication**: JWT with bcryptjs
- **API**: RESTful with Socket.io for real-time features
- **Testing**: Vitest, Playwright for E2E
- **Security**: Helmet, CORS, rate limiting
- **Monitoring**: OpenTelemetry, Prometheus metrics

### Frontend (React/Next.js)
- **Framework**: React 18.2
- **Platform**: Next.js (inferred from build artifacts)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (inferred)
- **Testing**: React Testing Library (inferred)

### Infrastructure & DevOps
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose (8 variants for different environments)
- **Database**: PostgreSQL 15-alpine
- **Cache**: Redis 7-alpine
- **Reverse Proxy**: Nginx (inferred from configs)
- **Security**: Multiple hardened Docker configurations
- **Monitoring**: Prometheus, Grafana, OpenTelemetry

## Project Structure
```
medianest/
├── backend/          # Express.js API server
├── frontend/         # React/Next.js web app  
├── shared/           # Common utilities and types
├── docs/             # Project documentation
├── scripts/          # Build and deployment scripts
├── config/           # Configuration files
├── tests/            # Testing infrastructure
└── infrastructure/   # Infrastructure as code
```

## Key Files & Configuration
- `package.json` - Monorepo root configuration
- `docker-compose.yml` - Main container orchestration
- `Dockerfile` - Multi-stage build configuration
- `tsconfig.json` - TypeScript configuration
- `.env.production` - Production environment variables