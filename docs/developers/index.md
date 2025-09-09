# Developer Documentation

Welcome to the MediaNest developer documentation. Whether you're contributing to the project, building integrations, or extending functionality, this section provides all the technical information you need.

## Quick Start for Developers

### Development Environment Setup
```bash
# Clone the repository
git clone https://github.com/medianest/medianest.git
cd medianest

# Install dependencies
npm install

# Set up development environment
cp .env.example .env.dev
npm run setup:dev

# Start development servers
npm run dev
```

## Architecture Overview

MediaNest is built with modern technologies and follows clean architecture principles:

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React, Next.js, TypeScript
- **Caching**: Redis for sessions and caching
- **Media Processing**: FFmpeg for video/audio processing
- **Search**: Elasticsearch for advanced search capabilities

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Mobile App    │    │   API Clients   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Load Balancer │
                    └─────────┬───────┘
                              │
                ┌─────────────────────────┐
                │     MediaNest API       │
                │  (Express + TypeScript) │
                └─────────┬───────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐ ┌────────▼────────┐ ┌──────▼──────┐
│ PostgreSQL   │ │     Redis       │ │ File System │
│  Database    │ │    Cache        │ │   Storage   │
└──────────────┘ └─────────────────┘ └─────────────┘
```

## Development Guides

### [Architecture Overview](architecture.md)
Detailed system architecture, design patterns, and technology stack explanations.

### [Contributing Guidelines](contributing.md)
How to contribute to MediaNest, coding standards, and pull request process.

### [Development Setup](development-setup.md)
Complete guide to setting up your development environment.

### [Coding Standards](coding-standards.md)
Code style guidelines, linting rules, and best practices.

### [Testing](testing.md)
Testing strategies, writing tests, and running the test suite.

### [Deployment](deployment.md)
Deployment procedures, CI/CD pipeline, and production considerations.

### [Database Schema](database-schema.md)
Complete database schema documentation and migration procedures.

### [Plugin Development](plugins.md)
How to create and integrate plugins to extend MediaNest functionality.

## API Integration

### RESTful API
MediaNest provides a comprehensive REST API for all functionality:

- **Authentication**: JWT-based authentication with refresh tokens
- **Rate Limiting**: Configurable rate limiting for API endpoints
- **Versioning**: API versioning for backward compatibility
- **Documentation**: Auto-generated OpenAPI/Swagger documentation

### WebSocket API
Real-time features are available through WebSocket connections:

- **Live Updates**: Real-time library updates and scan progress
- **Notifications**: System notifications and alerts
- **Collaboration**: Multi-user real-time collaboration features

### SDK and Libraries
Official SDKs are available for popular languages:

- **JavaScript/TypeScript**: `@medianest/sdk`
- **Python**: `medianest-python`
- **Go**: `medianest-go`

## Extension Points

### Plugin System
MediaNest supports plugins for extending functionality:

- **Metadata Providers**: Custom metadata sources
- **File Processors**: Custom file processing and transcoding
- **Notification Providers**: Custom notification channels
- **Authentication Providers**: SSO and custom auth integration

### Webhook System
Integrate with external systems using webhooks:

- **Library Events**: File additions, deletions, modifications
- **User Events**: Login, logout, permission changes
- **System Events**: Backup completion, errors, health status

## Development Tools

### Available Scripts
```bash
# Development
npm run dev              # Start development servers
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Building
npm run build            # Production build
npm run build:docker     # Docker image build

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode testing
npm run test:coverage    # Coverage report

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed development data
npm run db:reset         # Reset database

# Code Quality
npm run lint             # Run linter
npm run format           # Format code
npm run typecheck        # TypeScript type checking
```

### IDE Configuration
Recommended IDE setup with VS Code:

- **Extensions**: ESLint, Prettier, TypeScript
- **Settings**: Auto-format on save, organize imports
- **Debugging**: Launch configurations for backend and frontend

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Contribution Areas

- **Core Features**: Backend API, frontend UI, core functionality
- **Integrations**: Third-party service integrations
- **Documentation**: User guides, API docs, tutorials
- **Testing**: Unit tests, integration tests, end-to-end tests
- **Performance**: Optimization, caching, scalability
- **Security**: Security audits, vulnerability fixes

## Community

- **Discord**: [Join our developer community](https://discord.gg/medianest-dev)
- **GitHub**: [Source code and issues](https://github.com/medianest/medianest)
- **Documentation**: [Technical documentation](https://docs.medianest.com)

## Support

- **Developer Issues**: [GitHub Issues](https://github.com/medianest/medianest/issues)
- **API Questions**: [API Discussion Forum](https://github.com/medianest/medianest/discussions)
- **Real-time Help**: [Discord #dev-help channel](https://discord.gg/medianest)

---

Ready to contribute? Start with our [Contributing Guidelines](contributing.md) or jump into the [Development Setup](development-setup.md) guide!