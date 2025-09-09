# CLI Commands Reference

MediaNest provides a comprehensive command-line interface for administration, maintenance, and automation tasks.

## Installation and Setup

The MediaNest CLI is included with the main installation. For Docker installations, commands are run through the container:

```bash
# Docker installation
docker-compose exec medianest python manage.py <command>

# Manual installation
python manage.py <command>
```

## Core Commands

### Database Management

#### `migrate`
Apply database migrations.

```bash
python manage.py migrate [app_label] [migration_name]

# Examples
python manage.py migrate                    # Apply all pending migrations
python manage.py migrate media             # Apply migrations for media app
python manage.py migrate media 0001        # Migrate to specific version
```

**Options:**
- `--fake` - Mark migrations as run without executing them
- `--fake-initial` - Skip initial migration if tables exist
- `--list` - Show migration status without applying

#### `makemigrations`
Create new migrations based on model changes.

```bash
python manage.py makemigrations [app_label]

# Examples
python manage.py makemigrations            # Create migrations for all apps
python manage.py makemigrations media     # Create migrations for media app
python manage.py makemigrations --empty   # Create empty migration
```

**Options:**
- `--name NAME` - Custom migration name
- `--empty` - Create empty migration file
- `--dry-run` - Show what migrations would be created

#### `showmigrations`
Display migration status.

```bash
python manage.py showmigrations [app_label]

# Examples
python manage.py showmigrations           # Show all migrations
python manage.py showmigrations media    # Show media app migrations
```

### User Management

#### `createsuperuser`
Create a superuser account.

```bash
python manage.py createsuperuser

# Non-interactive mode
python manage.py createsuperuser --username admin --email admin@example.com --noinput
```

#### `changepassword`
Change user password.

```bash
python manage.py changepassword <username>

# Example
python manage.py changepassword admin
```

#### `create_user`
Create a regular user account.

```bash
python manage.py create_user --username <username> --email <email> --password <password>

# Example
python manage.py create_user --username john --email john@example.com --password secretpass
```

### Media Management

#### `scan_media`
Scan directories for media files and import them.

```bash
python manage.py scan_media [path] [options]

# Examples
python manage.py scan_media /media/movies
python manage.py scan_media --recursive --auto-import
python manage.py scan_media --extensions mp4,mkv,avi
```

**Options:**
- `--recursive` - Scan subdirectories recursively
- `--auto-import` - Automatically import found files
- `--extensions EXT` - Comma-separated list of file extensions
- `--dry-run` - Show what would be imported without importing
- `--force` - Force re-scan of existing files

#### `generate_thumbnails`
Generate thumbnails for media files.

```bash
python manage.py generate_thumbnails [options]

# Examples
python manage.py generate_thumbnails              # Generate missing thumbnails
python manage.py generate_thumbnails --force      # Regenerate all thumbnails
python manage.py generate_thumbnails --size 500   # Custom thumbnail size
```

**Options:**
- `--force` - Regenerate existing thumbnails
- `--size SIZE` - Thumbnail size (default: 300)
- `--quality QUALITY` - JPEG quality (1-100, default: 85)
- `--media-type TYPE` - Only process specific media type (image, video, audio)

#### `process_media`
Process media files for metadata extraction and format conversion.

```bash
python manage.py process_media [options]

# Examples
python manage.py process_media                    # Process unprocessed files
python manage.py process_media --reprocess        # Reprocess all files
python manage.py process_media --media-id 123     # Process specific file
```

**Options:**
- `--reprocess` - Reprocess already processed files
- `--media-id ID` - Process specific media file by ID
- `--media-type TYPE` - Process only specific media type
- `--workers N` - Number of parallel workers (default: 2)

#### `cleanup_media`
Clean up orphaned media files and database entries.

```bash
python manage.py cleanup_media [options]

# Examples
python manage.py cleanup_media                    # Remove orphaned entries
python manage.py cleanup_media --dry-run          # Show what would be cleaned
python manage.py cleanup_media --thumbnails       # Clean thumbnails only
```

**Options:**
- `--dry-run` - Show what would be cleaned without cleaning
- `--thumbnails` - Clean only thumbnail files
- `--database` - Clean only database entries
- `--files` - Clean only file system entries

### Search and Indexing

#### `rebuild_index`
Rebuild the search index from scratch.

```bash
python manage.py rebuild_index [options]

# Examples
python manage.py rebuild_index                    # Rebuild entire index
python manage.py rebuild_index --remove           # Remove and rebuild index
```

**Options:**
- `--remove` - Remove existing index before rebuilding
- `--batch-size SIZE` - Number of items to process at once (default: 1000)
- `--workers N` - Number of parallel workers

#### `update_index`
Update the search index with recent changes.

```bash
python manage.py update_index [options]

# Examples
python manage.py update_index                     # Update index incrementally
python manage.py update_index --age 24           # Update items changed in last 24 hours
```

