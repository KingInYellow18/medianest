#!/bin/bash
# MediaNest SSL Certificate Setup Script
# Initializes Let's Encrypt SSL certificates for the domain

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   print_message "$RED" "This script must be run as root or with sudo"
   exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_message "$RED" "Error: .env file not found. Please create it from .env.production template"
    exit 1
fi

# Validate required environment variables
if [ -z "$DOMAIN_NAME" ]; then
    print_message "$RED" "Error: DOMAIN_NAME not set in .env file"
    exit 1
fi

if [ -z "$CERTBOT_EMAIL" ]; then
    print_message "$RED" "Error: CERTBOT_EMAIL not set in .env file"
    exit 1
fi

print_message "$GREEN" "=== MediaNest SSL Certificate Setup ==="
print_message "$YELLOW" "Domain: $DOMAIN_NAME"
print_message "$YELLOW" "Email: $CERTBOT_EMAIL"
echo

# Create necessary directories
print_message "$YELLOW" "Creating directories..."
mkdir -p ${DATA_PATH:-./data}/certbot/webroot
mkdir -p ${DATA_PATH:-./data}/certbot/ssl
mkdir -p ${LOG_PATH:-./logs}/certbot

# Check if certificates already exist
if [ -d "${DATA_PATH:-./data}/certbot/ssl/live/$DOMAIN_NAME" ]; then
    print_message "$YELLOW" "Certificates already exist for $DOMAIN_NAME"
    read -p "Do you want to renew/replace them? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message "$GREEN" "Keeping existing certificates"
        exit 0
    fi
fi

# Start nginx in HTTP-only mode for initial certificate generation
print_message "$YELLOW" "Starting nginx for HTTP challenge..."

# Create a temporary nginx config for HTTP-only mode
cat > ${DATA_PATH:-./data}/certbot/nginx-temp.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name _;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 404;
        }
    }
}
EOF

# Start temporary nginx container
docker run -d \
    --name medianest-nginx-temp \
    -p 80:80 \
    -v ${DATA_PATH:-./data}/certbot/webroot:/var/www/certbot:ro \
    -v ${DATA_PATH:-./data}/certbot/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

# Wait for nginx to start
sleep 5

# Request the certificate
print_message "$YELLOW" "Requesting SSL certificate from Let's Encrypt..."

docker run --rm \
    -v ${DATA_PATH:-./data}/certbot/webroot:/var/www/certbot:rw \
    -v ${DATA_PATH:-./data}/certbot/ssl:/etc/letsencrypt:rw \
    -v ${LOG_PATH:-./logs}/certbot:/var/log/letsencrypt:rw \
    certbot/certbot:latest \
    certonly \
    --webroot \
    -w /var/www/certbot \
    --email $CERTBOT_EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN_NAME \
    -d www.$DOMAIN_NAME

# Check if certificate was created successfully
if [ $? -eq 0 ]; then
    print_message "$GREEN" "SSL certificate obtained successfully!"
else
    print_message "$RED" "Failed to obtain SSL certificate"
    # Stop and remove temporary nginx
    docker stop medianest-nginx-temp
    docker rm medianest-nginx-temp
    rm -f ${DATA_PATH:-./data}/certbot/nginx-temp.conf
    exit 1
fi

# Stop and remove temporary nginx
print_message "$YELLOW" "Cleaning up temporary nginx..."
docker stop medianest-nginx-temp
docker rm medianest-nginx-temp
rm -f ${DATA_PATH:-./data}/certbot/nginx-temp.conf

# Create a recommended SSL options file
print_message "$YELLOW" "Creating SSL configuration..."
mkdir -p ${DATA_PATH:-./data}/certbot/ssl/options-ssl-nginx.conf
cat > ${DATA_PATH:-./data}/certbot/ssl/options-ssl-nginx.conf << 'EOF'
# This file contains important security parameters. If you modify this file
# manually, Certbot will be unable to automatically provide future security
# updates. Instead, Certbot will print and log an error message with a path to
# the up-to-date file that you will need to refer to when manually updating
# this file.

ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;

ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
EOF

print_message "$GREEN" "=== SSL Setup Complete ==="
echo
print_message "$YELLOW" "Next steps:"
print_message "$YELLOW" "1. Start MediaNest with: docker compose -f docker-compose.prod.yml up -d"
print_message "$YELLOW" "2. Verify HTTPS is working at: https://$DOMAIN_NAME"
print_message "$YELLOW" "3. Certificate will auto-renew every 12 hours via Certbot service"
echo
print_message "$GREEN" "Certificate details:"
docker run --rm \
    -v ${DATA_PATH:-./data}/certbot/ssl:/etc/letsencrypt:ro \
    certbot/certbot:latest \
    certificates