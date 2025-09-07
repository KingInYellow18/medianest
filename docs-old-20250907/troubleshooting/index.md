# Troubleshooting Guide

Having issues with MediaNest? This comprehensive troubleshooting guide will help you diagnose and resolve common problems quickly.

## Quick Diagnostic

Before diving into specific issues, run our built-in diagnostic tool:

```bash
# For Docker installations
docker exec medianest npm run diagnostics

# For manual installations
medianest diagnostics
```

This will check:

- System requirements
- Database connectivity
- Storage permissions
- Service health
- Configuration issues

## Common Issues

<div class="grid cards" markdown>

- :material-alert-circle: **Common Issues**

  ***

  Quick solutions to the most frequently encountered problems.

  [Common Issues →](common-issues.md)

- :material-speedometer: **Performance Issues**

  ***

  Diagnose and fix slow loading, high CPU usage, and memory problems.

  [Performance Guide →](performance.md)

- :material-database-alert: **Database Issues**

  ***

  Resolve database connection, migration, and data integrity problems.

  [Database Troubleshooting →](database.md)

- :material-image-broken: **Media Processing**

  ***

  Fix issues with media uploads, processing, and thumbnail generation.

  [Media Processing →](media-processing.md)

- :material-account-alert: **Authentication Problems**

  ***

  Resolve login issues, token problems, and permission errors.

  [Authentication Issues →](authentication.md)

- :material-bug: **Logs and Debugging**

  ***

  Learn how to read logs, enable debugging, and gather diagnostic information.

  [Debug Guide →](debugging.md)

</div>

## Problem Categories

### Installation Issues

