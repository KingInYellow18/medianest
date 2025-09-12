# MEDIANEST Alert Configuration Summary

## Overview
This document provides a comprehensive overview of the alert configuration for the MEDIANEST PLG (Prometheus, Loki, Grafana) observability stack.

## Alert Categories

### 1. Application Alerts (`alerts/application-alerts.yml`)
**Critical business logic and API health monitoring**

#### Authentication & Security
- `AuthServiceDown` - Authentication service unavailability (Critical)
- `HighAuthFailureRate` - High authentication failure rate (Critical)
- `SuspiciousAuthActivity` - Rate limiting on auth endpoints (Warning)

#### API Performance
- `CriticalAPIResponseTime` - 95th percentile > 2s (Critical)
- `HighAPIErrorRate` - Server error rate > 1% (Critical)
- `MediaControllerErrors` - Media endpoint errors (Warning)

#### Business Logic
- `MediaRequestQueueBacklog` - Queue > 100 items (Warning)
- `CriticalMediaRequestBacklog` - Queue > 500 items (Critical)
- `PlexIntegrationFailure` - Plex API error rate > 20% (Critical)

#### JWT & Session Management
- `HighJWTVerificationFailures` - JWT failures > 1/sec (Warning)
- `SessionTokenLeakage` - Invalid token attempts > 5/sec (Critical)

### 2. Infrastructure Alerts (`alerts/infrastructure-alerts.yml`)
**System resources, containers, and infrastructure health**

#### System Resources
- `HighCPUUsage` / `CriticalCPUUsage` - CPU > 80% / 95%
- `HighMemoryUsage` / `CriticalMemoryUsage` - Memory > 85% / 95%
- `LowDiskSpace` / `CriticalDiskSpace` - Disk > 85% / 95%
- `HighDiskIOWait` - I/O wait > 20%

#### Container Monitoring
- `ContainerDown` - cAdvisor monitoring unavailable
- `HighContainerMemoryUsage` - Container memory > 85%
- `ContainerCPUThrottling` - CPU throttling detected
- `ContainerRestartLoop` - Frequent container restarts

#### Node Health
- `NodeDown` - Node exporter unreachable
- `HighLoadAverage` - Load > 2x CPU cores
- `NetworkInterfaceDown` - Network interface failure

### 3. Business Alerts (`alerts/business-alerts.yml`)
**User activity, conversion metrics, and business KPIs**

#### User Engagement
- `LowUserConversionRate` - Search-to-request conversion < 5%
- `UserSessionDropoff` - Session dropout > 70%
- `NoNewUserRegistrations` - No registrations in 6h

#### Media Processing
- `MediaRequestProcessingDelay` - Processing time > 300s
- `HighMediaRequestFailureRate` - Request failure rate > 10%
- `MediaRequestQueueStalled` - Queue stalled with items

#### Integration Health
- `PlexServiceDegraded` - Plex error/timeout rate > 15%
- `OverseerrServiceUnavailable` - Overseerr service down
- `ExternalAPIRateLimitHit` - Rate limiting detected

### 4. Security Alerts (`alerts/security-alerts.yml`)
**Authentication failures, rate limiting, and suspicious activity**

#### Authentication Security
- `BruteForceAttackDetected` - > 5 auth failures/sec (Critical)
- `SuspiciousAuthenticationActivity` - Multiple IP failures (Warning)
- `PrivilegeEscalationAttempt` - Privilege escalation detected (Critical)

#### API Security
- `RateLimitExceeded` - Rate limiting triggered (Warning)
- `CriticalRateLimitExceeded` - Heavy rate limiting (Critical)
- `SQLInjectionAttempt` - SQL injection detected (Critical)
- `XSSAttemptDetected` - XSS attempt detected (Critical)

#### Data Security
- `UnauthorizedDataAccess` - Unauthorized access attempt (Critical)
- `DataExfiltrationAttempt` - Large data transfer attempts (Critical)
- `SensitiveDataExposure` - Sensitive data exposure (Critical)

## Notification Routing

### Critical Security Alerts
- **Channels**: Slack (#security-alerts), Email (security team), PagerDuty
- **Escalation**: Immediate (0s group wait, 10m repeat)
- **Features**: Rich formatting, runbook links, action buttons

### Critical Infrastructure
- **Channels**: Slack (#alerts-critical), Email (ops team)
- **Escalation**: Immediate (0s group wait, 15m repeat)
- **Features**: Dashboard links, severity indicators

### Application & Business
- **Channels**: Slack (respective channels), Email (team-specific)
- **Escalation**: Standard (30s-2m group wait, 1-4h repeat)
- **Features**: Context-aware routing, inhibition rules

## Environment Variables

### SMTP Configuration
- `SMTP_HOST` - SMTP server hostname
- `SMTP_USERNAME` / `SMTP_PASSWORD` - Authentication
- `OPS_EMAIL` / `SECURITY_EMAIL` / `BUSINESS_EMAIL` - Team contacts

### Webhook Integration
- `SLACK_WEBHOOK_URL` - Slack integration
- `PAGERDUTY_WEBHOOK_URL` - PagerDuty integration
- `DEFAULT_WEBHOOK_URL` - Generic webhook endpoint

## Alert Thresholds

### Critical Thresholds
- **API Error Rate**: > 1% (5xx errors)
- **Response Time**: P95 > 2 seconds
- **Memory Usage**: > 95% sustained 2 minutes
- **CPU Usage**: > 95% sustained 2 minutes
- **Authentication Failures**: > 5 failures/second

### Warning Thresholds
- **API Error Rate**: > 0.5% 
- **Response Time**: P95 > 1 second
- **Memory Usage**: > 85% sustained 5 minutes
- **Queue Depth**: > 100 items for 10 minutes
- **Cache Hit Rate**: < 85%

## Inhibition Rules
- Critical alerts inhibit lower severity for same service
- Service down alerts inhibit related component alerts
- Node down alerts inhibit container alerts
- Infrastructure failures inhibit business alerts during outages

## Validation
Use the validation script to check configuration:
```bash
./monitoring/scripts/validate-alerts.sh
```

## Maintenance
- Review alert effectiveness monthly
- Update thresholds based on historical data
- Test notification channels quarterly
- Validate runbook links and procedures
