# Manual Installation

This guide covers installing MediaNest directly on your system without Docker.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, or macOS 10.15+
- **Python**: 3.9 or later
- **Node.js**: 16.x or later
- **Database**: PostgreSQL 12+ or MySQL 8.0+
- **Redis**: 6.0 or later

### Install System Dependencies

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib redis-server
```

#### CentOS/RHEL
```bash
sudo yum update
sudo yum install -y python3 python3-pip nodejs npm postgresql-server postgresql-contrib redis
```

#### macOS
```bash
brew install python@3.9 node postgresql redis
```

## Database Setup

### PostgreSQL (Recommended)

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
   CREATE DATABASE medianest;
   CREATE USER medianest WITH ENCRYPTED PASSWORD 'your_password_here';
   GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;
   \q
   ```

### MySQL (Alternative)

1. **Start MySQL service**:
   ```bash
   sudo systemctl start mysql
   sudo systemctl enable mysql
   ```

2. **Create database and user**:
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE medianest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'medianest'@'localhost' IDENTIFIED BY 'your_password_here';
   GRANT ALL PRIVILEGES ON medianest.* TO 'medianest'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

## MediaNest Installation

### 1. Download Source Code

```bash
git clone https://github.com/medianest/medianest.git
cd medianest
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies

```bash
npm install
npm run build
```

### 5. Configure Environment

Create `.env` file in the project root:

```bash
# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://medianest:your_password_here@localhost:5432/medianest

# Database Configuration (MySQL)
# DATABASE_URL=mysql://medianest:your_password_here@localhost:3306/medianest

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# MediaNest Configuration
SECRET_KEY=your_very_long_random_secret_key_here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Media Configuration
MEDIA_ROOT=/path/to/your/media/files
MEDIA_URL=/media/

# Plex Integration (Optional)
PLEX_SERVER_URL=http://localhost:32400
PLEX_TOKEN=your_plex_token_here

# Email Configuration (Optional)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### 6. Initialize Database

```bash
# Apply database migrations
python manage.py migrate

# Create superuser account
python manage.py createsuperuser

# Load initial data (optional)
python manage.py loaddata fixtures/initial_data.json
```

### 7. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 8. Start Services

#### Development Server
```bash
python manage.py runserver 0.0.0.0:8000
```

#### Production Server (Gunicorn)
```bash
pip install gunicorn
gunicorn --bind 0.0.0.0:8000 medianest.wsgi:application
```

## Production Deployment

### Nginx Configuration

Create `/etc/nginx/sites-available/medianest`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100M;

    location /static/ {
        alias /path/to/medianest/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /path/to/your/media/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/medianest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Systemd Service

Create `/etc/systemd/system/medianest.service`:

```ini
[Unit]
Description=MediaNest Application
After=network.target postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
User=medianest
Group=medianest
WorkingDirectory=/home/medianest/medianest
Environment="PATH=/home/medianest/medianest/venv/bin"
ExecStart=/home/medianest/medianest/venv/bin/gunicorn --bind 127.0.0.1:8000 medianest.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable medianest
sudo systemctl start medianest
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Maintenance Tasks

### Regular Updates

```bash
# Activate virtual environment
source venv/bin/activate

# Pull latest code
git pull origin main

# Update dependencies
pip install -r requirements.txt --upgrade
npm install
npm run build

# Apply database migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Restart application
sudo systemctl restart medianest
```

### Database Backup

```bash
# PostgreSQL backup
pg_dump -U medianest -h localhost medianest > backup_$(date +%Y%m%d).sql

# MySQL backup
mysqldump -u medianest -p medianest > backup_$(date +%Y%m%d).sql
```

### Log Management

```bash
# View application logs
sudo journalctl -u medianest -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

#### Python Module Not Found
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt
```

#### Database Connection Error
```bash
# Check database service status
sudo systemctl status postgresql

# Test database connection
psql -U medianest -h localhost -d medianest
```

#### Permission Errors
```bash
# Fix file permissions
sudo chown -R medianest:medianest /path/to/medianest
sudo chmod -R 755 /path/to/medianest
```

#### Static Files Not Loading
```bash
# Recollect static files
python manage.py collectstatic --clear --noinput

# Check Nginx configuration
sudo nginx -t
```

## Next Steps

- [Configuration Guide](configuration.md) - Detailed configuration options
- [Environment Variables](environment.md) - Complete environment reference
- [Database Setup](database.md) - Advanced database configuration