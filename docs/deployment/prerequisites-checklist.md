# MediaNest Deployment Prerequisites Checklist

**Use this checklist to ensure your server meets all requirements before deployment.**

## 🖥️ Hardware Requirements

### Minimum Specifications

- [ ] **CPU:** 2 cores (64-bit architecture)
- [ ] **RAM:** 4GB available memory
- [ ] **Storage:** 50GB free disk space
- [ ] **Network:** Stable internet connection (minimum 10 Mbps)

### Recommended Specifications

- [ ] **CPU:** 4+ cores for production workloads
- [ ] **RAM:** 8GB+ for optimal performance
- [ ] **Storage:** SSD with 100GB+ for production
- [ ] **Network:** Redundant network connections

### Storage Requirements Breakdown

```
Application Code:      ~2GB
Docker Images:         ~5GB
Database Storage:      ~10GB (grows with usage)
Log Files:            ~5GB (with rotation)
Backups:              ~15GB (7 days retention)
SSL Certificates:     ~50MB
Temporary Files:      ~5GB
Buffer Space:         ~8GB
Total Minimum:        ~50GB
```

## 🐧 Operating System Requirements

### Supported Operating Systems

- [ ] **Ubuntu 20.04 LTS** (recommended)
- [ ] **Ubuntu 22.04 LTS** (recommended)
- [ ] **CentOS 8+** / **RHEL 8+**
- [ ] **Debian 11+**
- [ ] **Amazon Linux 2**
- [ ] Any Docker-compatible Linux distribution

### OS Configuration Requirements

- [ ] Root access or sudo privileges
- [ ] Package manager available (apt, yum, dnf)
- [ ] Systemd service manager
- [ ] Firewall capability (ufw, firewalld, iptables)

### Kernel Requirements

- [ ] Kernel version 3.10+ (check with: `uname -r`)
- [ ] cgroups v1 or v2 support
- [ ] Namespace support enabled
- [ ] Overlay2 storage driver support

## 🌐 Network Requirements

### DNS Configuration

- [ ] **Domain name** registered and configured
- [ ] **DNS A record** pointing to server IP address
- [ ] **DNS propagation** completed (check with: `dig your-domain.com`)
- [ ] **Subdomain access** if using subdomains
- [ ] **TTL settings** appropriate for updates (300-3600 seconds)

### Port Requirements

