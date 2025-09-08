# MediaNest Security Operations Guide

**Classification**: Confidential  
**Security Level**: Production Critical  
**Last Updated**: September 8, 2025  
**Review Cycle**: Quarterly

## 🔐 Security Architecture Overview

MediaNest implements defense-in-depth security architecture with multiple layers of protection across the entire technology stack.

### Security Domains

1. **Application Security**: Code-level security measures
2. **Infrastructure Security**: Container and orchestration security
3. **Network Security**: Traffic protection and segmentation
4. **Data Security**: Encryption and access control
5. **Identity & Access**: Authentication and authorization
6. **Monitoring & Response**: Threat detection and incident response

## 🛡️ Authentication & Authorization

### JWT Token Security

#### Token Configuration

```typescript
interface JWTConfig {
  // Token settings
  algorithm: 'HS256' | 'RS256'; // Use RS256 for production
  expiresIn: '15m'; // Short-lived access tokens
  refreshExpiresIn: '7d'; // Longer-lived refresh tokens

  // Cookie security
  httpOnly: true; // Prevent XSS attacks
  secure: true; // HTTPS only
  sameSite: 'strict'; // CSRF protection

  // Token rotation
  rotateRefreshToken: true; // Rotate on each use
  blacklistOnLogout: true; // Invalidate on logout
}
```

#### Token Management

```bash
# Generate new signing keys
openssl genpkey -algorithm RSA -out private_key.pem -pkcs8 -aes256
openssl rsa -pubout -in private_key.pem -out public_key.pem

# Rotate keys every 90 days
./scripts/rotate-jwt-keys.sh --backup --notify-team
```

### Plex OAuth Integration

#### Security Configuration

1. **OAuth Scope Limitation**: Request minimal required permissions
2. **Token Validation**: Verify token with Plex servers
3. **Rate Limiting**: Limit OAuth requests per IP/user
4. **Session Binding**: Bind OAuth tokens to specific sessions

#### Plex Security Checks

```typescript
interface PlexSecurityValidation {
  // Server validation
  validatePlexServer(serverUrl: string): Promise<boolean>;
  checkServerSecurity(server: PlexServer): Promise<SecurityReport>;

  // Token validation
  validatePlexToken(token: string): Promise<TokenValidation>;
  checkTokenPermissions(token: string): Promise<Permission[]>;

  // User validation
  validatePlexUser(userId: string): Promise<UserValidation>;
  checkUserAccess(user: PlexUser, resource: string): Promise<boolean>;
}
```

### Role-Based Access Control (RBAC)

#### Permission Matrix

```yaml
roles:
  admin:
    permissions:
      - user:*
      - system:*
      - media:*
      - security:*

  moderator:
    permissions:
      - user:read
      - user:moderate
      - media:*
      - system:read

  user:
    permissions:
      - user:read:self
      - user:update:self
      - media:read
      - media:search

  guest:
    permissions:
      - media:read:public
      - system:health
```

#### Access Control Implementation

```typescript
class AccessControl {
  // Permission checking
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.getUserWithRoles(userId);
    const required = `${resource}:${action}`;

    return user.roles.some(
      (role) =>
        this.rolePermissions[role].includes(required) ||
        this.rolePermissions[role].includes(`${resource}:*`)
    );
  }

  // Resource-based access
  async checkResourceAccess(userId: string, resourceId: string, action: string): Promise<boolean> {
    const ownership = await this.checkOwnership(userId, resourceId);
    const permission = await this.checkPermission(userId, 'resource', action);

    return ownership || permission;
  }
}
```

## 🔒 Data Protection

### Encryption Standards

#### Data at Rest

```yaml
encryption:
  database:
    algorithm: AES-256-GCM
    key_rotation: 90_days
    key_management: AWS_KMS

  file_storage:
    algorithm: AES-256-CBC
    key_derivation: PBKDF2
    iterations: 100000

  backups:
    algorithm: AES-256-GCM
    compression: true
    integrity_check: SHA-256
```