| Problem                    | Quick Fix                | Full Solution                           |
| -------------------------- | ------------------------ | --------------------------------------- |
| Docker won't start         | `docker-compose restart` | [Docker Issues](#docker-issues)         |
| Port already in use        | Change port in config    | [Port Conflicts](#port-conflicts)       |
| Permission denied          | Fix file permissions     | [Permission Issues](#permission-issues) |
| Database connection failed | Check DB credentials     | [Database Issues](database.md)          |

### Runtime Issues

| Problem              | Quick Fix           | Full Solution                           |
| -------------------- | ------------------- | --------------------------------------- |
| 500 Server Error     | Check error logs    | [Server Errors](#server-errors)         |
| Slow performance     | Restart services    | [Performance Issues](performance.md)    |
| Media not processing | Check worker status | [Media Processing](media-processing.md) |
| Login not working    | Clear cookies/cache | [Authentication](authentication.md)     |

### User Interface Issues

| Problem               | Quick Fix              | Full Solution                       |
| --------------------- | ---------------------- | ----------------------------------- |
| Page won't load       | Hard refresh (Ctrl+F5) | [UI Issues](#ui-issues)             |
| Images not displaying | Check browser console  | [Media Display](#media-display)     |
| Search not working    | Clear search filters   | [Search Issues](#search-issues)     |
| Upload failing        | Check file size/format | [Upload Problems](#upload-problems) |

## Emergency Procedures

### System Down

If MediaNest is completely unresponsive:

1. **Check system resources**:

   ```bash
   # Check disk space
   df -h

   # Check memory usage
   free -h

   # Check running processes
   ps aux | grep medianest
   ```

2. **Restart services**:

   ```bash
   # Docker deployment
   docker-compose restart

   # Manual deployment
   systemctl restart medianest
   ```

3. **Check logs**:

   ```bash
   # Docker logs
   docker-compose logs --tail=50

   # System logs
   journalctl -u medianest --tail=50
   ```

### Data Recovery

If you're experiencing data loss:

1. **Stop all services immediately**:

   ```bash
   docker-compose stop
   ```

2. **Check database integrity**:

   ```bash
   docker exec medianest-db pg_dump medianest > backup_check.sql
   ```

3. **Restore from backup**:

   ```bash
   # List available backups
   ls -la /backups/

   # Restore latest backup
   medianest restore /backups/latest.backup
   ```

## Diagnostic Commands

### System Health Check

```bash
# Check all services
medianest health

# Check specific component
medianest health --component database
medianest health --component storage
medianest health --component processing
```

### Log Analysis

```bash
# View recent logs
medianest logs --tail 100

# Filter by level
medianest logs --level error

# Search logs
medianest logs --grep "upload failed"

# Export logs
medianest logs --export /tmp/medianest-logs.txt
```

### Performance Monitoring

```bash
# Current system status
medianest status

# Resource usage
medianest stats --detailed

# Processing queue status
medianest queue status

# Database performance
medianest db stats
```

## Step-by-Step Diagnostics

### 1. Connection Issues

**Symptoms**: Can't access MediaNest web interface

**Diagnosis**:

```bash
# Check if service is running
curl http://localhost:8080/health

# Check port binding
netstat -tulpn | grep :8080

# Check firewall
sudo ufw status
```

**Solutions**:

- Service not running → `docker-compose up -d`
- Port conflict → Change port in `docker-compose.yml`
- Firewall blocking → `sudo ufw allow 8080`

### 2. Upload Failures

**Symptoms**: Files fail to upload or get stuck

**Diagnosis**:

```bash
# Check storage permissions
ls -la /path/to/media/storage

# Check disk space
df -h /path/to/media/storage

# Check upload limits
grep -i upload /etc/nginx/nginx.conf
```

**Solutions**:

- Permission issues → `chown -R medianest:medianest /storage`
- Disk full → Clean up old files or add storage
- Size limits → Increase `client_max_body_size` in nginx

### 3. Processing Issues

**Symptoms**: Media uploads but thumbnails/previews don't generate

**Diagnosis**:

```bash
# Check processing queue
medianest queue status

# Check worker processes
ps aux | grep worker

# Check FFmpeg installation
ffmpeg -version
```

**Solutions**:

- Queue stuck → `medianest queue clear`
- Workers not running → `medianest workers restart`
- FFmpeg missing → Install FFmpeg

## Docker-Specific Issues

### Container Won't Start

```bash
# Check container status
docker ps -a

# Check container logs
docker logs medianest

# Check resource usage
docker stats medianest

# Restart container
docker-compose restart medianest
```

### Volume Issues

```bash
# Check volume mounts
docker inspect medianest | grep -A 20 "Mounts"

# Fix permissions
docker exec medianest chown -R app:app /app/data

# Recreate volumes
docker-compose down -v
docker-compose up -d
```

### Network Issues

```bash
# Check network connectivity
docker exec medianest ping google.com

# Check internal networking
docker network ls
docker network inspect medianest_default

# Check port mapping
docker port medianest
```

## Configuration Issues

### Environment Variables

Common environment variable problems:

```bash
# Check current environment
docker exec medianest env | grep MEDIANEST

# Validate configuration
medianest config validate

# Reset to defaults
medianest config reset --confirm
```

### Database Configuration

```bash
# Test database connection
medianest db test

# Check migrations
medianest db migrations status

# Run pending migrations
medianest db migrate
```

## Getting Additional Help

### Before Asking for Help

Please gather this information:

1. **System Information**:

   ```bash
   medianest --version
   docker --version
   uname -a
   ```

2. **Error Logs**:

   ```bash
   medianest logs --level error --tail 50 > error_logs.txt
   ```

3. **Configuration**:
   ```bash
   medianest config export --sanitized > config.json
   ```

### Support Channels

1. **Self-Service**:

   - Search this documentation
   - Check [FAQ](../reference/faq.md)
   - Use diagnostic tools

2. **Community Support**:

   - [GitHub Issues](https://github.com/medianest/medianest/issues)
   - [GitHub Discussions](https://github.com/medianest/medianest/discussions)
   - [Community Forum](https://forum.medianest.org)

3. **Professional Support**:
   - Enterprise support tickets
   - Priority response for Pro users
   - Custom troubleshooting sessions

### Creating Effective Bug Reports

When reporting issues, include:

1. **Clear Description**: What were you trying to do?
2. **Expected Behavior**: What should have happened?
3. **Actual Behavior**: What actually happened?
4. **Steps to Reproduce**: How can others reproduce the issue?
5. **Environment**: System specs, MediaNest version, etc.
6. **Logs**: Relevant error logs and diagnostic output

## Prevention Tips

### Regular Maintenance

1. **Update Regularly**:

   ```bash
   # Check for updates
   medianest update check

   # Apply updates
   medianest update apply
   ```

2. **Monitor Health**:

   ```bash
   # Set up health monitoring
   medianest monitor enable

   # Configure alerts
   medianest alerts setup
   ```

3. **Backup Regularly**:

   ```bash
   # Automated backups
   medianest backup schedule --daily

   # Test restore process
   medianest backup test-restore
   ```

### Best Practices

- Keep system resources within recommended limits
- Monitor log files for early warning signs
- Use staging environment for testing changes
- Document any custom configurations
- Train users on proper MediaNest usage

---

Still having issues? Start with [Common Issues](common-issues.md) for quick fixes, or check the specific troubleshooting guides above for your problem area.
