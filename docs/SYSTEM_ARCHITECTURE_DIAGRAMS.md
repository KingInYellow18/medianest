# MediaNest System Architecture Diagrams

**Version:** 2.0  
**Date:** January 2025  
**Status:** Enhanced Architecture Review  

## Table of Contents

1. [Enhanced Authentication Flow](#enhanced-authentication-flow)
2. [Distributed Session Architecture](#distributed-session-architecture)
3. [Multi-Provider OAuth Integration](#multi-provider-oauth-integration)
4. [Security Architecture Overview](#security-architecture-overview)
5. [Horizontal Scaling Architecture](#horizontal-scaling-architecture)
6. [Audit Trail and Monitoring](#audit-trail-and-monitoring)

## Enhanced Authentication Flow

### Current Implementation (Plex OAuth + Admin Bootstrap)
```mermaid
graph TB
    subgraph "User Authentication Journey"
        A[User Accesses MediaNest] --> B{First Run?}
        B -->|Yes| C[Admin Bootstrap Available]
        B -->|No| D[Plex OAuth Only]
        
        C --> E[Admin Login: admin/admin]
        E --> F[Force Password Change]
        F --> G[Admin Dashboard]
        
        D --> H[Plex OAuth PIN Flow]
        H --> I[Generate PIN via Plex API]
        I --> J[Display PIN to User]
        J --> K[User Enters PIN at plex.tv/link]
        K --> L{PIN Verified?}
        L -->|No| M[Retry or Timeout]
        L -->|Yes| N[Fetch Plex User Data]
        N --> O[Create/Update User in DB]
        O --> P[Generate JWT Session]
        P --> Q[Store Session in Redis]
        Q --> R[User Dashboard]
        
        M --> H
    end
    
    subgraph "Session Management"
        P --> S[NextAuth JWT Strategy]
        Q --> T[Redis Session Store]
        S --> U[30-day Session TTL]
        T --> V[Session Cleanup Job]
    end
    
    subgraph "Security Controls"
        G --> W[Admin Role Permissions]
        R --> X[User Role Permissions]
        W --> Y[Access Control Middleware]
        X --> Y
        Y --> Z[Rate Limiting]
    end
```

### Enhanced Authentication Flow (Future Implementation)
```mermaid
graph TB
    subgraph "Multi-Provider Authentication"
        A[User Access] --> B[Authentication Options]
        B --> C[Plex OAuth]
        B --> D[GitHub OAuth]  
        B --> E[Google OAuth]
        B --> F[Local Account]
        
        C --> G[Plex PIN Flow]
        D --> H[GitHub OAuth Flow]
        E --> I[Google OAuth Flow]
        F --> J[Email/Password + 2FA]
        
        G --> K[Account Linking Check]
        H --> K
        I --> K
        J --> K
        
        K --> L{Account Exists?}
        L -->|Yes| M[Link Accounts]
        L -->|No| N[Create New Account]
        
        M --> O[Unified User Profile]
        N --> O
    end
    
    subgraph "Enhanced Security"
        O --> P{2FA Enabled?}
        P -->|Yes| Q[TOTP Verification]
        P -->|No| R[Session Creation]
        Q --> S{2FA Valid?}
        S -->|Yes| R
        S -->|No| T[Authentication Failed]
        
        R --> U[Risk Assessment]
        U --> V{Suspicious Activity?}
        V -->|Yes| W[Additional Verification]
        V -->|No| X[Grant Access]
        W --> X
    end
    
    subgraph "Session & Audit"
        X --> Y[Distributed Session Creation]
        Y --> Z[Audit Event Logging]
        Z --> AA[User Dashboard]
    end
```

## Distributed Session Architecture

### Current Session Management
```mermaid
graph LR
    subgraph "Single Instance Architecture"
        A[Next.js App] --> B[NextAuth Session]
        B --> C[JWT Strategy]
        C --> D[Redis Session Store]
        D --> E[Session Validation]
        E --> F[User Request Processing]
    end
    
    subgraph "Session Data Flow"
        G[User Login] --> H[JWT Creation]
        H --> I[Redis Storage]
        I --> J[Session Metadata]
        J --> K[30-day TTL]
        K --> L[Cleanup Job]
    end
```

### Enhanced Distributed Session Architecture
```mermaid
graph TB
    subgraph "Load Balancer Layer"
        A[NGINX Load Balancer] --> B[Health Check Endpoints]
        A --> C[Session Affinity]
        A --> D[SSL Termination]
    end
    
    subgraph "Application Layer"
        B --> E[Node 1: Auth Service]
        B --> F[Node 2: Auth Service]
        B --> G[Node 3: Auth Service]
        
        E --> H[Session Manager]
        F --> I[Session Manager] 
        G --> J[Session Manager]
    end
    
    subgraph "Distributed Session Store"
        H --> K[Redis Cluster]
        I --> K
        J --> K
        
        K --> L[Session Shard 1]
        K --> M[Session Shard 2]
        K --> N[Session Shard 3]
        
        L --> O[Replication]
        M --> P[Replication]
        N --> Q[Replication]
    end
    
    subgraph "Session Distribution Logic"
        K --> R[Consistent Hashing]
        R --> S[Session Routing]
        S --> T[Node Selection]
        T --> U[Load Balancing]
    end
    
    subgraph "Monitoring & Health"
        U --> V[Session Metrics]
        V --> W[Node Health Status]
        W --> X[Auto-scaling Triggers]
        X --> Y[Session Redistribution]
    end
```

## Multi-Provider OAuth Integration

### OAuth Provider Registry Architecture
```mermaid
graph TB
    subgraph "OAuth Provider Registry"
        A[Authentication Request] --> B[Provider Selection]
        B --> C{Provider Available?}
        C -->|No| D[Fallback Provider]
        C -->|Yes| E[Provider Handler]
        
        E --> F[Plex Handler]
        E --> G[GitHub Handler]
        E --> H[Google Handler]
        E --> I[Custom Provider Handler]
        
        F --> J[Plex PIN Flow]
        G --> K[GitHub OAuth 2.0]
        H --> L[Google OAuth 2.0]
        I --> M[Custom OAuth Flow]
    end
    
    subgraph "Provider Configuration"
        N[Provider Config] --> O[Client ID/Secret]
        N --> P[Scopes & Permissions]
        N --> Q[Callback URLs]
        N --> R[Priority & Availability]
        
        O --> S[Environment Variables]
        P --> T[Security Policies]
        Q --> U[Route Configuration]
        R --> V[Load Balancing]
    end
    
    subgraph "Account Linking"
        J --> W[User Profile Extraction]
        K --> W
        L --> W
        M --> W
        
        W --> X[Email-based Matching]
        X --> Y{Existing Account?}
        Y -->|Yes| Z[Link Provider]
        Y -->|No| AA[Create New Account]
        
        Z --> BB[Update User Profile]
        AA --> BB
        BB --> CC[Unified Authentication]
    end
```

## Security Architecture Overview

### Defense in Depth Security Model
```mermaid
graph TB
    subgraph "Network Security Layer"
        A[Internet] --> B[Firewall/WAF]
        B --> C[DDoS Protection]
        C --> D[SSL/TLS Termination]
        D --> E[Rate Limiting]
    end
    
    subgraph "Application Security Layer"
        E --> F[NGINX Reverse Proxy]
        F --> G[Authentication Gateway]
        G --> H[Authorization Middleware]
        H --> I[CSRF Protection]
        I --> J[XSS Prevention]
    end
    
    subgraph "Authentication Security"
        J --> K[Multi-Provider OAuth]
        K --> L[2FA/MFA Verification]
        L --> M[Session Security]
        M --> N[JWT Validation]
        N --> O[Role-based Access Control]
    end
    
    subgraph "Data Protection Layer"
        O --> P[Input Validation]
        P --> Q[SQL Injection Prevention]
        Q --> R[Data Encryption at Rest]
        R --> S[Secure Session Storage]
        S --> T[Audit Trail Logging]
    end
    
    subgraph "Monitoring & Response"
        T --> U[Security Event Detection]
        U --> V[Anomaly Analysis]
        V --> W[Risk Scoring]
        W --> X[Automated Response]
        X --> Y[Security Alerting]
    end
```

### Enhanced Authentication Security Flow
```mermaid
sequenceDiagram
    participant U as User
    participant LB as Load Balancer
    participant AG as Auth Gateway
    participant AS as Auth Service
    participant RS as Redis Session
    participant DB as Database
    participant AL as Audit Logger
    
    U->>LB: Authentication Request
    LB->>AG: Route to Auth Gateway
    AG->>AG: Rate Limit Check
    
    alt Rate Limit Exceeded
        AG->>U: 429 Too Many Requests
        AG->>AL: Log Rate Limit Event
    else Rate Limit OK
        AG->>AS: Forward Auth Request
        AS->>AS: Provider Selection
        
        alt Plex OAuth
            AS->>AS: Generate PIN
            AS->>U: Return PIN Code
            U->>U: Enter PIN at plex.tv
            AS->>AS: Poll PIN Status
            AS->>AS: Validate Plex Token
        else Other OAuth
            AS->>AS: Standard OAuth Flow
        end
        
        AS->>DB: Create/Update User
        AS->>RS: Store Session
        AS->>AL: Log Auth Success
        AS->>U: Return JWT Token
        
        U->>AG: API Request with JWT
        AG->>RS: Validate Session
        RS->>AG: Session Valid
        AG->>AS: Authorized Request
        AS->>U: Response
        AS->>AL: Log API Access
    end
```

## Horizontal Scaling Architecture

### Multi-Node Deployment Architecture
```mermaid
graph TB
    subgraph "External Load Balancer"
        A[DNS/CDN] --> B[NGINX Load Balancer]
        B --> C[Health Checks]
        B --> D[SSL Termination]
        B --> E[Request Routing]
    end
    
    subgraph "Application Cluster"
        E --> F[Auth Node 1]
        E --> G[Auth Node 2] 
        E --> H[Auth Node 3]
        E --> I[Auth Node N]
        
        F --> J[NextAuth Service]
        G --> K[NextAuth Service]
        H --> L[NextAuth Service]
        I --> M[NextAuth Service]
    end
    
    subgraph "Shared Session Layer"
        J --> N[Redis Cluster]
        K --> N
        L --> N
        M --> N
        
        N --> O[Master Node 1]
        N --> P[Master Node 2]
        N --> Q[Master Node 3]
        
        O --> R[Replica Node 1]
        P --> S[Replica Node 2]
        Q --> T[Replica Node 3]
    end
    
    subgraph "Database Layer"
        R --> U[PostgreSQL Primary]
        S --> U
        T --> U
        
        U --> V[Read Replica 1]
        U --> W[Read Replica 2]
        V --> X[Backup Storage]
        W --> X
    end
    
    subgraph "Monitoring & Management"
        F --> Y[Metrics Collection]
        G --> Y
        H --> Y
        I --> Y
        
        Y --> Z[Prometheus/Grafana]
        Z --> AA[Alerting System]
        AA --> BB[Auto-scaling Controller]
        BB --> CC[Node Management]
    end
```

### Session Synchronization Flow
```mermaid
sequenceDiagram
    participant U as User
    participant LB as Load Balancer
    participant N1 as Node 1
    participant N2 as Node 2
    participant RC as Redis Cluster
    participant SM as Session Manager
    
    U->>LB: Login Request
    LB->>N1: Route to Node 1
    N1->>RC: Create Session
    RC->>SM: Distributed Storage
    SM->>RC: Confirm Storage
    RC->>N1: Session Created
    N1->>U: Authentication Success
    
    Note over U,SM: User makes subsequent request
    
    U->>LB: API Request
    LB->>N2: Route to Node 2 (different node)
    N2->>RC: Validate Session
    RC->>SM: Fetch Session Data
    SM->>RC: Return Session
    RC->>N2: Session Valid
    N2->>U: Process Request
    
    Note over N1,N2: Session accessible from any node
    
    N1->>SM: Session Update
    SM->>RC: Propagate Changes
    RC->>N2: Session Synchronized
```

## Audit Trail and Monitoring

### Comprehensive Audit Architecture
```mermaid
graph TB
    subgraph "Event Sources"
        A[Authentication Events] --> D[Audit Collector]
        B[Session Events] --> D
        C[Authorization Events] --> D
        E[Security Events] --> D
        F[Admin Actions] --> D
        G[System Events] --> D
    end
    
    subgraph "Event Processing"
        D --> H[Event Validator]
        H --> I[Risk Scorer]
        I --> J[Event Enricher]
        J --> K[Anomaly Detector]
    end
    
    subgraph "Storage Layer"
        K --> L[Redis Cache]
        K --> M[PostgreSQL DB]
        
        L --> N[Real-time Analysis]
        M --> O[Long-term Storage]
        
        N --> P[7-day Retention]
        O --> Q[365-day Retention]
    end
    
    subgraph "Analysis & Alerting"
        N --> R[Pattern Recognition]
        R --> S[Threat Detection]
        S --> T[Security Alerts]
        
        O --> U[Compliance Reports]
        U --> V[Audit Dashboards]
        V --> W[Executive Reports]
    end
    
    subgraph "Response System"
        T --> X[Automated Response]
        T --> Y[Manual Investigation]
        
        X --> Z[Account Lockout]
        X --> AA[IP Blocking]
        X --> BB[Session Termination]
        
        Y --> CC[Security Team Alert]
        Y --> DD[Incident Tracking]
    end
```

### Security Monitoring Dashboard Architecture
```mermaid
graph LR
    subgraph "Data Collection"
        A[Authentication Logs] --> E[Log Aggregator]
        B[Session Metrics] --> E
        C[Security Events] --> E
        D[Performance Metrics] --> E
    end
    
    subgraph "Processing Pipeline"
        E --> F[Data Normalizer]
        F --> G[Metric Calculator]
        G --> H[Threshold Monitor]
        H --> I[Alert Generator]
    end
    
    subgraph "Visualization"
        I --> J[Real-time Dashboard]
        I --> K[Security Overview]
        I --> L[Performance Metrics]
        I --> M[Compliance Status]
    end
    
    subgraph "Key Metrics"
        J --> N[Auth Success Rate: 99.5%+]
        J --> O[Session Duration: 24h avg]
        J --> P[Failed Login Rate: <0.1%]
        J --> Q[2FA Adoption: 85%+]
        J --> R[Risk Score Dist.]
    end
```

## Implementation Architecture Summary

### Technology Stack Integration
```mermaid
mindmap
  root((MediaNest Auth Architecture))
    Frontend
      Next.js 14.x
      NextAuth.js 4.x
      TypeScript
      Tailwind CSS
      React Hook Form
    
    Backend
      Express.js
      Prisma ORM
      PostgreSQL
      Redis Cluster
      Bull Queue
    
    Security
      JWT Tokens
      AES-256-GCM
      TOTP 2FA
      Rate Limiting
      Audit Logging
    
    Infrastructure  
      Docker Containers
      NGINX Load Balancer
      Redis Clustering
      Health Monitoring
      Auto-scaling
    
    Providers
      Plex OAuth
      GitHub OAuth
      Google OAuth
      Local Auth
      Account Linking
```

### Deployment Architecture
```mermaid
graph TB
    subgraph "Production Environment"
        A[Domain: medianest.example.com] --> B[Cloudflare CDN/WAF]
        B --> C[NGINX Load Balancer]
        C --> D[MediaNest App Cluster]
        
        D --> E[App Instance 1]
        D --> F[App Instance 2]
        D --> G[App Instance N]
        
        E --> H[Redis Cluster]
        F --> H
        G --> H
        
        H --> I[PostgreSQL Primary]
        I --> J[PostgreSQL Replica]
    end
    
    subgraph "Monitoring Stack"
        K[Prometheus] --> L[Grafana]
        L --> M[Alert Manager]
        M --> N[PagerDuty/Email]
        
        E --> K
        F --> K
        G --> K
        H --> K
        I --> K
    end
    
    subgraph "Security Services"
        O[Audit Collector] --> P[SIEM System]
        P --> Q[Security Dashboard]
        Q --> R[Incident Response]
        
        E --> O
        F --> O
        G --> O
    end
```

---

**Document Status:** Enhanced Architecture Review Complete  
**Next Review:** Architecture diagrams should be updated when implementing new phases  
**Maintainer:** System Architecture Team