# MediaNest Production Configuration

## Production Environment Setup

This is the production-ready MediaNest deployment. This file contains configuration guidelines for production deployment and maintenance.

## Build Commands

```bash
# Production build
npm run build

# Start production server
npm start

# Database operations
npm run db:setup
npm run db:migrate

# Docker deployment
npm run docker:prod
```

## Environment Requirements

- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (recommended)

## Security Configuration

Ensure the following environment variables are properly configured for production:

- `JWT_SECRET` - Strong secret key for JWT token signing
- `DATABASE_URL` - Production PostgreSQL connection string
- `REDIS_URL` - Production Redis connection string
- `PLEX_CLIENT_ID` - Plex OAuth application ID
- `PLEX_CLIENT_SECRET` - Plex OAuth application secret

## Production Deployment

1. Clone repository
2. Configure environment variables
3. Run `docker-compose up -d`
4. Access application at configured port

## Monitoring

- Health check: `/api/health`
- Metrics: `/api/metrics`
- Logs: Available via Docker logs or log files

This is a production-optimized configuration focused on deployment and operational excellence.