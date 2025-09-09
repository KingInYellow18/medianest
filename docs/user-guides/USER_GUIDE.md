# MediaNest User Guide

**Version:** 4.0 - Comprehensive User Documentation  
**Last Updated:** September 7, 2025  
**Audience:** End Users and System Administrators

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Interface Overview](#user-interface-overview)
3. [Authentication](#authentication)
4. [Dashboard Features](#dashboard-features)
5. [Media Management](#media-management)
6. [Search and Discovery](#search-and-discovery)
7. [User Settings](#user-settings)
8. [Integration Management](#integration-management)
9. [Troubleshooting](#troubleshooting)
10. [Tips and Best Practices](#tips-and-best-practices)

## Getting Started

### First Login

1. **Navigate to MediaNest**

   - Open your web browser
   - Go to your MediaNest installation URL
   - You'll see the login screen

2. **Initial Admin Setup**

   - Use admin/admin credentials for first login
   - You'll be prompted to change the admin password immediately
   - Choose a strong password following the security guidelines

3. **Plex Integration Setup**
   - After login, navigate to Settings → Integrations
   - Configure your Plex server connection
   - Enter your Plex server URL and authentication token

### System Requirements (User Side)

- **Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript:** Must be enabled
- **Cookies:** Required for authentication
- **Network:** Stable internet connection for media streaming

## User Interface Overview

### Main Navigation

```
┌─────────────────────────────────────────────────┐
│  MediaNest                            [User] [⚙] │
├─────────────────────────────────────────────────┤
│ 📊 Dashboard  📺 Media  🔍 Search  ⚙️ Settings │
├─────────────────────────────────────────────────┤
│                                                 │
│              Main Content Area                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Layout Components

1. **Header Bar**

   - MediaNest logo and title
   - User profile dropdown
   - Settings access
   - Logout option

2. **Navigation Tabs**

   - Dashboard: Overview and statistics
   - Media: Browse integrated media libraries
   - Search: Unified search across services
   - Settings: User and system configuration

3. **Content Area**
   - Dynamic content based on selected tab
   - Responsive design for mobile and desktop
   - Loading states and error handling

## Authentication

### Login Process

1. **Standard Login**

   - Enter username and password
   - Optional "Remember Me" for extended sessions
   - Click "Sign In" to authenticate

2. **Session Management**
   - Sessions automatically extend with activity
   - Idle timeout after 24 hours (configurable)
   - Secure logout clears all session data

### Password Management

1. **Change Password**

   - Navigate to Settings → Account
   - Enter current password
   - Provide new password (must meet security requirements)
   - Confirm new password and save

2. **Password Requirements**
   - Minimum 8 characters
   - Must include uppercase, lowercase, number
   - Special characters recommended
   - Cannot reuse last 5 passwords

### Security Features

- **Automatic Logout:** Idle session timeout
- **Device Tracking:** Monitor active sessions
- **Login Alerts:** Notifications for new device logins
- **Session Limits:** Maximum concurrent sessions per user

## Dashboard Features

### Overview Cards

1. **Library Statistics**

   - Total media items across all integrations
   - Recently added content
   - Most popular items
   - Storage usage statistics

2. **Activity Summary**

   - Recent user activity
   - Popular searches
   - Trending content
   - System status indicators

3. **Quick Actions**
   - Search shortcuts
   - Recent media access
   - Settings shortcuts
   - Help and documentation links

### Real-time Updates

- **Live Data:** Dashboard updates automatically
- **Notifications:** System alerts and status changes
- **Refresh Control:** Manual refresh option available

## Media Management

### Plex Integration

1. **Library Browsing**

   - Browse Plex libraries by type (Movies, TV, Music)
   - Filter by genre, rating, release date
   - Sort by various criteria
   - Grid and list view options

2. **Media Information**

   - Detailed metadata display
   - Cover art and thumbnails
   - Rating and review information
   - Related content suggestions

3. **Playback Control**
   - Direct links to Plex player
   - Continue watching from last position
   - Add to watchlist
   - Mark as watched/unwatched

### YouTube Integration

1. **Content Discovery**

   - Browse subscribed channels
   - View recommended content
   - Access playlists and favorites
   - Search YouTube content

2. **Video Management**
   - Save videos to custom playlists
   - Mark videos as watched
   - Download video information
   - Share video links

## Search and Discovery

### Unified Search

1. **Cross-Platform Search**

   - Search across Plex and YouTube simultaneously
   - Intelligent result ranking
   - Filter results by source
   - Advanced search operators

2. **Search Filters**
   - Content type (movies, TV, music, videos)
   - Source platform (Plex, YouTube)
   - Date ranges
   - Quality and format filters

### Search Features

1. **Auto-Complete**

   - Real-time search suggestions
   - Recent search history
   - Popular search terms
   - Typo correction

2. **Advanced Search**
   - Boolean operators (AND, OR, NOT)
   - Exact phrase matching
   - Wildcard searches
   - Regular expression support

### Result Management

1. **Result Display**

   - Thumbnail grid view
   - Detailed list view
   - Sorting options
   - Pagination controls

2. **Saved Searches**
   - Save frequent searches
   - Search history
   - Custom search folders
   - Search sharing (admin only)

## User Settings

### Account Management

1. **Profile Information**

   - Update display name
   - Change email address
   - Set timezone preferences
   - Language selection

2. **Notification Preferences**
   - Email notifications
   - In-app alerts
   - Notification frequency
   - Digest options

### Display Preferences

1. **Interface Customization**

   - Theme selection (light/dark)
   - Layout preferences
   - Grid size options
   - Default view modes

2. **Content Preferences**
   - Default content filters
   - Preferred video quality
   - Auto-play settings
   - Mature content filters

### Privacy Settings

1. **Data Management**

   - Download personal data
   - Clear search history
   - Reset preferences
   - Account deletion request

2. **Tracking Preferences**
   - Analytics opt-out
   - Usage data sharing
   - Personalization settings
   - Cookie preferences

## Integration Management

### Plex Server Configuration

1. **Connection Setup**

   - Server URL configuration
   - Authentication token management
   - Connection testing
   - Network troubleshooting

2. **Library Synchronization**
   - Manual sync triggers
   - Automatic sync scheduling
   - Sync status monitoring
   - Error resolution

### YouTube API Configuration

1. **API Key Management**

   - Configure YouTube API access
   - Monitor quota usage
   - Rate limit information
   - Error handling

2. **Content Preferences**
   - Default search regions
   - Content filtering levels
   - Preferred video formats
   - Subscription management

### Service Status

1. **Health Monitoring**

   - Real-time service status
   - Connection diagnostics
   - Performance metrics
   - Historical uptime data

2. **Error Reporting**
   - Automatic error detection
   - User error reporting
   - Resolution tracking
   - Support ticket creation

## Troubleshooting

### Common Issues

1. **Login Problems**

   - **Symptom:** Cannot log in with correct credentials
   - **Solution:** Clear browser cache and cookies
   - **Alternative:** Try incognito/private browsing mode

2. **Media Not Loading**

   - **Symptom:** Plex content not displaying
   - **Solution:** Verify Plex server is running and accessible
   - **Check:** Network connectivity and firewall settings

3. **Search Not Working**

   - **Symptom:** Search returns no results
   - **Solution:** Check integration status in Settings
   - **Verify:** API keys and service connections

4. **Performance Issues**
   - **Symptom:** Slow loading times
   - **Solution:** Check internet connection speed
   - **Alternative:** Try different browser or clear cache

### Error Messages

1. **"Service Unavailable"**

   - External service (Plex/YouTube) is down
   - Check service status pages
   - Wait and retry later

2. **"Authentication Failed"**

   - Invalid or expired credentials
   - Log out and log back in
   - Contact administrator if persistent

3. **"Connection Timeout"**
   - Network connectivity issues
   - Check internet connection
   - Verify firewall settings

### Browser Compatibility

1. **Recommended Browsers**

   - Chrome 90+ (best performance)
   - Firefox 88+
   - Safari 14+
   - Edge 90+

2. **Browser Settings**
   - Enable JavaScript
   - Allow cookies from MediaNest domain
   - Disable ad blockers for the site
   - Enable local storage

## Tips and Best Practices

### Optimal Usage

1. **Search Efficiency**

   - Use specific search terms for better results
   - Utilize filters to narrow down results
   - Save frequently used searches
   - Take advantage of auto-complete suggestions

2. **Media Organization**

   - Use playlists to organize content
   - Tag favorite content for quick access
   - Regularly clean up watch history
   - Organize content by personal categories

3. **Performance Optimization**
   - Regularly clear browser cache
   - Close unused browser tabs
   - Use wired internet connection when possible
   - Keep browser updated to latest version

### Security Best Practices

1. **Account Security**

   - Use strong, unique passwords
   - Enable two-factor authentication (when available)
   - Regularly review active sessions
   - Log out from shared computers

2. **Privacy Protection**
   - Review privacy settings regularly
   - Be cautious with personal information sharing
   - Monitor account activity
   - Report suspicious activities

### Getting Help

1. **Built-in Help**

   - Hover over UI elements for tooltips
   - Check help sections in Settings
   - Use the search feature to find specific content
   - Review status indicators for service health

2. **Support Resources**
   - Contact system administrator
   - Check system status page
   - Review troubleshooting guide
   - Submit feedback through the interface

---

**Note:** This user guide covers the standard MediaNest functionality. Some features may vary based on your installation configuration and user permissions. For technical issues beyond basic troubleshooting, contact your system administrator.
