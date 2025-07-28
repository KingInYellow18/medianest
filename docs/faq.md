# Frequently Asked Questions

Common questions and answers about MediaNest.

## 🎯 General Questions

### What is MediaNest?

MediaNest is a unified web portal for managing Plex media server and related services. It consolidates multiple media management tools into a single, secure, and user-friendly interface designed for friends and family who access your Plex media server.

### Who is MediaNest for?

MediaNest is designed for:

- **Media Server Administrators** - Who want a centralized management interface
- **Family and Friends** - Who need easy access to request content and check status
- **Power Users** - Who want advanced features like queue management and monitoring
- **Developers** - Who want to extend or integrate with the platform

### What services does MediaNest integrate with?

Currently supported integrations:

- **Plex Media Server** - Authentication and library access
- **Overseerr** - Media request management
- **Redis** - Caching and session management
- **PostgreSQL** - Primary data storage

Planned integrations:
- Radarr/Sonarr for automated downloads
- Tautulli for advanced analytics
- Jellyfin as an alternative to Plex

## 🔧 Installation & Setup

### Do I need Docker to run MediaNest?

No, Docker is not required but highly recommended. MediaNest can be installed manually with Node.js, PostgreSQL, and Redis, but Docker simplifies the setup process significantly.

**Recommended approach**: Use Docker Compose for the easiest setup.

### What are the minimum system requirements?

**Minimum Requirements:**
- 4GB RAM
- 10GB free disk space
- Node.js 20+ (if not using Docker)
- Internet connection for external API integrations

**Recommended:**
- 8GB RAM
- 20GB free disk space
- SSD storage for better performance

### Can I run MediaNest on a Raspberry Pi?

Yes! MediaNest supports ARM64 architecture. Use Docker for the easiest setup on Raspberry Pi:

```bash
# Use the ARM64 compatible images
docker-compose up -d
```

Minimum Raspberry Pi 4 with 4GB RAM is recommended.

### How do I get Plex Client ID and Secret?

