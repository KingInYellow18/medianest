# MediaNest SSL/TLS Configuration

This directory contains the SSL/TLS configuration for MediaNest using Let's Encrypt certificates.

## Overview

MediaNest uses:

- **Let's Encrypt** for free SSL certificates
- **Certbot** for automatic certificate management
- **Nginx** as the reverse proxy with SSL termination
- **Automatic renewal** every 12 hours

## Initial Setup

1. **Configure your domain**:

   - Point your domain's A record to your server's IP address
   - Optionally add a CNAME for `www.your-domain.com` → `your-domain.com`

2. **Update environment variables**:

   ```bash
   cp .env.production .env
   # Edit .env and set:
   # - DOMAIN_NAME=your-domain.com
   # - CERTBOT_EMAIL=your-email@example.com
   ```

3. **Run the SSL setup script**:

   ```bash
   sudo ./infrastructure/scripts/setup-ssl.sh
   ```

   This script will:

   - Create necessary directories
   - Start a temporary nginx for the HTTP challenge
   - Request certificates from Let's Encrypt
   - Configure SSL options

4. **Start MediaNest**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## SSL Configuration Details

### Security Features

- **TLS 1.2+ only**: No support for older, insecure protocols
- **Strong cipher suites**: ECDHE and DHE only, no weak ciphers
- **OCSP stapling**: Improved certificate verification performance
- **HSTS**: Forces HTTPS for all connections
- **Security headers**: X-Frame-Options, CSP, etc.

### Certificate Locations

- Certificates: `/data/certbot/ssl/live/your-domain.com/`
- Webroot: `/data/certbot/webroot/`
- DH parameters: `/etc/nginx/ssl/dhparam.pem`

### Automatic Renewal

The Certbot service runs every 12 hours to check and renew certificates if needed (when they're within 30 days of expiration).

## Troubleshooting

### Certificate not issued

1. Check domain DNS is properly configured
2. Ensure port 80 is accessible from the internet
3. Check Certbot logs: `docker logs medianest-certbot`

### Nginx not starting

1. Check if certificates exist: `ls -la data/certbot/ssl/live/`
2. Verify nginx config: `docker exec medianest-nginx nginx -t`
3. Check nginx logs: `docker logs medianest-nginx`

### Manual certificate renewal

```bash
docker compose -f docker-compose.prod.yml exec certbot \
  certbot renew --webroot -w /var/www/certbot
```

### View certificate details

```bash
docker compose -f docker-compose.prod.yml exec certbot \
  certbot certificates
```

## Monitoring

- Certificate expiry warnings are logged by Certbot
- Nginx access logs show SSL protocol and cipher used
- Monitor the `/nginx_status` endpoint for health checks

## Best Practices

1. **Backup certificates**: Include `/data/certbot/ssl/` in your backup strategy
2. **Monitor expiry**: Set up alerts for certificate expiration
3. **Test renewal**: Run a dry-run to test renewal process:
   ```bash
   docker compose -f docker-compose.prod.yml exec certbot \
     certbot renew --dry-run
   ```
4. **Security updates**: Keep Certbot and Nginx images updated
