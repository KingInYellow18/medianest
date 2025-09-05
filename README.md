# MediaNest

A unified web portal for managing Plex media server and related services.

## Quick Start

### Prerequisites

- Node.js 20.x or higher (`node --version` should show v20.x.x or higher)
- npm 10.x or higher (`npm --version` should show 10.x.x or higher)
- Docker 24.x or higher with Docker Compose v2 (`docker compose version`)
- Git for cloning the repository

**For local development without Docker:**
- PostgreSQL 15.x
- Redis 7.x

**Verify Docker Compose v2 Installation:**
```bash
docker compose version
# Should output: Docker Compose version v2.x.x
# If you see "docker-compose" (with hyphen), install Docker Compose v2
```

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd medianest
   ```

2. **Install dependencies**
   ```bash
   # Install all workspace dependencies
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   npm run generate-secrets
   ```
   Then edit `.env` with your configuration.

4. **Set up the database**
   ```bash
   # For local development (PostgreSQL and Redis running locally)
   npm run db:generate  # Generate Prisma client
   npm run db:migrate   # Run database migrations
   
   # For Docker development, skip this step - migrations run automatically
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend at http://localhost:3000
   - Backend at http://localhost:4000

### Docker Development (Recommended)

To run the entire stack with Docker:

```bash
# Build and start all services in detached mode
docker compose up -d

# View logs from all services
docker compose logs -f

# View logs from specific service
docker compose logs -f app

# Stop all services
docker compose down

# Rebuild and start (after code changes)
docker compose up -d --build
```

**First-time Docker setup:**
```bash
# Ensure you have generated secrets first
npm run generate-secrets

# Copy environment file and add your Plex credentials
cp .env.example .env
# Edit .env with your PLEX_CLIENT_ID and PLEX_CLIENT_SECRET

# Start the stack
docker compose up -d

# Check all services are healthy
docker compose ps
```

## Project Structure

```
medianest/
├── frontend/          # Next.js 14 frontend application
│   ├── src/
│   │   ├── app/      # App router pages and layouts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── services/
│   └── server.js     # Custom server for Socket.io support
├── backend/          # Express.js backend API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── integrations/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── prisma/       # Database schema and migrations
├── infrastructure/   # Infrastructure configuration
│   └── database/     # Database initialization scripts
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

## Available Scripts

### Root Commands
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run lint` - Run linting for both frontend and backend
- `npm run type-check` - Run TypeScript type checking

### Database Commands
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations  
- `npm run db:studio` - Open Prisma Studio

### Docker Commands  
- `docker compose build` - Build Docker images
- `docker compose up -d` - Start all services with Docker Compose
- `docker compose down` - Stop all services
- `docker compose logs -f` - View container logs
- `docker compose ps` - Check service status

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. **All required variables:**

**Authentication & Security:**
- `NEXTAUTH_SECRET` - Secret for NextAuth.js (generate with `openssl rand -hex 32`)
- `JWT_SECRET` - JWT signing secret (auto-generated)  
- `JWT_ISSUER` - JWT issuer identifier
- `JWT_AUDIENCE` - JWT audience identifier
- `ENCRYPTION_KEY` - Key for encrypting sensitive data (generate with `openssl rand -hex 32`)

**Database & Cache:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (or individual REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)

**Plex Integration:**
- `PLEX_CLIENT_ID` - Your Plex OAuth client ID  
- `PLEX_CLIENT_SECRET` - Your Plex OAuth client secret

**Application URLs:**
- `NEXTAUTH_URL` - Application base URL (http://localhost:3000 for dev)
- `FRONTEND_URL` - Frontend application URL
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:4000 for dev)

**Generate secrets automatically:**
```bash
npm run generate-secrets
```

### External Services

External service configurations (Plex, Overseerr, Uptime Kuma) are managed through the admin UI after deployment.

## Reverse Proxy Configuration

MediaNest is designed to work behind a reverse proxy. The application:
- Trusts proxy headers (`X-Forwarded-*`)
- Handles WebSocket upgrades for Socket.io
- Supports path-based routing

Example nginx configuration:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

## Troubleshooting

### Installation Issues

**`npm run install:all` command not found:**
- Use `npm install` instead (installs all workspace dependencies)

**Docker Compose command not found:**
- Make sure you have Docker Compose v2: `docker compose version`
- If you see "docker-compose" (with hyphen), update to Docker Compose v2

**Database connection errors:**
- Check PostgreSQL is running: `docker compose ps`  
- Verify DATABASE_URL in .env matches Docker service configuration
- For local dev: ensure PostgreSQL is running on localhost:5432

**Redis connection errors:**
- Check Redis is running: `docker compose ps`
- Verify REDIS_URL in .env or individual REDIS_* variables
- For local dev: ensure Redis is running on localhost:6379

**Port already in use errors:**
- Check what's using the ports: `lsof -i :3000` and `lsof -i :4000`
- Stop conflicting services or change ports in docker-compose.yml

### Development Issues

**Prisma client generation errors:**
```bash
cd backend && npm run prisma:generate
```

**Database migration issues:**
```bash
cd backend && npm run prisma:migrate
```

**TypeScript compilation errors:**
```bash
npm run type-check  # Check all workspaces
```

### Health Checks

**Verify installation:**
```bash
# Check prerequisites
node --version    # Should be v20.x.x+
npm --version     # Should be 10.x.x+
docker compose version  # Should show v2.x.x

# Check services (Docker)
docker compose ps    # All services should be healthy
curl http://localhost:3000  # Frontend should respond
curl http://localhost:4000/api/health  # Backend health endpoint
```

**Check logs for errors:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres  
docker compose logs -f redis
```

## Contributing

1. Create a feature branch
2. Make your changes  
3. Run tests and linting: `npm test && npm run lint`
4. Submit a pull request

## License

[Your License Here]