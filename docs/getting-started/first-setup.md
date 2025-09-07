# First Time Setup Guide

This guide walks you through the initial setup of MediaNest after installation.

## Initial Configuration

### 1. Access the Web Interface

After installation, navigate to your MediaNest instance:

```
http://localhost:3000
```

Or your configured domain/IP address.

### 2. Administrator Account Setup

On first access, you'll be prompted to create an administrator account:

1. **Username**: Choose a secure administrator username
2. **Email**: Provide a valid email address
3. **Password**: Use a strong password (minimum 8 characters)
4. **Confirm Password**: Re-enter your password

```bash
# Example using CLI (alternative method)
npm run setup:admin
```

### 3. Database Initialization

The system will automatically:

- Create required database tables
- Set up initial configuration
- Initialize caching layer
- Create default user roles

## Media Library Configuration

### 1. Add Media Sources

Configure your media storage locations:

1. Navigate to **Settings** → **Media Sources**
2. Click **Add New Source**
3. Configure source settings:
   - **Name**: Descriptive name for the source
   - **Path**: Local or network path to media files
   - **Type**: Movie, TV Show, Music, or Mixed
   - **Scan Schedule**: Automatic or manual scanning

```json
{
  "sources": [
    {
      "name": "Movie Library",
      "path": "/media/movies",
      "type": "movies",
      "scanSchedule": "daily"
    }
  ]
}
```

### 2. Library Scanning

Initiate your first library scan:

1. Go to **Libraries** → **Scan Now**
2. Monitor scan progress in the dashboard
3. Review detected media files
4. Verify metadata accuracy

## Essential Settings

### 1. General Settings

Configure basic application settings:

- **Site Name**: Your MediaNest instance name
- **Time Zone**: Your local time zone
- **Language**: Default interface language
- **Theme**: Light or dark theme preference

### 2. Security Settings

Enable security features:

- **Two-Factor Authentication**: Enable for admin accounts
- **API Access**: Configure API keys if needed
- **Session Timeout**: Set appropriate timeout values
- **CORS Settings**: Configure for external integrations

### 3. Notification Settings

Set up notification preferences:

- **Email Notifications**: Configure SMTP settings
- **Web Notifications**: Enable browser notifications
- **Webhook URLs**: For external integrations
- **Notification Types**: Choose what to be notified about

## User Management

### 1. Create Additional Users

Add other users to your MediaNest instance:

1. Go to **Admin** → **Users**
2. Click **Add User**
3. Fill in user details:
   - Username and email
   - Password (or invite via email)
   - Role assignment
   - Library access permissions

### 2. Configure Permissions

Set up role-based permissions:

- **Admin**: Full system access
- **User**: Standard media access
- **Guest**: Limited read-only access
- **Custom**: Define custom permission sets

## Integration Setup

### 1. Plex Integration (Optional)

If using Plex integration:

1. Navigate to **Integrations** → **Plex**
2. Enter Plex server details:
   - Server URL
   - Authentication token
   - Library mappings
3. Test connection and sync settings

### 2. External APIs

Configure external service integrations:

- **TMDb**: For movie metadata
- **TVDb**: For TV show information
- **MusicBrainz**: For music metadata
- **Webhooks**: For custom integrations

## Backup Configuration

### 1. Automatic Backups

Set up automated backup strategy:

```bash
# Configure backup schedule
npm run config:backup --schedule="0 2 * * *"  # Daily at 2 AM
```

### 2. Backup Locations

Configure backup storage:

- Local filesystem backups
- Cloud storage integration
- Network attached storage
- Retention policies

## Performance Optimization

### 1. Cache Configuration

Optimize caching settings:

- Enable Redis caching
- Set appropriate cache TTL values
- Configure cache warming schedules

### 2. Media Processing

Configure media processing:

- Thumbnail generation settings
- Video transcoding preferences
- Image optimization settings
- Processing queue management

## Final Verification

### 1. System Health Check

Verify all components are working:

```bash
# Run system health check
npm run health-check
```

### 2. Test Core Functions

Test essential functionality:

- [ ] User login/logout
- [ ] Media library browsing
- [ ] Search functionality
- [ ] File uploads (if enabled)
- [ ] API access (if configured)

### 3. Monitor Logs

Check system logs for any issues:

```bash
# View application logs
docker-compose logs -f medianest
```

## Next Steps

After completing the first-time setup:

1. **Explore Features**: Familiarize yourself with all available features
2. **Import Media**: Add your media collection to the library
3. **Customize Interface**: Personalize the user interface
4. **Set Up Monitoring**: Configure system monitoring and alerts
5. **Review Documentation**: Read through user guides and API documentation

## Troubleshooting Common Setup Issues

### Database Connection Issues

```bash
# Check database connectivity
docker-compose exec postgres psql -U medianest -d medianest -c "SELECT 1;"
```

### Permission Problems

```bash
# Fix file permissions
sudo chown -R medianest:medianest /path/to/media
sudo chmod -R 755 /path/to/media
```

### Memory Issues

```bash
# Increase container memory limits
# Edit docker-compose.yml
services:
  medianest:
    mem_limit: 2g
```

For additional help, consult the [Troubleshooting Guide](../troubleshooting/index.md) or visit our community forums.
