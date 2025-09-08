# MediaNest System Architecture

**Version:** 4.0 - Consolidated Architecture Guide  
**Last Updated:** September 7, 2025  
**Status:** Development Phase Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Core Components](#core-components)
4. [Technology Stack](#technology-stack)
5. [Authentication Architecture](#authentication-architecture)
6. [Database Design](#database-design)
7. [API Architecture](#api-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Integration Patterns](#integration-patterns)
10. [Security Architecture](#security-architecture)
11. [Performance Considerations](#performance-considerations)
12. [Deployment Architecture](#deployment-architecture)

## System Overview

MediaNest is a media management platform built on a modern full-stack architecture that integrates with external services (Plex, YouTube) to provide unified media discovery and management.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ - React UI      │    │ - Express API   │    │ - Plex Server   │
│ - TypeScript    │    │ - JWT Auth      │    │ - YouTube API   │
│ - Tailwind CSS  │    │ - Prisma ORM    │    │ - Redis Cache   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Database      │
                    │  (PostgreSQL)   │
                    │                 │
                    │ - User Data     │
                    │ - Session Mgmt  │
                    │ - Media Metadata│
                    └─────────────────┘
```

## Architecture Principles

### 1. **Separation of Concerns**

- Clear boundaries between frontend, backend, and data layers
- Single responsibility for each component
- Loose coupling with well-defined interfaces

### 2. **Security by Design**

- JWT-based authentication with secure session management
- Input validation and sanitization at all entry points
- Principle of least privilege for service integrations

### 3. **Performance Optimization**

- Redis caching for frequently accessed data
- Efficient database queries with Prisma ORM
- Lazy loading and code splitting in frontend

### 4. **Scalability Patterns**

- Stateless backend design for horizontal scaling
- Database connection pooling
- Caching strategies for external API calls

### 5. **Developer Experience**

- TypeScript throughout the stack for type safety
- Consistent error handling patterns
- Comprehensive logging and monitoring

## Core Components

### Backend Services

#### **1. Authentication Service**

- **Purpose:** JWT token generation, validation, and session management
- **Technologies:** Node.js, Express, JWT
- **Key Features:**
  - Secure token generation with configurable expiration
  - Device-based session tracking
  - Role-based access control
  - Session invalidation and cleanup

#### **2. Media Integration Service**

- **Purpose:** Unified interface for external media services
- **Integrations:** Plex Server, YouTube API
- **Key Features:**
  - Abstract service layer for media operations
  - Rate limiting and error handling
  - Response caching and normalization
  - Circuit breaker pattern for resilience

#### **3. Dashboard Service**

- **Purpose:** Aggregates and presents media statistics
- **Key Features:**
  - Real-time data aggregation
  - Caching layer for performance
  - Responsive data formatting
  - User-specific content filtering

### Frontend Components

#### **1. Authentication Module**

- **Components:** Login, logout, session management
- **Features:** Automatic token refresh, secure cookie handling
- **Security:** XSS protection, CSRF tokens

#### **2. Dashboard Module**

- **Components:** Statistics cards, media grids, search interface
- **Features:** Real-time updates, responsive design
- **Performance:** Lazy loading, virtualized lists

#### **3. Media Management Module**

- **Components:** Media browser, search, filtering
- **Features:** Unified search across services
- **UX:** Infinite scrolling, keyboard navigation

## Technology Stack

### **Backend Stack**

```yaml
Runtime: Node.js 18+
Framework: Express.js
Language: TypeScript
Database: PostgreSQL 14+
ORM: Prisma
Caching: Redis
Authentication: JWT (jsonwebtoken)
Validation: Zod schemas
Testing: Vitest, Supertest
```

### **Frontend Stack**

```yaml
Framework: Next.js 14+
UI Library: React 18+
Language: TypeScript
Styling: Tailwind CSS
State: React Context/hooks
HTTP Client: Fetch API
Testing: Vitest, React Testing Library
```

### **Infrastructure Stack**

```yaml
Containerization: Docker & Docker Compose
Reverse Proxy: Nginx
Process Manager: PM2 (production)
Monitoring: Prometheus, Grafana
Logging: Winston, structured logging
```

## Authentication Architecture

### JWT-Based Authentication Flow

```
1. User Login Request
   ├─→ Credentials validation
   ├─→ JWT token generation
   ├─→ Secure httpOnly cookie setting
   └─→ Device registration

2. Authenticated Requests
   ├─→ Token extraction from cookie
   ├─→ Token validation & decoding
   ├─→ User context attachment
   └─→ Request processing

3. Session Management
   ├─→ Device-based session tracking
   ├─→ Automatic token refresh
   ├─→ Logout & token invalidation
   └─→ Session cleanup
```

### Security Features

- **Secure Cookies:** httpOnly, secure, sameSite attributes
- **Token Rotation:** Automatic refresh with short-lived tokens
- **Device Tracking:** Device fingerprinting for security
- **Session Limits:** Configurable concurrent session limits

## Database Design

### Core Entities

```sql
Users
├─ id (UUID, primary key)
├─ email (unique)
├─ name
├─ password_hash
├─ role
└─ created_at, updated_at

SessionTokens
├─ id (UUID, primary key)
├─ user_id (foreign key)
├─ token_hash
├─ device_id
├─ expires_at
└─ created_at, updated_at

UserPreferences
├─ id (UUID, primary key)
├─ user_id (foreign key)
├─ plex_server_url
├─ plex_token
├─ youtube_preferences (JSON)
└─ created_at, updated_at
```

### Indexing Strategy

- Primary keys on all UUID fields
- Unique indexes on email, token_hash
- Composite indexes on frequently queried combinations
- Database constraints for data integrity

## API Architecture

### RESTful Design Principles

- **Resource-based URLs:** `/api/v1/users`, `/api/v1/media`
- **HTTP Verbs:** GET, POST, PUT, DELETE for operations
- **Status Codes:** Consistent HTTP status code usage
- **Response Format:** Standardized JSON response envelope

### API Structure

```
/api/v1/
├─ /auth/          # Authentication endpoints
├─ /dashboard/     # Dashboard data endpoints
├─ /media/         # Media management endpoints
├─ /plex/          # Plex integration endpoints
├─ /youtube/       # YouTube integration endpoints
└─ /health/        # Health check endpoints
```

### Error Handling

- Consistent error response format
- Detailed error codes and messages
- Request validation with Zod schemas
- Comprehensive error logging

## Frontend Architecture

### Component Organization

```
src/
├─ components/     # Reusable UI components
├─ pages/          # Next.js page components
├─ hooks/          # Custom React hooks
├─ services/       # API service layer
├─ utils/          # Utility functions
├─ types/          # TypeScript type definitions
└─ styles/         # Global styles and themes
```

### State Management Strategy

- **Local State:** React useState/useReducer for component state
- **Server State:** React Query for API data management
- **Global State:** React Context for user authentication state
- **Form State:** React Hook Form for form management

## Integration Patterns

### External Service Integration

- **Abstraction Layer:** Service interfaces for external APIs
- **Error Handling:** Circuit breaker pattern for resilience
- **Rate Limiting:** Respect external API rate limits
- **Caching:** Response caching for performance

### Plex Integration

- **Authentication:** Plex token-based authentication
- **Data Sync:** Periodic synchronization of media libraries
- **Real-time Updates:** Webhook support for live updates

### YouTube Integration

- **OAuth Flow:** YouTube OAuth for user authorization
- **API Usage:** Efficient API usage within quotas
- **Content Discovery:** Search and recommendation features

## Security Architecture

### Defense in Depth

1. **Input Validation:** All inputs validated and sanitized
2. **Authentication:** JWT with secure session management
3. **Authorization:** Role-based access control
4. **Transport Security:** HTTPS/TLS encryption
5. **Data Protection:** Sensitive data encryption at rest

### Security Headers

- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)

## Performance Considerations

### Backend Performance

- **Database:** Connection pooling, query optimization
- **Caching:** Redis for session data and API responses
- **API Design:** Pagination, filtering, and field selection
- **Monitoring:** Performance metrics and alerting

### Frontend Performance

- **Code Splitting:** Dynamic imports and lazy loading
- **Image Optimization:** Next.js Image component
- **Bundle Size:** Tree shaking and optimization
- **Caching:** Browser and CDN caching strategies

## Deployment Architecture

### Container Strategy

```yaml
Services:
  - frontend: Next.js application
  - backend: Node.js API server
  - database: PostgreSQL with persistence
  - cache: Redis for session/data caching
  - nginx: Reverse proxy and SSL termination
```

### Environment Configuration

- **Development:** Docker Compose for local development
- **Staging:** Container orchestration with health checks
- **Production:** Scalable deployment with load balancing

### Monitoring & Observability

- **Health Checks:** Endpoint monitoring for all services
- **Metrics:** Prometheus metrics collection
- **Logging:** Structured logging with correlation IDs
- **Alerting:** Grafana dashboards and alerting rules

## Future Architecture Considerations

### Scalability Improvements

- **Microservices:** Service decomposition as needed
- **Event-Driven:** Message queues for async processing
- **CDN Integration:** Static asset delivery optimization
- **Database Scaling:** Read replicas and sharding strategies

### Technology Evolution

- **API Gateway:** Centralized API management
- **Service Mesh:** Inter-service communication patterns
- **Observability:** Distributed tracing implementation
- **Security:** Zero-trust security model adoption

---

**Note:** This architecture document reflects the current development phase implementation. Production deployments should include additional hardening and scalability measures based on actual usage patterns and requirements.
