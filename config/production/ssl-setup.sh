#!/bin/bash
# MediaNest SSL Certificate Setup Script
# Supports both Let's Encrypt and custom certificates

set -e

DOMAIN="medianest.yourdomain.com"
WWW_DOMAIN="www.medianest.yourdomain.com"
EMAIL="admin@yourdomain.com"
SSL_DIR="/opt/medianest/ssl"
WEBROOT="/var/www/html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
    
    # Check if domain is reachable
    if ! ping -c 1 "$DOMAIN" &> /dev/null; then
        print_warning "Domain $DOMAIN is not reachable. Make sure DNS is configured correctly."
    fi
    
    # Create necessary directories
    mkdir -p "$SSL_DIR"/{certs,private}
    mkdir -p "$WEBROOT"
    
    print_status "Prerequisites checked successfully"
}

install_certbot() {
    print_status "Installing Certbot..."
    
    # Update package list
    apt update
    
    # Install certbot
    apt install -y certbot python3-certbot-nginx
    
    print_status "Certbot installed successfully"
}

setup_letsencrypt() {
    print_status "Setting up Let's Encrypt SSL certificate..."
    
    # Stop nginx if running
    systemctl stop nginx 2>/dev/null || true
    
    # Obtain certificate using standalone mode
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN,$WWW_DOMAIN" \
        --non-interactive
    
    if [[ $? -eq 0 ]]; then
        print_status "SSL certificate obtained successfully"
        
        # Copy certificates to application directory
        cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/certs/medianest.crt"
        cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/private/medianest.key"
        cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" "$SSL_DIR/certs/ca-certificates.crt"
        
        # Set proper permissions
        chmod 644 "$SSL_DIR/certs/"*.crt
        chmod 600 "$SSL_DIR/private/"*.key
        chown root:root "$SSL_DIR/certs/"*.crt
        chown root:root "$SSL_DIR/private/"*.key
        
        # Setup automatic renewal
        setup_auto_renewal
        
        print_status "Let's Encrypt SSL setup completed"
    else
        print_error "Failed to obtain SSL certificate"
        exit 1
    fi
}

setup_custom_ssl() {
    print_status "Setting up custom SSL certificate..."
    
    read -p "Enter path to your certificate file (.crt): " cert_file
    read -p "Enter path to your private key file (.key): " key_file
    read -p "Enter path to your CA bundle file (.crt) [optional]: " ca_file
    
    # Validate certificate files
    if [[ ! -f "$cert_file" ]]; then
        print_error "Certificate file not found: $cert_file"
        exit 1
    fi
    
    if [[ ! -f "$key_file" ]]; then
        print_error "Private key file not found: $key_file"
        exit 1
    fi
    
    # Verify certificate and key match
    cert_hash=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    key_hash=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [[ "$cert_hash" != "$key_hash" ]]; then
        print_error "Certificate and private key do not match"
        exit 1
    fi
    
    # Copy certificates
    cp "$cert_file" "$SSL_DIR/certs/medianest.crt"
    cp "$key_file" "$SSL_DIR/private/medianest.key"
    
    if [[ -f "$ca_file" ]]; then
        cp "$ca_file" "$SSL_DIR/certs/ca-certificates.crt"
    fi
    
    # Set proper permissions
    chmod 644 "$SSL_DIR/certs/"*.crt
    chmod 600 "$SSL_DIR/private/"*.key
    chown root:root "$SSL_DIR/certs/"*.crt
    chown root:root "$SSL_DIR/private/"*.key
    
    print_status "Custom SSL certificate setup completed"
}

