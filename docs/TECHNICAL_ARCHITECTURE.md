# MediaNest Technical Architecture

## System Overview

MediaNest is a modern web application built with a microservices architecture, designed for scalability, maintainability, and developer experience.

## Architecture Principles

### 1. Separation of Concerns

- **Frontend**: Presentation and user interaction
- **Backend**: Business logic and data management
- **Queue Workers**: Asynchronous processing
- **External Services**: Third-party integrations

### 2. Domain-Driven Design

- Clear boundaries between domains
- Repository pattern for data access
- Service layer for business logic
- Controllers for HTTP handling

### 3. Event-Driven Communication

- WebSocket for real-time updates
- Queue-based job processing
- Event emitters for internal communication

## Component Architecture

### Frontend (Next.js)

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Application                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   App Dir   │  │  Components  │  │     Hooks     │  │
│  │   Routes    │  │   (React)    │  │  (Business)   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  API Routes │  │   Lib/API    │  │    Types      │  │
│  │  (NextAuth) │  │   Client     │  │ (TypeScript)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Key Technologies

- **Next.js 14**: App Router for modern React
- **React 18**: UI components with hooks
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **React Query**: Server state management
- **Zustand**: Client state management

### Backend (Express.js)

```
┌─────────────────────────────────────────────────────────┐
│                   Express Application                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Routes    │→ │ Controllers  │→ │   Services    │  │
│  │  (Express)  │  │  (Handlers)  │  │  (Business)   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                           ↓              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Middleware  │  │ Repositories │← │   Database    │  │
│  │  (Auth...)  │  │   (Prisma)   │  │ (PostgreSQL)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Layered Architecture

1. **Routes Layer**

   - HTTP routing
   - Request/Response handling
   - API versioning

2. **Controller Layer**

   - Request validation
   - Response formatting
   - Error handling

3. **Service Layer**

   - Business logic
   - Transaction management
   - External API calls

4. **Repository Layer**
   - Database queries
   - Data mapping
   - Query optimization

### Database Design

```sql
-- Core Entities
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│    Users    │────<│     Sessions    │     │ ServiceConfig│
└─────────────┘     └─────────────────┘     └──────────────┘
       │                                            │
       │                                            │
       ↓                                            ↓
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│MediaRequests│     │YouTubeDownloads │     │ServiceStatus │
└─────────────┘     └─────────────────┘     └──────────────┘
```

#### Key Tables

1. **Users**

   - Authentication data
   - Plex integration
   - Preferences

2. **MediaRequests**

   - Request tracking
   - Status management
   - User association

3. **YouTubeDownloads**

   - Download queue
   - Progress tracking
   - File metadata

4. **ServiceConfig**
   - External service settings
   - API credentials
   - Configuration

### Queue Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Producer   │────>│    Redis    │────>│   Consumer   │
│  (Backend)   │     │   (Queue)   │     │  (Worker)    │
└──────────────┘     └─────────────┘     └──────────────┘
                            │
                            ↓
                     ┌─────────────┐
                     │  Dead Letter │
                     │    Queue     │
                     └─────────────┘
```

#### Queue Types

1. **YouTube Download Queue**

   - Priority-based processing
   - Retry logic
   - Progress tracking

2. **Media Request Queue**

   - Overseerr integration
   - Status updates
   - Notification dispatch

3. **Notification Queue**
   - Email notifications
   - WebSocket events
   - Push notifications

### Real-time Communication

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │<───>│  Socket.io  │<───>│   Backend    │
│   (Client)   │     │   Server    │     │  (Events)    │
└──────────────┘     └─────────────┘     └──────────────┘
```

#### WebSocket Events

1. **Status Updates**

   - Service health
   - Real-time metrics
   - System alerts

2. **Queue Updates**

   - Download progress
   - Request status
   - Job completion

3. **Notifications**
   - User alerts
   - System messages
   - Error notifications

## Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │────>│   Plex   │────>│ NextAuth │────>│   API    │
│          │<────│  OAuth   │<────│          │<────│          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Security Layers

1. **Network Security**

   - HTTPS everywhere
   - CORS configuration
   - Rate limiting
   - IP whitelisting

2. **Application Security**

   - JWT authentication
   - Role-based access
   - Input validation
   - SQL injection prevention

3. **Data Security**
   - Encryption at rest
   - Encryption in transit
   - Sensitive data hashing
   - Secure session management

## Performance Architecture

### Caching Strategy

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser    │     │    CDN      │     │   Server     │
│   Cache      │<───>│   Cache     │<───>│   Cache      │
└──────────────┘     └─────────────┘     └──────────────┘
                                               │
                                               ↓
                                        ┌─────────────┐
                                        │    Redis    │
                                        │   Cache     │
                                        └─────────────┘
```

