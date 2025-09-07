# Self-Hosted Installation Guide

Complete guide for installing and deploying MediaNest on your own infrastructure, covering various deployment scenarios and platforms.

## Table of Contents

- [Installation Overview](#installation-overview)
- [System Requirements](#system-requirements)
- [Pre-Installation Setup](#pre-installation-setup)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Platform-Specific Guides](#platform-specific-guides)
- [Cloud Provider Setup](#cloud-provider-setup)
- [Bare Metal Installation](#bare-metal-installation)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Post-Installation Configuration](#post-installation-configuration)
- [Security Hardening](#security-hardening)
- [Maintenance](#maintenance)

## Installation Overview

MediaNest can be self-hosted using several approaches:

1. **Docker Compose** (Recommended) - Single server deployment
2. **Kubernetes** - Scalable container orchestration
3. **Bare Metal** - Direct installation on server
4. **Cloud Platforms** - AWS, GCP, Azure, DigitalOcean
5. **Home Server** - Personal/small-scale deployment

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │   MediaNest     │    │   PostgreSQL    │
│  Reverse Proxy  │────│   Application   │────│    Database     │
│   SSL/Load Bal  │    │  Backend+Front  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Certbot SSL   │    │     Redis       │    │  File Storage   │
│   Management    │    │     Cache       │    │ Uploads/Media   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## System Requirements

### Minimum Requirements

**Single Server Setup:**

- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- **CPU**: 2 cores (x86_64)
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps internet connection

**Recommended Production:**

- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4+ cores (x86_64)
- **RAM**: 8GB+
- **Storage**: 200GB+ NVMe SSD
- **Network**: 1 Gbps internet connection

### Software Dependencies

- **Docker**: 24.0+ and Docker Compose 2.20+
- **Git**: Latest version
- **curl/wget**: For downloading files
- **openssl**: For generating certificates and secrets
- **ufw/iptables**: For firewall management

### Network Requirements

**Required Ports:**

- **80/tcp**: HTTP (redirects to HTTPS)
- **443/tcp**: HTTPS
- **22/tcp**: SSH (for management)

**Optional Ports:**

- **9090/tcp**: Prometheus metrics (internal)
- **3001/tcp**: Grafana dashboard (internal)

## Pre-Installation Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git ufw software-properties-common

# Create a dedicated user for MediaNest
sudo adduser --disabled-password --gecos "" medianest
sudo usermod -aG sudo medianest
sudo usermod -aG docker medianest

# Switch to MediaNest user
sudo su - medianest
```

### 2. Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Test Docker installation
docker run hello-world
```

### 3. Configure Firewall

```bash
# Enable UFW
sudo ufw --force enable

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optional: Allow specific monitoring ports from specific IPs
# sudo ufw allow from YOUR_MONITORING_IP to any port 9090

# Check firewall status
sudo ufw status verbose
```

### 4. Domain and DNS Setup

```bash
# Verify domain points to your server
nslookup yourdomain.com
dig yourdomain.com

# Test connectivity
curl -I http://yourdomain.com
```

## Quick Installation

### Automated Installation Script

```bash
#!/bin/bash
# install-medianest.sh - Quick installation script

set -euo pipefail

# Configuration
DOMAIN_NAME="${DOMAIN_NAME:-medianest.local}"
EMAIL="${EMAIL:-admin@example.com}"
INSTALL_DIR="${INSTALL_DIR:-/opt/medianest}"
MEDIANEST_USER="${MEDIANEST_USER:-medianest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root"
   exit 1
fi

# Function to check system requirements
check_requirements() {
    log_info "Checking system requirements..."

    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        log_error "Unable to detect operating system"
        exit 1
    fi

    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "debian" ]] && [[ "$ID" != "centos" ]]; then
        log_warning "Unsupported OS: $ID. Proceeding anyway..."
    fi

    # Check available memory
    MEM_GB=$(free -g | awk 'NR==2{print $2}')
    if [[ $MEM_GB -lt 4 ]]; then
        log_warning "System has only ${MEM_GB}GB RAM. 4GB+ recommended."
    fi

    # Check available disk space
    DISK_GB=$(df / | awk 'NR==2{print int($4/1024/1024)}')
    if [[ $DISK_GB -lt 50 ]]; then
        log_warning "Low disk space: ${DISK_GB}GB available. 50GB+ recommended."
    fi

    log_success "System requirements check completed"
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing system dependencies..."

    # Update package list
    sudo apt update

    # Install required packages
    sudo apt install -y curl wget git ufw openssl jq

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh

        # Add user to docker group
        sudo usermod -aG docker $USER

        # Start Docker service
        sudo systemctl start docker
        sudo systemctl enable docker
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
            -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi

    log_success "Dependencies installed successfully"
}

# Function to download and setup MediaNest
setup_medianest() {
    log_info "Setting up MediaNest..."

    # Create installation directory
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$USER:$USER" "$INSTALL_DIR"

    # Clone repository
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Updating existing installation..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        log_info "Cloning MediaNest repository..."
        git clone https://github.com/your-org/medianest.git "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Create required directories
    mkdir -p {data,logs,backups,secrets}
    mkdir -p data/{postgres,redis,downloads,uploads,certbot}
    mkdir -p logs/{backend,frontend,nginx,certbot}

    # Set proper permissions
    chmod 755 data/ logs/ backups/
    chmod 700 secrets/

    log_success "MediaNest setup completed"
}

# Function to generate configuration
generate_config() {
    log_info "Generating configuration..."

    # Generate secrets
    log_info "Generating secure secrets..."
    echo -n "$(openssl rand -base64 32)" > secrets/jwt_secret
    echo -n "$(openssl rand -base64 32)" > secrets/encryption_key
    echo -n "$(openssl rand -base64 32)" > secrets/nextauth_secret
    echo -n "$(openssl rand -base64 16)" > secrets/postgres_password
    echo -n "$(openssl rand -base64 16)" > secrets/redis_password

    # Generate database URL
    POSTGRES_PASSWORD=$(cat secrets/postgres_password)
    echo -n "postgresql://medianest:${POSTGRES_PASSWORD}@postgres:5432/medianest" > secrets/database_url

    # Generate Redis URL
    REDIS_PASSWORD=$(cat secrets/redis_password)
    echo -n "redis://redis:6379" > secrets/redis_url

    # Set secret permissions
    chmod 600 secrets/*

    # Generate environment file
    cat > .env.production <<EOF
# MediaNest Production Configuration
NODE_ENV=production
DOMAIN_NAME=${DOMAIN_NAME}
CERTBOT_EMAIL=${EMAIL}

# URLs
FRONTEND_URL=https://${DOMAIN_NAME}
NEXT_PUBLIC_API_URL=https://${DOMAIN_NAME}/api/v1
NEXTAUTH_URL=https://${DOMAIN_NAME}

# CORS Configuration
CORS_ORIGIN=https://${DOMAIN_NAME}

# Container Configuration
VERSION=latest
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF=$(git rev-parse --short HEAD || echo 'unknown')

# Paths
DATA_PATH=./data
LOG_PATH=./logs
BACKUP_PATH=./backups

# Feature Flags
FEATURE_REAL_TIME_UPDATES=true
FEATURE_ADVANCED_SEARCH=true
FEATURE_RECOMMENDATIONS=true
EOF

    # Generate Grafana password
    echo -n "$(openssl rand -base64 16)" > secrets/grafana_password

    log_success "Configuration generated successfully"
    log_info "Domain: ${DOMAIN_NAME}"
    log_info "Admin email: ${EMAIL}"
    log_info "Installation directory: ${INSTALL_DIR}"
}

# Function to configure firewall
configure_firewall() {
    log_info "Configuring firewall..."

    # Enable UFW if not already enabled
    sudo ufw --force enable

    # Set default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing

    # Allow SSH
    sudo ufw allow 22/tcp

    # Allow HTTP/HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp

    # Reload firewall
    sudo ufw reload

    log_success "Firewall configured successfully"
}

# Function to start services
start_services() {
    log_info "Starting MediaNest services..."

    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull

    # Start services
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    sleep 30

    # Check service health
    local services_healthy=true

    # Check PostgreSQL
    if docker-compose exec postgres pg_isready -U medianest &>/dev/null; then
        log_success "PostgreSQL is healthy"
    else
        log_error "PostgreSQL health check failed"
        services_healthy=false
    fi

    # Check Redis
    if docker-compose exec redis redis-cli ping &>/dev/null; then
        log_success "Redis is healthy"
    else
        log_error "Redis health check failed"
        services_healthy=false
    fi

    # Check backend
    if timeout 60 bash -c 'until curl -f http://localhost:4000/api/health &>/dev/null; do sleep 2; done'; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        services_healthy=false
    fi

    if [[ "$services_healthy" == "true" ]]; then
        log_success "All services started successfully"
    else
        log_error "Some services failed to start properly"
        log_info "Check logs: docker-compose -f docker-compose.prod.yml logs"
        return 1
    fi
}

# Function to setup SSL
setup_ssl() {
    log_info "Setting up SSL certificate..."

    # Check if domain resolves to this server
    DOMAIN_IP=$(dig +short "$DOMAIN_NAME" | head -1)
    SERVER_IP=$(curl -s http://checkip.amazonaws.com/ || curl -s http://ipinfo.io/ip)

    if [[ "$DOMAIN_IP" != "$SERVER_IP" ]]; then
        log_warning "Domain $DOMAIN_NAME does not resolve to this server ($SERVER_IP)"
        log_warning "SSL certificate generation may fail"
        log_info "Please update your DNS records to point to $SERVER_IP"
    fi

    # Generate initial certificate
    log_info "Generating SSL certificate for $DOMAIN_NAME..."
    docker-compose -f docker-compose.prod.yml run --rm certbot \
        certonly --webroot -w /var/www/certbot \
        --email "$EMAIL" --agree-tos --no-eff-email \
        -d "$DOMAIN_NAME"

    if [[ $? -eq 0 ]]; then
        log_success "SSL certificate generated successfully"

        # Restart nginx to use SSL
        docker-compose -f docker-compose.prod.yml restart nginx
    else
        log_error "SSL certificate generation failed"
        log_info "You can try again later with: docker-compose run --rm certbot ..."
    fi
}

# Function to display completion info
display_completion_info() {
    log_success "MediaNest installation completed!"

    echo
    echo "==============================================="
    echo "MediaNest Self-Hosted Installation Complete"
    echo "==============================================="
    echo
    echo "🌐 Application URL: https://${DOMAIN_NAME}"
    echo "📊 Installation Directory: ${INSTALL_DIR}"
    echo "🔧 Configuration File: ${INSTALL_DIR}/.env.production"
    echo
    echo "📋 Next Steps:"
    echo "1. Visit https://${DOMAIN_NAME} to access MediaNest"
    echo "2. Complete the initial setup wizard"
    echo "3. Configure your Plex server connection"
    echo "4. Set up monitoring (optional): docker-compose --profile monitoring up -d"
    echo "5. Set up backups: docker-compose --profile backup up -d"
    echo
    echo "🛠️  Management Commands:"
    echo "• View logs: docker-compose -f docker-compose.prod.yml logs"
    echo "• Restart services: docker-compose -f docker-compose.prod.yml restart"
    echo "• Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "• Update: git pull && docker-compose -f docker-compose.prod.yml up -d --build"
    echo
    echo "📖 Documentation: ${INSTALL_DIR}/docs/"
    echo "🚨 Support: Create an issue in the GitHub repository"
    echo

    # Display service status
    echo "🔍 Service Status:"
    docker-compose -f docker-compose.prod.yml ps
    echo

    # Display useful credentials
    if [[ -f secrets/grafana_password ]]; then
        echo "📊 Grafana Credentials (if monitoring enabled):"
        echo "   URL: https://${DOMAIN_NAME}/grafana/"
        echo "   Username: admin"
        echo "   Password: $(cat secrets/grafana_password)"
        echo
    fi

    echo "Installation completed successfully! 🎉"
}

# Main installation function
main() {
    log_info "Starting MediaNest self-hosted installation..."

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --help)
                echo "MediaNest Self-Hosted Installation"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --domain DOMAIN     Domain name for MediaNest (required)"
                echo "  --email EMAIL       Email for SSL certificates (required)"
                echo "  --install-dir DIR   Installation directory (default: /opt/medianest)"
                echo "  --help              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --domain medianest.example.com --email admin@example.com"
                echo "  $0 --domain localhost --email test@example.com --install-dir ./medianest"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Validate required parameters
    if [[ "$DOMAIN_NAME" == "medianest.local" ]] || [[ "$EMAIL" == "admin@example.com" ]]; then
        log_error "Please provide valid domain and email:"
        echo "  --domain your-domain.com --email your-email@domain.com"
        exit 1
    fi

    # Run installation steps
    check_requirements
    install_dependencies
    configure_firewall
    setup_medianest
    generate_config
    start_services

    # Setup SSL (skip for localhost/local development)
    if [[ "$DOMAIN_NAME" != "localhost" ]] && [[ "$DOMAIN_NAME" != "127.0.0.1" ]] && [[ "$DOMAIN_NAME" != *.local ]]; then
        setup_ssl
    else
        log_info "Skipping SSL setup for local domain: $DOMAIN_NAME"
    fi

    display_completion_info
}

# Run main function with all arguments
main "$@"
```

### Quick Installation Usage

```bash
# Download and run installation script
curl -fsSL https://raw.githubusercontent.com/your-org/medianest/main/install-medianest.sh -o install-medianest.sh
chmod +x install-medianest.sh

# Run installation
./install-medianest.sh --domain medianest.yourdomain.com --email admin@yourdomain.com

# Or with custom installation directory
./install-medianest.sh --domain medianest.yourdomain.com --email admin@yourdomain.com --install-dir /home/medianest/app
```

## Manual Installation

### Step-by-Step Manual Setup

#### 1. Download MediaNest

```bash
# Create installation directory
sudo mkdir -p /opt/medianest
sudo chown $USER:$USER /opt/medianest

# Clone repository
git clone https://github.com/your-org/medianest.git /opt/medianest
cd /opt/medianest
```

#### 2. Prepare Environment

```bash
# Create required directories
mkdir -p {data,logs,backups,secrets}
mkdir -p data/{postgres,redis,downloads,uploads,certbot}
mkdir -p logs/{backend,frontend,nginx,certbot}
mkdir -p backups/{postgres,redis}

# Set permissions
chmod 755 data/ logs/ backups/
chmod 700 secrets/

# Generate secrets
echo -n "$(openssl rand -base64 32)" > secrets/jwt_secret
echo -n "$(openssl rand -base64 32)" > secrets/encryption_key
echo -n "$(openssl rand -base64 32)" > secrets/nextauth_secret
echo -n "$(openssl rand -base64 16)" > secrets/postgres_password
echo -n "$(openssl rand -base64 16)" > secrets/redis_password

# Set secret permissions
chmod 600 secrets/*
```

#### 3. Configure Environment

```bash
# Copy and customize environment file
cp .env.example .env.production

# Edit configuration
nano .env.production
```

**Key configurations to update:**

```bash
# Domain Configuration
DOMAIN_NAME=medianest.yourdomain.com
CERTBOT_EMAIL=admin@yourdomain.com

# URLs
FRONTEND_URL=https://medianest.yourdomain.com
NEXT_PUBLIC_API_URL=https://medianest.yourdomain.com/api/v1
NEXTAUTH_URL=https://medianest.yourdomain.com

# CORS
CORS_ORIGIN=https://medianest.yourdomain.com

# Enable production features
FEATURE_REAL_TIME_UPDATES=true
FEATURE_ADVANCED_SEARCH=true
FEATURE_RECOMMENDATIONS=true
```

#### 4. Start Services

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### 5. Generate SSL Certificate

```bash
# Initial certificate generation
docker-compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot -w /var/www/certbot \
    --email admin@yourdomain.com --agree-tos --no-eff-email \
    -d medianest.yourdomain.com

# Restart nginx to enable SSL
docker-compose -f docker-compose.prod.yml restart nginx
```

#### 6. Verify Installation

```bash
# Test health endpoints
curl -f https://medianest.yourdomain.com/api/health
curl -f https://medianest.yourdomain.com

# Check SSL certificate
echo | openssl s_client -servername medianest.yourdomain.com -connect medianest.yourdomain.com:443 | openssl x509 -noout -dates
```

## Platform-Specific Guides

### Ubuntu 22.04 LTS

```bash
#!/bin/bash
# Ubuntu-specific setup

# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configure UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Continue with MediaNest installation...
```

### CentOS/RHEL 8+

```bash
#!/bin/bash
# CentOS/RHEL-specific setup

# Update system
sudo dnf update -y

# Install prerequisites
sudo dnf install -y dnf-plugins-core

# Add Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configure firewall
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Continue with MediaNest installation...
```

### Debian 11+

```bash
#!/bin/bash
# Debian-specific setup

# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configure firewall (if using UFW)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Continue with MediaNest installation...
```

## Cloud Provider Setup

### DigitalOcean Droplet

```bash
#!/bin/bash
# DigitalOcean-specific setup script

# Create droplet using doctl
doctl compute droplet create medianest-server \
    --size s-2vcpu-4gb \
    --image ubuntu-22-04-x64 \
    --region nyc3 \
    --ssh-keys YOUR_SSH_KEY_ID \
    --enable-monitoring \
    --enable-backups

# Wait for droplet to be ready
sleep 60

# Get droplet IP
DROPLET_IP=$(doctl compute droplet list medianest-server --format PublicIPv4 --no-header)

# SSH to droplet and run installation
ssh root@$DROPLET_IP << 'EOF'
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Clone MediaNest
git clone https://github.com/your-org/medianest.git /opt/medianest
cd /opt/medianest

# Run installation script
./install-medianest.sh --domain medianest.yourdomain.com --email admin@yourdomain.com
EOF

echo "MediaNest installed on DigitalOcean droplet: $DROPLET_IP"
```

### AWS EC2 Instance

```bash
#!/bin/bash
# AWS EC2 setup using AWS CLI

# Create security group
aws ec2 create-security-group \
    --group-name medianest-sg \
    --description "MediaNest security group"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups --group-names medianest-sg --query 'SecurityGroups[0].GroupId' --output text)

# Add security group rules
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0

# Launch EC2 instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type t3.medium \
    --key-name YOUR_KEY_PAIR \
    --security-group-ids $SG_ID \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=MediaNest-Server}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "EC2 instance created: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH command: ssh -i your-key.pem ubuntu@$PUBLIC_IP"
```

### Google Cloud Platform

```bash
#!/bin/bash
# GCP Compute Engine setup

# Create firewall rules
gcloud compute firewall-rules create medianest-http \
    --allow tcp:80 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTP"

gcloud compute firewall-rules create medianest-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTPS"

# Create compute instance
gcloud compute instances create medianest-server \
    --zone=us-central1-a \
    --machine-type=n1-standard-2 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-ssd \
    --tags=http-server,https-server \
    --metadata-from-file startup-script=startup-script.sh

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe medianest-server --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo "GCP instance created with IP: $EXTERNAL_IP"
```

### Azure VM

```bash
#!/bin/bash
# Azure VM setup

# Create resource group
az group create --name medianest-rg --location eastus

# Create virtual network
az network vnet create \
    --resource-group medianest-rg \
    --name medianest-vnet \
    --subnet-name medianest-subnet

# Create network security group
az network nsg create \
    --resource-group medianest-rg \
    --name medianest-nsg

# Add security rules
az network nsg rule create \
    --resource-group medianest-rg \
    --nsg-name medianest-nsg \
    --name allow-ssh \
    --protocol tcp \
    --priority 1000 \
    --destination-port-range 22

az network nsg rule create \
    --resource-group medianest-rg \
    --nsg-name medianest-nsg \
    --name allow-http \
    --protocol tcp \
    --priority 1001 \
    --destination-port-range 80

az network nsg rule create \
    --resource-group medianest-rg \
    --nsg-name medianest-nsg \
    --name allow-https \
    --protocol tcp \
    --priority 1002 \
    --destination-port-range 443

# Create virtual machine
az vm create \
    --resource-group medianest-rg \
    --name medianest-vm \
    --image UbuntuLTS \
    --size Standard_B2s \
    --admin-username azureuser \
    --generate-ssh-keys \
    --vnet-name medianest-vnet \
    --subnet medianest-subnet \
    --nsg medianest-nsg

# Get public IP
PUBLIC_IP=$(az vm show -d -g medianest-rg -n medianest-vm --query publicIps -o tsv)

echo "Azure VM created with IP: $PUBLIC_IP"
```

## Bare Metal Installation

### Hardware Setup

```bash
#!/bin/bash
# Bare metal server setup

# System information
echo "=== System Information ==="
uname -a
lscpu
free -h
df -h
ip addr show

# Install system monitoring
sudo apt install -y htop iotop nethogs

# Configure system limits
sudo tee /etc/security/limits.d/medianest.conf << 'EOF'
medianest soft nofile 65536
medianest hard nofile 65536
medianest soft nproc 4096
medianest hard nproc 4096
EOF

# Configure sysctl for production
sudo tee /etc/sysctl.d/99-medianest.conf << 'EOF'
# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535

# Memory optimizations
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system optimizations
fs.file-max = 2097152
EOF

sudo sysctl -p /etc/sysctl.d/99-medianest.conf

# Configure log rotation
sudo tee /etc/logrotate.d/medianest << 'EOF'
/opt/medianest/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 medianest medianest
    postrotate
        docker-compose -f /opt/medianest/docker-compose.prod.yml restart > /dev/null 2>&1 || true
    endscript
}
EOF
```

### Performance Optimization

```bash
# CPU optimization
echo 'performance' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Storage optimization (for SSD)
echo 'deadline' | sudo tee /sys/block/*/queue/scheduler
echo '1' | sudo tee /sys/block/*/queue/nomerges

# Network optimization
sudo ethtool -K eth0 gro on
sudo ethtool -K eth0 gso on

# Docker daemon optimization
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ]
}
EOF

sudo systemctl restart docker
```

## Kubernetes Deployment

### Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Kubernetes Manifests

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: medianest
  labels:
    name: medianest
---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: medianest-secrets
  namespace: medianest
type: Opaque
data:
  database_url: cG9zdGdyZXNxbDovL21lZGlhbmVzdDpwYXNzd29yZEBwb3N0Z3JlczozNDMyL21lZGlhbmVzdA==
  jwt_secret: eW91ci1qd3Qtc2VjcmV0LWhlcmU=
  encryption_key: eW91ci1lbmNyeXB0aW9uLWtleS1oZXJl
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: medianest-config
  namespace: medianest
data:
  NODE_ENV: 'production'
  LOG_LEVEL: 'info'
  DOMAIN_NAME: 'medianest.k8s.local'
---
# k8s/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: medianest
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          env:
            - name: POSTGRES_DB
              value: 'medianest'
            - name: POSTGRES_USER
              value: 'medianest'
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: medianest-secrets
                  key: postgres_password
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: medianest
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
# k8s/medianest.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: medianest-backend
  namespace: medianest
spec:
  replicas: 2
  selector:
    matchLabels:
      app: medianest-backend
  template:
    metadata:
      labels:
        app: medianest-backend
    spec:
      containers:
        - name: backend
          image: medianest/backend:latest
          envFrom:
            - configMapRef:
                name: medianest-config
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: medianest-secrets
                  key: database_url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: medianest-secrets
                  key: jwt_secret
          ports:
            - containerPort: 4000
          livenessProbe:
            httpGet:
              path: /api/health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### Deploy to Kubernetes

```bash
# Create namespace and deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/medianest.yaml

# Check deployment status
kubectl get pods -n medianest
kubectl get services -n medianest

# View logs
kubectl logs -f deployment/medianest-backend -n medianest
```

## Post-Installation Configuration

### Initial Setup Wizard

Access `https://yourdomain.com/setup` to complete initial configuration:

1. **Admin Account Setup**
   - Create administrator account
   - Set application settings
   - Configure email settings

2. **Plex Integration**
   - Enter Plex server URL
   - Authenticate with Plex
   - Select libraries to monitor

3. **Media Configuration**
   - Set download directories
   - Configure quality preferences
   - Set retention policies

4. **Notification Settings**
   - Email notifications
   - Webhook integrations
   - Push notifications

### SSL Certificate Renewal

```bash
# Setup automatic renewal
cat > /etc/cron.d/medianest-ssl << 'EOF'
0 3 * * * medianest cd /opt/medianest && docker-compose run --rm certbot renew && docker-compose restart nginx
EOF
```

### Backup Configuration

```bash
# Setup automatic backups
cat > /etc/cron.d/medianest-backup << 'EOF'
0 2 * * * medianest cd /opt/medianest && docker-compose --profile backup run --rm backup
EOF
```

## Security Hardening

### System Security

```bash
# Disable root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Setup fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Configure automatic updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Container Security

```bash
# Run security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v /opt/medianest:/opt/medianest \
    aquasec/trivy image medianest/backend:latest

# Setup container monitoring
docker run -d --name watchtower \
    -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --schedule "0 0 4 * * *" \
    --cleanup
```

### Network Security

```bash
# Configure strict firewall rules
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from trusted.ip.address to any port 22
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Setup intrusion detection
sudo apt install -y aide
sudo aide --init
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
```

## Maintenance

### Update Procedures

```bash
#!/bin/bash
# update-medianest.sh

cd /opt/medianest

# Backup before update
./scripts/backup.sh

# Pull latest changes
git pull origin main

# Update container images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d --build

# Run health check
sleep 30
curl -f https://yourdomain.com/api/health

echo "Update completed successfully"
```

### Monitoring Setup

```bash
# Enable monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Setup log rotation for monitoring
sudo logrotate -d /opt/medianest/logs/
```

### Maintenance Scripts

```bash
# Create maintenance script
cat > /opt/medianest/scripts/maintenance.sh << 'EOF'
#!/bin/bash
# Daily maintenance tasks

cd /opt/medianest

# Clean up old Docker images
docker image prune -a -f

# Clean up old logs
find logs/ -name "*.log" -mtime +7 -delete

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "Warning: Disk usage is at ${DISK_USAGE}%"
fi

# Check SSL certificate expiry
CERT_EXPIRY=$(openssl x509 -enddate -noout -in data/certbot/ssl/live/*/cert.pem | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
    echo "Warning: SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
fi

echo "Maintenance completed"
EOF

chmod +x /opt/medianest/scripts/maintenance.sh

# Schedule maintenance
cat > /etc/cron.d/medianest-maintenance << 'EOF'
0 1 * * * medianest /opt/medianest/scripts/maintenance.sh >> /var/log/medianest-maintenance.log 2>&1
EOF
```

This comprehensive self-hosted installation guide provides everything needed to deploy MediaNest on your own infrastructure, from simple single-server setups to complex Kubernetes deployments. Choose the approach that best fits your needs and technical expertise.
