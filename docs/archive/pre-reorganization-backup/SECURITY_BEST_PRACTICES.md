# MediaNest Security Best Practices Guide

**Version:** 1.0  
**Last Updated:** January 2025  
**Classification:** Internal Documentation

## Table of Contents

- [Security Overview](#security-overview)
- [Authentication & Authorization](#authentication--authorization)
- [Data Protection](#data-protection)
- [API Security](#api-security)
- [Infrastructure Security](#infrastructure-security)
- [Dependency Management](#dependency-management)
- [Monitoring & Incident Response](#monitoring--incident-response)
- [Security Checklist](#security-checklist)
- [Common Vulnerabilities & Mitigations](#common-vulnerabilities--mitigations)

## Security Overview

MediaNest implements defense-in-depth security with multiple layers:

1. **Authentication Layer**: Plex OAuth with JWT sessions
2. **Authorization Layer**: Role-based access control (RBAC)
3. **Transport Layer**: HTTPS/TLS encryption
4. **Application Layer**: Input validation, rate limiting
5. **Data Layer**: Encryption at rest, secure storage
6. **Infrastructure Layer**: Container isolation, firewall rules

### Security Principles

- **Least Privilege**: Users and services have minimal required permissions
- **Defense in Depth**: Multiple security layers protect against failures
- **Zero Trust**: Verify all requests regardless of source
- **Secure by Default**: Security enabled without configuration
- **Fail Secure**: System fails to a secure state on errors

## Authentication & Authorization

### Plex OAuth Implementation

#### Secure PIN Flow

```typescript
// Never expose PIN directly to client
const pin = await plexClient.generatePin();
// Store PIN server-side with expiration
await redis.setex(`pin:${pin.id}`, 600, JSON.stringify(pin));
```

#### Token Storage

```typescript
// Encrypt Plex tokens before storage
const encryptedToken = await encrypt(plexToken, process.env.ENCRYPTION_KEY);
await user.update({ plexToken: encryptedToken });
```

### JWT Session Management

#### Secure Cookie Configuration

```typescript
// backend/src/middleware/auth.ts
const cookieOptions: CookieOptions = {
  httpOnly: true, // Prevent XSS access
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
  domain: process.env.COOKIE_DOMAIN,
};
```

#### Token Rotation

```typescript
// Rotate tokens on sensitive operations
if (isSensitiveOperation(request)) {
  const newToken = generateToken(user);
  response.cookie('session', newToken, cookieOptions);
}
```

### Role-Based Access Control

#### Permission Matrix

| Role  | View Content | Request Media | Admin Panel | Manage Users |
| ----- | ------------ | ------------- | ----------- | ------------ |
| Guest | ❌           | ❌            | ❌          | ❌           |
| User  | ✅           | ✅            | ❌          | ❌           |
| Admin | ✅           | ✅            | ✅          | ✅           |

#### Middleware Implementation

```typescript
// Protect admin routes
router.use('/admin/*', authenticate, requireRole('admin'));

// User-specific resources
router.get('/requests/:id', authenticate, async (req, res) => {
  const request = await getRequest(req.params.id);
  if (request.userId !== req.user.id && req.user.role !== 'admin') {
    throw new ForbiddenError('Access denied');
  }
  res.json(request);
});
```

## Data Protection

### Encryption at Rest

#### Sensitive Data Encryption

```typescript
// Encrypt service credentials
const encryptedApiKey = encrypt(apiKey, process.env.ENCRYPTION_KEY);
await serviceConfig.create({
  service: 'overseerr',
  apiKey: encryptedApiKey,
});
```

#### Database Field Encryption

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   // Stored as hash for lookups
  plexToken    String   // Encrypted
  preferences  Json     // Encrypted if contains sensitive data
}
```

### Secure Password Handling

#### Admin Bootstrap

```typescript
// Hash admin password with bcrypt
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Enforce strong passwords
const passwordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');
```

### Data Sanitization

#### Input Validation

```typescript
// Validate all user inputs
const mediaRequestSchema = z.object({
  title: z.string().min(1).max(255),
  mediaType: z.enum(['movie', 'tv']),
  tmdbId: z.string().regex(/^\d+$/),
  overseerrId: z.string().optional(),
});

// Sanitize outputs
const sanitizeHtml = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  });
};
```

## API Security

### Rate Limiting

#### Configuration

```typescript
// Redis-based rate limiting
const rateLimits = {
  api: { points: 100, duration: 60 }, // 100 req/min
  auth: { points: 10, duration: 60 }, // 10 req/min
  youtube: { points: 5, duration: 3600 }, // 5 req/hour
};

// Apply rate limiting
app.use('/api', createRateLimiter(rateLimits.api));
app.use('/api/v1/auth', createRateLimiter(rateLimits.auth));
```

#### DDoS Protection

```nginx
# Nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_conn_zone $binary_remote_addr zone=addr:10m;

location /api {
    limit_req zone=api burst=20 nodelay;
    limit_conn addr 10;
}
```

### CORS Configuration

```typescript
// Strict CORS policy
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.FRONTEND_URL, 'https://medianest.yourdomain.com'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400, // 24 hours
};
```

### Request Validation

```typescript
// Validate Content-Type
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.is('application/json')) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
  }
  next();
});

// Prevent large payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

## Infrastructure Security

### Container Security

#### Dockerfile Best Practices

```dockerfile
# Use specific versions
FROM node:20.14-alpine AS base

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy only necessary files
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js
```

#### Docker Compose Security

