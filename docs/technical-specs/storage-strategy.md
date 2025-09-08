# Storage Architecture and Strategy

## Overview

This document defines the comprehensive storage architecture for the MediaNest homelab environment, incorporating enterprise-grade storage solutions, backup strategies, and data management practices based on the discovered patterns in the existing infrastructure.

## Current Storage Implementation Analysis

### Existing Docker Volume Configuration
```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/postgres
      
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/redis
      
  uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/uploads
      
  app_logs:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/log/medianest
```

### Current Storage Patterns
- **Local bind mounts**: Direct host filesystem access
- **Persistent volumes**: Data survives container restarts
- **Segregated storage**: Separate volumes for different data types
- **Security constraints**: Read-only filesystems with specific write access

## Enhanced Storage Architecture

### Storage Tiers

```
┌─────────────────────────────────────────────────────────┐
│                    Tier 0: Hot Storage                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    NVMe     │  │   Redis     │  │ Application │    │
│  │   Cache     │  │   Memory    │  │    Logs     │    │
│  │  (Sub-ms)   │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                   Tier 1: Primary Storage               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    SSD      │  │ PostgreSQL  │  │  Container  │    │
│  │   RAID 10   │  │  Database   │  │   Images    │    │
│  │  (1-10ms)   │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  Tier 2: Archive Storage                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    HDD      │  │   Backups   │  │    Media    │    │
│  │   RAID 6    │  │   Archive   │  │   Content   │    │
│  │  (10-100ms) │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                 Tier 3: Cold Storage                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Cloud     │  │   Glacier   │  │  Tape/LTO   │    │
│  │  Storage    │  │  Archives   │  │   Backup    │    │
│  │ (1-10sec)   │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Storage Components

#### Primary Storage Layer (Tier 1)

**ZFS-based Storage Pool**
```bash
# Create ZFS pool with redundancy
zpool create -f tank raidz2 /dev/sdb /dev/sdc /dev/sdd /dev/sde /dev/sdf /dev/sdg

# Configure ZFS filesystem properties
zfs create -o compression=lz4 -o dedup=on -o recordsize=128k tank/medianest
zfs create -o compression=lz4 -o recordsize=8k tank/medianest/postgres
zfs create -o compression=gzip -o recordsize=1M tank/medianest/media
zfs create -o sync=disabled tank/medianest/logs
```

**Storage Classes**
```yaml
# Kubernetes StorageClass definitions
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/no-provisioner
parameters:
  type: ssd
  fsType: ext4
  reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: archive-hdd
provisioner: kubernetes.io/no-provisioner
parameters:
  type: hdd
  fsType: ext4
  reclaimPolicy: Delete
volumeBindingMode: Immediate
```

#### Object Storage (MinIO Distributed)

**MinIO Cluster Configuration**
```yaml
version: '3.8'

services:
  minio1:
    image: minio/minio:RELEASE.2023-12-07T04-16-00Z
    hostname: minio1
    volumes:
      - /mnt/storage/minio1:/data1
      - /mnt/storage/minio2:/data2
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_password
      MINIO_DISTRIBUTED_MODE_ENABLED: "yes"
      MINIO_DISTRIBUTED_NODES: "minio{1...4}/data{1...2}"
    command: server --console-address ":9001"
    networks:
      - storage-network
    secrets:
      - minio_password
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  minio2:
    image: minio/minio:RELEASE.2023-12-07T04-16-00Z
    hostname: minio2
    volumes:
      - /mnt/storage/minio3:/data1
      - /mnt/storage/minio4:/data2
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_password
      MINIO_DISTRIBUTED_MODE_ENABLED: "yes"
      MINIO_DISTRIBUTED_NODES: "minio{1...4}/data{1...2}"
    command: server --console-address ":9001"
    networks:
      - storage-network
    secrets:
      - minio_password
```

## Data Management Strategy

### Database Storage

#### PostgreSQL Configuration
```bash
# PostgreSQL storage optimization
shared_buffers = 256MB
effective_cache_size = 1GB
checkpoint_segments = 32
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # SSD optimization
effective_io_concurrency = 200

# Enable WAL compression and archiving
wal_compression = on
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
```

#### Redis Persistence Strategy
```bash
# Redis persistence configuration
save 900 1     # Save if at least 1 key changed in 900 seconds
save 300 10    # Save if at least 10 keys changed in 300 seconds
save 60 10000  # Save if at least 10000 keys changed in 60 seconds

# Enable AOF persistence
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Memory optimization
maxmemory-policy allkeys-lru
maxmemory 512mb
```

### File System Layout

```
/var/lib/medianest/
├── postgres/           # PostgreSQL data directory
│   ├── data/          # Database files
│   ├── wal/           # Write-ahead logs
│   └── archive/       # WAL archives
├── redis/             # Redis data directory
│   ├── dump.rdb       # Redis snapshot
│   └── appendonly.aof # Redis AOF file
├── uploads/           # Application file uploads
│   ├── images/        # Image files
│   ├── documents/     # Document files
│   └── temp/         # Temporary uploads
├── media/            # Media content storage
│   ├── movies/       # Movie files
│   ├── tv/          # TV show files
│   └── music/       # Music files
├── backups/         # Local backup storage
│   ├── database/    # Database backups
│   ├── files/       # File backups
│   └── config/      # Configuration backups
└── logs/            # Application logs
    ├── application/ # App-specific logs
    ├── nginx/       # Web server logs
    └── system/      # System logs
