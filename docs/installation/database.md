# Database Setup

This guide covers database setup and configuration for MediaNest, including PostgreSQL (recommended) and MySQL/MariaDB support.

## Supported Databases

MediaNest supports the following databases:

- **PostgreSQL 12+** (Recommended)
- **MySQL 8.0+** / **MariaDB 10.4+**
- **SQLite** (Development only)

## PostgreSQL Setup (Recommended)

PostgreSQL is the recommended database for MediaNest due to its excellent performance, full-text search capabilities, and JSON field support.

### Installation

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

#### CentOS/RHEL
```bash
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
```

#### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Configuration

1. **Start PostgreSQL service**:
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Create database and user**:
   ```bash
   sudo -u postgres psql
   ```
   
   ```sql
   -- Create database
   CREATE DATABASE medianest;
   
   -- Create user with password
   CREATE USER medianest WITH ENCRYPTED PASSWORD 'your_secure_password_here';
   
   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;
   
   -- Grant schema privileges (PostgreSQL 15+)
   GRANT ALL ON SCHEMA public TO medianest;
   GRANT CREATE ON SCHEMA public TO medianest;
   
   -- Exit psql
   \q
   ```

3. **Configure authentication** (edit `/etc/postgresql/14/main/pg_hba.conf`):
   ```
   # Add this line for local connections
   local   medianest       medianest                       md5
   host    medianest       medianest       127.0.0.1/32   md5
   host    medianest       medianest       ::1/128         md5
   ```

4. **Restart PostgreSQL**:
   ```bash
   sudo systemctl restart postgresql
   ```

### Performance Tuning

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Memory settings
shared_buffers = 256MB                # 25% of RAM
effective_cache_size = 1GB            # 75% of RAM
work_mem = 4MB                        # For sorting operations
maintenance_work_mem = 64MB           # For maintenance operations

# Connection settings
max_connections = 100
listen_addresses = 'localhost'
port = 5432

# Performance settings
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100

# Logging (optional)
log_statement = 'mod'                 # Log modifications
log_line_prefix = '%t [%p-%l] %q%u@%d '
log_min_duration_statement = 1000     # Log slow queries (1 second)
```

Restart PostgreSQL after configuration changes:
```bash
sudo systemctl restart postgresql
```

## MySQL/MariaDB Setup

### Installation

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y mysql-server
# or for MariaDB
sudo apt install -y mariadb-server
```

#### CentOS/RHEL
```bash
sudo yum install -y mysql-server
# or for MariaDB
sudo yum install -y mariadb-server
```

#### macOS
```bash
brew install mysql
# or for MariaDB
brew install mariadb
```

### Configuration

1. **Secure installation**:
   ```bash
   sudo mysql_secure_installation
   ```

2. **Create database and user**:
   ```bash
   mysql -u root -p
   ```
   
   ```sql
   -- Create database with proper charset
   CREATE DATABASE medianest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   -- Create user
   CREATE USER 'medianest'@'localhost' IDENTIFIED BY 'your_secure_password_here';
   
   -- Grant privileges
   GRANT ALL PRIVILEGES ON medianest.* TO 'medianest'@'localhost';
   
   -- Apply changes
   FLUSH PRIVILEGES;
   
   -- Exit MySQL
   EXIT;
   ```

### MySQL Performance Tuning

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
[mysqld]
# Buffer pool size (70-80% of RAM)
innodb_buffer_pool_size = 1G

# Log file size
innodb_log_file_size = 256M

# Connection settings
max_connections = 151
wait_timeout = 28800

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Query cache (MySQL 5.7 only)
query_cache_type = 1
query_cache_size = 128M

# Slow query log
slow_query_log = 1
long_query_time = 2
slow_query_log_file = /var/log/mysql/slow.log
```

## Database Connection Configuration

### Environment Variables

```bash
# PostgreSQL
DATABASE_URL=postgresql://medianest:password@localhost:5432/medianest

# MySQL
DATABASE_URL=mysql://medianest:password@localhost:3306/medianest
```

### Django Settings

```python
# settings.py
import os
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default='postgresql://medianest:password@localhost:5432/medianest'
    )
}

# Connection pooling
DATABASES['default']['CONN_MAX_AGE'] = 600

# For PostgreSQL - additional options
if 'postgresql' in DATABASES['default']['ENGINE']:
    DATABASES['default']['OPTIONS'] = {
        'MAX_CONNS': 20,
        'sslmode': 'prefer',
    }

# For MySQL - additional options
if 'mysql' in DATABASES['default']['ENGINE']:
    DATABASES['default']['OPTIONS'] = {
        'charset': 'utf8mb4',
        'init_command': \"SET sql_mode='STRICT_TRANS_TABLES'\",
    }
```

## Database Migration

### Initial Setup

```bash
# Apply initial migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Load initial data (if available)
python manage.py loaddata fixtures/initial_data.json
```

### Managing Migrations

```bash
# Create new migration
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Show migration status
python manage.py showmigrations

# Rollback to specific migration
python manage.py migrate app_name 0002

