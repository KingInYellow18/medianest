# 🚀 Quick Start

The fastest way to get MediaNest running on your system.

!!! tip "Prefer Docker?"
    Jump to the [Docker Quick Start](#docker-quick-start) for the simplest setup experience.

## ⚡ 30-Second Setup with Docker

```bash
# Clone and start
git clone https://github.com/medianest/medianest.git
cd medianest
cp .env.example .env

# Edit .env with your Plex credentials, then:
docker-compose up -d

# Visit http://localhost:3000
```

## 📋 Prerequisites Checklist

- [ ] Node.js 20+ and npm 10+
- [ ] PostgreSQL 14+ (or use Docker)
- [ ] Redis 6+ (or use Docker)
- [ ] Plex Media Server access
- [ ] 10GB free disk space

## 🏃‍♂️ Manual Installation

### 1. Get the Code
```bash
git clone https://github.com/medianest/medianest.git
cd medianest
npm install
```

### 2. Configure Environment
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database and Plex settings

# Frontend  
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your API URLs
```

### 3. Setup Database
```bash
npm run db:setup
```

### 4. Build and Start
```bash
npm run build
npm start
```

## 🐳 Docker Quick Start

### Prerequisites
- Docker and Docker Compose
- Plex Client ID and Secret

### Setup Steps

1. **Clone and Configure**
   ```bash
   git clone https://github.com/medianest/medianest.git
   cd medianest
   cp .env.example .env
   ```

2. **Edit Environment**
   ```bash
   # Required settings in .env
   PLEX_CLIENT_ID=your-plex-client-id
   PLEX_CLIENT_SECRET=your-plex-client-secret
   JWT_SECRET=your-secure-secret-32-chars-minimum
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Verify Installation**
   ```bash
   # Check health
   curl http://localhost:8000/health
   
   # View logs
   docker-compose logs -f medianest
   ```

## 🎯 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| MediaNest App | http://localhost:3000 | Main application interface |
| API Server | http://localhost:8000 | Backend API endpoints |
| Health Check | http://localhost:8000/health | System status |
| API Docs | http://localhost:8000/api-docs | Interactive API documentation |

## ✅ Verification Steps

### 1. Health Check
```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 2. Frontend Access
Navigate to http://localhost:3000 and verify:
- [ ] Page loads without errors
- [ ] Login interface is displayed
- [ ] No console errors in browser

### 3. Database Connection
```bash
# If using Docker
docker-compose exec postgres psql -U medianest -d medianest -c "\dt"

# If using local PostgreSQL
psql -U medianest -d medianest -c "\dt"
```

## 🚨 Common Issues

### Port Conflicts
```bash
# Find processes using ports
lsof -i :3000
lsof -i :8000

# Solution: Kill processes or change ports in .env files
```

### Database Connection Failed
```bash
# Check PostgreSQL status
docker-compose ps postgres  # For Docker
systemctl status postgresql  # For system service

# Check connection
docker-compose exec postgres pg_isready -U medianest
```

### Redis Connection Failed
```bash
# Check Redis status
docker-compose ps redis  # For Docker
systemctl status redis    # For system service

# Test connection
docker-compose exec redis redis-cli ping
```

### Build Failures
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🔄 Development Mode

For active development with hot reloading:

```bash
# Start database services only
docker-compose up -d postgres redis

# Start backend in development mode
cd backend && npm run dev

# Start frontend in development mode (new terminal)
cd frontend && npm run dev
```

## 🎯 Next Steps

Once MediaNest is running successfully:

1. **[Complete Configuration](getting-started/configuration.md)** - Set up Plex and external services
2. **[First Steps](getting-started/first-steps.md)** - Create your first user and configure settings
3. **[Development Setup](development/environment.md)** - If you plan to modify or contribute

## 📚 Additional Resources

- **[Full Installation Guide](getting-started.md)** - Detailed step-by-step instructions
- **[Configuration Reference](reference/environment.md)** - All environment variables
- **[Docker Guide](reference/docker.md)** - Advanced Docker configuration
- **[Troubleshooting](reference/troubleshooting.md)** - Common problems and solutions

---

**Ready to configure?** → [Configuration Guide](getting-started/configuration.md)