# Quick Start Guide

Get MediaNest up and running in minutes with this comprehensive quick start guide.

## 🎯 Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js 20+** and **npm 10+** - [Download from nodejs.org](https://nodejs.org/)
- **PostgreSQL 14+** - [Download from postgresql.org](https://postgresql.org/)
- **Redis 6+** - [Download from redis.io](https://redis.io/)

### External Services
- **Plex Media Server** - For authentication integration
- **Overseerr** (optional) - For media request management

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space minimum
- **Network**: Internet connection for external API integrations

## 🚀 Installation

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/medianest/medianest.git
cd medianest
```

### 2. Install Dependencies

MediaNest uses npm workspaces for managing the monorepo structure:

```bash
# Install all dependencies across workspaces
npm install
```

This will install dependencies for:
- Root workspace
- Backend (`@medianest/backend`)
- Frontend (`@medianest/frontend`)
- Shared (`@medianest/shared`)

### 3. Environment Configuration

Create environment files for each workspace:

#### Backend Configuration

```bash
# Create backend environment file
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration:

```bash
# Database Configuration
DATABASE_URL="postgresql://medianest:medianest@localhost:5432/medianest"
REDIS_URL="redis://localhost:6379/0"

# Authentication
JWT_SECRET="your-secure-jwt-secret-minimum-32-characters"
JWT_EXPIRES_IN="7d"

# Plex Integration
PLEX_CLIENT_ID="your-plex-client-id"
PLEX_CLIENT_SECRET="your-plex-client-secret"
PLEX_REDIRECT_URI="http://localhost:8000/auth/plex/callback"

# External Services
OVERSEERR_URL="http://localhost:5055"
OVERSEERR_API_KEY="your-overseerr-api-key"

# Application Settings
NODE_ENV="development"
PORT=8000
CORS_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL="info"
LOG_FILE="logs/application.log"

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

#### Frontend Configuration

```bash
# Create frontend environment file
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```bash
# Next.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-minimum-32-characters"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_WS_URL="ws://localhost:8000"

# External Services
NEXT_PUBLIC_PLEX_CLIENT_ID="your-plex-client-id"
```

### 4. Database Setup

Set up your PostgreSQL database:

```bash
# Create database (if not using Docker)
createdb medianest

# Generate Prisma client and run migrations
npm run db:setup
```

This will:
- Generate the Prisma client
- Run database migrations
- Set up the initial schema

### 5. Build the Application

Build all workspaces for production:

```bash
# Build shared types first, then backend and frontend
npm run build
```

### 6. Start the Application

Start MediaNest in production mode:

```bash
# Start the backend server
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health

## 🐳 Docker Quick Start

For the fastest setup experience, use Docker Compose:

### 1. Clone and Configure

```bash
git clone https://github.com/medianest/medianest.git
cd medianest

# Copy and edit the environment file
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
# Required: Plex Integration
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret

# Optional: External Services
OVERSEERR_URL=http://your-overseerr-instance:5055
OVERSEERR_API_KEY=your-overseerr-api-key

# Security (generate secure values)
JWT_SECRET=your-secure-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
```

### 3. Start with Docker Compose

```bash
# Start all services (PostgreSQL, Redis, MediaNest)
docker-compose up -d

# View logs
docker-compose logs -f medianest
```

### 4. Access the Application

- **MediaNest**: http://localhost:3000
- **API Health**: http://localhost:8000/health

## 🔧 Development Mode

For development with hot reloading:

### 1. Start Database Services

```bash
# Start only database services
docker-compose up -d postgres redis
```

### 2. Start Development Servers

```bash
# Start backend in development mode
cd backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

## ✅ Verification

Verify your installation by checking these endpoints:

### Health Check
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### API Documentation
Visit http://localhost:8000/api-docs for the interactive API documentation.

### Frontend Access
Navigate to http://localhost:3000 to access the MediaNest interface.

## 🎯 Next Steps

Once MediaNest is running:

1. **[Configure Plex Authentication](getting-started/configuration.md#plex-setup)** - Set up Plex OAuth integration
2. **[Connect External Services](getting-started/configuration.md#external-services)** - Integrate Overseerr and other services
3. **[User Management](backend/authentication.md)** - Understand user roles and permissions
4. **[Monitor System Health](hooks/monitoring.md)** - Set up monitoring and alerts

## 🆘 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
# Check PostgreSQL is running
systemctl status postgresql
# or
docker-compose ps postgres
```

#### Redis Connection Error
```bash
# Check Redis is running
systemctl status redis
# or
docker-compose ps redis
```

#### Port Already in Use
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Kill the process or change ports in environment files
```

#### Build Errors
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

For more detailed troubleshooting, see our [Troubleshooting Guide](reference/troubleshooting.md).

## 🤝 Need Help?

- **Documentation**: [Complete docs](https://medianest.io/docs)
- **GitHub Issues**: [Report problems](https://github.com/medianest/medianest/issues)
- **FAQ**: [Common questions](faq.md)

---

**Next**: [Configuration Guide](getting-started/configuration.md) →