# Show SQL for migration
python manage.py sqlmigrate app_name 0003
```

## Backup and Restore

### PostgreSQL

#### Backup
```bash
# Full database backup
pg_dump -U medianest -h localhost medianest > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U medianest -h localhost medianest | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Custom format backup (recommended)
pg_dump -U medianest -h localhost -Fc medianest > backup_$(date +%Y%m%d_%H%M%S).dump
```

#### Restore
```bash
# From SQL file
psql -U medianest -h localhost medianest < backup_20241209_120000.sql

# From compressed file
gunzip -c backup_20241209_120000.sql.gz | psql -U medianest -h localhost medianest

# From custom format
pg_restore -U medianest -h localhost -d medianest backup_20241209_120000.dump
```

### MySQL

#### Backup
```bash
# Full database backup
mysqldump -u medianest -p medianest > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
mysqldump -u medianest -p medianest | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Restore
```bash
# From SQL file
mysql -u medianest -p medianest < backup_20241209_120000.sql

# From compressed file
gunzip -c backup_20241209_120000.sql.gz | mysql -u medianest -p medianest
```

## Automated Backups

### Script for Regular Backups

Create `/usr/local/bin/medianest-backup.sh`:

```bash
#!/bin/bash

# Configuration
DB_NAME="medianest"
DB_USER="medianest"
DB_HOST="localhost"
BACKUP_DIR="/backups/medianest"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/medianest_backup_$TIMESTAMP"

# PostgreSQL backup
if command -v pg_dump >/dev/null 2>&1; then
    pg_dump -U "$DB_USER" -h "$DB_HOST" -Fc "$DB_NAME" > "$BACKUP_FILE.dump"
    echo "PostgreSQL backup created: $BACKUP_FILE.dump"
fi

# MySQL backup
if command -v mysqldump >/dev/null 2>&1; then
    mysqldump -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" "$DB_NAME" | gzip > "$BACKUP_FILE.sql.gz"
    echo "MySQL backup created: $BACKUP_FILE.sql.gz"
fi

# Remove old backups
find "$BACKUP_DIR" -name "medianest_backup_*" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"
```

Make it executable and add to cron:
```bash
chmod +x /usr/local/bin/medianest-backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/medianest-backup.sh" | crontab -
```

## Database Maintenance

### PostgreSQL Maintenance

```bash
# Analyze tables for query optimization
sudo -u postgres psql medianest -c "ANALYZE;"

# Vacuum to reclaim space
sudo -u postgres psql medianest -c "VACUUM;"

# Full vacuum (requires more time and space)
sudo -u postgres psql medianest -c "VACUUM FULL;"

# Reindex for performance
sudo -u postgres psql medianest -c "REINDEX DATABASE medianest;"
```

### MySQL Maintenance

```bash
# Optimize all tables
mysql -u medianest -p medianest -e "OPTIMIZE TABLE $(mysql -u medianest -p medianest -e 'SHOW TABLES' | grep -v Tables_in | tr '\n' ',' | sed 's/,$//');"

# Analyze tables
mysql -u medianest -p medianest -e "ANALYZE TABLE $(mysql -u medianest -p medianest -e 'SHOW TABLES' | grep -v Tables_in | tr '\n' ',' | sed 's/,$//');"

# Check and repair tables
mysql -u medianest -p medianest -e "CHECK TABLE $(mysql -u medianest -p medianest -e 'SHOW TABLES' | grep -v Tables_in | tr '\n' ',' | sed 's/,$//');"
```

## Troubleshooting

### Connection Issues

#### PostgreSQL
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='medianest';"

# Check configuration
sudo -u postgres psql -c "SHOW all;" | grep listen_addresses
sudo -u postgres psql -c "SHOW all;" | grep port
```

#### MySQL
```bash
# Check if MySQL is running
sudo systemctl status mysql

# Check connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Check configuration
mysql -u root -p -e "SHOW VARIABLES LIKE 'port';"
mysql -u root -p -e "SHOW VARIABLES LIKE 'bind_address';"
```

### Performance Issues

#### Check Database Size
```bash
# PostgreSQL
sudo -u postgres psql medianest -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# MySQL
mysql -u medianest -p medianest -e "
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'medianest'
ORDER BY (data_length + index_length) DESC;"
```

#### Slow Query Analysis

##### PostgreSQL
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

##### MySQL
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- View slow queries (from slow query log file)
-- tail -f /var/log/mysql/slow.log
```

### Common Error Solutions

#### Permission Denied
```bash
# PostgreSQL
sudo -u postgres psql medianest -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medianest;"
sudo -u postgres psql medianest -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medianest;"

# MySQL
mysql -u root -p -e "GRANT ALL PRIVILEGES ON medianest.* TO 'medianest'@'localhost';"
mysql -u root -p -e "FLUSH PRIVILEGES;"
```

#### Connection Pool Exhaustion
```python
# In Django settings
DATABASES['default']['CONN_MAX_AGE'] = 0  # Disable persistent connections temporarily

# Or increase database max_connections
# PostgreSQL: max_connections = 200
# MySQL: max_connections = 300
```

## Next Steps

- [Configuration Guide](configuration.md) - Complete configuration options
- [Performance Tuning](../troubleshooting/performance.md) - Database performance optimization
- [Monitoring](../troubleshooting/debugging.md) - Database monitoring and logging