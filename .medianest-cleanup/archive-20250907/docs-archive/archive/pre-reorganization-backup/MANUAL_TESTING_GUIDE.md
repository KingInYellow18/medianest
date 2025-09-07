# MediaNest Manual Testing Guide

## Overview

This guide provides comprehensive manual testing procedures for MediaNest in a homelab environment. It's designed for testing with real Plex, Overseerr, and Uptime Kuma instances with 10-20 concurrent users.

## Pre-Test Setup

### 1. Environment Verification

```bash
# Check all services are running
docker compose ps

# Verify environment variables
docker compose exec backend env | grep -E "(PLEX|OVERSEERR|DATABASE|REDIS)"

# Check database connectivity
docker compose exec backend npx prisma db push --accept-data-loss

# Verify Redis connection
docker compose exec backend redis-cli -h redis ping
```

### 2. Service URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/v1
- API Docs: http://localhost:4000/api-docs
- Prisma Studio: http://localhost:5555
- Redis Commander: http://localhost:8081

### 3. Test Data Setup

```sql
-- Connect to database
docker compose exec postgres psql -U medianest -d medianest

-- Create test users (if needed)
-- Admin bootstrap should create initial admin
-- Other users created via Plex OAuth
```

## Test Execution Checklist

### Phase 1: Initial Setup and Configuration

#### 1.1 First-Time Setup

- [ ] **Fresh Installation**
  - [ ] Clone repository
  - [ ] Copy `.env.example` to `.env`
  - [ ] Update environment variables with your services
  - [ ] Run `docker compose up -d`
  - [ ] Verify all containers start successfully
  - [ ] Check logs: `docker compose logs -f`

- [ ] **Admin Bootstrap**
  - [ ] Navigate to http://localhost:3000
  - [ ] See admin setup prompt
  - [ ] Login with `admin/admin`
  - [ ] Prompted to change password
  - [ ] Successfully change password
  - [ ] Redirected to dashboard

#### 1.2 Service Configuration

