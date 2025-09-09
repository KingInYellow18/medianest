# MediaNest Administrator Guide

This comprehensive guide covers all administrative functions and best practices for managing MediaNest instances.

## Administrator Overview

As a MediaNest administrator, you have access to advanced features for:
- User management and role assignment
- System configuration and optimization
- Media request workflow management
- Performance monitoring and troubleshooting
- Security and compliance management

## Getting Started as Admin

### Initial Setup

1. **Access Admin Panel**: Navigate to `/admin` or click "Admin" in the main navigation
2. **Review System Status**: Check all services are running properly
3. **Configure Settings**: Set up system-wide preferences
4. **Create User Policies**: Establish request limits and quality standards

### Admin Dashboard Overview

The admin dashboard provides:
- **System Health**: Real-time service status monitoring
- **User Activity**: Overview of user requests and system usage
- **Performance Metrics**: System performance and optimization status
- **Recent Actions**: Audit log of recent administrative activities

## User Management

### User Roles and Permissions

#### Role Types

**User (Default)**
- Submit media requests
- View own request history
- Access search and discovery features
- Basic profile management

**Admin**
- All user permissions
- Manage other users and roles
- Configure system settings
- Access performance metrics
- Manage media request workflows

### Managing Users

#### View All Users
```
GET /api/v1/admin/users
```

The user management interface shows:
- **User Details**: Username, email, join date, last login
- **Activity Stats**: Request counts, success rates
- **Role Assignment**: Current role and permission level
- **Account Status**: Active, suspended, or pending

#### User Actions

**Promote to Admin**:
1. Navigate to user profile
2. Click "Change Role"
3. Select "Admin" from dropdown
4. Confirm the change
5. User will have admin access on next login

**Change User Role**:
```bash
PATCH /api/v1/admin/users/{userId}/role
Content-Type: application/json

{
  "role": "admin"
}
```

**Suspend User Account**:
1. Go to user management page
2. Find the user account
3. Click "Suspend Account"
4. Provide suspension reason
5. Set suspension duration (optional)

**Delete User Account**:
```bash
DELETE /api/v1/admin/users/{userId}
```

!!! warning "Account Deletion"
    Deleting a user account is permanent and will remove all their requests and history. Consider suspension instead.

### User Request Management

#### Request Oversight

**View All Requests**:
```
GET /api/v1/admin/requests
```

Filter options:
- User ID or username
- Request status (pending, approved, rejected, completed)
- Date range
- Media type (movie, TV show)
- Priority level

#### Request Actions

**Approve Request**:
1. Navigate to admin request management
2. Find pending request
3. Click "Approve"
4. Optionally set priority level
5. Add approval notes

**Reject Request**:
1. Select the request
2. Click "Reject"
3. **Required**: Provide rejection reason
4. Send notification to user

**Bulk Request Management**:
- Select multiple requests using checkboxes
- Apply bulk actions: approve, reject, change priority
- Set processing schedules for approved requests

### Request Workflow Configuration

#### Approval Settings

**Auto-Approval Rules**:
```yaml
Auto-Approval Criteria:
  - Content Rating: PG-13 or lower
  - Request Count: User has < 5 pending requests
  - Content Age: Released > 30 days ago
  - User Standing: No recent rejections

Manual Review Required:
  - Content Rating: R or higher
  - Large Collections: > 10 episodes/movies
  - New Users: < 30 days since joining
  - High Storage: > 50GB estimated size
```

**Request Limits**:
- **Daily Limits**: Maximum requests per user per day
- **Monthly Quotas**: Total requests per user per month
- **Quality Restrictions**: Limit 4K access by user role
- **Content Filters**: Block specific genres or content types

## System Configuration

### Service Integration

#### Plex Server Configuration

**Connection Settings**:
1. Navigate to Admin → Services → Plex
2. Enter Plex server details:
   - Server URL (e.g., `http://plex.local:32400`)
   - Plex Token (generated from Plex account)
   - Library sections to monitor

**Library Sync Settings**:
```yaml
Sync Configuration:
  - Sync Frequency: Every 4 hours
  - Full Sync: Weekly on Sunday at 2 AM
  - Monitor Libraries: Movies, TV Shows, Documentaries
  - Auto-Remove: Remove requests when added to Plex
```

