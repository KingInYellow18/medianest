# Architecture Decision Records (ADR)

**MediaNest Authentication System**  
**Version:** 2.0  
**Date:** January 2025  
**Status:** Active

## Table of Contents

1. [ADR-001: Authentication Framework Selection](#adr-001-authentication-framework-selection)
2. [ADR-002: Session Management Strategy](#adr-002-session-management-strategy)
3. [ADR-003: Multi-Factor Authentication Implementation](#adr-003-multi-factor-authentication-implementation)
4. [ADR-004: Password Reset Security Architecture](#adr-004-password-reset-security-architecture)
5. [ADR-005: Horizontal Scaling Strategy](#adr-005-horizontal-scaling-strategy)
6. [ADR-006: Audit Trail and Compliance](#adr-006-audit-trail-and-compliance)
7. [ADR-007: Multi-Provider OAuth Strategy](#adr-007-multi-provider-oauth-strategy)

## ADR-001: Authentication Framework Selection

### Status: Accepted

### Context
MediaNest requires a robust authentication system supporting Plex OAuth, admin bootstrap, and future multi-provider authentication for a homelab environment serving 10-20 users with potential to scale to 100+.

### Decision
Use **NextAuth.js 4.x** with custom Plex OAuth provider implementation.

### Rationale

**Chosen Alternative: NextAuth.js 4.x**
- ✅ Mature, well-maintained authentication framework
- ✅ Built-in support for multiple providers
- ✅ JWT and database session support
- ✅ TypeScript support
- ✅ Active community and documentation

**Rejected Alternatives:**

1. **Custom JWT Implementation**
   - ❌ Requires significant security expertise
   - ❌ Higher maintenance burden
   - ❌ No built-in provider support

2. **Auth0/Firebase Auth**
   - ❌ External dependency for homelab
   - ❌ Recurring costs
   - ❌ Data sovereignty concerns

3. **Passport.js**
   - ❌ More complex setup for React/Next.js
   - ❌ Requires custom session management

### Consequences

**Positive:**
- Rapid development with proven security patterns
- Extensible provider system
- Built-in CSRF protection
- Session management handled

**Negative:**
- Some customization required for Plex PIN-based OAuth
- Framework dependency
- Migration complexity if switching later

### Implementation Notes
```typescript
// Custom Plex provider implementation required
export default function PlexProvider(options: OAuthUserConfig<PlexProfile>) {
  return {
    id: 'plex',
    name: 'Plex',
    type: 'oauth',
    // Custom PIN-based authentication flow
    authorization: { /* Plex-specific config */ }
  };
}
```

---

## ADR-002: Session Management Strategy

### Status: Accepted

### Context
Need scalable session management supporting both single-instance homelab deployment and potential horizontal scaling.

### Decision
Use **Redis-backed JWT sessions** with NextAuth.js JWT strategy.

### Rationale

**Chosen Alternative: Redis + JWT Hybrid**
- ✅ Stateless for horizontal scaling
- ✅ Redis for shared state and session invalidation
- ✅ Fast session validation
- ✅ Supports session management features

**Rejected Alternatives:**

1. **Database Sessions Only**
   - ❌ Database load for every request
   - ❌ Slower session validation
   - ✅ Better for audit trails

2. **Pure JWT (Stateless)**
   - ❌ Cannot invalidate sessions server-side
   - ❌ Token size limitations
   - ✅ True stateless scaling

3. **Memory Sessions**
   - ❌ Not scalable beyond single instance
   - ❌ Data loss on restart

### Architecture

```typescript
// Hybrid approach: JWT for statelessness, Redis for control
interface SessionStrategy {
  storage: 'redis'; // Session metadata
  tokens: 'jwt';    // Stateless authentication
  invalidation: 'server-side'; // Via Redis
  scaling: 'horizontal';
}
```

### Consequences

**Positive:**
- Horizontally scalable
- Fast session validation
- Server-side session control
- Redis clustering support

**Negative:**
- Additional Redis dependency
- Slightly more complex architecture
- Network latency for Redis calls

---

## ADR-003: Multi-Factor Authentication Implementation

### Status: Accepted

### Context
Enhanced security required for admin accounts and optional for users, supporting industry-standard TOTP and backup codes.

### Decision
Implement **TOTP-based 2FA** using `otplib` with encrypted backup codes.

### Rationale

**Chosen Alternative: TOTP + Backup Codes**
- ✅ Industry standard (Google Authenticator, Authy compatible)
- ✅ Offline functionality
- ✅ User-controlled setup
- ✅ Recovery mechanism via backup codes

**Rejected Alternatives:**

1. **SMS-based 2FA**
   - ❌ Requires SMS service integration
   - ❌ SIM swapping vulnerability
   - ❌ Not suitable for homelab

2. **Email-based 2FA**
   - ❌ Email compromise risk
   - ❌ Dependency on email service
   - ❌ Less secure than TOTP

3. **Hardware Keys (WebAuthn)**
   - ❌ Hardware requirements
   - ❌ More complex for homelab users
   - ✅ Could be future enhancement

### Architecture

```typescript
interface TwoFactorArchitecture {
  algorithm: 'TOTP'; // RFC 6238
  secret_encryption: 'AES-256-GCM';
  backup_codes: {
    count: 10;
    format: '8-character-hex';
    one_time_use: true;
  };
  enrollment: 'opt-in'; // Required for admin, optional for users
}
```

### Security Measures
- Secrets encrypted at rest using AES-256-GCM
- Backup codes are one-time use
- Time-based window validation (30-second window)
- Rate limiting on verification attempts

### Consequences

**Positive:**
- Strong security enhancement
- User-friendly with authenticator apps
- Recovery mechanism available
- No external dependencies

**Negative:**
- Additional complexity for users
- Recovery process needed for lost devices
- Encryption key management

---

## ADR-004: Password Reset Security Architecture

### Status: Accepted

### Context
Secure password reset required for admin accounts and future local authentication, preventing enumeration attacks and ensuring token security.

### Decision
Implement **time-limited token-based reset** with email delivery and rate limiting.

### Rationale

**Security Requirements:**
- Prevent email enumeration attacks
- Short-lived tokens (15 minutes)
- Secure token generation and validation
- Rate limiting on reset requests

**Chosen Architecture:**
- Tokens generated using crypto.randomBytes(32)
- Tokens hashed before storage (SHA-256)
- Redis storage with TTL
- Session invalidation on password change

### Implementation

```typescript
interface PasswordResetSecurity {
  token: {
    generation: 'crypto.randomBytes(32)';
    storage: 'sha256-hashed';
    ttl: 900; // 15 minutes
  };
  rate_limiting: {
    attempts_per_email: 3;
    window: 3600; // 1 hour
  };
  email_enumeration_prevention: 'always-success-response';
  session_invalidation: 'all-user-sessions';
}
```

### Consequences

**Positive:**
- Secure against common attack vectors
- Time-limited exposure window
- Rate limiting prevents abuse
- No email enumeration

**Negative:**
- Requires email service integration
- Additional complexity
- Token storage requirements

---

## ADR-005: Horizontal Scaling Strategy

### Status: Accepted

### Context
Architecture must support scaling from homelab (10-20 users) to larger deployments (100+ users) while maintaining performance and session consistency.

### Decision
Implement **distributed session management** with API gateway pattern and Redis clustering support.

### Rationale

**Scaling Requirements:**
- Stateless application instances
- Shared session state
- Load balancing support
- Health monitoring

**Architecture Components:**

```typescript
interface ScalingArchitecture {
  app_instances: 'stateless';
  session_store: 'redis-cluster';
  load_balancer: 'nginx-with-health-checks';
  api_gateway: 'auth-routing-layer';
  monitoring: 'per-node-metrics';
}
```

### Implementation Strategy

1. **Session Distribution**
   - Redis Cluster for session storage
   - Consistent hashing for session routing
   - Session replication across nodes

2. **Load Balancing**
   - Health check endpoints
   - Weighted round-robin routing
   - Failover mechanisms

3. **API Gateway**
   - Authentication routing
   - Rate limiting enforcement
   - Request aggregation

### Consequences

**Positive:**
- Horizontal scalability
- High availability
- Performance optimization
- Fault tolerance

**Negative:**
- Increased complexity
- Additional infrastructure requirements
- Network latency considerations

---

## ADR-006: Audit Trail and Compliance

### Status: Accepted

### Context
Comprehensive audit logging required for security monitoring, compliance, and forensic analysis of authentication events.

### Decision
Implement **dual-storage audit system** with Redis for real-time analysis and PostgreSQL for long-term storage.

### Rationale

**Audit Requirements:**
- All authentication events logged
- Risk scoring for suspicious activity
- Long-term retention (365 days)
- Real-time security monitoring

**Architecture:**

```typescript
interface AuditArchitecture {
  real_time_storage: 'redis';
  long_term_storage: 'postgresql';
  risk_scoring: 'rule-based-with-ml-ready';
  retention: {
    redis: '7-days';
    database: '365-days';
  };
  anonymization: 'gdpr-compliant';
}
```

### Event Types
- Authentication attempts (success/failure)
- Session creation/termination
- Password changes
- 2FA enrollment/usage
- Admin actions
- Suspicious activity

### Risk Scoring Factors
- Failed login attempts
- Geographic anomalies
- Time-based patterns
- Device fingerprinting
- Multiple IP addresses

### Consequences

**Positive:**
- Comprehensive security monitoring
- Compliance support
- Forensic capabilities
- Real-time threat detection

**Negative:**
- Storage overhead
- Processing complexity
- Privacy considerations

---

## ADR-007: Multi-Provider OAuth Strategy

### Status: Accepted

### Context
Support multiple OAuth providers (Plex, GitHub, Google) with consistent user experience and security standards.

### Decision
Implement **provider registry pattern** with unified authentication flow and account linking.

### Rationale

**Provider Requirements:**
- Plex (primary for media server integration)
- GitHub (for developer users)
- Google (for broad compatibility)
- Extensible for future providers

**Architecture:**

```typescript
interface MultiProviderArchitecture {
  primary_provider: 'plex';
  secondary_providers: ['github', 'google'];
  account_linking: 'email-based';
  user_experience: 'unified-signin-page';
  security: 'consistent-across-providers';
}
```

### Implementation Strategy

1. **Provider Registry**
   - Dynamic provider configuration
   - Enable/disable per environment
   - Priority-based ordering

2. **Account Linking**
   - Email-based account matching
   - Secure linking flow
   - Multiple provider support per user

3. **Security Consistency**
   - Same session management
   - Unified rate limiting
   - Consistent audit logging

### Consequences

**Positive:**
- Flexible authentication options
- Better user experience
- Future extensibility
- Consistent security model

**Negative:**
- Increased complexity
- More OAuth app registrations
- Account linking edge cases

---

## Decision Summary

| ADR | Decision | Status | Impact | Complexity |
|-----|----------|--------|---------|------------|
| 001 | NextAuth.js 4.x | ✅ Accepted | High | Medium |
| 002 | Redis + JWT Sessions | ✅ Accepted | High | Medium |
| 003 | TOTP 2FA | ✅ Accepted | Medium | High |
| 004 | Secure Password Reset | ✅ Accepted | Medium | Medium |
| 005 | Horizontal Scaling | ✅ Accepted | High | High |
| 006 | Comprehensive Auditing | ✅ Accepted | Medium | Medium |
| 007 | Multi-Provider OAuth | ✅ Accepted | Medium | High |

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- ADR-001: NextAuth.js integration ✅
- ADR-002: Session management ✅
- ADR-004: Password reset system

### Phase 2: Security Enhancement (Weeks 3-4)
- ADR-003: 2FA implementation
- ADR-006: Audit logging system

### Phase 3: Scalability (Weeks 5-6)
- ADR-005: Horizontal scaling
- ADR-007: Multi-provider support

## Review Schedule

These ADRs should be reviewed:
- **Quarterly**: For relevance and accuracy
- **Before major releases**: For impact assessment
- **When requirements change**: For decision validation

---

**Document Maintainer:** System Architecture Team  
**Last Review:** January 2025  
**Next Review:** April 2025