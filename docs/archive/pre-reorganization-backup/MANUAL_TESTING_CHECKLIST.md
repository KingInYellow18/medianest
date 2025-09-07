# MediaNest Manual Testing Checklist

## Date: **\*\***\_\_\_**\*\***

## Tester: **\*\***\_\_\_**\*\***

## Version: **\*\***\_\_\_**\*\***

## 1. Environment Setup Verification

### Docker & Services

- [ ] Docker Compose starts all services successfully
  ```bash
  docker compose up -d
  ```
- [ ] All containers are running:
  - [ ] Frontend (port 3000)
  - [ ] Backend (port 4000)
  - [ ] PostgreSQL (port 5432)
  - [ ] Redis (port 6379)
  - [ ] Nginx (port 80/443)

### Health Checks

- [ ] Frontend loads at http://localhost:3000
- [ ] Backend health endpoint responds: http://localhost:4000/api/health
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] Environment variables loaded correctly

## 2. Complete User Journey Testing

### First-time Setup

- [ ] Access application for first time
- [ ] Admin bootstrap page appears
- [ ] Can create admin account with admin/admin
- [ ] Required to change admin password
- [ ] Service configuration page accessible

### Plex Authentication Flow

- [ ] "Login with Plex" button visible
- [ ] PIN generation successful
- [ ] PIN displayed clearly
- [ ] Link to plex.tv/link works
- [ ] PIN entry successful on Plex
- [ ] Redirect back to app works
- [ ] User profile loaded correctly
- [ ] User avatar displayed
- [ ] Username shown
- [ ] Email displayed (if available)

### Service Dashboard

- [ ] All service cards visible:
  - [ ] Plex
  - [ ] Overseerr
  - [ ] Uptime Kuma
- [ ] Real-time status updates working
- [ ] Service health indicators correct:
  - [ ] Green for up
  - [ ] Red for down
  - [ ] Yellow for degraded
- [ ] Response times displayed
- [ ] Uptime percentages shown
- [ ] Last check timestamps updating
- [ ] Quick action buttons functional
- [ ] Responsive layout on different screen sizes

## 3. Media Management Testing

### Browse Plex Library

- [ ] Library sections load correctly
- [ ] Can switch between libraries:
  - [ ] Movies
  - [ ] TV Shows
  - [ ] Music (if available)
- [ ] Media items display with:
  - [ ] Poster images
  - [ ] Titles
  - [ ] Year
  - [ ] Rating
- [ ] Pagination works
- [ ] Search within libraries functional
- [ ] Recently added section displays
- [ ] Metadata displayed correctly

### Request Media

- [ ] Search for new content works
- [ ] Search results display from Overseerr
- [ ] Can open request modal
- [ ] Movie requests:
  - [ ] Shows movie details
  - [ ] Submit request button works
  - [ ] Confirmation message appears
- [ ] TV Show requests:
  - [ ] Season selector appears
  - [ ] Can select individual seasons
  - [ ] Select All/Deselect All works
  - [ ] Available seasons marked
- [ ] Request status updates
- [ ] Request history viewable
- [ ] Duplicate request prevention works
- [ ] Rate limiting message appears after limit

## 4. YouTube Download Testing

### Submit Downloads

- [ ] URL input field available
- [ ] Single video URL accepted
- [ ] Playlist URL accepted
- [ ] Invalid URL shows error
- [ ] Quality selection works
- [ ] Format selection works
- [ ] Submit button enabled when valid

### Download Management

- [ ] Download added to queue
- [ ] Progress indicator updates
- [ ] Download speed displayed
- [ ] ETA shown
- [ ] Can cancel in-progress download
- [ ] Completed downloads listed
- [ ] Failed downloads show error
- [ ] Retry button works

### Rate Limiting

- [ ] Can submit 5 downloads
- [ ] 6th download blocked with message
- [ ] Timer shows when limit resets
- [ ] Limit resets after 1 hour

### File Organization

- [ ] Downloads saved to correct directory
- [ ] Files named appropriately
- [ ] Metadata files created
- [ ] Thumbnails downloaded

### Plex Integration

- [ ] Plex library scan triggered
- [ ] New content appears in Plex
- [ ] Metadata displayed correctly

## 5. Service Degradation Testing

### Stop Plex Server

- [ ] Service card shows "down" status
- [ ] Error message user-friendly
- [ ] Cached library data still displays
- [ ] Cannot make new requests
- [ ] App remains stable

### Stop Overseerr