#### Data in Transit

```yaml
tls_configuration:
  minimum_version: TLS_1.2
  preferred_version: TLS_1.3
  cipher_suites:
    - ECDHE-ECDSA-AES256-GCM-SHA384
    - ECDHE-RSA-AES256-GCM-SHA384
    - ECDHE-ECDSA-CHACHA20-POLY1305

  certificate:
    type: RSA_2048_or_ECDSA_P256
    validity: 90_days
    auto_renewal: true
```

### Sensitive Data Handling

#### Personal Identifiable Information (PII)

1. **Data Minimization**: Collect only necessary PII
2. **Purpose Limitation**: Use data only for stated purposes
3. **Retention Policies**: Delete data when no longer needed
4. **Access Controls**: Restrict PII access to authorized personnel

#### Secrets Management

```typescript
interface SecretsManager {
  // Secret storage
  storeSecret(key: string, value: string, ttl?: number): Promise<void>;
  retrieveSecret(key: string): Promise<string | null>;
  rotateSecret(key: string): Promise<void>;

  // Secret rotation
  scheduleRotation(key: string, interval: Duration): Promise<void>;
  validateSecretIntegrity(key: string): Promise<boolean>;

  // Audit logging
  auditSecretAccess(key: string, user: string, action: string): Promise<void>;
}
```

#### Database Security

```sql
-- Encrypted columns
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    plex_token TEXT ENCRYPTED,  -- Encrypted sensitive data
    created_at TIMESTAMP DEFAULT NOW()
);

-- Row-level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users
    FOR ALL TO application_role
    USING (id = current_setting('app.current_user_id')::uuid);

-- Audit trail
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(50),
    resource VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);
```

## 🚨 Security Monitoring & Incident Response

### Threat Detection

#### Security Events Monitoring

```yaml
security_events:
  authentication:
    - failed_login_attempts
    - suspicious_login_patterns
    - privilege_escalation_attempts
    - token_manipulation

  application:
    - sql_injection_attempts
    - xss_attempts
    - path_traversal_attempts
    - unusual_api_usage

  infrastructure:
    - unusual_network_traffic
    - container_breakout_attempts
    - unauthorized_file_access
    - resource_exhaustion
```

#### Automated Response Actions

```typescript
interface SecurityResponse {
  // Immediate actions
  blockIpAddress(ip: string, duration: number): Promise<void>;
  suspendUserAccount(userId: string, reason: string): Promise<void>;
  invalidateUserSessions(userId: string): Promise<void>;

  // Escalation
  alertSecurityTeam(incident: SecurityIncident): Promise<void>;
  createSecurityTicket(incident: SecurityIncident): Promise<string>;

  // Evidence collection
  collectLogs(timeRange: TimeRange, filters: LogFilter[]): Promise<LogEntry[]>;
  captureNetworkTrace(duration: number): Promise<NetworkTrace>;
}
```

### Incident Response Procedures

#### Security Incident Classification

```yaml
severity_levels:
  critical:
    description: 'Active security breach or data exposure'
    response_time: 15_minutes
    escalation: 'CISO, Legal, PR team'
    examples:
      - Data breach
      - Ransomware attack
      - Privilege escalation exploit

  high:
    description: 'Potential security vulnerability'
    response_time: 1_hour
    escalation: 'Security team, Engineering manager'
    examples:
      - Failed authentication spike
      - Suspicious API usage
      - Malware detection

  medium:
    description: 'Security policy violation'
    response_time: 4_hours
    escalation: 'Security team'
    examples:
      - Policy violations
      - Unusual user behavior
      - Configuration drift

  low:
    description: 'Security monitoring alert'
    response_time: 24_hours
    escalation: 'On-call engineer'
    examples:
      - Log analysis alerts
      - Compliance check failures
      - Performance anomalies
```

#### Incident Response Playbook