1. Visit [Plex's Developer Portal](https://www.plex.tv/claim/)
2. Sign in with your Plex account
3. Create a new app with these settings:
   - **App Name**: MediaNest
   - **Redirect URI**: `http://your-domain:8000/auth/plex/callback`
4. Copy the Client ID and Secret to your `.env` file

## 🔒 Security & Authentication

### How secure is MediaNest?

MediaNest implements enterprise-grade security practices:

- **JWT Authentication** with secure token management
- **Rate Limiting** to prevent abuse (100 requests per 15 minutes)
- **CORS Protection** with configurable origins
- **Input Validation** using Zod schemas
- **Helmet.js** for security headers
- **bcrypt** for password hashing
- **Environment isolation** for sensitive configuration

### Can I use MediaNest without Plex?

Currently, Plex integration is required for authentication. However, we're planning to add support for:
- Local user accounts
- LDAP/Active Directory integration
- OAuth providers (Google, GitHub, etc.)

### How are passwords stored?

MediaNest uses bcrypt with a high salt factor for password hashing. Passwords are never stored in plain text, and the JWT secret ensures token security.

## 🚀 Usage & Features

### How do I request new content?

1. Navigate to the **Requests** section
2. Search for the movie/TV show you want
3. Click **Request** and add any notes
4. Your request is sent to Overseerr for processing
5. You'll receive updates on the request status

### Can multiple users access MediaNest simultaneously?

Yes! MediaNest supports multiple concurrent users with:
- Real-time updates via WebSocket connections
- User session management
- Role-based access control
- Individual user preferences and request history

### What's the difference between Admin and User roles?

**Admin Users:**
- Full system configuration access
- User management capabilities
- View all requests and system metrics
- Access to monitoring dashboards

**Regular Users:**
- Create and manage their own requests
- View content library
- Basic profile management
- Request status tracking

## 🔧 Development & Customization

### How do I contribute to MediaNest?

1. Fork the repository on GitHub
2. Create a feature branch
3. Follow our [coding standards](development/standards.md)
4. Submit a pull request
5. See our [Contributing Guide](contributing/guide.md) for details

### Can I customize the interface?

Yes! MediaNest uses a modular component system:

- **Theme Customization** - Modify Tailwind CSS variables
- **Component Override** - Replace or extend existing components
- **Plugin System** - Add new features via plugins (planned)

### How do I add new integrations?

See our [Integration Guide](hooks/overview.md) for adding new service integrations. The architecture supports:

- Service abstraction layers
- Plugin-based extensions
- API middleware for external services

### Is there an API for external applications?

Yes! MediaNest provides a comprehensive REST API with:

- OpenAPI documentation at `/api-docs`
- JWT-based authentication
- Rate limiting and security
- WebSocket events for real-time data

## 🐛 Troubleshooting

### MediaNest won't start - what should I check?

1. **Check Prerequisites**:
   ```bash
   node --version  # Should be 20+
   npm --version   # Should be 10+
   ```

2. **Verify Environment Variables**:
   ```bash
   # Check required variables are set
   cat backend/.env | grep -E "(DATABASE_URL|JWT_SECRET|PLEX_CLIENT_ID)"
   ```

3. **Check Service Status**:
   ```bash
   # For Docker
   docker-compose ps
   
   # For manual installation
   systemctl status postgresql
   systemctl status redis
   ```

4. **Review Logs**:
   ```bash
   # Docker logs
   docker-compose logs medianest
   
   # Manual installation
   tail -f logs/application.log
   ```

### Database connection errors?

**Common causes and solutions:**

1. **PostgreSQL not running**:
   ```bash
   # Start PostgreSQL
   docker-compose up -d postgres
   # or
   systemctl start postgresql
   ```

2. **Wrong connection string**:
   ```bash
   # Verify DATABASE_URL format
   DATABASE_URL="postgresql://user:password@host:port/database"
   ```

3. **Database doesn't exist**:
   ```bash
   # Create database
   createdb medianest
   # or using Docker
   docker-compose exec postgres createdb -U medianest medianest
   ```

### API returns 401 Unauthorized?

1. **Check JWT token**:
   - Ensure you're logged in
   - Token may have expired (default: 7 days)
   - Clear browser storage and re-login

2. **Verify JWT_SECRET**:
   - Ensure it's at least 32 characters
   - Same secret in both backend and frontend config

### High memory usage?

**Optimization tips:**

1. **Enable Redis caching**:
   ```bash
   # Verify Redis is running and connected
   docker-compose exec redis redis-cli ping
   ```

2. **Adjust Node.js memory**:
   ```bash
   # Add to package.json start script
   "start": "node --max-old-space-size=4096 dist/server.js"
   ```

3. **Monitor with health endpoint**:
   ```bash
   curl http://localhost:8000/health
   ```

## 📊 Performance & Monitoring

### How do I monitor MediaNest performance?

MediaNest includes built-in monitoring:

- **Health Endpoint**: `GET /health` - System health status
- **Metrics Dashboard** - Real-time performance metrics
- **Winston Logging** - Comprehensive error tracking
- **WebSocket Monitoring** - Connection status and events

### What's the expected performance?

**Typical performance metrics:**

- **API Response Time**: < 100ms for most endpoints
- **WebSocket Latency**: < 50ms for real-time updates
- **Database Queries**: < 50ms average with proper indexing
- **Memory Usage**: 200-500MB depending on user load

### How do I optimize performance?

1. **Enable Redis caching**
2. **Use PostgreSQL connection pooling**
3. **Implement CDN for static assets**
4. **Monitor with the built-in health checks**

## 🔄 Updates & Maintenance

### How do I update MediaNest?

1. **Backup your data**:
   ```bash
   # Backup database
   docker-compose exec postgres pg_dump -U medianest medianest > backup.sql
   ```

2. **Pull latest changes**:
   ```bash
   git pull origin main
   npm install
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Restart services**:
   ```bash
   docker-compose up -d --force-recreate
   ```

### How often should I update?

- **Security updates**: Apply immediately
- **Feature releases**: Monthly or as needed
- **Database backups**: Weekly recommended

### Can I rollback an update?

Yes! Keep database backups and use Git tags:

```bash
# Rollback to previous version
git checkout v1.0.0
docker-compose up -d --force-recreate

# Restore database if needed
docker-compose exec postgres psql -U medianest medianest < backup.sql
```

## 🤝 Support & Community

### Where can I get help?

- **Documentation**: [https://medianest.io/docs](https://medianest.io/docs)
- **GitHub Issues**: [Report bugs or request features](https://github.com/medianest/medianest/issues)
- **GitHub Discussions**: [Community Q&A](https://github.com/medianest/medianest/discussions)

### How do I report a bug?

1. Check [existing issues](https://github.com/medianest/medianest/issues)
2. Use our [bug report template](https://github.com/medianest/medianest/issues/new?template=bug_report.md)
3. Include:
   - MediaNest version
   - Operating system
   - Steps to reproduce
   - Error logs
   - Expected vs actual behavior

### Can I request new features?

Yes! Submit feature requests via:

1. [GitHub Issues](https://github.com/medianest/medianest/issues/new?template=feature_request.md)
2. Include use case and expected behavior
3. Check our [roadmap](https://github.com/medianest/medianest/projects) for planned features

---

**Can't find your answer?** [Ask a question](https://github.com/medianest/medianest/discussions/new?category=q-a) in our GitHub Discussions.