```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### Network Security

#### Firewall Rules

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow specific ports
sudo ufw allow 22/tcp    # SSH (restrict source IP)
sudo ufw allow 80/tcp    # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp   # HTTPS

# Internal services (not exposed)
# PostgreSQL: 5432 (internal only)
# Redis: 6379 (internal only)
# Backend: 4000 (internal only)
# Frontend: 3000 (internal only)
```

#### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# Security headers
add_header Strict-Transport-Security "max-age=63072000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Database Security

#### Connection Security

```typescript
// Use connection pooling with SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Query Security

```typescript
// Always use parameterized queries
const user = await prisma.user.findFirst({
  where: {
    email: userInput, // Prisma handles escaping
    deletedAt: null,
  },
});

// Never use raw queries with user input
// BAD: prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`
// GOOD: Use Prisma ORM methods
```

## Dependency Management

### Vulnerability Scanning

```json
// package.json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:check": "npm run security:audit && npm run security:snyk",
    "security:snyk": "snyk test"
  }
}
```

### Automated Updates

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    security-updates-only: true
    reviewers:
      - 'security-team'
```

### Supply Chain Security

```bash
# Lock file integrity
npm ci --prefer-offline --no-audit

# Verify package signatures
npm install --ignore-scripts
npm run postinstall --if-present
```

## Monitoring & Incident Response

### Security Logging

```typescript
// Log security events
logger.security({
  event: 'authentication_failure',
  userId: attemptedUserId,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
});

// Alert on suspicious activity
if (failedAttempts > 5) {
  alerting.send({
    level: 'warning',
    message: `Multiple failed login attempts from ${req.ip}`,
  });
}
```

### Audit Trail

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String
  resource  String
  before    Json?
  after     Json?
  ip        String
  userAgent String
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
}
```

### Incident Response Plan

1. **Detection**
   - Monitor logs for anomalies
   - Set up alerts for security events
   - Regular security scans

2. **Containment**
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs

3. **Eradication**
   - Patch vulnerabilities
   - Remove malicious code
   - Update security rules

4. **Recovery**
   - Restore from clean backups
   - Verify system integrity
   - Monitor for recurrence

5. **Lessons Learned**
   - Document incident
   - Update security procedures
   - Implement preventive measures

## Security Checklist

### Development

- [ ] All inputs validated with Zod schemas
- [ ] SQL injection prevented via ORM
- [ ] XSS prevented via React escaping
- [ ] CSRF tokens implemented
- [ ] Sensitive data encrypted
- [ ] Error messages don't leak information
- [ ] Dependencies up to date
- [ ] Security headers configured

### Deployment

- [ ] HTTPS enforced everywhere
- [ ] Secrets in environment/files (not code)
- [ ] Default passwords changed
- [ ] Firewall rules configured
- [ ] Container security applied
- [ ] Database connections encrypted
- [ ] Logs don't contain sensitive data
- [ ] Backups encrypted

### Operations

- [ ] Security patches applied regularly
- [ ] Access logs monitored
- [ ] Failed auth attempts tracked
- [ ] Rate limiting active
- [ ] SSL certificates valid
- [ ] Incident response plan tested
- [ ] Security audits scheduled
- [ ] Penetration testing performed

## Common Vulnerabilities & Mitigations

### 1. Injection Attacks

**Risk**: SQL/NoSQL injection, command injection  
**Mitigation**:

- Use Prisma ORM for all database queries
- Validate inputs with Zod schemas
- Never use eval() or exec() with user input
- Escape shell arguments when necessary

### 2. Broken Authentication

**Risk**: Session hijacking, credential stuffing  
**Mitigation**:

- Secure cookie configuration
- Token rotation on sensitive operations
- Account lockout after failed attempts
- Multi-factor authentication (future)

### 3. Sensitive Data Exposure

**Risk**: Data leaks, insufficient encryption  
**Mitigation**:

- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Mask sensitive data in logs
- Secure key management

### 4. XML External Entities (XXE)

**Risk**: XXE attacks through XML parsing  
**Mitigation**:

- Disable XML external entity processing
- Use JSON instead of XML
- Validate XML schemas strictly

### 5. Broken Access Control

**Risk**: Unauthorized access to resources  
**Mitigation**:

- Implement RBAC consistently
- Verify ownership on all operations
- Default deny access policy
- Regular permission audits

### 6. Security Misconfiguration

**Risk**: Default configs, unnecessary features  
**Mitigation**:

- Security hardening checklist
- Remove default accounts
- Disable unnecessary features
- Regular configuration reviews

### 7. Cross-Site Scripting (XSS)

**Risk**: Script injection, DOM manipulation  
**Mitigation**:

- React's automatic escaping
- Content Security Policy headers
- Input validation and sanitization
- Avoid dangerouslySetInnerHTML

### 8. Insecure Deserialization

**Risk**: Remote code execution, replay attacks  
**Mitigation**:

- Validate serialized data
- Use simple data types
- Sign serialized objects
- Implement integrity checks

### 9. Using Components with Known Vulnerabilities

**Risk**: Exploits in dependencies  
**Mitigation**:

- Regular dependency updates
- Automated vulnerability scanning
- Security advisories monitoring
- Dependency pinning

### 10. Insufficient Logging & Monitoring

**Risk**: Undetected breaches, slow response  
**Mitigation**:

- Comprehensive security logging
- Real-time alerting
- Log analysis and correlation
- Regular security reviews

---

## Security Contacts

**Security Issues**: security@medianest.example.com  
**Security Updates**: Subscribe to security mailing list  
**Bug Bounty**: See SECURITY.md for responsible disclosure

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
