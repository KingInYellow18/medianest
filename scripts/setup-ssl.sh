#!/bin/bash

# MediaNest SSL Certificate Setup Script
# Configures Let's Encrypt SSL certificates for production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NGINX_CONTAINER="${NGINX_CONTAINER:-medianest-nginx}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
STAGING="${STAGING:-false}"
SSL_PATH="./infrastructure/nginx/ssl"
WEBROOT_PATH="/var/www/certbot"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed."
        exit 1
    fi
    
    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is required but not installed."
        exit 1
    fi
    
    # Check required environment variables
    if [ -z "$DOMAIN_NAME" ]; then
        log_error "DOMAIN_NAME environment variable is required."
        echo "Usage: DOMAIN_NAME=yourdomain.com CERTBOT_EMAIL=your@email.com $0"
        exit 1
    fi
    
    if [ -z "$CERTBOT_EMAIL" ]; then
        log_error "CERTBOT_EMAIL environment variable is required."
        echo "Usage: DOMAIN_NAME=yourdomain.com CERTBOT_EMAIL=your@email.com $0"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to create SSL directory structure
create_ssl_directories() {
    log_info "Creating SSL directory structure..."
    
    mkdir -p "$SSL_PATH"
    mkdir -p "./data/certbot/conf"
    mkdir -p "./data/certbot/www"
    
    log_success "SSL directories created"
}

# Function to generate DH parameters
generate_dhparam() {
    local dhparam_file="$SSL_PATH/dhparam.pem"
    
    if [ -f "$dhparam_file" ]; then
        log_info "DH parameters already exist, skipping generation"
        return
    fi
    
    log_info "Generating DH parameters (this may take a while)..."
    openssl dhparam -out "$dhparam_file" 2048
    chmod 600 "$dhparam_file"
    log_success "DH parameters generated"
}

