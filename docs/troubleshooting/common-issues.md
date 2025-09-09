# MediaNest Troubleshooting Guide

This guide helps you diagnose and resolve common issues with MediaNest. Issues are organized by category with step-by-step solutions.

## Quick Diagnosis

### System Health Check

Before troubleshooting specific issues, check overall system health:

1. **Dashboard Status**: Check service status indicators on the dashboard
2. **Recent Errors**: Review error notifications or alerts
3. **Service Connectivity**: Verify all external services are accessible
4. **Resource Usage**: Check if system resources are adequate

### Common Symptoms and Quick Fixes

| Symptom | Quick Fix | See Section |
|---------|-----------|-------------|
| Can't log in | Clear browser cache, check Plex account | [Authentication Issues](#authentication-issues) |
| No search results | Check spelling, try different terms | [Search Problems](#search-problems) |
| Requests stuck pending | Contact admin, check service status | [Request Issues](#request-issues) |
| Slow page loading | Check internet connection, clear cache | [Performance Issues](#performance-issues) |
| Missing notifications | Check notification settings | [Notification Problems](#notification-problems) |

## Authentication Issues

### Cannot Log In with Plex

#### Symptoms
- Login page shows error after Plex authorization
- PIN expires before completing authorization
- Redirected to error page after Plex authentication

#### Diagnostic Steps
1. **Check Plex Account Access**:
   ```bash
   # Test Plex account by logging into plex.tv directly
   Visit: https://app.plex.tv/desktop
   ```

2. **Verify Browser Compatibility**:
   - Use a modern browser (Chrome, Firefox, Safari, Edge)
   - Disable browser extensions temporarily
   - Try incognito/private browsing mode

3. **Check Network Connectivity**:
   ```bash
   # Test connectivity to Plex services
   ping plex.tv
   nslookup plex.tv
   ```

#### Solutions

**Solution 1: Clear Browser Data**
1. Clear browser cookies and cache
2. Disable ad blockers or tracking protection
3. Allow pop-ups for MediaNest domain
4. Try authentication again

**Solution 2: Use Different Browser**
1. Try Chrome or Firefox if using Safari
2. Disable all browser extensions
3. Ensure JavaScript is enabled
4. Allow cookies from plex.tv and MediaNest

**Solution 3: Check Plex Account**
1. Log into plex.tv directly to verify account
2. Ensure account has access to the media server
3. Check if account requires 2FA (not supported)
4. Verify account is not suspended

**Solution 4: Network Configuration**
1. Check firewall settings allow plex.tv access
2. Verify DNS resolution for plex.tv
3. Try different network (mobile hotspot)
4. Check corporate proxy settings

### Session Expires Quickly

#### Symptoms
- Logged out after short period of inactivity
- "Session expired" errors during normal use
- Frequent re-authentication required

#### Solutions

**Check Session Settings**:
1. Log in with "Remember Me" checked
2. Contact admin about session timeout settings
3. Verify browser allows long-term cookies

**Browser Configuration**:
1. Don't use private/incognito mode for regular use
2. Allow cookies for MediaNest domain
3. Disable automatic cookie clearing

## Search Problems

### No Search Results

#### Symptoms
- Search returns empty results for known content
- Popular movies/shows don't appear in search
- Search seems to hang or load indefinitely

#### Diagnostic Steps
1. **Test Search Terms**:
   ```
   Try these test searches:
   - "inception" (popular movie)
   - "breaking bad" (popular TV show)
   - "2023" (recent year)
   ```

2. **Check Search Syntax**:
   - Use at least 3 characters
   - Avoid special characters or quotes
   - Try alternative titles or spellings

#### Solutions

**Solution 1: Adjust Search Terms**
1. Use simpler, shorter search terms
2. Remove years, extra words, or punctuation
3. Try alternative titles (original language, nicknames)
4. Search for individual words instead of full titles

**Solution 2: Check Service Status**
1. Verify TMDB service connectivity
2. Check admin dashboard for service issues
3. Try searching again after a few minutes
4. Contact admin if problem persists

**Solution 3: Clear Search Cache**
1. Refresh the search page (F5)
2. Clear browser cache for MediaNest
3. Try searching from different device
4. Log out and back in

### Search Results Inaccurate

#### Symptoms
- Wrong movies/shows in results
- Missing popular or recent content
- Results don't match search terms

#### Solutions

**Improve Search Specificity**:
1. Include release year: "batman 2022"
2. Use exact titles from TMDB
3. Search for specific categories (if available)
4. Try searching by actor or director names

**Report Search Issues**:
1. Note specific search terms and unexpected results
2. Contact admin with examples
3. Check if content exists on TMDB
4. Request manual addition if content is missing

## Request Issues

### Cannot Submit Request

#### Symptoms
- Request button is disabled or missing
- Form submission fails with error
- "Already requested" error for new content

#### Diagnostic Steps
1. **Check Request Status**:
   - Verify content isn't already in Plex
   - Check if you've already requested this content
   - Review your pending request count

2. **Verify Account Permissions**:
   - Ensure you're logged in
   - Check if account has request permissions
   - Verify account isn't suspended

#### Solutions

**Solution 1: Check Existing Requests**
1. Go to "My Requests" page
2. Search for the content you want to request
3. Cancel duplicate requests if needed
4. Wait for pending requests to be processed

**Solution 2: Verify Content Details**
1. Ensure correct media type (movie vs TV show)
2. For TV shows, select specific seasons
3. Check content rating and availability
4. Try requesting from content detail page

**Solution 3: Account Issues**
1. Log out and back in
2. Check with admin about request limits
3. Verify account isn't restricted
4. Try requesting different content to isolate issue

### Requests Stuck in Pending Status

#### Symptoms
- Requests remain pending for extended period
- No response from administrators
- Status never changes from "pending"

#### Solutions

**Check Admin Response Time**:
1. Review typical approval times with admin
2. Check if admins are notified about requests
3. Contact admin directly if urgent
4. Be patient during busy periods or holidays

**Verify Request Details**:
1. Ensure request has all required information
2. Check if content violates any policies
3. Verify content is available for download
4. Add notes or comments if allowed

### Request Failed or Rejected

#### Symptoms
- Request status shows "failed" or "rejected"
- Download errors or timeouts
- Content unavailable despite approval

#### Solutions

**For Rejected Requests**:
1. Read rejection reason carefully
2. Check content policies and guidelines
3. Modify request if possible (different quality, seasons)
4. Contact admin for clarification

**For Failed Requests**:
1. Check if content is still available
2. Wait and try requesting again later
3. Report persistent failures to admin
4. Try requesting alternative versions

## Performance Issues

### Slow Page Loading

#### Symptoms
- Pages take long time to load
- Interface feels sluggish or unresponsive
- Timeouts or connection errors

#### Diagnostic Steps
1. **Test Network Speed**:
   ```bash
   # Test internet connection speed
   Use: speedtest.net or similar
   ```

2. **Check Browser Performance**:
   - Open browser developer tools (F12)
   - Check Network tab for slow requests
   - Monitor Console for JavaScript errors

#### Solutions

**Solution 1: Network Optimization**
1. Check internet connection speed
2. Try wired connection instead of WiFi
3. Disable VPN temporarily
4. Use different DNS servers (8.8.8.8, 1.1.1.1)

**Solution 2: Browser Optimization**
1. Clear browser cache and cookies
2. Disable unnecessary browser extensions
3. Close other tabs and applications
4. Update browser to latest version

**Solution 3: System Resources**
1. Close other applications using memory
2. Restart browser completely
3. Restart computer if issues persist
4. Check available disk space

### Search Takes Too Long

#### Symptoms
- Search results take more than 10 seconds
- Search appears to hang or timeout
- Partial results or error messages

#### Solutions

**Optimize Search Queries**:
1. Use more specific search terms
2. Avoid very broad terms like "action" or "2023"
3. Search for exact titles when possible
4. Use filters to narrow results (if available)

**Check System Status**:
1. Verify external services (TMDB) are responsive
2. Try searching again during off-peak hours
3. Contact admin if consistently slow
4. Check admin dashboard for performance issues

## Notification Problems

### Not Receiving Notifications

#### Symptoms
- No email notifications for request updates
- Missing browser notifications
- No alerts for completed requests

#### Diagnostic Steps
1. **Check Notification Settings**:
   - Review profile notification preferences
   - Verify email address is correct
   - Check browser notification permissions

2. **Test Email Delivery**:
   - Check spam/junk folders
   - Verify email filters aren't blocking
   - Test with password reset email

#### Solutions

**Solution 1: Email Configuration**
1. Check spam/junk folders for MediaNest emails
2. Add MediaNest email address to contacts
3. Whitelist MediaNest domain in email filters
4. Update email address in profile if changed

**Solution 2: Browser Notifications**
1. Enable notifications in browser settings
2. Allow notifications for MediaNest site
3. Check if "Do Not Disturb" mode is enabled
4. Try different browser to test

**Solution 3: Profile Settings**
1. Review notification preferences in profile
2. Enable all desired notification types
3. Save settings and test with new request
4. Contact admin if settings don't save

### Too Many Notifications

#### Symptoms
- Excessive email notifications
- Constant browser alerts
- Notification fatigue from too many updates

#### Solutions

**Customize Notification Settings**:
1. Go to Profile → Notification Settings
2. Disable non-essential notifications
3. Choose email digest instead of individual emails
4. Set quiet hours if available

**Filter Important Notifications**:
1. Keep only completion and approval notifications
2. Disable progress update notifications
3. Turn off system maintenance notifications
4. Create email rules to organize MediaNest emails

## Integration Issues

### Plex Integration Problems

#### Symptoms
- Content doesn't appear in Plex after completion
- Plex status shows incorrect information
- Cannot connect to Plex server

#### Solutions

**Check Plex Server**:
1. Verify Plex server is running and accessible
2. Check Plex server has latest updates
3. Refresh Plex library manually
4. Check network connectivity to Plex server

**Verify MediaNest Configuration**:
1. Contact admin about Plex integration settings
2. Check if Plex token is valid
3. Verify library scanning configuration
4. Test Plex connectivity from admin dashboard

### External Service Issues

#### Symptoms
- TMDB data not loading
- Download service connectivity problems
- Service status shows offline

#### Solutions

**Check Service Status**:
1. Visit service status pages (status.themoviedb.org)
2. Test service connectivity directly
3. Check for service maintenance windows
4. Wait and retry if services are down

**Report to Administrator**:
1. Contact admin with specific service issues
2. Provide details about error messages
3. Include timestamps and affected features
4. Check admin dashboard for known issues

## Mobile and Browser Issues

### Mobile App Problems

#### Symptoms
- App crashes or won't start
- Features missing on mobile
- Touch interface not responsive

#### Solutions

**App Troubleshooting**:
1. Update app to latest version
2. Restart app completely
3. Clear app cache and data
4. Reinstall app if problems persist

**Browser Alternative**:
1. Use mobile browser instead of app
2. Add MediaNest as home screen bookmark
3. Enable desktop site if needed
4. Try different mobile browser

### Browser Compatibility Issues

#### Symptoms
- Interface elements not displaying correctly
- JavaScript errors or missing functionality
- Layout problems or missing styles

#### Solutions

**Browser Updates**:
1. Update browser to latest version
2. Enable JavaScript and cookies
3. Disable compatibility mode
4. Clear browser cache completely

**Alternative Browsers**:
1. Try Chrome, Firefox, Safari, or Edge
2. Use browser with better standards support
3. Disable all extensions for testing
4. Check browser console for error messages

## When to Contact Support

### User Support Issues
Contact your MediaNest administrator for:
- Account access problems that persist after troubleshooting
- Request approval questions or policy clarifications
- System-wide issues affecting multiple users
- Feature requests or configuration changes

### Technical Support Issues
Contact technical support for:
- Server errors or system crashes
- Integration problems with external services
- Performance issues affecting entire system
- Security concerns or suspicious activity

### Information to Include

When contacting support, include:

**Basic Information**:
- Your username and account details
- Browser and operating system version
- Steps you've already tried
- When the problem started

**Technical Details**:
- Error messages (exact text or screenshots)
- Request IDs or correlation IDs
- Browser console errors (if applicable)
- Network information (if relevant)

**Context**:
- What you were trying to do
- Expected vs actual behavior
- How often the problem occurs
- Impact on your workflow

## Preventive Measures

### Regular Maintenance

**User Actions**:
1. Keep browser updated and clear cache regularly
2. Review and update notification preferences
3. Monitor request limits and usage
4. Report issues early before they become critical

**System Health**:
1. Monitor system status dashboard regularly
2. Stay informed about maintenance windows
3. Keep contact information updated
4. Follow administrator announcements

### Best Practices

**Effective Usage**:
1. Use specific search terms for better results
2. Check existing requests before submitting new ones
3. Review content policies to avoid rejections
4. Be patient with request processing times

**Troubleshooting**:
1. Try simple solutions first (refresh, logout/login)
2. Document problems with screenshots when possible
3. Test on different devices/browsers to isolate issues
4. Keep track of correlation IDs for support requests

---

**Still having issues?** Contact your MediaNest administrator or check the [User Guide](/user-guides/) for additional help.

**Last Updated:** January 15, 2025  
**Version:** 1.0.0