```bash
#!/bin/bash
# Security incident response script

INCIDENT_ID=$(uuidgen)
INCIDENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. Immediate containment
echo "🚨 SECURITY INCIDENT: $INCIDENT_ID"
echo "⏰ Time: $INCIDENT_TIME"

# Isolate affected systems
kubectl cordon affected-node
kubectl drain affected-node --ignore-daemonsets --force

# Block suspicious IPs
iptables -A INPUT -s $SUSPICIOUS_IP -j DROP

# 2. Evidence collection
mkdir -p /var/log/incidents/$INCIDENT_ID
kubectl logs --all-containers=true --since=1h > /var/log/incidents/$INCIDENT_ID/pod-logs.txt
netstat -tuln > /var/log/incidents/$INCIDENT_ID/network-connections.txt

# 3. Notification
curl -X POST $SLACK_WEBHOOK \
  -d "{\"text\":\"🚨 Security incident $INCIDENT_ID - immediate attention required\"}"

# 4. Assessment
./scripts/security-assessment.sh --incident-id $INCIDENT_ID
```

### Vulnerability Management

#### Vulnerability Scanning

```yaml
scanning_schedule:
  code_analysis:
    tool: SonarQube
    frequency: 'on_commit'
    severity_threshold: 'high'

  dependency_scanning:
    tool: 'npm audit, Snyk'
    frequency: 'daily'
    auto_fix: 'patch_level_only'

  container_scanning:
    tool: 'Trivy, Grype'
    frequency: 'on_build'
    fail_on: 'critical'

  infrastructure_scanning:
    tool: 'Nessus, OpenVAS'
    frequency: 'weekly'
    scope: 'production_network'
```

#### Patch Management

```typescript
interface PatchManagement {
  // Vulnerability assessment
  assessVulnerability(vuln: Vulnerability): Promise<RiskAssessment>;
  prioritizePatches(vulnerabilities: Vulnerability[]): Promise<PatchPlan>;

  // Patch deployment
  createPatchPlan(vulnerabilities: Vulnerability[]): Promise<PatchPlan>;
  testPatch(patch: Patch, environment: Environment): Promise<TestResult>;
  deployPatch(patch: Patch, environment: Environment): Promise<DeployResult>;

  // Rollback capability
  createRollbackPlan(patch: Patch): Promise<RollbackPlan>;
  executeRollback(plan: RollbackPlan): Promise<void>;
}
```

## 🔍 Security Auditing & Compliance

### Audit Logging

#### Comprehensive Audit Trail

```typescript
interface AuditLogger {
  // Authentication events
  logLogin(userId: string, success: boolean, metadata: LoginMetadata): Promise<void>;
  logLogout(userId: string, metadata: LogoutMetadata): Promise<void>;
  logPermissionChange(userId: string, changes: PermissionChange[]): Promise<void>;

  // Data access events
  logDataAccess(userId: string, resource: string, action: string): Promise<void>;
  logDataModification(userId: string, resource: string, changes: any): Promise<void>;
  logSensitiveDataAccess(userId: string, dataType: string): Promise<void>;

  // System events
  logConfigurationChange(userId: string, config: string, change: any): Promise<void>;
  logSecurityEvent(event: SecurityEvent): Promise<void>;
  logSystemAccess(userId: string, system: string, action: string): Promise<void>;
}
```

#### Audit Log Protection

```sql
-- Immutable audit logs
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
    user_id UUID,
    event_type VARCHAR(50) NOT NULL,
    resource VARCHAR(100),
    action VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    checksum VARCHAR(64) -- Integrity verification
);

-- Prevent modifications
ALTER TABLE audit_events ADD CONSTRAINT immutable_audit
    CHECK (created_at IS NOT NULL AND created_at <= NOW());

-- Regular integrity checks
CREATE OR REPLACE FUNCTION verify_audit_integrity()
RETURNS BOOLEAN AS $$
BEGIN
    -- Verify checksums
    RETURN (SELECT COUNT(*) = 0 FROM audit_events
            WHERE checksum != encode(sha256(
                (id || timestamp || user_id || event_type ||
                 COALESCE(resource, '') || COALESCE(action, ''))::bytea
            ), 'hex'));
END;
$$ LANGUAGE plpgsql;
```