# Function to generate self-signed certificate for initial setup
generate_self_signed() {
    log_info "Generating self-signed certificate for initial setup..."
    
    # Create temporary self-signed certificate
    docker run --rm \
        -v "$(pwd)/$SSL_PATH:/certs" \
        alpine/openssl req -x509 -nodes -newkey rsa:4096 \
        -keyout /certs/privkey.pem \
        -out /certs/fullchain.pem \
        -days 365 \
        -subj "/C=US/ST=State/L=City/O=MediaNest/CN=$DOMAIN_NAME"
    
    # Create chain.pem (same as fullchain for self-signed)
    cp "$SSL_PATH/fullchain.pem" "$SSL_PATH/chain.pem"
    
    chmod 600 "$SSL_PATH"/*.pem
    log_success "Self-signed certificate generated"
}

# Function to start nginx with temporary certificate
start_nginx_temp() {
    log_info "Starting nginx with temporary certificate..."
    
    # Start nginx container
    docker-compose -f docker-compose.prod.yml up -d nginx
    
    # Wait for nginx to start
    sleep 5
    
    if docker ps | grep -q "$NGINX_CONTAINER"; then
        log_success "Nginx started successfully"
    else
        log_error "Failed to start nginx"
        exit 1
    fi
}

# Function to obtain Let's Encrypt certificate
obtain_letsencrypt_cert() {
    log_info "Obtaining Let's Encrypt certificate..."
    
    local staging_arg=""
    if [ "$STAGING" = "true" ]; then
        staging_arg="--staging"
        log_warning "Using Let's Encrypt staging environment"
    fi
    
    # Run certbot
    docker run --rm \
        -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/data/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$CERTBOT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        $staging_arg \
        -d "$DOMAIN_NAME"
    
    if [ $? -eq 0 ]; then
        log_success "Let's Encrypt certificate obtained successfully"
        
        # Copy certificates to SSL directory
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/privkey.pem" "$SSL_PATH/"
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/fullchain.pem" "$SSL_PATH/"
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/chain.pem" "$SSL_PATH/"
        chmod 600 "$SSL_PATH"/*.pem
        
        log_success "Certificates copied to SSL directory"
    else
        log_error "Failed to obtain Let's Encrypt certificate"
        exit 1
    fi
}

# Function to reload nginx with new certificate
reload_nginx() {
    log_info "Reloading nginx with new certificate..."
    
    docker exec "$NGINX_CONTAINER" nginx -s reload
    
    if [ $? -eq 0 ]; then
        log_success "Nginx reloaded successfully"
    else
        log_error "Failed to reload nginx"
        exit 1
    fi
}

# Function to setup automatic renewal
setup_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > ./scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
# MediaNest SSL Certificate Renewal Script

set -euo pipefail

# Configuration
DOMAIN_NAME="${DOMAIN_NAME}"
NGINX_CONTAINER="${NGINX_CONTAINER:-medianest-nginx}"
SSL_PATH="./infrastructure/nginx/ssl"

echo "[$(date)] Starting certificate renewal check..."

# Renew certificate
docker run --rm \
    -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/data/certbot/www:/var/www/certbot" \
    certbot/certbot renew \
    --quiet \
    --no-self-upgrade

if [ $? -eq 0 ]; then
    echo "[$(date)] Certificate renewal successful"
    
    # Copy renewed certificates
    if [ -f "./data/certbot/conf/live/$DOMAIN_NAME/privkey.pem" ]; then
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/privkey.pem" "$SSL_PATH/"
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/fullchain.pem" "$SSL_PATH/"
        cp -L "./data/certbot/conf/live/$DOMAIN_NAME/chain.pem" "$SSL_PATH/"
        chmod 600 "$SSL_PATH"/*.pem
        
        # Reload nginx
        docker exec "$NGINX_CONTAINER" nginx -s reload
        echo "[$(date)] Nginx reloaded with new certificate"
    fi
else
    echo "[$(date)] Certificate renewal failed or not needed"
fi
EOF

    chmod +x ./scripts/renew-ssl.sh
    
    # Create systemd timer for automatic renewal (if systemd is available)
    if command -v systemctl &> /dev/null; then
        log_info "Creating systemd timer for automatic renewal..."
        
        sudo tee /etc/systemd/system/medianest-ssl-renewal.service > /dev/null << EOF
[Unit]
Description=MediaNest SSL Certificate Renewal
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/scripts/renew-ssl.sh
StandardOutput=journal
StandardError=journal
EOF

        sudo tee /etc/systemd/system/medianest-ssl-renewal.timer > /dev/null << EOF
[Unit]
Description=MediaNest SSL Certificate Renewal Timer
Requires=medianest-ssl-renewal.service

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable medianest-ssl-renewal.timer
        sudo systemctl start medianest-ssl-renewal.timer
        
        log_success "Systemd timer created and enabled"
    else
        log_warning "Systemd not available. Please set up cron job manually:"
        echo "0 2 * * * cd $(pwd) && ./scripts/renew-ssl.sh >> ./logs/ssl-renewal.log 2>&1"
    fi
    
    log_success "Automatic renewal setup completed"
}

# Function to test SSL configuration
test_ssl_config() {
    log_info "Testing SSL configuration..."
    
    # Test with curl
    if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN_NAME" | grep -q "200\|301\|302"; then
        log_success "HTTPS is working correctly"
    else
        log_warning "HTTPS test returned unexpected status code"
    fi
    
    # Test SSL certificate
    echo | openssl s_client -servername "$DOMAIN_NAME" -connect "$DOMAIN_NAME:443" 2>/dev/null | \
        openssl x509 -noout -text | grep -q "$DOMAIN_NAME"
    
    if [ $? -eq 0 ]; then
        log_success "SSL certificate is valid for $DOMAIN_NAME"
    else
        log_warning "SSL certificate validation failed"
    fi
}

# Main function
main() {
    log_info "MediaNest SSL Certificate Setup"
    log_info "================================"
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Create directories
    create_ssl_directories
    
    # Generate DH parameters
    generate_dhparam
    
    # Generate self-signed certificate
    generate_self_signed
    
    # Start nginx with temporary certificate
    start_nginx_temp
    
    # Obtain Let's Encrypt certificate
    obtain_letsencrypt_cert
    
    # Reload nginx with new certificate
    reload_nginx
    
    # Setup automatic renewal
    setup_renewal
    
    # Test SSL configuration
    test_ssl_config
    
    echo
    log_success "SSL setup completed successfully!"
    echo
    log_info "Next steps:"
    echo "1. Verify HTTPS is working: https://$DOMAIN_NAME"
    echo "2. Check certificate details: openssl s_client -connect $DOMAIN_NAME:443 -servername $DOMAIN_NAME"
    echo "3. Test SSL security: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN_NAME"
    echo "4. Monitor renewal logs: tail -f ./logs/ssl-renewal.log"
    echo
    log_warning "Important notes:"
    echo "- Certificates will auto-renew daily via systemd timer or cron"
    echo "- Renewal logs are stored in ./logs/ssl-renewal.log"
    echo "- Let's Encrypt certificates are valid for 90 days"
    echo "- Renewal attempts start 30 days before expiration"
}

# Run main function
main "$@"