### Optimization Techniques

1. **Frontend Optimization**

   - Code splitting
   - Lazy loading
   - Image optimization
   - Bundle minimization

2. **Backend Optimization**

   - Query optimization
   - Connection pooling
   - Response compression
   - Caching strategies

3. **Database Optimization**
   - Proper indexing
   - Query planning
   - Connection limits
   - Partitioning strategy

## Monitoring Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Application  │────>│ Prometheus  │────>│   Grafana    │
│   Metrics    │     │  (Metrics)  │     │ (Dashboard)  │
└──────────────┘     └─────────────┘     └──────────────┘
       │                                          │
       ↓                                          ↓
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│     Logs     │────>│    Loki     │────>│   Alerts     │
│  (Winston)   │     │(Aggregation)│     │   (Email)    │
└──────────────┘     └─────────────┘     └──────────────┘
```

### Monitoring Components

1. **Application Metrics**

   - Response times
   - Error rates
   - Queue lengths
   - Active users

2. **System Metrics**

   - CPU usage
   - Memory usage
   - Disk I/O
   - Network traffic

3. **Business Metrics**
   - Request counts
   - Download statistics
   - User activity
   - Service usage

## Deployment Architecture

### Container Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                           │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Nginx   │  │ Frontend │  │ Backend  │  │ Worker │ │
│  │  Proxy   │  │   Next   │  │ Express  │  │  Jobs  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │  Redis   │  │Prometheus│  │Grafana │ │
│  │    DB    │  │  Cache   │  │ Metrics  │  │  Dash  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Scaling Strategy

1. **Horizontal Scaling**

   - Load balancer ready
   - Stateless services
   - Shared session store
   - Database replication

2. **Vertical Scaling**
   - Resource limits
   - Memory optimization
   - CPU allocation
   - Storage expansion

## Integration Architecture

### External Services

```
┌─────────────────────────────────────────────────────────┐
│                   MediaNest Core                         │
├─────────────────────────────────────────────────────────┤
│       ↓              ↓              ↓              ↓     │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │  Plex   │  │Overseerr │  │Uptime Kuma│  │YouTube │ │
│  │   API   │  │   API    │  │    API    │  │   DL   │ │
│  └─────────┘  └──────────┘  └───────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Integration Patterns

1. **Circuit Breaker**

   - Fault tolerance
   - Graceful degradation
   - Automatic recovery
   - Fallback responses

2. **Retry Logic**

   - Exponential backoff
   - Max retry limits
   - Dead letter queues
   - Error logging

3. **Rate Limiting**
   - API quotas
   - Request throttling
   - Burst allowance
   - User-based limits

## Data Flow Architecture

### Request Flow

```
User Request → Nginx → Frontend → API Gateway → Backend
     ↓                                              ↓
  Browser ← Response ← Frontend ← JSON API ← Service Layer
```

### Data Processing Flow

```
Data Input → Validation → Business Logic → Database
     ↓            ↓             ↓             ↓
  Error ←    Invalid ←     Exception ←   Constraint
```

## Future Architecture Considerations

### Planned Enhancements

1. **Microservices Migration**

   - Service decomposition
   - API Gateway
   - Service mesh
   - Container orchestration

2. **AI/ML Integration**

   - Content recommendations
   - Usage predictions
   - Anomaly detection
   - Natural language search

3. **Enhanced Monitoring**
   - APM integration
   - Distributed tracing
   - Log analytics
   - User analytics

### Scalability Roadmap

1. **Phase 1**: Current monolithic with services
2. **Phase 2**: Extract queue workers
3. **Phase 3**: Separate API services
4. **Phase 4**: Full microservices

---

For implementation details, see:

- [Developer Guide](./DEVELOPER_GUIDE.md)
- [API Documentation](./API_REFERENCE.md)
- [Database Schema](../backend/prisma/README.md)
