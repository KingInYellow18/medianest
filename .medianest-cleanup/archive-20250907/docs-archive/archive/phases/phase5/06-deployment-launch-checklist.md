# Phase 5: Production Deployment and Launch Checklist

**Status:** Not Started  
**Priority:** High  
**Dependencies:** All previous tasks complete  
**Estimated Time:** 4 hours

## Objective

Execute the final production deployment of MediaNest to the homelab environment, verify all systems are operational, and complete the launch checklist.

## Background

This is the final step before MediaNest goes live. We'll deploy to production, verify everything works, and ensure the system is ready for users.

## Tasks

### 1. Pre-Deployment Verification

- [ ] All tests passing
- [ ] Security audit complete
- [ ] Documentation finalized
- [ ] Backups configured
- [ ] Monitoring ready
- [ ] Images built and scanned

### 2. Domain and SSL Setup

- [ ] Configure domain DNS
- [ ] Point to homelab IP
- [ ] Generate SSL certificates
- [ ] Test HTTPS access
- [ ] Configure auto-renewal
- [ ] Verify security headers

### 3. Production Deployment

- [ ] Create Docker secrets
- [ ] Configure environment
- [ ] Deploy stack
- [ ] Verify all services start
- [ ] Check health endpoints
- [ ] Test WebSocket connections

### 4. Service Configuration

- [ ] Connect to Plex server
- [ ] Configure Overseerr integration
- [ ] Set up Uptime Kuma monitoring
- [ ] Test all integrations
- [ ] Verify service status
- [ ] Configure admin account

### 5. Functionality Testing

- [ ] Test Plex OAuth login
- [ ] Browse media libraries
- [ ] Submit media request
- [ ] Test YouTube downloads
- [ ] Verify real-time updates
- [ ] Check mobile responsiveness

### 6. Go-Live Preparation

- [ ] Notify beta users
- [ ] Share documentation
- [ ] Monitor initial usage
- [ ] Address any issues
- [ ] Collect feedback
- [ ] Plan improvements

## Deployment Commands

### 1. Create Docker Secrets

```bash
# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Create Docker secrets
echo "$DB_PASSWORD" | docker secret create db_password -
echo "$NEXTAUTH_SECRET" | docker secret create nextauth_secret -
echo "$ENCRYPTION_KEY" | docker secret create encryption_key -
echo "$PLEX_CLIENT_SECRET" | docker secret create plex_client_secret -

# Save passwords securely
cat > secrets.env << EOF
# Save this file securely and delete after noting values
DB_PASSWORD=$DB_PASSWORD
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF
```

### 2. SSL Certificate Generation

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone \
  -d media.yourdomain.com \
  --agree-tos \
  --email your-email@example.com

# Set up auto-renewal
echo "0 0,12 * * * root certbot renew --quiet" | sudo tee -a /etc/crontab > /dev/null
```

### 3. Deploy Application

```bash
# Clone repository
cd /opt
git clone https://github.com/yourusername/medianest.git
cd medianest

# Copy production environment
cp .env.production.example .env.production
nano .env.production  # Edit with your values

# Build images
./scripts/build-production.sh

# Deploy stack
docker stack deploy -c docker-compose.prod.yml medianest

# Or with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment

```bash
# Check all services are running
docker ps | grep medianest

# Check logs
docker logs medianest_backend
docker logs medianest_frontend

# Test health endpoints
curl https://media.yourdomain.com/api/health
curl https://media.yourdomain.com/api/v1/services/status

# Check database
docker exec medianest_postgres psql -U medianest -c "SELECT COUNT(*) FROM users;"
```

## Launch Checklist

### System Verification

- [ ] ✓ All containers running
- [ ] ✓ No errors in logs
- [ ] ✓ Database accessible
- [ ] ✓ Redis connected
- [ ] ✓ Frontend loads
- [ ] ✓ API responds

### Security Verification

- [ ] ✓ HTTPS working
- [ ] ✓ Security headers present
- [ ] ✓ Rate limiting active
- [ ] ✓ Authentication required
- [ ] ✓ Secrets not exposed
- [ ] ✓ Admin password changed

### Feature Verification

- [ ] ✓ Plex OAuth works
- [ ] ✓ Media browsing functional
- [ ] ✓ Search returns results
- [ ] ✓ Requests can be submitted
- [ ] ✓ Service status updates
- [ ] ✓ YouTube downloads work

### Integration Verification

- [ ] ✓ Plex connection active
- [ ] ✓ Overseerr integrated
- [ ] ✓ Uptime Kuma connected
- [ ] ✓ WebSocket working
- [ ] ✓ Notifications functional
- [ ] ✓ Graceful degradation

### Performance Verification

- [ ] ✓ Page loads <2 seconds
- [ ] ✓ API responses <1 second
- [ ] ✓ No memory leaks
- [ ] ✓ CPU usage normal
- [ ] ✓ Disk space adequate
- [ ] ✓ Network stable

### Operational Verification

- [ ] ✓ Backups scheduled
- [ ] ✓ Monitoring active
- [ ] ✓ Logs rotating
- [ ] ✓ Alerts configured
- [ ] ✓ Documentation accessible
- [ ] ✓ Recovery tested

## Post-Launch Tasks

### Day 1

- Monitor system health
- Check error logs
- Respond to user issues
- Verify backup ran
- Review performance

### Week 1

- Gather user feedback
- Fix any critical bugs
- Optimize based on usage
- Update documentation
- Plan next features

### Month 1

- Review usage analytics
- Optimize performance
- Enhance features
- Security updates
- Capacity planning

## Rollback Plan

If critical issues arise:

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./scripts/restore-medianest.sh /backups/last-known-good.tar.gz

# Or revert to previous version
docker tag medianest/frontend:previous medianest/frontend:latest
docker tag medianest/backend:previous medianest/backend:latest
docker-compose -f docker-compose.prod.yml up -d
```

## Success Criteria

- [ ] All users can log in
- [ ] No critical errors
- [ ] Performance meets targets
- [ ] Features work as expected
- [ ] Users are satisfied
- [ ] System is stable

## Communication Template

```markdown
Subject: MediaNest is Now Live! 🎉

Hi everyone,

I'm excited to announce that MediaNest is now available at:
https://media.yourdomain.com

MediaNest brings together all our media services in one place:

- Browse the Plex library
- Request new movies and shows
- Download YouTube content
- Monitor service status

To get started:

1. Visit the link above
2. Click "Login with Plex"
3. Follow the PIN instructions

Check out the user guide here: [link to docs]

Please let me know if you have any questions or run into issues!

Happy streaming!
```

## Notes

- Take deployment slowly
- Test each step thoroughly
- Keep backups ready
- Monitor closely after launch
- Be ready to help users
- Document any issues found
