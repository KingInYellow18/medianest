# Phase 5: Infrastructure Monitoring and Backup Setup

**Status:** Not Started  
**Priority:** Medium  
**Dependencies:** Production deployment  
**Estimated Time:** 4 hours

## Objective

Set up infrastructure monitoring and automated backups to ensure MediaNest data is protected and system health is tracked.

## Background

Infrastructure monitoring and backups are critical for homelab reliability. We need automated systems that require minimal maintenance.

## Tasks

### 1. Backup Automation

- [ ] Create backup scripts for database
- [ ] Set up backup retention policies
- [ ] Configure automated scheduling
- [ ] Test restore procedures
- [ ] Set up backup monitoring
- [ ] Document recovery process

### 2. Log Management

- [ ] Configure log rotation
- [ ] Set up log retention (30 days)
- [ ] Create log backup strategy
- [ ] Implement log compression
- [ ] Set up log analysis tools
- [ ] Document log locations

### 3. System Monitoring

- [ ] Monitor CPU usage
- [ ] Track memory consumption
- [ ] Watch disk I/O
- [ ] Monitor network traffic
- [ ] Set up system alerts
- [ ] Create monitoring dashboard

### 4. Database Monitoring

- [ ] Track connection count
- [ ] Monitor query performance
- [ ] Watch database size
- [ ] Set up slow query logs
- [ ] Configure autovacuum
- [ ] Plan maintenance windows

### 5. Container Monitoring

- [ ] Set up Docker health checks
- [ ] Monitor container restarts
- [ ] Track resource limits
- [ ] Watch container logs
- [ ] Configure auto-restart
- [ ] Document container management

### 6. Disaster Recovery Planning

- [ ] Create recovery procedures
- [ ] Test backup restoration
- [ ] Document recovery time
- [ ] Plan for data corruption
- [ ] Create emergency contacts
- [ ] Schedule DR tests

## Implementation Details

### Automated Backup Script

```bash
#!/bin/bash
# /scripts/backup-medianest.sh

set -e

# Configuration
BACKUP_ROOT="/backups/medianest"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
RETENTION_DAYS=30
HEALTHCHECK_URL="https://hc-ping.com/your-uuid-here"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to handle errors
error_handler() {
    echo "Backup failed at line $1"
    curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL/fail" > /dev/null
    exit 1
}

trap 'error_handler $LINENO' ERR

# Start backup
echo "Starting MediaNest backup - $TIMESTAMP"
curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL/start" > /dev/null

# Backup database
echo "Backing up PostgreSQL..."
docker exec medianest_postgres pg_dump -U medianest medianest_db | gzip > "$BACKUP_DIR/database.sql.gz"

# Backup Redis
echo "Backing up Redis..."
docker exec medianest_redis redis-cli SAVE
docker cp medianest_redis:/data/dump.rdb "$BACKUP_DIR/redis-dump.rdb"

# Backup configuration
echo "Backing up configuration..."
cp /opt/medianest/.env.production "$BACKUP_DIR/env.production"
docker config inspect --pretty medianest_secrets > "$BACKUP_DIR/docker-secrets.json"

# Backup YouTube downloads metadata
echo "Backing up download metadata..."
tar -czf "$BACKUP_DIR/youtube-metadata.tar.gz" -C /youtube/.metadata .

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "version": "$(docker images medianest/backend --format '{{.Tag}}' | head -1)",
  "files": [
    "database.sql.gz",
    "redis-dump.rdb",
    "env.production",
    "docker-secrets.json",
    "youtube-metadata.tar.gz"
  ],
  "size": "$(du -sh $BACKUP_DIR | cut -f1)"
}
EOF

# Compress backup
echo "Compressing backup..."
tar -czf "$BACKUP_ROOT/medianest-backup-$TIMESTAMP.tar.gz" -C "$BACKUP_ROOT" "$TIMESTAMP"
rm -rf "$BACKUP_DIR"

# Clean old backups
echo "Cleaning old backups..."
find "$BACKUP_ROOT" -name "medianest-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup
echo "Verifying backup..."
tar -tzf "$BACKUP_ROOT/medianest-backup-$TIMESTAMP.tar.gz" > /dev/null

# Success notification
echo "Backup completed successfully"
curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL" > /dev/null

# Upload to remote storage (optional)
# rclone copy "$BACKUP_ROOT/medianest-backup-$TIMESTAMP.tar.gz" remote:medianest-backups/
```

