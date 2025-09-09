# MediaNest Service Environment Mapping Analysis

## Current Service Distribution Analysis

### 🏗️ **Core Application Services**

#### **Backend Services**
- **Service**: Express.js Backend API
- **Container**: `medianest-backend`
- **Port**: 4000
- **Environments**: 
  - **Development**: Hot reload, debugging port 9229, polling enabled
  - **Test**: CI-optimized, fast startup, ephemeral data
  - **Production**: Security hardened, secrets management, resource limited

#### **Frontend Services** 
- **Service**: Next.js React Application
- **Container**: `medianest-frontend`
- **Port**: 3000
- **Environments**:
  - **Development**: HMR enabled, fast refresh, polling enabled
  - **Test**: CI-optimized, telemetry disabled
  - **Production**: Static optimization, image optimization, security hardened

### 🗄️ **Infrastructure Services**

#### **Database Services**
- **Service**: PostgreSQL Database
- **Container**: `medianest-postgres`
- **Port**: 5432 (dev), 5433 (test)
- **Environments**:
  - **Development**: Full persistence, admin tools (pgAdmin), dev seed data
  - **Test**: tmpfs storage, performance optimized, ephemeral data
  - **Production**: Performance tuned, backup enabled, security hardened

#### **Cache Services**
- **Service**: Redis Cache/Queue
- **Container**: `medianest-redis` 
- **Port**: 6379 (dev), 6380 (test)
- **Environments**:
  - **Development**: Full persistence, admin tools (Redis Commander)
  - **Test**: tmpfs storage, no persistence, speed optimized
  - **Production**: Performance tuned, authentication, backup enabled

### 🌐 **Infrastructure & Middleware Services**

#### **Reverse Proxy Service** (Production Only)
- **Service**: Nginx Reverse Proxy
- **Container**: `medianest-nginx`
- **Ports**: 80, 443
- **Features**: SSL/TLS termination, rate limiting, security headers, static serving

#### **SSL Management Service** (Production Only)
- **Service**: Let's Encrypt Certbot
- **Container**: `medianest-certbot`
- **Features**: Automatic certificate renewal, domain validation

#### **Backup Service** (Production Only)
- **Service**: Database & Data Backup
- **Container**: `medianest-backup`
- **Features**: Scheduled backups, data archiving, recovery procedures

### 🔧 **Development Tools & Services**

#### **Database Administration** (Development Profile)
- **Service**: pgAdmin
- **Container**: `medianest-pgadmin-dev`
- **Port**: 8080
- **Profile**: `tools`

#### **Cache Administration** (Development Profile)
- **Service**: Redis Commander
- **Container**: `medianest-redis-commander-dev`
- **Port**: 8081
- **Profile**: `tools`

#### **Mail Testing** (Development Profile)
- **Service**: MailHog
- **Container**: `medianest-mailhog-dev`
- **Ports**: 8025 (UI), 1025 (SMTP)
- **Profile**: `tools`

### 🧪 **Test-Specific Services**

#### **Test Runners**
- **Backend Test**: `medianest-backend-test`
- **Frontend Test**: `medianest-frontend-test`
- **Integration Test**: `medianest-integration-test`
- **E2E Test**: `medianest-e2e-test`

#### **Test Services** (Integration Testing)
- **Backend Service**: `medianest-backend-service-test`
- **Frontend Service**: `medianest-frontend-service-test`

#### **Test Reporting**
- **Test Report**: `medianest-test-report`

## 📊 **Environment-Specific Configuration Matrix**

### **Development Environment**
```yaml
Purpose: Local development with hot reload and debugging
Network: medianest-development (172.30.0.0/16)
Features:
  - Hot reload enabled
  - Debug ports exposed
  - Admin tools available
  - Full logging enabled
  - Persistent volumes
  - Development seed data
```

