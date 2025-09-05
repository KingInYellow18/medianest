# MediaNest

A unified web portal for managing Plex media server and related services.

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- PostgreSQL 15.x (for local development)
- Redis 7.x (for local development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd medianest
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   npm run generate-secrets
   ```
   Then edit `.env` with your configuration.

4. **Set up the database**
   ```bash
   # Start PostgreSQL and Redis (if not using Docker)
   # Then run migrations
   npm run db:generate
   npm run db:migrate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend at http://localhost:3000
   - Backend at http://localhost:4000

### Docker Development

To run the entire stack with Docker:

```bash
# Build and start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
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
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start all services with Docker Compose
- `npm run docker:down` - Stop all services
- `npm run docker:logs` - View container logs

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Secret for NextAuth.js
- `PLEX_CLIENT_ID/SECRET` - Plex OAuth credentials
- `ENCRYPTION_KEY` - Key for encrypting sensitive data

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

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

[Your License Here]