### Database Monitoring Queries

```sql
-- Connection monitoring
CREATE VIEW db_connection_stats AS
SELECT
    datname,
    count(*) as connections,
    count(*) filter (where state = 'active') as active,
    count(*) filter (where state = 'idle') as idle,
    max(age(clock_timestamp(), query_start)) as longest_query
FROM pg_stat_activity
GROUP BY datname;

-- Table size monitoring
CREATE VIEW db_table_sizes AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Slow query logging
ALTER DATABASE medianest_db SET log_min_duration_statement = 1000; -- Log queries over 1s
```

### Docker Health Checks

```yaml
# docker-compose.prod.yml additions
services:
  backend:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
```

### Monitoring Dashboard Script

```bash
#!/bin/bash
# /scripts/system-monitor.sh

# Function to get color based on value
get_color() {
    if [ $1 -gt $2 ]; then echo -e "\033[0;31m"; # Red
    elif [ $1 -gt $3 ]; then echo -e "\033[0;33m"; # Yellow
    else echo -e "\033[0;32m"; fi # Green
}

clear
echo "=== MediaNest System Monitor ==="
echo "Time: $(date)"
echo ""

# Docker containers
echo "Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.State}}" | grep medianest

echo ""
echo "Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "Disk Usage:"
df -h | grep -E "Filesystem|docker|youtube"

echo ""
echo "Database Connections:"
docker exec medianest_postgres psql -U medianest -d medianest_db -c "SELECT count(*) as connections FROM pg_stat_activity;"

echo ""
echo "Recent Errors (last 10):"
docker logs medianest_backend 2>&1 | grep ERROR | tail -10
```

### Backup Restoration Procedure

```bash
#!/bin/bash
# /scripts/restore-medianest.sh

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR="/tmp/medianest-restore"

echo "⚠️  WARNING: This will restore MediaNest from backup"
echo "Current data will be overwritten!"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restoration cancelled"
    exit 0
fi

# Extract backup
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"
BACKUP_NAME=$(ls "$RESTORE_DIR")

# Stop services
docker-compose -f docker-compose.prod.yml stop

# Restore database
echo "Restoring database..."
docker-compose -f docker-compose.prod.yml up -d postgres
sleep 5
gunzip < "$RESTORE_DIR/$BACKUP_NAME/database.sql.gz" | docker exec -i medianest_postgres psql -U medianest medianest_db

# Restore Redis
echo "Restoring Redis..."
docker cp "$RESTORE_DIR/$BACKUP_NAME/redis-dump.rdb" medianest_redis:/data/dump.rdb
docker-compose -f docker-compose.prod.yml restart redis

# Start services
docker-compose -f docker-compose.prod.yml up -d

echo "Restoration complete!"
rm -rf "$RESTORE_DIR"
```

## Cron Schedule

```cron
# Automated backups - daily at 2 AM
0 2 * * * /scripts/backup-medianest.sh >> /var/log/medianest-backup.log 2>&1

# System monitoring - every 5 minutes
*/5 * * * * /scripts/check-health.sh

# Log rotation - weekly
0 0 * * 0 /usr/sbin/logrotate /etc/logrotate.d/medianest

# Disk cleanup - monthly
0 3 1 * * /scripts/cleanup-old-files.sh
```

## Success Criteria

- [ ] Automated backups running daily
- [ ] Restore tested successfully
- [ ] Monitoring alerts working
- [ ] Logs rotating properly
- [ ] System metrics visible
- [ ] DR plan documented

## Notes

- Test backups regularly
- Monitor backup sizes
- Keep restore procedures updated
- Document any manual steps
- Consider off-site backup storage