### **Test Environment**
```yaml
Purpose: Fast, isolated testing for CI/CD
Network: medianest-testing (172.50.0.0/16)
Features:
  - Ephemeral data (tmpfs)
  - Performance optimized
  - Fast startup/shutdown
  - No persistence required
  - CI-specific configuration
  - Test-specific environment variables
```

### **Production Environment**
```yaml
Purpose: Secure, scalable production deployment
Networks: 
  - frontend-network (172.21.0.0/24)
  - backend-network (172.20.0.0/24)
Features:
  - Security hardened containers
  - SSL/TLS encryption
  - Secrets management
  - Resource limits
  - Backup & monitoring
  - Rate limiting
  - Health checks
```

## 🎯 **Service Groupings by Function**

### **Core Application Stack**
- Backend API (`backend`)
- Frontend UI (`frontend`) 
- Shared utilities (`shared`)

### **Data Layer**
- PostgreSQL Database (`postgres/postgres-test`)
- Redis Cache/Queue (`redis/redis-test`)

### **Infrastructure Layer**
- Nginx Proxy (`nginx`) - Production only
- SSL Management (`certbot`) - Production only

### **Development Tools**
- Database Admin (`pgadmin`) - Dev only
- Cache Admin (`redis-commander`) - Dev only
- Mail Testing (`mailhog`) - Dev only

### **Testing Infrastructure**
- Test Runners (`*-test` containers) - Test only
- Test Services (`*-service-test` containers) - Test only
- Test Reporting (`test-report`) - Test only

### **Operations & Backup**
- Backup Service (`backup`) - Production only
- Health Monitoring (built into each service)

## 🔒 **Security & Performance Requirements by Environment**

### **Development**
- Security: Basic (development keys, open ports)
- Performance: Convenience over performance
- Monitoring: Basic health checks, full logging
- Persistence: Full persistence for development continuity

### **Test**
- Security: Isolated (test secrets, network isolation)
- Performance: Speed optimized (tmpfs, no persistence)
- Monitoring: Minimal logging, fast health checks
- Persistence: None (ephemeral data)

### **Production**
- Security: Hardened (secrets management, SSL, firewalls)
- Performance: Production optimized (resource limits, caching)
- Monitoring: Comprehensive (metrics, alerting, logging)
- Persistence: Full persistence with backup/recovery

## 🔗 **Service Dependencies & Startup Order**

### **Development Order**
1. Infrastructure: `postgres`, `redis`
2. Backend: `backend` (depends on postgres, redis)
3. Frontend: `frontend` (depends on backend)
4. Tools: `pgadmin`, `redis-commander`, `mailhog` (optional profiles)

### **Test Order**
1. Infrastructure: `postgres-test`, `redis-test`
2. Services: `backend-service`, `frontend-service` (for integration tests)
3. Test Runners: Various test containers in parallel
4. Reporting: `test-report` (depends on all tests)

### **Production Order**
1. Infrastructure: `postgres`, `redis`
2. Application: `backend` (depends on infrastructure)
3. Frontend: `frontend` (depends on backend)
4. Proxy: `nginx` (depends on frontend, backend)
5. Support: `certbot` (depends on nginx), `backup` (optional)

## 💾 **Storage & Volume Strategy**

### **Development Volumes**
- Persistent data for continuity
- Node modules optimization
- Log retention
- Development tools data

### **Test Volumes**
- Ephemeral test data (tmpfs)
- Coverage reports
- Test artifacts (screenshots, videos)
- Minimal persistence

### **Production Volumes**
- Host-mounted data directories
- Backup storage
- Log rotation
- SSL certificate storage
- Application uploads

## 🌐 **Network Architecture**

### **Development**
- Single bridge network
- All services interconnected
- Exposed ports for external access

### **Test**  
- Isolated test network
- Ephemeral networking
- Minimal external exposure

### **Production**
- Segmented networks (frontend/backend)
- Security isolation
- Load balancer integration
- SSL termination at proxy

This comprehensive analysis provides the foundation for environment-specific deployment strategies and service orchestration decisions.