- [ ] **Port 22:** SSH access (for management)
- [ ] **Port 80:** HTTP (for Let's Encrypt and redirects)
- [ ] **Port 443:** HTTPS (main application access)
- [ ] **Outbound internet access** for Docker image pulls and updates

### Optional Monitoring Ports (can be internal-only)

- [ ] **Port 3001:** Grafana dashboard
- [ ] **Port 9090:** Prometheus metrics

### Firewall Testing Commands

```bash
# Test port accessibility from external location
telnet your-domain.com 80
telnet your-domain.com 443

# Check DNS resolution
dig your-domain.com
nslookup your-domain.com
```

## 🔧 Software Requirements

### Required Software with Versions

- [ ] **Docker** 24.0+ (`docker --version`)
- [ ] **Docker Compose** v2.20+ (`docker compose version`)
- [ ] **Git** 2.30+ (`git --version`)
- [ ] **Curl** latest (`curl --version`)
- [ ] **OpenSSL** 1.1+ (`openssl version`)

### Installation Verification Commands

```bash
# Verify Docker installation
docker --version
docker run hello-world

# Verify Docker Compose
docker compose version

# Verify Git
git --version

# Verify network tools
curl --version
ping -c 1 google.com
```

### Optional but Recommended

- [ ] **Nginx** (for advanced proxy configuration)
- [ ] **Certbot** (for SSL certificate management)
- [ ] **Fail2ban** (for security hardening)
- [ ] **UFW** (uncomplicated firewall)
- [ ] **Htop** (system monitoring)
- [ ] **Jq** (JSON processing)

## 🔐 Security Requirements

### User Account Setup

- [ ] **Non-root user** created for application deployment
- [ ] **Sudo access** configured for non-root user
- [ ] **SSH key authentication** configured (password auth disabled)
- [ ] **User added to docker group** (will be done during setup)

### Security Hardening

- [ ] **SSH password authentication disabled**
- [ ] **Firewall configured** and enabled
- [ ] **Automatic security updates** enabled
- [ ] **Strong password policy** implemented
- [ ] **Fail2ban** installed for intrusion detection

### SSL Certificate Requirements

- [ ] **Valid domain ownership** (required for Let's Encrypt)
- [ ] **Email address** for certificate notifications
- [ ] **Port 80 accessible** for certificate validation
- [ ] **DNS control** for domain validation

## 📊 Performance Requirements

### System Performance Baselines

- [ ] **CPU load** under 80% during normal operation
- [ ] **Memory usage** under 80% with swap available
- [ ] **Disk I/O** capable of 100 MB/s sequential read/write
- [ ] **Network latency** under 50ms to target users

### Performance Testing Commands

```bash
# CPU performance test
sysbench cpu --cpu-max-prime=20000 --threads=2 run

# Memory test
free -h
cat /proc/meminfo

# Disk performance test
dd if=/dev/zero of=testfile bs=1G count=1 oflag=direct

# Network performance test
curl -o /dev/null -s -w "Total time: %{time_total}s\n" https://google.com
```

## 🔍 Environment Validation

### Pre-Installation System Check

```bash
#!/bin/bash
# Save as: check-prerequisites.sh

echo "🔍 MediaNest Prerequisites Checker"
echo "=================================="

# Check OS
echo "📋 Operating System:"
lsb_release -a 2>/dev/null || cat /etc/os-release

# Check hardware
echo -e "\n🖥️  Hardware:"
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk Space: $(df -h / | tail -1 | awk '{print $4}') available"

# Check software
echo -e "\n🔧 Software:"
docker --version 2>/dev/null && echo "✅ Docker installed" || echo "❌ Docker not found"
docker compose version 2>/dev/null && echo "✅ Docker Compose installed" || echo "❌ Docker Compose not found"
git --version 2>/dev/null && echo "✅ Git installed" || echo "❌ Git not found"
curl --version 2>/dev/null && echo "✅ Curl installed" || echo "❌ Curl not found"

# Check network
echo -e "\n🌐 Network:"
ping -c 1 8.8.8.8 &>/dev/null && echo "✅ Internet connectivity" || echo "❌ No internet access"

# Check ports
echo -e "\n🔌 Ports:"
ss -tlnp | grep :80 &>/dev/null && echo "⚠️  Port 80 in use" || echo "✅ Port 80 available"
ss -tlnp | grep :443 &>/dev/null && echo "⚠️  Port 443 in use" || echo "✅ Port 443 available"

# Check permissions
echo -e "\n🔐 Permissions:"
groups $USER | grep docker &>/dev/null && echo "✅ User in docker group" || echo "⚠️  User not in docker group (will be added during setup)"
sudo -n true 2>/dev/null && echo "✅ Sudo access available" || echo "❌ No sudo access"

echo -e "\n✅ Prerequisites check complete!"
echo "Review any ❌ or ⚠️  items before proceeding with deployment."
```

### Post-Installation Validation

```bash
#!/bin/bash
# Save as: validate-installation.sh

echo "✅ MediaNest Installation Validator"
echo "==================================="

# Check Docker daemon
systemctl is-active docker &>/dev/null && echo "✅ Docker service running" || echo "❌ Docker service not running"

# Test Docker functionality
docker run hello-world &>/dev/null && echo "✅ Docker functioning correctly" || echo "❌ Docker not working"

# Check Docker Compose
docker compose version &>/dev/null && echo "✅ Docker Compose available" || echo "❌ Docker Compose not available"

# Check user permissions
docker ps &>/dev/null && echo "✅ Docker permissions correct" || echo "❌ Docker permission issues"

# Check firewall
ufw status | grep "Status: active" &>/dev/null && echo "✅ Firewall active" || echo "⚠️  Firewall not active"

# Check SSL tools
which certbot &>/dev/null && echo "✅ Certbot available" || echo "⚠️  Certbot not installed"

echo -e "\n🎯 Ready for MediaNest deployment!"
```

## 📋 Quick Setup Commands

### Ubuntu/Debian Quick Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y curl wget git jq htop ufw fail2ban

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Install SSL tools
sudo apt install -y nginx-full certbot python3-certbot-nginx

echo "✅ Prerequisites installed! Log out and back in for Docker permissions."
```

### CentOS/RHEL Quick Setup

```bash
# Update system
sudo dnf update -y

# Install prerequisites
sudo dnf install -y curl wget git jq htop firewalld fail2ban

# Install Docker
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# Configure firewall
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload

# Install SSL tools
sudo dnf install -y nginx certbot python3-certbot-nginx

echo "✅ Prerequisites installed! Log out and back in for Docker permissions."
```

## ❌ Common Prerequisites Issues

### Issue: Docker Permission Denied

**Symptoms:** `permission denied while trying to connect to Docker daemon socket`
**Solution:**

```bash
sudo usermod -aG docker $USER
# Log out and log back in
newgrp docker
```

### Issue: Port Already in Use

**Symptoms:** `Port 80/443 already in use`
**Solution:**

```bash
# Find what's using the port
sudo ss -tlnp | grep :80
sudo systemctl stop apache2  # or nginx, or other service
sudo systemctl disable apache2
```

### Issue: Insufficient Disk Space

**Symptoms:** `No space left on device`
**Solution:**

```bash
# Clean up system
sudo apt autoremove -y
sudo apt autoclean
docker system prune -f

# Check disk usage
df -h
du -sh /var/log/* | sort -hr
```

### Issue: DNS Not Resolving

**Symptoms:** `Domain not found` errors
**Solution:**

```bash
# Check DNS resolution
dig your-domain.com
nslookup your-domain.com

# Wait for DNS propagation (up to 48 hours)
# Use online DNS checker tools
```

---

**✅ Prerequisites Complete!**

Once all items are checked and verified, proceed to the main [README_DEPLOYMENT.md](../README_DEPLOYMENT.md) guide for the actual deployment process.