#### External Service Integration

**TMDB Configuration**:
- API Key setup for metadata retrieval
- Language and region preferences
- Image quality settings

**Overseerr Integration**:
- Overseerr instance URL and API key
- Request forwarding configuration
- Status synchronization settings

**Download Client Setup**:
- Integration with download managers
- Quality profile configuration
- Storage path management

### Notification Configuration

#### System Notifications

**Email Configuration**:
```yaml
SMTP Settings:
  Host: smtp.gmail.com
  Port: 587
  Username: notifications@yourdomain.com
  Password: [secure-app-password]
  From Address: MediaNest <noreply@yourdomain.com>
```

**Notification Templates**:
- Request approval notifications
- Completion notifications
- System maintenance alerts
- Weekly user summaries

#### Admin Alerts

**Configure alerts for**:
- Service outages or degraded performance
- High error rates or failed requests
- Storage space warnings
- Security events or failed login attempts

### Performance Configuration

#### Optimization Settings

**Cache Configuration**:
```yaml
Cache Settings:
  - API Response Cache: 5 minutes
  - Media Metadata Cache: 1 hour
  - Search Results Cache: 15 minutes
  - User Session Cache: 30 minutes
```

**Database Optimization**:
- Automatic maintenance schedules
- Query performance monitoring
- Index optimization settings
- Connection pool configuration

**Resource Limits**:
- Maximum concurrent downloads
- API rate limiting per user
- Memory usage thresholds
- CPU usage monitoring

## Security Management

### Access Control

#### Authentication Settings

**Plex OAuth Configuration**:
- Allowed Plex servers for authentication
- Session timeout settings
- Multi-factor authentication requirements
- Password policy enforcement

**Session Management**:
```yaml
Session Security:
  - Session Timeout: 24 hours
  - Refresh Token Lifetime: 90 days
  - Concurrent Sessions: 3 per user
  - IP Address Validation: Enabled
```

#### Security Policies

**Content Security Policy**:
```yaml
CSP Settings:
  - Script Sources: 'self' trusted-cdn.com
  - Image Sources: 'self' image.tmdb.org
  - Style Sources: 'self' 'unsafe-inline'
  - Connection Sources: 'self' api.plex.tv
```

### Audit and Compliance

#### Audit Logging

**Logged Events**:
- User authentication and authorization
- Administrative actions and changes
- Request submissions and status changes
- System configuration modifications
- Security events and anomalies

**Log Retention**:
- Security logs: 1 year retention
- User activity: 6 months retention
- System logs: 3 months retention
- Performance logs: 1 month retention

#### Compliance Features

**Data Privacy**:
- User data export functionality
- Account deletion and data removal
- Privacy policy compliance tools
- GDPR-compliant data handling

**Security Monitoring**:
- Failed login attempt tracking
- Unusual activity pattern detection
- IP address monitoring and blocking
- Automated security report generation

## Performance Monitoring

### System Health Dashboard

#### Key Metrics

**Response Time Monitoring**:
- API endpoint response times
- Database query performance
- External service response times
- User interface load times

**Resource Utilization**:
- CPU usage patterns and peaks
- Memory consumption and garbage collection
- Storage usage and growth trends
- Network bandwidth utilization

**Service Availability**:
- Uptime tracking for all services
- Error rate monitoring and alerting
- Dependency health checks
- Automatic failover status

### Performance Optimization

#### Automated Optimizations

**Cache Management**:
- Automatic cache warming for popular content
- Intelligent cache eviction policies
- Cache hit rate optimization
- Cache size auto-adjustment

**Database Performance**:
- Automatic index creation and optimization
- Query plan analysis and improvement
- Connection pool auto-tuning
- Table maintenance scheduling

**Resource Scaling**:
- Automatic scaling based on load
- Performance-based optimization triggers
- Resource allocation adjustments
- Capacity planning recommendations

#### Manual Optimization Tools