### Compliance Framework

#### GDPR Compliance

```typescript
interface GDPRCompliance {
  // Data subject rights
  exportUserData(userId: string): Promise<UserDataExport>;
  deleteUserData(userId: string, reason: string): Promise<DeletionReport>;
  correctUserData(userId: string, corrections: DataCorrection[]): Promise<void>;

  // Consent management
  recordConsent(userId: string, purpose: string, consent: boolean): Promise<void>;
  getConsentHistory(userId: string): Promise<ConsentRecord[]>;
  processConsentWithdrawal(userId: string, purpose: string): Promise<void>;

  // Data processing
  documentProcessingActivity(activity: ProcessingActivity): Promise<void>;
  performDataProtectionImpactAssessment(activity: ProcessingActivity): Promise<DPIAResult>;
}
```

#### SOC2 Compliance

```yaml
soc2_controls:
  security:
    - access_controls
    - vulnerability_management
    - incident_response
    - security_monitoring

  availability:
    - system_monitoring
    - backup_procedures
    - disaster_recovery
    - capacity_management

  processing_integrity:
    - data_validation
    - error_handling
    - system_monitoring
    - change_management

  confidentiality:
    - data_classification
    - encryption_standards
    - access_restrictions
    - data_handling_procedures

  privacy:
    - data_collection_limitation
    - purpose_specification
    - use_limitation
    - retention_policies
```

## 🔧 Security Configuration

### Application Security Headers

```typescript
interface SecurityHeaders {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains';
  'Content-Security-Policy': string; // Restrictive CSP
  'X-Frame-Options': 'DENY';
  'X-Content-Type-Options': 'nosniff';
  'X-XSS-Protection': '1; mode=block';
  'Referrer-Policy': 'strict-origin-when-cross-origin';
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()';
}

// CSP Configuration
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://trusted-cdn.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.medianest.app",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');
```

### Rate Limiting Configuration

```typescript
interface RateLimitingConfig {
  // Global limits
  global: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 1000,                 // requests per window
    standardHeaders: true,
    legacyHeaders: false
  },

  // API-specific limits
  api: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                  // requests per window per IP
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Authentication limits
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                    // login attempts per window
    skipSuccessfulRequests: true,
    onLimitReached: 'block_ip'
  }
}
```

### Container Security

```yaml
# Security-hardened container
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
  seccompProfile:
    type: RuntimeDefault

# Pod security standards
podSecurityContext:
  fsGroup: 1000
  supplementalGroups: [1000]
  seccompProfile:
    type: RuntimeDefault

# Network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: medianest-network-policy
spec:
  podSelector:
    matchLabels:
      app: medianest
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx-ingress
      ports:
        - protocol: TCP
          port: 4000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
```

## 📚 Security Training & Awareness

### Developer Security Guidelines

1. **Secure Coding Practices**: OWASP Top 10 awareness
2. **Code Review Security**: Security-focused code reviews
3. **Dependency Management**: Regular dependency updates
4. **Secret Management**: Never commit secrets to version control

### Security Incident Drills

- **Monthly**: Incident response table-top exercises
- **Quarterly**: Full incident response simulation
- **Annually**: Disaster recovery and business continuity testing

### Security Metrics & KPIs

- **Mean Time to Detection (MTTD)**: < 5 minutes
- **Mean Time to Response (MTTR)**: < 15 minutes
- **Security Training Completion**: 100% annually
- **Vulnerability Remediation**: 95% within SLA

---

**Generated by**: MediaNest SWARM Security Agent  
**Classification**: Confidential  
**Next Security Review**: October 8, 2025  
**Approval**: CISO Required
