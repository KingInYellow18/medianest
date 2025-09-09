# Getting Started with MediaNest

Welcome to MediaNest! This guide will help you get up and running quickly with our advanced media management platform.

## 🎯 Overview

MediaNest is designed to simplify media management while providing powerful features for organization, metadata handling, and integration with popular media servers like Plex.

## 🚀 Quick Start Options

Choose the setup method that best fits your needs:

### Option 1: Docker (Recommended)
Perfect for most users - containerized deployment with all dependencies included.

```bash
# Pull and run MediaNest
docker run -d \
  --name medianest \
  -p 8080:8080 \
  -v /path/to/media:/app/media \
  -v /path/to/config:/app/config \
  medianest/medianest:latest
```

### Option 2: Docker Compose
Best for production setups with database and additional services.

```bash
# Clone repository
git clone https://github.com/medianest/medianest.git
cd medianest

# Start all services
docker-compose up -d
```

### Option 3: Manual Installation
For developers or advanced users who prefer manual control.

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev
```

## 📋 Prerequisites

Before installing MediaNest, ensure you have:

- **Docker 20.10+** (for Docker installation)
- **Node.js 18+** (for manual installation)
- **PostgreSQL 13+** (database)
- **Redis** (caching and sessions)

## 🔧 Initial Configuration

### 1. Environment Setup

Create your configuration file:

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Required Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medianest
DB_USER=medianest
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Settings
APP_PORT=8080
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key

# Media Paths
MEDIA_ROOT=/path/to/your/media
UPLOAD_PATH=/path/to/uploads
```

### 3. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

## 👤 First-Time Setup

### Access the Web Interface

1. Open your browser to `http://localhost:8080`
2. Complete the setup wizard
3. Create your admin account
4. Configure your media libraries

### Setup Wizard Steps

1. **Welcome** - Introduction and system check
2. **Database** - Database connection verification
3. **Admin Account** - Create your administrator user
4. **Media Libraries** - Configure your media folders
5. **Plex Integration** - Optional Plex server connection
6. **Completion** - Final configuration and summary

## 📁 Media Library Configuration

### Adding Media Libraries

1. Navigate to **Settings** → **Libraries**
2. Click **Add Library**
3. Configure library settings:
   - **Name**: Library display name
   - **Type**: Movies, TV Shows, Music, etc.
   - **Path**: File system path to media
   - **Scanner**: Metadata scanner to use

### Supported Media Types

| Type | Extensions | Metadata Sources |
|------|------------|------------------|
| **Movies** | `.mp4`, `.mkv`, `.avi`, `.mov` | TMDB, IMDB |
| **TV Shows** | `.mp4`, `.mkv`, `.avi` | TVDB, TMDB |
| **Music** | `.mp3`, `.flac`, `.aac`, `.ogg` | MusicBrainz, Last.fm |
| **Photos** | `.jpg`, `.png`, `.tiff`, `.raw` | EXIF metadata |

## 🔐 Security Configuration

### User Management

1. **Admin Users**: Full system access
2. **Standard Users**: Library access only
3. **Guest Users**: Read-only access

### Authentication Options

- **Local Authentication**: Username/password
- **LDAP/Active Directory**: Enterprise integration
- **OAuth2**: Google, GitHub, etc.
- **API Keys**: Programmatic access

## 🔌 Plex Integration

### Connecting to Plex

1. Go to **Settings** → **Integrations** → **Plex**
2. Enter your Plex server details:
   - **Server URL**: `http://plex-server:32400`
   - **Token**: Your Plex authentication token
3. Test connection and save

### Sync Configuration

- **Two-way sync**: MediaNest ↔ Plex
- **Metadata sync**: Automatically update metadata
- **Watch status**: Sync watch progress
- **Collections**: Sync Plex collections

## ✅ Verification Steps

### System Health Check

```bash
# Check application status
curl http://localhost:8080/health

# Verify database connection
npm run db:check

# Test API endpoints
curl http://localhost:8080/api/v1/status
```

### Expected Response

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected",
  "redis": "connected",
  "uptime": "0d 0h 5m 23s"
}
```

## 🚨 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Check what's using port 8080
lsof -i :8080

# Use different port
export APP_PORT=8081
```

**Database connection failed**
```bash
# Verify PostgreSQL is running
systemctl status postgresql

# Test connection manually
psql -h localhost -U medianest -d medianest
```

**Permission errors**
```bash
# Fix file permissions
sudo chown -R medianest:medianest /path/to/media
chmod -R 755 /path/to/media
```

## 📚 Next Steps

Now that MediaNest is running:

1. **[Configure your media libraries](../user-guides/media-management.md)**
2. **[Set up automated scanning](../user-guides/file-organization.md)**
3. **[Explore the API](../api/index.md)**
4. **[Join our community](https://discord.gg/medianest)**

## 🔗 Related Documentation

- [Installation Guide](../installation/index.md) - Detailed installation procedures
- [Configuration Reference](../reference/config-reference.md) - All configuration options
- [User Guides](../user-guides/index.md) - Step-by-step user guides
- [Troubleshooting](../troubleshooting/index.md) - Common issues and solutions

---

**Need Help?** Join our [Discord community](https://discord.gg/medianest) or [create an issue](https://github.com/medianest/medianest/issues) on GitHub.