**Performance Analysis**:
```bash
# Get detailed performance metrics
GET /api/v1/admin/performance/detailed

# Trigger optimization analysis
POST /api/v1/admin/performance/analyze

# Execute specific optimizations
POST /api/v1/admin/performance/optimize
{
  "optimizations": ["cache", "database", "memory"]
}
```

## Backup and Recovery

### Backup Configuration

#### Automated Backups

**Database Backups**:
```yaml
Backup Schedule:
  - Frequency: Daily at 2 AM
  - Retention: 30 days
  - Location: S3 bucket or local storage
  - Encryption: AES-256
  - Compression: gzip
```

**Configuration Backups**:
- Application settings and configuration
- User roles and permissions
- Service integration settings
- Custom notification templates

#### Manual Backup Procedures

**Create Manual Backup**:
1. Navigate to Admin → Backup & Recovery
2. Click "Create Backup Now"
3. Select backup components:
   - Database
   - Configuration files
   - User uploads
   - Log files
4. Choose backup location
5. Monitor backup progress

### Disaster Recovery

#### Recovery Procedures

**Database Recovery**:
```bash
# List available backups
GET /api/v1/admin/backups

# Restore from specific backup
POST /api/v1/admin/restore
{
  "backupId": "backup-20250115-020000",
  "components": ["database", "config"]
}
```

**Service Recovery**:
1. Check service status in admin dashboard
2. Review error logs for failed services
3. Restart services through admin interface
4. Verify service connectivity and configuration
5. Test critical functionality

#### Recovery Testing

**Regular Recovery Drills**:
- Monthly backup restoration tests
- Service failure simulation
- Performance degradation scenarios
- Security incident response testing

## Troubleshooting Common Issues

### User Issues

#### Authentication Problems

**User Cannot Login**:
1. Verify user account is active
2. Check Plex server connectivity
3. Validate Plex account permissions
4. Review authentication logs for errors
5. Clear user session cache if needed

**Permission Denied Errors**:
1. Verify user role and permissions
2. Check resource-specific access controls
3. Review recent role changes
4. Validate system-wide access policies

#### Request Issues

**Requests Stuck in Pending**:
1. Check admin notification settings
2. Verify automatic approval rules
3. Review request for policy violations
4. Check external service connectivity

**Failed Request Processing**:
1. Review download client status
2. Check storage space availability
3. Verify external service API keys
4. Review request quality settings

### System Issues

#### Performance Problems

**Slow Response Times**:
1. Check system resource utilization
2. Review database query performance
3. Verify cache hit rates
4. Check external service response times
5. Analyze network connectivity

**High Error Rates**:
1. Review application error logs
2. Check database connectivity
3. Verify external service availability
4. Monitor resource exhaustion
5. Check security policy violations

#### Service Connectivity

**Plex Integration Issues**:
1. Verify Plex server accessibility
2. Check Plex token validity
3. Review library permissions
4. Test direct API connectivity
5. Validate SSL certificate issues

**External Service Failures**:
1. Check service status pages
2. Verify API key validity
3. Review rate limiting issues
4. Test network connectivity
5. Check service configuration

## Best Practices

### Security Best Practices

1. **Regular Security Updates**: Keep MediaNest and dependencies updated
2. **Access Review**: Regularly review user access and permissions
3. **Log Monitoring**: Monitor security logs for suspicious activity
4. **Backup Verification**: Regularly test backup and recovery procedures
5. **Network Security**: Use HTTPS and secure network configurations

### Performance Best Practices

1. **Monitoring**: Implement comprehensive monitoring and alerting
2. **Optimization**: Regular performance optimization and tuning
3. **Capacity Planning**: Monitor growth trends and plan capacity
4. **Cache Management**: Optimize caching strategies for performance
5. **Database Maintenance**: Regular database optimization and cleanup

### Operational Best Practices

1. **Documentation**: Maintain up-to-date configuration documentation
2. **Change Management**: Use controlled change management processes
3. **Testing**: Test changes in staging before production deployment
4. **Communication**: Keep users informed of maintenance and changes
5. **Training**: Ensure admin team is trained on new features and procedures

---

**For technical support or advanced configuration assistance, contact the MediaNest development team or consult the API documentation for integration details.**

**Last Updated:** January 15, 2025  
**Version:** 1.0.0