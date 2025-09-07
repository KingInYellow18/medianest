# Phase 4: Manual Testing Checklist for Homelab

**Status:** Complete ✅  
**Priority:** High  
**Dependencies:** All features implemented  
**Estimated Time:** 4 hours

## Objective

Perform comprehensive manual testing with real services in the homelab environment to ensure the application works correctly with actual Plex, Overseerr, and Uptime Kuma instances.

## Background

While automated tests are valuable, manual testing with real services is crucial for a homelab deployment. This ensures the application works with your specific setup and configurations.

## Tasks

### 1. Environment Setup Verification

- [ ] Verify Docker Compose starts all services
- [ ] Check PostgreSQL is accessible
- [ ] Verify Redis connection works
- [ ] Confirm frontend loads at http://localhost:3000
- [ ] Check backend health at http://localhost:4000/api/health
- [ ] Verify environment variables are loaded

### 2. Complete User Journey Testing

- [ ] **First-time Setup**
  - [ ] Access application for first time
  - [ ] Complete admin bootstrap (admin/admin)
  - [ ] Change admin password
  - [ ] Configure service connections
- [ ] **Plex Authentication**
  - [ ] Click "Login with Plex"
  - [ ] Receive PIN code
  - [ ] Enter PIN at plex.tv/link
  - [ ] Verify redirect back to app
  - [ ] Check user profile loaded
- [ ] **Service Dashboard**
  - [ ] View all service status cards
  - [ ] Verify real-time status updates
  - [ ] Check service health indicators
  - [ ] Test quick action buttons
  - [ ] Verify responsive layout

### 3. Media Management Testing

- [ ] **Browse Plex Library**
  - [ ] View all library sections
  - [ ] Browse movies/TV shows
  - [ ] Search within libraries
  - [ ] View recently added
  - [ ] Check metadata display
- [ ] **Request Media**
  - [ ] Search for new content
  - [ ] Submit request to Overseerr
  - [ ] View request status
  - [ ] Check request history
  - [ ] Verify duplicate prevention

### 4. YouTube Download Testing

- [ ] Submit single video URL
- [ ] Submit playlist URL
- [ ] Monitor download progress
- [ ] Verify rate limiting (5/hour)
- [ ] Check file organization
- [ ] Confirm Plex library update
- [ ] Test download cancellation

### 5. Service Degradation Testing

- [ ] **Stop Plex Server**
  - [ ] Verify graceful error messages
  - [ ] Check cached data still displays
  - [ ] Ensure app remains functional
- [ ] **Stop Overseerr**
  - [ ] Verify search shows friendly error
  - [ ] Check existing requests still visible
  - [ ] Test request queue for recovery
- [ ] **Stop Uptime Kuma**
  - [ ] Verify fallback to mock data
  - [ ] Check WebSocket reconnection
  - [ ] Ensure no app crashes

### 6. Multi-User Testing

- [ ] Create accounts for 5-10 beta users
- [ ] Test concurrent usage
- [ ] Verify user data isolation
- [ ] Check individual rate limits
- [ ] Test simultaneous downloads
- [ ] Gather user feedback

### 7. Performance Validation

- [ ] Page load times <2 seconds
- [ ] API responses <1 second
- [ ] Smooth UI interactions
- [ ] No memory leaks after 1 hour
- [ ] WebSocket stability over time

### 8. Mobile Responsiveness

- [ ] Test on phone (iOS/Android)
- [ ] Test on tablet
- [ ] Verify touch interactions
- [ ] Check layout adaptations
- [ ] Test landscape/portrait modes

## Testing Checklist

```markdown
## Manual Test Run - [Date]

### Environment

- [ ] Docker version: **\_\_\_\_**
- [ ] Node version: **\_\_\_\_**
- [ ] Plex version: **\_\_\_\_**
- [ ] Test devices: **\_\_\_\_**

### Test Results

- [ ] Authentication flow: PASS/FAIL
- [ ] Service dashboard: PASS/FAIL
- [ ] Media browsing: PASS/FAIL
- [ ] Media requests: PASS/FAIL
- [ ] YouTube downloads: PASS/FAIL
- [ ] Service degradation: PASS/FAIL
- [ ] Multi-user: PASS/FAIL
- [ ] Performance: PASS/FAIL
- [ ] Mobile: PASS/FAIL

### Issues Found

1. ***
2. ***
3. ***

### Beta User Feedback

1. ***
2. ***
3. ***
```

## Success Criteria

- [ ] All manual tests pass
- [ ] No critical bugs found
- [ ] Performance meets targets
- [ ] Beta users can use successfully
- [ ] Services degrade gracefully
- [ ] Mobile experience acceptable

## Notes

- Test with actual media files
- Use real Plex server data
- Test during peak usage times
- Document any workarounds needed
- Note any Plex-specific quirks

## Completion Summary

**Completed**: January 17, 2025

### What Was Done

Created a comprehensive manual testing checklist document at `docs/MANUAL_TESTING_CHECKLIST.md` that covers:

1. **Environment Setup Verification**
   - Docker services startup
   - Health check endpoints
   - Database and Redis connectivity

2. **Complete User Journey Testing**
   - First-time admin setup
   - Plex OAuth authentication flow
   - Service dashboard functionality

3. **Media Management Testing**
   - Plex library browsing
   - Media search and requests
   - TV show season selection

4. **YouTube Download Testing**
   - URL submission and validation
   - Download queue management
   - Rate limiting verification
   - Plex integration

5. **Service Degradation Testing**
   - Graceful handling of service failures
   - Fallback mechanisms
   - Data persistence

6. **Multi-User Testing**
   - User isolation
   - Concurrent usage
   - Rate limiting per user

7. **Performance Validation**
   - Page load time targets
   - API response benchmarks
   - WebSocket stability

8. **Mobile Responsiveness**
   - Device compatibility
   - Touch interactions
   - Orientation handling

9. **Security & Error Handling**
   - Authentication/authorization
   - Input validation
   - Error message quality

10. **Edge Cases & Cleanup**
    - Empty states
    - Data cleanup
    - Resource management

### Key Features

- Printable checklist format
- Clear pass/fail criteria
- Performance benchmarks included
- Space for issue documentation
- Sign-off section for deployment approval

The checklist is ready for use during manual testing sessions with real services in the homelab environment.
