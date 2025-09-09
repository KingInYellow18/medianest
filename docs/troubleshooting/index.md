# Troubleshooting Guide

Having issues with MediaNest? This comprehensive troubleshooting guide covers common problems and their solutions.

## Quick Diagnostics

### Health Check
```bash
# Check system status
curl http://localhost:8080/health

# Expected response
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### Common Issues

#### 🔴 Service Won't Start
- [Common Issues](common-issues.md) - Port conflicts, permission errors
- [Performance Issues](performance.md) - Memory, CPU, disk problems
- [Database Issues](database.md) - Connection and migration problems

#### 🟡 Functionality Problems
- [Media Processing](media-processing.md) - File scanning and processing
- [Authentication Problems](authentication.md) - Login and permission issues
- [Logs and Debugging](debugging.md) - Enable debug logging

## Issue Categories

### Installation & Setup
- **Docker Issues**: Container won't start, port conflicts
- **Database Problems**: Connection errors, migration failures
- **Permission Errors**: File access, directory permissions
- **Network Issues**: Port binding, firewall problems

### Media Library
- **Import Problems**: Files not being detected or imported
- **Metadata Issues**: Missing or incorrect information
- **Transcoding Failures**: Video/audio processing errors
- **Storage Problems**: Disk space, network storage issues

### Performance
- **Slow Scanning**: Large library optimization
- **High Memory Usage**: Memory leak investigation
- **Database Performance**: Query optimization
- **Network Performance**: Bandwidth and latency

### User & Security
- **Login Problems**: Authentication failures
- **Permission Issues**: Access control problems
- **API Authentication**: Token and API key issues
- **SSL/HTTPS**: Certificate and encryption problems

## Diagnostic Tools

### Log Analysis
```bash
# View application logs
docker logs medianest

# Follow logs in real-time
docker logs -f medianest

# View specific timeframe
docker logs --since="2024-01-01T00:00:00" medianest
```

### System Monitoring
```bash
# Check resource usage
docker stats medianest

# View disk usage
df -h

# Check memory usage
free -h

# Monitor network connections
netstat -tlnp | grep :8080
```

### Database Diagnostics
```bash
# Test database connection
npm run db:check

# View migration status
npm run db:status

# Check database size
psql -d medianest -c "SELECT pg_size_pretty(pg_database_size('medianest'));"
```

## Self-Help Tools

### Built-in Diagnostics
MediaNest includes several diagnostic endpoints:

- `/health` - Overall system health
- `/metrics` - Performance metrics
- `/debug/info` - System information
- `/debug/logs` - Recent log entries

### Configuration Validation
```bash
# Validate configuration
npm run config:validate

# Test all connections
npm run test:connections

# Verify file permissions
npm run check:permissions
```

## Getting Help

### Before Reporting Issues

1. **Check Logs**: Review application and system logs
2. **Verify Configuration**: Ensure all settings are correct
3. **Test Isolation**: Try to reproduce in a clean environment
4. **Search Documentation**: Check existing guides and FAQ

### When Reporting Issues

Include the following information:

- **Version**: MediaNest version and build
- **Environment**: Docker/manual, OS, hardware specs
- **Configuration**: Relevant config (sanitized of secrets)
- **Logs**: Error messages and relevant log entries
- **Steps**: How to reproduce the issue

### Support Channels

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/medianest/medianest/issues)
- **Discord Community**: [Get community help](https://discord.gg/medianest)
- **Documentation**: [Browse all guides](../index.md)

### Emergency Issues

For critical production issues:

1. **Immediate Action**: Stop the service if necessary
2. **Backup**: Secure your data and configuration
3. **Rollback**: Return to last known good state
4. **Report**: Create urgent issue with all details

## FAQ

### Common Questions

**Q: MediaNest won't start after update**
A: Check [Database Issues](database.md) for migration problems

**Q: Files aren't being imported**
A: Verify file permissions and supported formats

**Q: High CPU usage during scanning**
A: See [Performance Issues](performance.md) for optimization

**Q: Can't connect to Plex**
A: Check network connectivity and Plex token

### Performance Tuning

- **Large Libraries**: Adjust scan intervals and batch sizes
- **Memory Usage**: Configure cache sizes and limits
- **Database**: Tune PostgreSQL settings for your hardware
- **Network**: Optimize for remote access scenarios

## Advanced Troubleshooting

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm start

# Or for Docker
docker run -e LOG_LEVEL=debug medianest/medianest
```

### Profiling
```bash
# CPU profiling
npm run profile:cpu

# Memory profiling
npm run profile:memory

# Database query analysis
npm run profile:db
```

### System Health Monitoring
Set up monitoring for proactive issue detection:

- **Health Checks**: Automated health monitoring
- **Alert Thresholds**: CPU, memory, disk usage alerts
- **Log Monitoring**: Error pattern detection
- **Performance Metrics**: Response time tracking

---

Still having issues? Don't hesitate to reach out to our [community](https://discord.gg/medianest) for help!