setup_auto_renewal() {
    print_status "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > /usr/local/bin/certbot-renew.sh << 'EOF'
#!/bin/bash
# Automatic certificate renewal script

LOG_FILE="/var/log/certbot-renew.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting certificate renewal check" >> $LOG_FILE

# Renew certificates
if certbot renew --quiet --post-hook "systemctl reload nginx" >> $LOG_FILE 2>&1; then
    echo "[$DATE] Certificate renewal check completed successfully" >> $LOG_FILE
    
    # Copy renewed certificates to application directory
    if [[ -f "/etc/letsencrypt/live/medianest.yourdomain.com/fullchain.pem" ]]; then
        cp "/etc/letsencrypt/live/medianest.yourdomain.com/fullchain.pem" "/opt/medianest/ssl/certs/medianest.crt"
        cp "/etc/letsencrypt/live/medianest.yourdomain.com/privkey.pem" "/opt/medianest/ssl/private/medianest.key"
        echo "[$DATE] Certificates copied to application directory" >> $LOG_FILE
        
        # Restart Docker containers if needed
        cd /opt/medianest/app && docker-compose -f docker-compose.production.yml restart nginx
        echo "[$DATE] Docker containers restarted" >> $LOG_FILE
    fi
else
    echo "[$DATE] Certificate renewal failed" >> $LOG_FILE
    exit 1
fi
EOF
    
    chmod +x /usr/local/bin/certbot-renew.sh
    
    # Add cron job for automatic renewal (twice daily)
    echo "0 */12 * * * root /usr/local/bin/certbot-renew.sh" > /etc/cron.d/certbot-renew
    
    print_status "Automatic renewal setup completed"
}

test_ssl_configuration() {
    print_status "Testing SSL configuration..."
    
    # Test certificate validity
    if openssl x509 -in "$SSL_DIR/certs/medianest.crt" -text -noout | grep -q "Signature Algorithm"; then
        print_status "SSL certificate is valid"
        
        # Display certificate information
        echo "Certificate Information:"
        openssl x509 -in "$SSL_DIR/certs/medianest.crt" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:)"
        
        # Test certificate expiration
        exp_date=$(openssl x509 -in "$SSL_DIR/certs/medianest.crt" -noout -enddate | cut -d= -f2)
        exp_timestamp=$(date -d "$exp_date" +%s)
        current_timestamp=$(date +%s)
        days_until_expiry=$(( (exp_timestamp - current_timestamp) / 86400 ))
        
        if [[ $days_until_expiry -lt 30 ]]; then
            print_warning "Certificate expires in $days_until_expiry days"
        else
            print_status "Certificate is valid for $days_until_expiry more days"
        fi
    else
        print_error "SSL certificate is invalid"
        exit 1
    fi
}

create_nginx_ssl_config() {
    print_status "Creating SSL configuration for Nginx..."
    
    # Create SSL-specific configuration
    cat > /etc/nginx/conf.d/ssl-security.conf << 'EOF'
# SSL Security Configuration
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# SSL Protocols and Ciphers
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
ssl_prefer_server_ciphers off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 1.0.0.1 valid=300s;
resolver_timeout 5s;

# SSL Certificate paths
ssl_certificate /opt/medianest/ssl/certs/medianest.crt;
ssl_certificate_key /opt/medianest/ssl/private/medianest.key;
ssl_trusted_certificate /opt/medianest/ssl/certs/ca-certificates.crt;
EOF
    
    print_status "Nginx SSL configuration created"
}

main() {
    print_status "MediaNest SSL Setup Script"
    print_status "=========================="
    
    check_prerequisites
    
    echo "Choose SSL certificate option:"
    echo "1) Let's Encrypt (Free, automatic renewal)"
    echo "2) Custom SSL certificate"
    read -p "Enter your choice (1 or 2): " choice
    
    case $choice in
        1)
            install_certbot
            setup_letsencrypt
            ;;
        2)
            setup_custom_ssl
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
    
    test_ssl_configuration
    create_nginx_ssl_config
    
    print_status "SSL setup completed successfully!"
    print_status "Next steps:"
    echo "1. Update your nginx configuration to use SSL"
    echo "2. Test your SSL configuration: https://$DOMAIN"
    echo "3. Run SSL Labs test: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
    
    if [[ $choice -eq 1 ]]; then
        print_status "Let's Encrypt certificates will auto-renew via cron job"
    else
        print_warning "Remember to manually renew your custom certificate before it expires"
    fi
}

# Run main function
main "$@"