- [ ] Search shows friendly error
- [ ] Existing requests still visible
- [ ] Cannot submit new requests
- [ ] Request queue saved for recovery

### Stop Uptime Kuma

- [ ] Service status shows "unknown"
- [ ] Fallback data displayed
- [ ] No app crashes
- [ ] WebSocket reconnection attempts visible

### Database Failure

- [ ] App shows maintenance mode
- [ ] Cached data where available
- [ ] No data loss on recovery

### Redis Failure

- [ ] Rate limiting falls back gracefully
- [ ] Sessions remain active
- [ ] Performance degraded but functional

## 6. Multi-User Testing

### User Accounts

- [ ] Create 5-10 test user accounts
- [ ] Each user can log in successfully
- [ ] User profiles isolated

### Concurrent Usage

- [ ] Multiple users browsing simultaneously
- [ ] No performance degradation
- [ ] No data leakage between users

### User Isolation

- [ ] Users see only their requests
- [ ] Download queues are separate
- [ ] Rate limits per user
- [ ] Cannot access other users' data

### Simultaneous Operations

- [ ] Multiple downloads work
- [ ] Concurrent media requests
- [ ] No race conditions

## 7. Performance Validation

### Page Load Times

- [ ] Homepage: < 2 seconds
- [ ] Dashboard: < 2 seconds
- [ ] Media browse: < 3 seconds
- [ ] Search results: < 2 seconds

### API Response Times

- [ ] Auth endpoints: < 500ms
- [ ] Media search: < 1 second
- [ ] Status endpoints: < 200ms
- [ ] Download submission: < 500ms

### UI Interactions

- [ ] Smooth scrolling (60 fps)
- [ ] No janky animations
- [ ] Responsive to clicks
- [ ] Form inputs responsive

### Resource Usage

- [ ] Memory stable after 1 hour
- [ ] No memory leaks detected
- [ ] CPU usage reasonable
- [ ] Network requests optimized

### WebSocket Stability

- [ ] Connection remains stable
- [ ] Reconnects after disconnect
- [ ] No duplicate events
- [ ] Messages delivered reliably

## 8. Mobile Responsiveness

### Phone Testing (iOS/Android)

- [ ] Layout adapts correctly
- [ ] Text remains readable
- [ ] Buttons easily tappable
- [ ] Forms usable
- [ ] Modals fit screen

### Tablet Testing

- [ ] Layout optimized for tablet
- [ ] Uses available space well
- [ ] Navigation remains usable

### Touch Interactions

- [ ] Swipe gestures work
- [ ] Tap targets adequate size
- [ ] No hover-dependent features
- [ ] Long press where appropriate

### Orientation

- [ ] Portrait mode works
- [ ] Landscape mode works
- [ ] Smooth transitions
- [ ] No layout breaking

## 9. Security & Error Handling

### Authentication

- [ ] Cannot access without login
- [ ] JWT tokens working
- [ ] Logout clears session
- [ ] Remember me works (90 days)

### Authorization

- [ ] Regular users cannot access admin
- [ ] API endpoints protected
- [ ] CORS configured correctly

### Error Messages

- [ ] User-friendly error messages
- [ ] No stack traces exposed
- [ ] Helpful guidance provided
- [ ] Contact info if needed

### Input Validation

- [ ] XSS attempts blocked
- [ ] SQL injection prevented
- [ ] File upload restrictions
- [ ] URL validation working

## 10. Edge Cases & Cleanup

### Edge Cases

- [ ] Empty states handled
- [ ] Very long text truncated
- [ ] Special characters handled
- [ ] Network timeout handling
- [ ] Large file downloads

### Data Cleanup

- [ ] Old downloads cleaned up
- [ ] Expired sessions removed
- [ ] Temporary files deleted
- [ ] Logs rotate properly

## Test Results Summary

### Overall Status: PASS / FAIL

### Critical Issues Found:

1. ***
2. ***
3. ***

### Minor Issues Found:

1. ***
2. ***
3. ***

### Performance Metrics:

- Average page load: **\_\_\_** seconds
- API response time: **\_\_\_** ms
- Memory usage: **\_\_\_** MB
- Concurrent users tested: **\_\_\_**

### Recommendations:

1. ***
2. ***
3. ***

### Sign-off:

- Tester: ****\*\*****\_\_\_****\*\*****
- Date: ****\*\*\*\*****\_****\*\*\*\*****
- Approved for deployment: YES / NO

## Notes Section

_Use this space for additional observations, test environment details, or specific configuration notes_

---

---

---

---