**Options:**
- `--age HOURS` - Only update items changed in the last N hours
- `--batch-size SIZE` - Batch size for processing
- `--remove` - Remove items no longer in database

### Plex Integration

#### `sync_plex`
Synchronize with Plex Media Server.

```bash
python manage.py sync_plex [options]

# Examples
python manage.py sync_plex                        # Sync all libraries
python manage.py sync_plex --library "Movies"     # Sync specific library
python manage.py sync_plex --force                # Force full sync
```

**Options:**
- `--library NAME` - Sync specific Plex library
- `--force` - Force full synchronization
- `--dry-run` - Show what would be synchronized
- `--users` - Sync Plex users as well

#### `plex_status`
Show Plex integration status.

```bash
python manage.py plex_status

# Output includes:
# - Connection status
# - Available libraries
# - Last sync time
# - Sync statistics
```

### Backup and Restore

#### `backup_database`
Create database backup.

```bash
python manage.py backup_database [path] [options]

# Examples
python manage.py backup_database                          # Backup to default location
python manage.py backup_database /backups/db_backup.sql   # Backup to specific file
python manage.py backup_database --compress               # Compressed backup
```

**Options:**
- `--compress` - Create compressed backup
- `--exclude-table TABLE` - Exclude specific table from backup

#### `restore_database`
Restore database from backup.

```bash
python manage.py restore_database <backup_file> [options]

# Examples
python manage.py restore_database /backups/db_backup.sql
python manage.py restore_database backup.sql.gz --decompress
```

**Options:**
- `--decompress` - Decompress backup file before restoring
- `--confirm` - Skip confirmation prompt

#### `backup_media`
Create backup of media metadata and configuration.

```bash
python manage.py backup_media [path] [options]

# Examples
python manage.py backup_media                             # Backup to default location
python manage.py backup_media /backups/media_backup.json  # Backup to specific file
```

### System Maintenance

#### `cleanup_sessions`
Remove expired user sessions.

```bash
python manage.py cleanup_sessions

# Remove sessions older than specific age
python manage.py cleanup_sessions --age 30  # 30 days
```

#### `cleanup_logs`
Clean up old log files.

```bash
python manage.py cleanup_logs [options]

# Examples
python manage.py cleanup_logs                    # Clean logs older than 30 days
python manage.py cleanup_logs --days 7          # Clean logs older than 7 days
python manage.py cleanup_logs --size 100M       # Clean when logs exceed 100MB
```

**Options:**
- `--days N` - Remove logs older than N days (default: 30)
- `--size SIZE` - Remove logs when total size exceeds SIZE

#### `check_health`
Perform system health checks.

```bash
python manage.py check_health [options]

# Examples
python manage.py check_health                    # Run all health checks
python manage.py check_health --database         # Check database only
python manage.py check_health --verbose          # Detailed output
```

**Options:**
- `--database` - Check database connectivity and performance
- `--redis` - Check Redis connectivity
- `--storage` - Check file storage accessibility
- `--plex` - Check Plex integration
- `--verbose` - Show detailed information

### Development and Testing

#### `shell`
Open Django shell with MediaNest context.

```bash
python manage.py shell

# Shell with specific imports
python manage.py shell_plus  # If django-extensions is installed
```

#### `runserver`
Start development server.

```bash
python manage.py runserver [address:port]

# Examples
python manage.py runserver                       # Default: 127.0.0.1:8000
python manage.py runserver 0.0.0.0:8000         # Listen on all interfaces
python manage.py runserver 8080                 # Custom port
```

#### `test`
Run test suite.

```bash
python manage.py test [app_or_test] [options]

# Examples
python manage.py test                            # Run all tests
python manage.py test media                      # Run tests for media app
python manage.py test media.tests.test_models   # Run specific test module
```

**Options:**
- `--keepdb` - Keep test database after tests
- `--parallel N` - Run tests in parallel
- `--failfast` - Stop on first failure
- `--verbosity LEVEL` - Output verbosity (0-3)

### Configuration Management

#### `collectstatic`
Collect static files for production deployment.

```bash
python manage.py collectstatic [options]

# Examples
python manage.py collectstatic                   # Collect static files
python manage.py collectstatic --noinput         # No confirmation prompt
python manage.py collectstatic --clear           # Clear existing files first
```

**Options:**
- `--noinput` - Don't prompt for user input
- `--clear` - Clear existing files before collecting
- `--link` - Create symlinks instead of copying files
- `--ignore PATTERN` - Ignore files matching pattern

#### `check`
Check for common problems.

```bash
python manage.py check [options]

# Examples
python manage.py check                           # Basic checks
python manage.py check --deploy                  # Production deployment checks
python manage.py check --database                # Database checks only
```

**Options:**
- `--deploy` - Check deployment-specific issues
- `--database` - Check database configuration
- `--list-tags` - List available check tags

## Custom MediaNest Commands

### Analytics and Reporting

#### `generate_report`
Generate usage and analytics reports.

