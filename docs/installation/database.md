# Database Setup Guide

MediaNest uses PostgreSQL as its primary database. This guide covers database installation, configuration, and maintenance.

## Database Requirements

### PostgreSQL Version Support

- **Minimum**: PostgreSQL 12
- **Recommended**: PostgreSQL 14+
- **Tested**: PostgreSQL 12, 13, 14, 15

### Required Extensions

- `uuid-ossp`: UUID generation
- `pg_trgm`: Text search improvements
- `pgcrypto`: Cryptographic functions (optional)

## Installation Methods

### Method 1: Docker PostgreSQL (Recommended)

#### Quick Start

```bash
# Create PostgreSQL container
docker run -d \
  --name medianest-postgres \
  -e POSTGRES_DB=medianest \
  -e POSTGRES_USER=medianest \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  -v medianest-db:/var/lib/postgresql/data \
  postgres:14-alpine

# Verify connection
docker exec -it medianest-postgres psql -U medianest -d medianest -c "SELECT version();"
```

#### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: '--encoding=UTF8 --locale=C'
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d/
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest']
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres-data:
```

### Method 2: System Installation

#### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres createuser --interactive medianest
sudo -u postgres createdb medianest -O medianest

# Set password
sudo -u postgres psql -c "ALTER USER medianest PASSWORD 'secure_password';"
```

#### CentOS/RHEL

```bash
# Install PostgreSQL
sudo yum install postgresql-server postgresql-contrib

# Initialize database
sudo postgresql-setup initdb

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres createuser medianest
sudo -u postgres createdb medianest -O medianest
sudo -u postgres psql -c "ALTER USER medianest PASSWORD 'secure_password';"
```

#### macOS

```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Create database and user
createuser medianest
createdb medianest -O medianest
psql -c "ALTER USER medianest PASSWORD 'secure_password';"
```

### Method 3: Cloud Database Services

#### AWS RDS

1. Create RDS PostgreSQL instance
2. Configure security groups
3. Note connection details
4. Use connection string format:
   ```
   postgresql://username:password@endpoint:5432/database
   ```

#### Google Cloud SQL

1. Create Cloud SQL PostgreSQL instance
2. Configure authorized networks
3. Create database and user
4. Use connection string with SSL

#### Azure Database for PostgreSQL

1. Create Azure Database for PostgreSQL
2. Configure firewall rules
3. Note connection details
4. Use connection string with SSL

## Database Configuration

### PostgreSQL Configuration (postgresql.conf)

```bash
# Find configuration file location
sudo -u postgres psql -c "SHOW config_file;"

# Edit configuration
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Key settings for MediaNest:

```bash
# Connection settings
listen_addresses = 'localhost'          # or '*' for remote connections
port = 5432
max_connections = 100

# Memory settings
shared_buffers = 256MB                  # 25% of available RAM
effective_cache_size = 1GB              # 75% of available RAM
work_mem = 4MB
maintenance_work_mem = 64MB

# Write-ahead logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_level = replica

# Logging
log_destination = 'csvlog'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'error'
log_min_duration_statement = 1000

# Query tuning
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 200          # For SSD storage
```

### Client Authentication (pg_hba.conf)

```bash
# Edit client authentication
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add MediaNest access rules:

```bash
# MediaNest local connection
local   medianest    medianest                     md5

# MediaNest remote connections (adjust IP range as needed)
host    medianest    medianest    192.168.1.0/24   md5
host    medianest    medianest    10.0.0.0/8       md5

# SSL connections (recommended for production)
hostssl medianest    medianest    0.0.0.0/0        md5
```

Restart PostgreSQL after configuration changes:

```bash
sudo systemctl restart postgresql
```

## Database Schema Setup

### 1. Connect to Database

```bash
# Using psql
psql -h localhost -U medianest -d medianest

# Using connection string
psql "postgresql://medianest:password@localhost:5432/medianest"
```

### 2. Install Required Extensions

```sql
-- Connect as superuser if needed
-- sudo -u postgres psql -d medianest

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Verify extensions
\dx
```

### 3. Create Schema (Handled by MediaNest)

MediaNest automatically creates and manages its database schema through migrations. On first run, it will:

1. Create all required tables
2. Set up indexes for performance
3. Insert initial configuration data
4. Create admin user if specified

## Database Maintenance

### Regular Maintenance Tasks

#### 1. Database Statistics Update

```sql
-- Update table statistics (run weekly)
ANALYZE;

-- Update specific table statistics
ANALYZE users;
ANALYZE media_items;
```

#### 2. Vacuum Operations

```bash
# Regular vacuum (can run while database is in use)
psql -d medianest -c "VACUUM;"

# Full vacuum (requires exclusive lock, run during maintenance window)
psql -d medianest -c "VACUUM FULL;"

# Auto-vacuum configuration in postgresql.conf
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
```

#### 3. Index Maintenance

```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Rebuild indexes if needed (during maintenance window)
REINDEX DATABASE medianest;
```

### Backup Strategies

#### 1. Logical Backup with pg_dump

```bash
# Full database backup
pg_dump -U medianest -h localhost medianest > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U medianest -h localhost medianest | gzip > backup_$(date +%Y%m%d).sql.gz

# Custom format (recommended for large databases)
pg_dump -U medianest -h localhost -Fc medianest > backup_$(date +%Y%m%d).dump
```

#### 2. Automated Backup Script