```

## Backup Strategy

### Multi-Tier Backup Approach

#### Tier 1: Local Backups (Immediate Recovery)
```bash
#!/bin/bash
# Daily backup script
BACKUP_DIR="/var/lib/medianest/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup with compression
pg_dump -h postgres -U medianest medianest | gzip > "$BACKUP_DIR/database/postgres_$DATE.sql.gz"

# Redis backup
redis-cli --rdb "$BACKUP_DIR/database/redis_$DATE.rdb"

# Application files backup
tar -czf "$BACKUP_DIR/files/uploads_$DATE.tar.gz" /var/lib/medianest/uploads/

# Configuration backup
tar -czf "$BACKUP_DIR/config/config_$DATE.tar.gz" \
  /etc/docker/compose/ \
  /etc/nginx/ \
  /etc/ssl/

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -type f -mtime +7 -delete
```

#### Tier 2: Remote Backups (Offsite Protection)
```bash
#!/bin/bash
# Weekly offsite backup using restic
export RESTIC_REPOSITORY="s3:https://s3.amazonaws.com/medianest-backups"
export RESTIC_PASSWORD_FILE="/etc/restic/password"

# Backup to S3
restic backup \
  /var/lib/medianest/backups \
  /var/lib/medianest/uploads \
  --exclude-file=/etc/restic/exclude.txt

# Prune old backups (keep 4 weekly, 6 monthly)
restic forget --keep-weekly 4 --keep-monthly 6 --prune
```

#### Tier 3: Cloud Archive (Long-term Retention)
```yaml
# Lifecycle policy for S3 backup bucket
Rules:
  - Id: "MediaNestBackupLifecycle"
    Status: Enabled
    Filter:
      Prefix: "medianest/"
    Transitions:
      - Days: 30
        StorageClass: STANDARD_IA
      - Days: 90
        StorageClass: GLACIER
      - Days: 365
        StorageClass: DEEP_ARCHIVE
    Expiration:
      Days: 2555  # 7 years retention
```

### Backup Verification

```bash
#!/bin/bash
# Backup verification script
verify_backup() {
    local backup_file=$1
    local backup_type=$2
    
    case $backup_type in
        "postgres")
            # Verify PostgreSQL backup
            gunzip -c "$backup_file" | head -10 | grep -q "PostgreSQL database dump"
            ;;
        "redis")
            # Verify Redis backup
            redis-check-rdb "$backup_file"
            ;;
        "files")
            # Verify tar archive
            tar -tzf "$backup_file" > /dev/null
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        echo "✓ Backup verification successful: $backup_file"
        return 0
    else
        echo "✗ Backup verification failed: $backup_file"
        return 1
    fi
}

# Verify all backups
find /var/lib/medianest/backups -name "*.gz" -mtime -1 | while read backup; do
    verify_backup "$backup" "postgres"
done
```

## Storage Monitoring and Performance

### Storage Metrics Collection

```yaml
# Prometheus configuration for storage monitoring
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          service: 'storage-metrics'

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
        labels:
          service: 'database-metrics'

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['localhost:9121']
        labels:
          service: 'cache-metrics'

  - job_name: 'minio-exporter'
    static_configs:
      - targets: ['localhost:9000']
        labels:
          service: 'object-storage-metrics'
```

### Performance Monitoring Queries

```promql
# Storage I/O metrics
rate(node_disk_io_time_seconds_total[5m])

# Database connection metrics
postgres_stat_database_numbackends

# Redis memory usage
redis_memory_used_bytes / redis_memory_max_bytes * 100

# MinIO bucket metrics
minio_bucket_objects_count
```

### Alerting Rules

```yaml
groups:
  - name: storage.rules
    rules:
      - alert: HighDiskUsage
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High disk usage on {{ $labels.instance }}"
          description: "Disk usage is above 90% on {{ $labels.instance }}"

      - alert: DatabaseConnectionsHigh
        expr: postgres_stat_database_numbackends > 80
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High number of database connections"
          description: "PostgreSQL has {{ $value }} active connections"

      - alert: BackupFailed
        expr: increase(backup_failed_total[1h]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Backup job failed"
          description: "Backup job has failed in the last hour"
```

## Storage Security

### Encryption at Rest

#### LUKS Disk Encryption
```bash
# Encrypt storage devices
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb encrypted_storage

# Create encrypted filesystem
mkfs.ext4 /dev/mapper/encrypted_storage

# Mount with encryption
mount /dev/mapper/encrypted_storage /var/lib/medianest/secure
```

#### Database Encryption
```sql
-- PostgreSQL TDE (Transparent Data Encryption)
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/server.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/server.key';

-- Enable data encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Access Controls

#### File System Permissions
```bash
# Set secure permissions
chmod 750 /var/lib/medianest
chown -R medianest:medianest /var/lib/medianest

# Database directory permissions
chmod 700 /var/lib/medianest/postgres
chown postgres:postgres /var/lib/medianest/postgres

# Backup directory permissions
chmod 755 /var/lib/medianest/backups
chown backup:backup /var/lib/medianest/backups
```

#### MinIO Access Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::*:user/medianest-app"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::medianest-uploads/*"
    }
  ]
}
```

## Disaster Recovery

### Recovery Point Objectives (RPO) and Recovery Time Objectives (RTO)

| Data Type | RPO | RTO | Backup Frequency | Recovery Method |
|-----------|-----|-----|------------------|-----------------|
| Database | 1 hour | 30 minutes | Continuous WAL | Point-in-time recovery |
| Application Files | 24 hours | 1 hour | Daily | File restoration |
| Configuration | 24 hours | 15 minutes | Daily | Git deployment |
| Media Content | 7 days | 4 hours | Weekly | Bulk restoration |

### Recovery Procedures

#### Database Recovery
```bash
#!/bin/bash
# PostgreSQL point-in-time recovery
pg_ctl stop -D /var/lib/postgresql/data