```bash
python manage.py generate_report <report_type> [options]

# Available report types
python manage.py generate_report usage           # Usage statistics
python manage.py generate_report storage         # Storage analysis
python manage.py generate_report performance     # Performance metrics
python manage.py generate_report user_activity   # User activity report

# Options
python manage.py generate_report usage --format json --output /tmp/report.json
```

**Options:**
- `--format FORMAT` - Output format: text, json, csv, html
- `--output PATH` - Save report to file
- `--date-range RANGE` - Date range: 7d, 30d, 90d, 1y
- `--email TO` - Email report to address

#### `export_data`
Export data in various formats.

```bash
python manage.py export_data <data_type> [options]

# Data types
python manage.py export_data media               # Export media library
python manage.py export_data users               # Export user data
python manage.py export_data collections         # Export collections
python manage.py export_data playlists           # Export playlists

# Examples
python manage.py export_data media --format json --output media_export.json
python manage.py export_data users --format csv --anonymize
```

### Automation and Scheduling

#### `schedule_task`
Schedule recurring maintenance tasks.

```bash
python manage.py schedule_task <task_name> [options]

# Available tasks
python manage.py schedule_task cleanup_thumbnails --interval daily
python manage.py schedule_task scan_media --interval weekly --path /media
python manage.py schedule_task sync_plex --interval hourly
python manage.py schedule_task backup_database --interval daily --time "02:00"
```

**Options:**
- `--interval INTERVAL` - Frequency: hourly, daily, weekly, monthly
- `--time TIME` - Specific time to run (HH:MM format)
- `--enabled` - Enable scheduled task
- `--disabled` - Disable scheduled task

#### `run_scheduled`
Manually run scheduled tasks.

```bash
python manage.py run_scheduled [task_name]

# Examples
python manage.py run_scheduled                   # Run all due tasks
python manage.py run_scheduled cleanup_thumbnails
```

## Environment Variables

Many CLI commands respect environment variables:

```bash
# Database settings
export DATABASE_URL="postgresql://user:pass@localhost/medianest"

# Redis settings
export REDIS_URL="redis://localhost:6379/0"

# Media paths
export MEDIA_ROOT="/data/media"

# Plex settings
export PLEX_SERVER_URL="http://plex.local:32400"
export PLEX_TOKEN="your_plex_token"

# Then run commands normally
python manage.py sync_plex
```

## Batch Operations

### Example Batch Scripts

#### Weekly Maintenance
```bash
#!/bin/bash
# weekly_maintenance.sh

echo "Starting weekly maintenance..."

# Clean up old sessions and logs
python manage.py cleanup_sessions
python manage.py cleanup_logs --days 7

# Update search index
python manage.py update_index

# Generate missing thumbnails
python manage.py generate_thumbnails

# Sync with Plex
python manage.py sync_plex

# Run health checks
python manage.py check_health

# Backup database
python manage.py backup_database

echo "Weekly maintenance completed."
```

#### Media Import Pipeline
```bash
#!/bin/bash
# import_new_media.sh

MEDIA_DIR="/data/incoming"

if [ -d "$MEDIA_DIR" ]; then
    echo "Scanning for new media..."
    
    # Scan and import new media
    python manage.py scan_media "$MEDIA_DIR" --auto-import --recursive
    
    # Generate thumbnails for new files
    python manage.py generate_thumbnails
    
    # Process metadata
    python manage.py process_media
    
    # Update search index
    python manage.py update_index
    
    echo "Media import completed."
else
    echo "Media directory not found: $MEDIA_DIR"
fi
```

## Exit Codes

MediaNest CLI commands use standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Command usage error
- `3` - Database connection error
- `4` - File system error
- `5` - External service error (Plex, Redis, etc.)

## Getting Help

### Command Help
```bash
# Get help for any command
python manage.py help <command>

# Examples
python manage.py help scan_media
python manage.py help generate_thumbnails
```

### List All Commands
```bash
# List all available commands
python manage.py help

# List commands by category
python manage.py help --commands
```

### Verbose Output
Most commands support verbose output:

```bash
python manage.py scan_media --verbosity 2
python manage.py generate_thumbnails --verbose
```

## Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Ensure proper file permissions
sudo chown -R medianest:medianest /data/media
sudo chmod -R 755 /data/media
```

#### Database Connection Issues
```bash
# Test database connection
python manage.py dbshell

# Check database settings
python manage.py check --database
```

#### Memory Issues
```bash
# Reduce batch size for large operations
python manage.py generate_thumbnails --batch-size 10
python manage.py process_media --workers 1
```

### Debug Mode
Enable debug output for troubleshooting:

```bash
export DEBUG=1
export DJANGO_LOG_LEVEL=DEBUG
python manage.py <command> --verbosity 3
```

## Next Steps

- [Configuration Reference](../installation/configuration.md) - Environment and settings
- [Troubleshooting Guide](../troubleshooting/index.md) - Common issues and solutions  
- [API Reference](../api/index.md) - REST API documentation
- [Developer Setup](../developers/development-setup.md) - Development environment