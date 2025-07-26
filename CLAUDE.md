# MediaNest - Production Configuration

## Project Overview
MediaNest is a media management and automation platform that integrates with Plex, Overseerr, and other media services to provide a unified dashboard for managing your media library.

## Architecture
- **Backend**: Node.js/Express API with Prisma ORM
- **Frontend**: Next.js React application
- **Database**: PostgreSQL with Redis for caching
- **Authentication**: JWT-based with OAuth support

## Quick Start

### Prerequisites
- Node.js 20+ and npm 10+
- PostgreSQL database
- Redis server

### Installation
```bash
# Install dependencies
npm install

# Setup database
cd backend && npm run db:generate && npm run db:migrate

# Build applications
npm run build

# Start production server
npm start
```

### Configuration
Create `.env` files in the appropriate directories with your configuration:

**Backend** (`.env`):
```
DATABASE_URL="postgresql://user:password@localhost:5432/medianest"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-jwt-secret"
PLEX_CLIENT_ID="your-plex-client-id"
```

**Frontend** (`.env.local`):
```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

## Production Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

## Available Scripts
- `npm run build` - Build all applications
- `npm start` - Start production server
- `npm run docs:build` - Build documentation
- `npm run docs:serve` - Serve documentation locally

## Support
For support and documentation, visit the project repository or contact the development team.