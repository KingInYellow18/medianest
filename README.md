# Media Management Web App (MediaNest)

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-username/medianest)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/react-18+-blue.svg)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/docker-compose-blue.svg)](https://docker.com)

A comprehensive media management web application providing a unified interface for Plex server management and media workflow optimization. Designed for small teams (~10 users) who need streamlined access to media services, request management, and system monitoring.

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Installation](#-installation)
- [API Overview](#-api-overview)
- [User Roles & Permissions](#-user-roles--permissions)
- [Security Features](#-security-features)
- [Development Timeline](#-development-timeline)
- [Contributing](#-contributing)
- [Documentation](#-documentation)
- [License](#-license)
- [Support](#-support)

## 🚀 Features

### Core Capabilities

- **🔍 Service Monitoring**: Real-time status and health checks via Uptime Kuma integration
- **📺 Media Request Management**: Seamless media requests through Overseerr API integration
- **📥 YouTube Download Manager**: yt-dlp integration for downloading and managing YouTube content
- **👥 User Management**: Complete user authentication, profiles, and role-based access control
- **⚙️ Configuration Administration**: System configuration management with YAML-based settings
- **📚 Plex Setup Guide**: Comprehensive FAQ and setup documentation for users

### User Experience

- **Regular Users**: View service status, submit media requests, manage YouTube downloads, access setup guides
- **Administrators**: Full system access including user management, configuration editing, system monitoring, and backup management

## 🛠 Technology Stack

### Frontend Architecture
- **React 18** with TypeScript for type safety and modern development
- **Tailwind CSS** for utility-first responsive design
- **React Query/TanStack Query** for server state management and caching
- **React Router** for client-side routing
- **React Hook Form** for form management with validation
- **Axios** for HTTP client with authentication interceptors

### Backend Architecture
- **Flask 3.x** with Python 3.11+ for REST API server
- **SQLAlchemy 2.x** with Alembic for database ORM and migrations
- **Flask-JWT-Extended** for secure JWT-based authentication
- **Marshmallow** for data serialization and validation
- **Flask-CORS** for cross-origin resource sharing
- **Flask-Limiter** for API rate limiting

### Database & Storage
- **SQLite** for lightweight database needs with Alembic migrations
- **NFS Storage** for shared media file management
- **File-based configuration** using YAML format

### External Integrations
- **Uptime Kuma** (WebSocket/HTTP API) for service monitoring
- **Overseerr** (REST API) for Plex media request management
- **yt-dlp** Python library for YouTube content downloading
- **NFS** for distributed storage access

### Infrastructure & Deployment
- **Docker Compose** for multi-container orchestration
- **Nginx** as reverse proxy with SSL termination and static file serving
- **Multi-stage Docker builds** for optimized production images
- **GitHub Actions** for CI/CD pipeline automation

## 🏗 System Architecture

The application consists of 7 main components working together in a microservices architecture:

1. **Frontend React App** - User interface and client-side logic
2. **Flask API Server** - Backend REST API and business logic
3. **SQLite Database** - Data persistence layer
4. **Nginx Reverse Proxy** - Load balancing and SSL termination
5. **Uptime Kuma Integration** - Service monitoring and health checks
6. **Overseerr Integration** - Media request management
7. **yt-dlp Service** - YouTube content downloading

For detailed architecture diagrams, see [`project_plan/architecture_diagram.png`](project_plan/architecture_diagram.png).

## 📦 Installation

### Prerequisites

- Docker and Docker Compose
- Git
- 4GB+ RAM recommended
- 10GB+ storage space

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/medianest.git
   cd medianest
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Web Interface: `http://localhost:3000`
   - API Documentation: `http://localhost:5000/api/docs`

### Development Setup

1. **Backend Development**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt -r requirements-dev.txt
   flask run
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm start
   ```

For detailed setup instructions, see [`project_plan/implementation-guide.md`](project_plan/implementation-guide.md).

## 🔌 API Overview

The application provides a comprehensive REST API with **25 endpoints** across **5 main categories**:

### API Categories

1. **Authentication** (4 endpoints)
   - Login, logout, refresh tokens, user registration

2. **User Management** (6 endpoints)
   - User CRUD operations, profile management, role assignment

3. **Service Monitoring** (3 endpoints)
   - Status checks, uptime statistics, health monitoring

4. **Media Management** (7 endpoints)
   - Media request lifecycle, YouTube download management

5. **Admin Functions** (5 endpoints)
   - Configuration management, system monitoring, backup operations

### API Documentation

- Interactive API docs available at `/api/docs` when running
- OpenAPI/Swagger specification included
- Postman collection available in [`project_plan/`](project_plan/)

## 👤 User Roles & Permissions

### Regular Users
- ✅ View service status and uptime statistics
- ✅ Submit and track media requests
- ✅ Manage personal YouTube downloads
- ✅ Access setup guides and documentation
- ✅ Update personal profile and preferences

### Administrators
- ✅ All regular user permissions
- ✅ User management (create, edit, delete users)
- ✅ System configuration management
- ✅ Advanced monitoring and analytics
- ✅ Backup and restore operations
- ✅ Service integration management

## 🔒 Security Features

- **JWT Authentication**: Short-lived access tokens (15 min) with refresh tokens
- **Role-Based Access Control**: Admin and User roles with appropriate permissions
- **Rate Limiting**: API-wide and endpoint-specific rate limits
- **Input Validation**: Comprehensive validation using Marshmallow schemas
- **Security Headers**: CORS, XSS protection, content security policy
- **Secure Configuration**: Environment-based secrets management
- **API Security**: Request/response validation and sanitization

## 📅 Development Timeline

**Total Duration**: 10 weeks across 5 phases

### Phase Overview
1. **Foundation** (Weeks 1-2): Core infrastructure and authentication
2. **Core Features** (Weeks 3-4): User management and basic functionality
3. **Integrations** (Weeks 5-6): External service integrations
4. **Advanced Features** (Weeks 7-8): Admin features and optimization
5. **Deployment** (Weeks 9-10): Production deployment and testing

For detailed timeline and milestones, see [`project_plan/project-plan.md`](project_plan/project-plan.md).

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure Docker builds pass
- Follow semantic versioning for releases

### Code Style
- **Python**: Follow PEP 8, use Black for formatting
- **TypeScript/React**: Follow Airbnb style guide, use Prettier
- **Commits**: Use conventional commit messages

## 📚 Documentation

### Project Documentation
- [`project_plan/project-plan.md`](project_plan/project-plan.md) - Complete project specification
- [`project_plan/implementation-guide.md`](project_plan/implementation-guide.md) - Implementation details
- [`project_plan/docker-configs.md`](project_plan/docker-configs.md) - Docker configuration guide

### Architecture Resources
- [`project_plan/architecture_diagram.png`](project_plan/architecture_diagram.png) - System architecture diagram
- [`project_plan/api_endpoints_chart.png`](project_plan/api_endpoints_chart.png) - API structure visualization
- [`project_plan/gantt_chart.png`](project_plan/gantt_chart.png) - Development timeline

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

### Getting Help
- **Issues**: Report bugs and request features via [GitHub Issues](https://github.com/your-username/medianest/issues)
- **Discussions**: Join community discussions in [GitHub Discussions](https://github.com/your-username/medianest/discussions)
- **Documentation**: Check the [`project_plan/`](project_plan/) directory for detailed documentation

### Maintainers
- **Project Lead**: [Your Name](mailto:your.email@example.com)
- **Technical Lead**: [Technical Lead Name](mailto:tech.lead@example.com)

### Community
- Follow development updates and announcements
- Contribute to discussions and feature requests
- Help improve documentation and guides

---

**Built with ❤️ for the Plex community**

*MediaNest - Streamlining your media management workflow*
