# MediaNest Backend

**⚠️ Current Status: Development/Repair Phase - Active Fixes in Progress**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.0-blue)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21.0-lightgrey)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-Latest-2D3748)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791)](https://www.postgresql.org/)

The MediaNest Backend is an Express.js TypeScript API server that provides unified access to Plex media server and related services. It features authentication, device management, system monitoring, and external service integrations.

## 🚨 Current Development Status

| Issue Type | Count | Status | Priority |
|------------|-------|--------|----------|
| **TypeScript Errors** | 80+ | 🔶 In Progress | High |
| **Database Schema** | ID mismatches | 🔶 Fixing | High |
| **Test Failures** | 28/30 | 🔶 Investigating | Medium |
| **Plex Integration** | Config missing | 🔶 Implementation | Low |

> **Active Development**: These issues are being actively addressed. The backend core functionality works but may have stability issues.

## 📋 Purpose

The backend serves as:

- **API Gateway**: Unified REST API for media management
- **Authentication Service**: JWT-based auth with device tracking and 2FA
- **Integration Hub**: Connects Plex, Overseerr, Uptime Kuma, and other services
- **Real-time Communication**: WebSocket support via Socket.io
- **Job Processing**: Background tasks and queue management
- **Monitoring & Logging**: Performance metrics and security auditing

## 🏗️ Architecture

```
backend/src/
├── config/          # Configuration management
├── controllers/     # Request handlers and business logic
├── integrations/    # External service integrations
│   ├── plex/       # Plex Media Server integration
│   ├── overseerr/  # Media request management
│   └── uptime/     # Service monitoring
├── jobs/           # Background job processors
├── middleware/     # Express middleware (auth, validation, etc.)
├── repositories/   # Data access layer
├── routes/         # API route definitions
├── services/       # Business logic services
├── socket/         # WebSocket handlers
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL 15.x
- Redis 7.x
- TypeScript knowledge

### Installation

**⚠️ Note: Installation may have TypeScript errors but core functionality works**

```bash
# From project root
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client (may fail)
npm run prisma:generate

# Run database migrations (may fail)
npm run prisma:migrate

# Build project (may have TypeScript warnings)
npm run build
```

### Development Server

```bash
# Start development server (may have warnings but functional)
npm run dev

# Alternative: Run tests (28/30 failing)
npm test

# Type checking (will show current TypeScript issues)
npm run type-check
```

## 📡 API Endpoints

### Authentication

```
POST   /api/auth/login          # User login
POST   /api/auth/logout         # User logout
POST   /api/auth/refresh        # Refresh JWT token
POST   /api/auth/register       # User registration
GET    /api/auth/me            # Current user info
```

### Users & Devices

```
GET    /api/users              # List users (admin)
GET    /api/users/:id          # Get user details
PUT    /api/users/:id          # Update user
DELETE /api/users/:id          # Delete user
GET    /api/devices            # List user devices
DELETE /api/devices/:id        # Remove device
```

### Media Services

```
GET    /api/plex/servers       # List Plex servers
GET    /api/plex/libraries     # Get media libraries
GET    /api/overseerr/status   # Overseerr connection status
POST   /api/overseerr/request  # Submit media request
GET    /api/uptime/services    # Service status monitoring
```

### System

```
GET    /api/health             # Health check
GET    /api/metrics            # Performance metrics
GET    /api/system/info        # System information
POST   /api/system/backup      # Create backup
```

## 🔐 Authentication & Security

### JWT Authentication

- **Access Tokens**: Short-lived (15 minutes)
- **Refresh Tokens**: Long-lived (7 days)
- **Device Tracking**: Fingerprinting and risk assessment
- **Token Rotation**: Automatic refresh mechanism

### Security Features

- **Helmet.js**: HTTP security headers
- **Rate Limiting**: Request throttling
- **CORS**: Cross-origin request handling
- **Input Validation**: Zod schema validation
- **Password Hashing**: bcrypt with salt rounds
- **2FA Support**: TOTP-based two-factor authentication

## 🗄️ Database

### Prisma ORM

- **Database**: PostgreSQL 15.x
- **Schema**: Located in `prisma/schema.prisma`
- **Migrations**: Version-controlled schema changes
- **Client Generation**: Type-safe database access

### Key Models

- **User**: User accounts and profiles
- **Device**: Registered user devices
- **Session**: Authentication sessions
- **Service**: External service configurations
- **AuditLog**: Security and access logging

### Common Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Open database studio
npm run prisma:studio

# Reset database (development only)
npx prisma migrate reset
```

## 🔌 External Integrations

### Plex Media Server

- **Authentication**: Plex OAuth integration
- **Library Access**: Media scanning and metadata
- **User Management**: Plex user synchronization
- **Transcoding**: Stream optimization

### Overseerr

- **Media Requests**: User request management
- **Approval Workflow**: Admin approval system
- **Radarr/Sonarr**: Automatic media acquisition

### Uptime Kuma

- **Service Monitoring**: Health check monitoring
- **Alert Management**: Notification handling
- **Status Dashboard**: Service availability tracking

## 🔄 Background Jobs

### Queue System (BullMQ + Redis)

- **Media Scanning**: Periodic library updates
- **User Synchronization**: Plex user sync
- **Health Checks**: Service monitoring
- **Cleanup Tasks**: Database maintenance
- **Email Notifications**: User communications

### Job Types

```typescript
// Media scanning job
interface MediaScanJob {
  libraryId: string;
  fullScan: boolean;
  userId?: string;
}

// User sync job
interface UserSyncJob {
  plexServerId: string;
  syncType: 'full' | 'incremental';
}
```

## 📊 Real-time Features

### Socket.io Integration

- **Connection Management**: User session handling
- **Room Management**: Channel-based messaging
- **Event Broadcasting**: Real-time notifications
- **Authentication**: JWT-based socket auth

### Events

```typescript
// Client → Server
socket.emit('join-room', { roomId: 'library-updates' });
socket.emit('media-scan', { libraryId: '1' });

// Server → Client
socket.emit('scan-progress', { progress: 45, status: 'scanning' });
socket.emit('notification', { type: 'info', message: 'Scan complete' });
```

## 🧪 Testing

### Current Status: **FAILING**

- **Integration Tests**: 28/30 tests failing
- **Unit Tests**: Limited coverage due to build issues
- **E2E Tests**: Cannot run due to compilation errors

### Test Structure

```
backend/tests/
├── integration/     # API endpoint tests
├── unit/           # Service and utility tests
├── fixtures/       # Test data and mocks
└── setup.ts        # Test configuration
```

### Running Tests

```bash
# Run all tests (will show failures)
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.ts
```

## 📝 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
ENCRYPTION_KEY=your-encryption-key

# External Services
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret
OVERSEERR_URL=http://localhost:5055
OVERSEERR_API_KEY=your-overseerr-api-key

# Application
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Configuration Files

- `src/config/database.ts` - Database configuration
- `src/config/auth.ts` - Authentication settings
- `src/config/integrations.ts` - External service config
- `src/config/jobs.ts` - Background job configuration

## 🛠️ Development

### Code Style

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Conventional Commits**: Commit message format

### Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Production build (currently failing)
npm run start        # Production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking
npm run clean        # Clean build artifacts
```

## 🚀 Deployment

### Docker Compose Production Deployment

The backend is designed for Docker Compose deployment as part of the MediaNest stack:

```bash
# Production deployment from project root
./deployment/scripts/deploy-compose.sh --domain your-domain.com

# Or manual deployment
docker compose -f config/docker/docker-compose.prod.yml up -d

# Database migrations are handled automatically
# Health checks verify service readiness
```

### Container Architecture

```dockerfile
# Production container (backend/Dockerfile.prod)
FROM node:20-alpine
USER 1000:1000  # Non-root security

# Optimized for:
# - Security (non-root, minimal base image)
# - Performance (multi-stage build, optimized deps)
# - Reliability (health checks, graceful shutdown)
```

### Environment Setup

1. **Automated Setup**: Use `deploy-compose.sh` for complete setup
2. **Database Migration**: Automatic Prisma migrations on startup
3. **Secret Management**: Docker secrets for sensitive data
4. **SSL/Reverse Proxy**: Nginx container handles HTTPS
5. **Health Monitoring**: Built-in health checks and monitoring

### Health Checks & Monitoring

**Built-in Health Endpoints:**
- `GET /health` - Basic container health (for Docker health checks)
- `GET /api/health` - Detailed application health with dependencies
- `GET /api/status` - Service status and metrics

**Docker Health Check:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
```

**Monitoring Integration:**
- Prometheus metrics endpoint: `/metrics`
- Structured JSON logging for centralized log aggregation
- Real-time WebSocket status updates
- External service health monitoring (Plex, Overseerr, Uptime Kuma)

## 🔗 Related Modules

- **[Frontend](../frontend/README.md)** - Next.js React application
- **[Shared](../shared/README.md)** - Common utilities and types
- **[Infrastructure](../infrastructure/README.md)** - Deployment configuration
- **[Tests](../tests/README.md)** - Testing framework and E2E tests

## 📚 Key Dependencies

### Production

- **express**: Web framework
- **@prisma/client**: Database ORM
- **jsonwebtoken**: JWT authentication
- **socket.io**: Real-time communication
- **bullmq**: Job queue management
- **winston**: Logging
- **helmet**: Security middleware
- **zod**: Schema validation

### Development

- **typescript**: Static typing
- **vitest**: Testing framework
- **eslint**: Code linting
- **nodemon**: Development server
- **supertest**: HTTP testing

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   # Check TypeScript errors
   npm run type-check

   # Clean and rebuild
   npm run clean && npm run build
   ```

2. **Database Connection**

   ```bash
   # Test database connectivity
   npx prisma db pull

   # Reset database (development)
   npx prisma migrate reset
   ```

3. **Redis Connection**

   ```bash
   # Test Redis connectivity
   redis-cli ping

   # Check Redis configuration
   echo $REDIS_URL
   ```

4. **Test Failures**
   - Review integration test logs
   - Check database test setup
   - Verify environment variables

### Debugging

- Enable debug logging: `DEBUG=medianest:* npm run dev`
- Use built-in debugger: `node --inspect dist/server.js`
- Monitor with PM2: `pm2 start ecosystem.config.js`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Fix TypeScript errors before implementing features
4. Write tests for new functionality
5. Ensure linting passes: `npm run lint:fix`
6. Submit pull request with description

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
