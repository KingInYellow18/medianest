# MediaNest Essential Commands

## Development Commands
```bash
# Start development environment
npm run dev                    # Start both backend and frontend
npm run dev:backend           # Backend only
npm run dev:frontend          # Frontend only

# Building
npm run build                 # Build all components
npm run build:backend         # Build backend only
npm run build:frontend        # Build frontend only
npm run build:optimized       # Optimized production build
```

## Testing Commands
```bash
# Testing
npm run test                  # Run all tests
npm run test:backend          # Backend tests only
npm run test:frontend         # Frontend tests only
npm run test:e2e             # End-to-end tests
npm run test:coverage        # Test coverage report

# Security & Quality
npm run lint                 # Run linting
npm run typecheck           # TypeScript checking
npm run security:scan       # Security scanning
```

## Docker Commands
```bash
# Docker Operations
npm run docker:build         # Build Docker images
npm run docker:compose      # Start with docker-compose
docker-compose up -d         # Start services in background
docker-compose down          # Stop services

# Production Docker
docker-compose -f docker-compose.production.yml up -d
docker-compose -f docker-compose.hardened.yml up -d
```

## Database Commands
```bash
# Database Management
npm run db:migrate           # Run migrations
npm run db:rollback          # Rollback migrations  
npm run db:seed             # Seed database
npm run db:reset            # Reset and reseed
```

## System Commands (Linux)
```bash
# Process Management  
ps aux | grep node          # Check running Node processes
systemctl status nginx      # Check nginx status
df -h                       # Check disk usage
htop                        # Monitor system resources

# Docker Management
docker ps                   # List running containers
docker logs <container>     # View container logs
docker system prune         # Clean up unused resources
```

## Build & Deployment
```bash
# Production Preparation
npm run build:production     # Production build
npm run validate:production  # Validate production readiness
npm run deploy              # Deploy application

# Performance Analysis
npm run analyze:bundle       # Analyze bundle size
npm run benchmark           # Run benchmarks
```