# Restore base backup
tar -xzf /backups/postgres_base_20231201.tar.gz -C /var/lib/postgresql/data

# Create recovery configuration
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2023-12-01 14:30:00'
EOF

# Start recovery
pg_ctl start -D /var/lib/postgresql/data
```

#### File System Recovery
```bash
#!/bin/bash
# ZFS snapshot recovery
zfs list -t snapshot tank/medianest

# Rollback to snapshot
zfs rollback tank/medianest@daily-20231201

# Or restore specific files
zfs clone tank/medianest@daily-20231201 tank/recovery
cp -r /tank/recovery/uploads/* /var/lib/medianest/uploads/
zfs destroy tank/recovery
```

## Storage Automation with Terraform

### Terraform Storage Configuration
```hcl
# storage.tf
resource "null_resource" "storage_setup" {
  provisioner "local-exec" {
    command = <<-EOT
      # Create storage directories
      mkdir -p /var/lib/medianest/{postgres,redis,uploads,backups,logs}
      
      # Set permissions
      chown -R 999:999 /var/lib/medianest/postgres
      chown -R 999:1000 /var/lib/medianest/redis
      chown -R 1001:1001 /var/lib/medianest/uploads
      
      # Create ZFS datasets if available
      if command -v zfs >/dev/null 2>&1; then
        zfs create -p tank/medianest/postgres
        zfs create -p tank/medianest/redis
        zfs create -p tank/medianest/uploads
        zfs create -p tank/medianest/backups
      fi
    EOT
  }

  triggers = {
    always_run = timestamp()
  }
}

resource "docker_volume" "postgres_data" {
  name = "postgres_data"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/lib/medianest/postgres"
  }

  depends_on = [null_resource.storage_setup]
}

resource "docker_volume" "redis_data" {
  name = "redis_data"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/lib/medianest/redis"
  }

  depends_on = [null_resource.storage_setup]
}
```

## Performance Optimization

### I/O Optimization
```bash
# Kernel I/O scheduler optimization
echo "deadline" > /sys/block/sda/queue/scheduler

# Filesystem mount options
mount -o noatime,nodiratime,discard /dev/sda1 /var/lib/medianest

# ZFS performance tuning
echo 1073741824 > /sys/module/zfs/parameters/zfs_arc_max  # 1GB ARC
echo 134217728 > /sys/module/zfs/parameters/zfs_arc_min   # 128MB minimum
```

### Cache Configuration
```bash
# bcache setup for hybrid storage
make-bcache -B /dev/sdb -C /dev/nvme0n1p1
echo /dev/bcache0 > /sys/fs/bcache/register

# Configure cache policy
echo writeback > /sys/block/bcache0/bcache/cache_mode
```

## Implementation Timeline

### Week 1: Foundation Setup
- Configure ZFS storage pools
- Set up basic directory structure
- Implement basic backup scripts

### Week 2: Object Storage
- Deploy MinIO distributed cluster
- Configure S3-compatible APIs
- Set up client access policies

### Week 3: Backup Implementation
- Deploy automated backup system
- Configure offsite replication
- Test backup verification

### Week 4: Monitoring and Optimization
- Deploy storage monitoring
- Implement performance tuning
- Complete disaster recovery testing

## Cost Optimization

### Storage Tiering Strategy
- **Hot data**: NVMe/SSD for active databases and logs
- **Warm data**: SATA SSD for application files and recent backups
- **Cold data**: HDD for media content and archive backups
- **Frozen data**: Cloud storage for long-term retention

### Capacity Planning
```bash
# Storage growth estimation
current_usage=$(df -h /var/lib/medianest | tail -1 | awk '{print $3}')
growth_rate="10%"  # monthly
projected_6month=$(echo "$current_usage * 1.1^6" | bc)

echo "Current usage: $current_usage"
echo "Projected 6-month usage: $projected_6month"
```

---

*This storage architecture should be reviewed quarterly and updated based on capacity requirements and performance metrics.*