Create `/usr/local/bin/medianest-backup.sh`:

```bash
#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_USER="medianest"
DB_NAME="medianest"
BACKUP_DIR="/var/backups/medianest"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/medianest_$TIMESTAMP.dump"

# Perform backup
pg_dump -h "$DB_HOST" -U "$DB_USER" -Fc "$DB_NAME" > "$BACKUP_FILE"

# Compress older backups (older than 1 day)
find "$BACKUP_DIR" -name "*.dump" -mtime +1 -exec gzip {} \;

# Remove old backups
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +$RETENTION_DAYS -delete

# Log completion
echo "$(date): Backup completed: $BACKUP_FILE" >> /var/log/medianest-backup.log
```

#### 3. Schedule Backups with Cron

```bash
# Edit crontab
crontab -e

# Add backup schedule (daily at 2 AM)
0 2 * * * /usr/local/bin/medianest-backup.sh

# Weekly full backup (Sunday at 3 AM)
0 3 * * 0 pg_dump -U medianest -h localhost medianest | gzip > /var/backups/medianest/weekly_$(date +\%Y\%m\%d).sql.gz
```

### Backup Restoration

#### 1. Restore from pg_dump

```bash
# From SQL file
psql -U medianest -d medianest < backup_20241201.sql

# From compressed SQL file
gunzip -c backup_20241201.sql.gz | psql -U medianest -d medianest

# From custom format
pg_restore -U medianest -d medianest backup_20241201.dump
```

#### 2. Point-in-Time Recovery (Advanced)

For production environments, consider enabling WAL archiving:

```bash
# postgresql.conf settings
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
```

## Performance Optimization

### 1. Query Performance

#### Enable Query Logging

```bash
# postgresql.conf
log_min_duration_statement = 1000  # Log queries taking > 1 second
log_statement = 'all'              # Log all statements (development only)
```

#### Analyze Slow Queries

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 2. Index Optimization

#### Check Index Usage

```sql
-- Check index usage statistics
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check for missing indexes
SELECT schemaname, tablename, seq_scan, seq_tup_read,
       seq_tup_read / seq_scan AS avg_tup_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;
```

#### Common MediaNest Indexes

```sql
-- Indexes that MediaNest creates automatically
-- Users table
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_username ON users(username);

-- Media items table
CREATE INDEX CONCURRENTLY idx_media_items_user_id ON media_items(user_id);
CREATE INDEX CONCURRENTLY idx_media_items_created_at ON media_items(created_at);
CREATE INDEX CONCURRENTLY idx_media_items_file_path ON media_items(file_path);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_media_items_search ON media_items USING gin(to_tsvector('english', title || ' ' || description));
```

### 3. Connection Optimization

#### Connection Pooling

MediaNest uses Sequelize's built-in connection pooling. Configure in your environment:

```bash
# Connection pool settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE=10000
DB_POOL_ACQUIRE=60000
```

#### Monitor Connections

```sql
-- Check active connections
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active_connections,
       count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = 'medianest';

-- Check connection limits
SELECT setting as max_connections FROM pg_settings WHERE name = 'max_connections';
```

## Security Configuration

### 1. Database User Privileges

```sql
-- Create restricted user for application
CREATE USER medianest_app WITH PASSWORD 'app_password';

-- Grant only necessary privileges
GRANT CONNECT ON DATABASE medianest TO medianest_app;
GRANT USAGE ON SCHEMA public TO medianest_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO medianest_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medianest_app;

-- Grant privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO medianest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO medianest_app;
```

### 2. SSL Configuration

```bash
# Generate SSL certificates
sudo -u postgres openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=medianest-db"

# Set permissions
sudo -u postgres chmod 600 server.key
sudo -u postgres chmod 644 server.crt

# postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

### 3. Network Security

```bash
# postgresql.conf - restrict listening addresses
listen_addresses = '127.0.0.1,192.168.1.100'  # Specific IPs only

# pg_hba.conf - require SSL for remote connections
hostssl medianest medianest 0.0.0.0/0 md5

# Firewall rules (example for ufw)
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

## Monitoring and Alerting

### 1. Database Metrics to Monitor

- Connection count and usage
- Query performance and slow queries
- Disk usage and growth rate
- Cache hit ratio
- Lock wait times
- Replication lag (if using replication)

### 2. Monitoring Queries

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('medianest')) as database_size;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Cache hit ratio (should be > 95%)
SELECT
  round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'medianest';

-- Active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND datname = 'medianest'
ORDER BY duration DESC;
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if listening on correct port
sudo netstat -tulpn | grep :5432

# Test connection
telnet localhost 5432
```

#### 2. Authentication Failed

```bash
# Check pg_hba.conf configuration
sudo tail /var/log/postgresql/postgresql-14-main.log

# Test different authentication methods
psql -h localhost -U medianest -d medianest
```

#### 3. Performance Issues

```sql
-- Check for lock contentions
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

#### 4. Disk Space Issues

```bash
# Check database disk usage
df -h /var/lib/postgresql/

# Clean up old WAL files
sudo -u postgres pg_archivecleanup /var/lib/postgresql/14/main/pg_wal 000000010000000000000001

# Vacuum to reclaim space
psql -d medianest -c "VACUUM FULL;"
```

For additional database configuration and advanced topics, see the [Configuration Guide](configuration.md) and [Performance Optimization](../performance/index.md) sections.
