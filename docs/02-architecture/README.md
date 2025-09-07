# Architecture Documentation

MediaNest follows a modern microservices architecture with clean separation of concerns.

## Architecture Overview

MediaNest is built as a full-stack application with:

- **Frontend**: React.js with TypeScript
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL with Redis caching
- **Media Processing**: Integrated Plex Media Server
- **Monitoring**: Comprehensive observability stack

## Core Components

### System Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │◄──►│   Backend   │◄──►│  Database   │
│   (React)   │    │  (Express)  │    │(PostgreSQL) │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │    Redis    │            │
       │            │   (Cache)   │            │
       │            └─────────────┘            │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│Plex Server  │    │ Monitoring  │    │   Docker    │
│ (Media)     │    │   Stack     │    │ Container   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Documentation in this section

- [System Architecture](./system-architecture.md) - High-level system design
- [Database Design](./database-design.md) - Schema and data flow
- [API Architecture](./api-architecture.md) - RESTful API structure

## Key Design Principles

1. **Modularity**: Clean separation between frontend, backend, and services
2. **Scalability**: Horizontally scalable microservices architecture
3. **Observability**: Comprehensive monitoring and logging
4. **Security**: Authentication, authorization, and data protection
5. **Performance**: Caching, optimization, and efficient data access

## Technology Stack

### Frontend Stack

- React 18 with TypeScript
- Material-UI component library
- React Router for navigation
- React Query for state management
- Jest + React Testing Library

### Backend Stack

- Node.js with Express framework
- TypeScript for type safety
- PostgreSQL database with migrations
- Redis for caching and sessions
- JWT for authentication
- OpenAPI/Swagger documentation

### DevOps & Infrastructure

- Docker containers for all services
- Docker Compose for local development
- GitHub Actions for CI/CD
- Comprehensive logging with structured output
- Health checks and monitoring endpoints

## Related Documentation

- [Implementation Guides](../04-implementation-guides/README.md) - How to implement features
- [API Reference](../03-api-reference/README.md) - Complete API documentation
- [Deployment Guide](../06-deployment/README.md) - Production deployment