- [ ] **Configure Plex**
  - [ ] Navigate to Settings → Services
  - [ ] Enter Plex server URL (e.g., http://192.168.1.100:32400)
  - [ ] Enter Plex token
  - [ ] Click "Test Connection"
  - [ ] See success message
  - [ ] Save configuration

- [ ] **Configure Overseerr**
  - [ ] Enter Overseerr URL
  - [ ] Enter API key from Overseerr settings
  - [ ] Test connection
  - [ ] Verify success
  - [ ] Save configuration

- [ ] **Configure Uptime Kuma**
  - [ ] Enter Uptime Kuma URL
  - [ ] Map monitor IDs to services
  - [ ] Test connection
  - [ ] Save configuration

### Phase 2: Authentication Flow

#### 2.1 Plex OAuth Login

- [ ] **PIN Generation**
  - [ ] Logout if logged in
  - [ ] Click "Login with Plex"
  - [ ] See PIN displayed (4 characters)
  - [ ] QR code visible
  - [ ] Timer counting down from 15 minutes

- [ ] **PIN Authorization**
  - [ ] Navigate to https://plex.tv/link
  - [ ] Enter PIN code
  - [ ] Authorize MediaNest
  - [ ] Return to MediaNest
  - [ ] Automatically logged in
  - [ ] User profile loaded correctly

- [ ] **Session Management**
  - [ ] Check "Remember me" on login
  - [ ] Close browser
  - [ ] Reopen and navigate to app
  - [ ] Still logged in
  - [ ] Logout works correctly

#### 2.2 User Access Levels

- [ ] **Regular User Access**
  - [ ] Can view dashboard
  - [ ] Can browse media
  - [ ] Can make requests
  - [ ] Cannot access admin settings
  - [ ] Cannot see other users' data

- [ ] **Admin Access**
  - [ ] Can access all user features
  - [ ] Can access Settings page
  - [ ] Can view all users' requests
  - [ ] Can manage service configurations
  - [ ] Can cancel any download

### Phase 3: Service Dashboard

#### 3.1 Service Status Cards

- [ ] **Plex Status Card**
  - [ ] Shows online/offline status
  - [ ] Displays version number
  - [ ] Shows active streams count
  - [ ] Library count visible
  - [ ] Quick actions work (Open Plex)

- [ ] **Overseerr Status Card**
  - [ ] Shows connection status
  - [ ] Displays pending requests
  - [ ] Shows version info
  - [ ] Quick request button works

- [ ] **Uptime Kuma Monitors**
  - [ ] All configured monitors shown
  - [ ] Real-time status updates
  - [ ] Uptime percentages displayed
  - [ ] Response times visible
  - [ ] Click to open Uptime Kuma

#### 3.2 Real-Time Updates

- [ ] **Status Changes**
  - [ ] Stop a monitored service
  - [ ] Status updates within 30 seconds
  - [ ] Card shows offline state
  - [ ] Error message user-friendly
  - [ ] Start service again
  - [ ] Status returns to online

- [ ] **WebSocket Connection**
  - [ ] Check browser console
  - [ ] WebSocket connected message
  - [ ] No reconnection spam
  - [ ] Updates received smoothly

### Phase 4: Media Management

#### 4.1 Media Browsing

- [ ] **Library Navigation**
  - [ ] All Plex libraries visible
  - [ ] Can switch between Movies/TV Shows
  - [ ] Poster images load
  - [ ] Metadata displayed correctly
  - [ ] Search works within library

- [ ] **Media Details**
  - [ ] Click on any media item
  - [ ] Details modal/page opens
  - [ ] Synopsis visible
  - [ ] Cast and crew listed
  - [ ] Ratings displayed
  - [ ] Trailer link (if available)

#### 4.2 Media Requests

- [ ] **Search for New Content**
  - [ ] Use search bar
  - [ ] Results from Overseerr appear
  - [ ] Can filter by Movies/TV
  - [ ] Poster images load
  - [ ] Already available items marked

- [ ] **Submit Request**
  - [ ] Click request on unavailable item
  - [ ] For TV: season selection works
  - [ ] Confirm request dialog
  - [ ] Success notification
  - [ ] Request appears in history

- [ ] **Request Management**
  - [ ] View "My Requests" page
  - [ ] All requests listed
  - [ ] Status indicators correct
  - [ ] Can cancel pending requests
  - [ ] Cannot cancel approved requests
  - [ ] Pagination works if many requests

### Phase 5: YouTube Downloads

#### 5.1 URL Submission

- [ ] **Video Download**
  - [ ] Navigate to YouTube Downloader
  - [ ] Paste YouTube video URL
  - [ ] URL validates successfully
  - [ ] Preview shows (title, thumbnail)
  - [ ] Quality selection available
  - [ ] Submit download
  - [ ] Added to queue

- [ ] **Playlist Download**
  - [ ] Paste playlist URL
  - [ ] Shows video count
  - [ ] Can select video range
  - [ ] Submits successfully

#### 5.2 Download Management

- [ ] **Queue Monitoring**
  - [ ] Active downloads show progress
  - [ ] Progress bar updates
  - [ ] Speed and ETA visible
  - [ ] Can cancel active download
  - [ ] Queue position shown

- [ ] **Rate Limiting**
  - [ ] Submit 5 downloads quickly
  - [ ] 6th shows rate limit error
  - [ ] Error shows when limit resets
  - [ ] Other users not affected

#### 5.3 Completion Handling

- [ ] **Successful Download**
  - [ ] Download completes
  - [ ] File size shown
  - [ ] Status changes to completed
  - [ ] Plex library updates (if configured)

- [ ] **Failed Download**
  - [ ] Private video shows error
  - [ ] Can retry failed download
  - [ ] Error message helpful

### Phase 6: Error Scenarios

#### 6.1 Service Degradation

- [ ] **Plex Offline**
  - [ ] Stop Plex server
  - [ ] Dashboard shows Plex offline
  - [ ] Can still browse cached data
  - [ ] Other features work normally
  - [ ] Login fails gracefully

- [ ] **Overseerr Offline**
  - [ ] Stop Overseerr
  - [ ] Search shows friendly error
  - [ ] Existing requests still visible
  - [ ] Request submission queued
  - [ ] Queue processed when back online

- [ ] **Database Issues**
  - [ ] Stop PostgreSQL briefly
  - [ ] App shows maintenance message
  - [ ] Doesn't crash
  - [ ] Recovers when DB returns

#### 6.2 Network Issues

- [ ] **Slow Connection**
  - [ ] Throttle network (browser DevTools)
  - [ ] Loading states appear
  - [ ] No duplicate requests
  - [ ] Timeouts handled gracefully

- [ ] **Connection Loss**
  - [ ] Disconnect network
  - [ ] Offline indicator appears
  - [ ] Reconnection attempted
  - [ ] State restored on reconnect

### Phase 7: Multi-User Testing

#### 7.1 Concurrent Usage

- [ ] **Multiple Sessions**
  - [ ] Login with 3-5 test accounts
  - [ ] Each in different browser/incognito
  - [ ] All can use simultaneously
  - [ ] No session conflicts
  - [ ] Updates visible to all

- [ ] **Data Isolation**
  - [ ] User A makes request
  - [ ] User B doesn't see it
  - [ ] User A downloads video
  - [ ] User B doesn't see it
  - [ ] Admin sees everything

#### 7.2 Performance

- [ ] **Response Times**
  - [ ] Dashboard loads < 2 seconds
  - [ ] Search results < 1 second
  - [ ] Media browsing smooth
  - [ ] No lag with 5+ users

- [ ] **Resource Usage**
  - [ ] Check container stats
  - [ ] Memory usage reasonable
  - [ ] CPU usage normal
  - [ ] No memory leaks over time

### Phase 8: Mobile Testing

#### 8.1 Responsive Design

- [ ] **Phone (375px width)**
  - [ ] Navigation menu collapses
  - [ ] Cards stack vertically
  - [ ] All text readable
  - [ ] Buttons tappable
  - [ ] Forms usable

- [ ] **Tablet (768px width)**
  - [ ] Layout adjusts appropriately
  - [ ] Two-column layouts work
  - [ ] Touch interactions smooth
  - [ ] Modals fit screen

#### 8.2 Mobile Functionality

- [ ] **Core Features**
  - [ ] Can login with Plex
  - [ ] Can browse media
  - [ ] Can make requests
  - [ ] Can manage downloads
  - [ ] Settings accessible

### Phase 9: Security Testing

#### 9.1 Authentication

- [ ] **Invalid Tokens**
  - [ ] Modify JWT in browser
  - [ ] Requests rejected
  - [ ] Forced to re-login
  - [ ] No sensitive data exposed

- [ ] **Session Expiry**
  - [ ] Wait for session timeout
  - [ ] Redirected to login
  - [ ] No auth errors shown
  - [ ] Can login again

#### 9.2 Authorization

- [ ] **Access Control**
  - [ ] Try admin URLs as user
  - [ ] Access denied (403)
  - [ ] Try other user's resources
  - [ ] Get 404 (not 403)
  - [ ] No information leakage

### Phase 10: Beta User Testing

#### 10.1 User Onboarding

- [ ] **Invite Beta Users**
  - [ ] Send Plex server invites
  - [ ] Provide MediaNest URL
  - [ ] Users can self-register
  - [ ] First login smooth
  - [ ] Features discoverable

#### 10.2 Feedback Collection

- [ ] **Usage Monitoring**
  - [ ] Track feature usage
  - [ ] Note any errors
  - [ ] Collect feedback
  - [ ] Document issues
  - [ ] Prioritize fixes

## Post-Test Checklist

### Data Verification

```sql
-- Check user creation
SELECT username, email, role, status, created_at
FROM users
ORDER BY created_at DESC;

-- Check media requests
SELECT u.username, mr.title, mr.media_type, mr.status, mr.requested_at
FROM media_requests mr
JOIN users u ON mr.user_id = u.id
ORDER BY mr.requested_at DESC;

-- Check download history
SELECT u.username, yd.title, yd.status, yd.progress, yd.created_at
FROM youtube_downloads yd
JOIN users u ON yd.user_id = u.id
ORDER BY yd.created_at DESC;

-- Check service status history
SELECT service, status, response_time, checked_at
FROM service_status
WHERE checked_at > NOW() - INTERVAL '1 hour'
ORDER BY checked_at DESC;
```

### Log Analysis

```bash
# Check for errors
docker compose logs backend | grep -i error

# Check for warnings
docker compose logs backend | grep -i warn

# Check authentication logs
docker compose logs backend | grep -i "auth"

# Check WebSocket connections
docker compose logs backend | grep -i "socket"
```

### Performance Metrics

```bash
# Container resource usage
docker stats --no-stream

# Database connections
docker compose exec postgres psql -U medianest -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory usage
docker compose exec redis redis-cli INFO memory
```

## Issue Reporting Template

```markdown
### Issue Description

[Clear description of the issue]

### Steps to Reproduce

1. [First step]
2. [Second step]
3. [etc...]

### Expected Behavior

[What should happen]

### Actual Behavior

[What actually happens]

### Environment

- Browser: [Chrome/Firefox/Safari version]
- OS: [Windows/Mac/Linux]
- Docker version: [docker --version]
- User role: [admin/user]
- Service versions:
  - Plex: [version]
  - Overseerr: [version]
  - MediaNest: [git commit hash]

### Logs

[Relevant log entries]

### Screenshots

[If applicable]
```

## Troubleshooting Guide

### Common Issues

1. **Plex OAuth not working**
   - Verify Plex server is accessible
   - Check firewall rules
   - Ensure correct client ID/secret
   - Try incognito mode

2. **Services showing offline**
   - Verify service URLs are correct
   - Check from MediaNest container: `docker compose exec backend curl [service-url]`
   - Verify API keys are valid
   - Check service logs

3. **YouTube downloads failing**
   - Check yt-dlp is installed
   - Verify output directory permissions
   - Check disk space
   - Try updating yt-dlp

4. **WebSocket disconnections**
   - Check browser console
   - Verify no proxy interference
   - Check nginx configuration
   - Look for rate limiting

### Performance Optimization

1. **Slow page loads**
   - Enable Redis caching
   - Check database indexes
   - Review API response times
   - Enable CDN for assets

2. **High memory usage**
   - Check for memory leaks
   - Review Redis memory settings
   - Limit concurrent downloads
   - Adjust Node.js heap size

## Success Criteria

The application is ready for homelab deployment when:

- ✅ All test sections pass without critical issues
- ✅ Beta users can use all features successfully
- ✅ Performance meets targets (< 2s page loads)
- ✅ No security vulnerabilities found
- ✅ Error rate < 1% in normal usage
- ✅ All services degrade gracefully
- ✅ Mobile experience is acceptable
- ✅ 5+ concurrent users supported smoothly

## Final Sign-off

| Role          | Name | Date | Signature |
| ------------- | ---- | ---- | --------- |
| Developer     |      |      |           |
| Beta Tester 1 |      |      |           |
| Beta Tester 2 |      |      |           |
| System Admin  |      |      |           |

---

Last Updated: 2024-01-20
Version: 1.0.0
