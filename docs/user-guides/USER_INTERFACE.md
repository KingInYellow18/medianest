# MediaNest User Interface Guide

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active - Post-Cleanup Interface Guide  

## Overview

MediaNest provides a modern, responsive web interface for managing your media server and related services. This guide covers all aspects of the user interface, from basic navigation to advanced features.

## Interface Architecture

### Technology Stack
- **Frontend Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with custom components
- **Real-time Updates**: Socket.io for live status updates
- **Authentication**: NextAuth.js with Plex OAuth integration
- **State Management**: React Context with optimized hooks
- **Icons**: Lucide React icon library

### Responsive Design
- ✅ **Desktop**: Optimized for 1920x1080 and larger
- ✅ **Tablet**: Responsive layout for tablet devices
- ✅ **Mobile**: Mobile-first design with touch optimizations

## Main Interface Components

### Navigation Header

Located at the top of every page:

```
[MediaNest Logo] [Dashboard] [Media] [Services] [Settings] [Profile ▼]
```

**Navigation Items:**
- **Dashboard**: System overview and quick actions
- **Media**: Browse and manage Plex media library
- **Services**: External service status and management
- **Settings**: System configuration and integrations
- **Profile Menu**: User settings, logout, and preferences

### Sidebar Navigation (Desktop)

**Main Sections:**
```
📊 Dashboard
├── System Overview
├── Recent Activity  
└── Quick Actions

📺 Media Library
├── Movies
├── TV Shows
├── Music
└── Photos

🔧 Services
├── Plex Server
├── Overseerr
├── Uptime Kuma
└── Service Health

⚙️ Settings
├── General
├── Integrations
├── Users
└── Security
```

### Status Bar

Located at the bottom of the interface:
- **Connection Status**: WebSocket connection indicator
- **System Status**: Overall system health
- **Version Info**: Current MediaNest version
- **Last Update**: Timestamp of last data refresh

## Dashboard Interface

### System Overview Card

**Real-time Metrics:**
- System uptime and load
- Active user sessions
- Database connection status
- Cache hit ratio (if Redis enabled)

**Visual Elements:**
- Status indicators (green/yellow/red)
- Progress bars for system resources
- Interactive tooltips with details

### Service Status Grid

**Service Cards Display:**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Plex Server │ │  Overseerr  │ │ Uptime Kuma │
│   ✅ Online  │ │  ⚠️ Slow    │ │  ❌ Down    │
│ 45ms resp   │ │ 234ms resp  │ │  Timeout    │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Status Indicators:**
- ✅ **Green**: Service online and responsive
- ⚠️ **Yellow**: Service online but slow/degraded
- ❌ **Red**: Service offline or unreachable
- ⏳ **Blue**: Service checking or starting

### Recent Activity Feed

**Activity Types:**
- Media requests and downloads
- User login/logout events
- Service status changes
- System alerts and notifications

**Activity Entry Format:**
```
[Timestamp] [User] [Action] [Resource]
2:34 PM     admin   requested "Movie Title"
2:31 PM     system  plex_server went offline
2:28 PM     user1   logged in from 192.168.1.100
```

### Quick Actions Panel

**Available Actions:**
- **Restart Services**: Quick service restart buttons
- **System Maintenance**: Cache clear, log rotation
- **Emergency Actions**: Emergency mode, safe shutdown
- **Backup/Restore**: Configuration backup/restore

## Media Library Interface

### Library Browser

**View Modes:**
- **Grid View**: Poster thumbnails with metadata
- **List View**: Detailed list with sortable columns
- **Card View**: Medium-sized cards with descriptions

**Filter Options:**
- Media type (Movies, TV Shows, Music, Photos)
- Genre filtering
- Release year range
- Quality/resolution
- Watch status

**Sort Options:**
- Title (A-Z, Z-A)
- Release date (newest, oldest)
- Date added (recent, oldest)
- Rating (highest, lowest)
- Duration

### Media Details View

**Information Displayed:**
```
┌─────────────────────────────────────────────────────┐
│ [Movie Poster]  Movie Title (Year)                  │
│                 ★★★★☆ 8.2/10                        │
│                                                     │
│ Duration: 2h 34m    Genre: Action, Thriller        │
│ Resolution: 1080p   Audio: DTS-HD MA 5.1          │
│ File Size: 4.2 GB   Bitrate: 3,847 kbps           │
│                                                     │
│ Synopsis: [Movie description...]                    │
│                                                     │
│ [▶ Play] [+ Watchlist] [📥 Download] [ℹ More Info] │
└─────────────────────────────────────────────────────┘
```

### Search Interface

**Search Features:**
- **Global Search**: Search across all media types
- **Advanced Filters**: Multiple criteria combination
- **Real-time Results**: Results update as you type
- **Search History**: Recent searches saved
- **Suggestions**: Auto-complete and suggestions

**Search Bar:**
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search your library...                          │
│ ┌─ Filters ──────────────────────────────────────┐ │
│ │ Type: All ▼  Genre: All ▼  Year: All ▼       │ │
│ │ Quality: All ▼  Status: All ▼                  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Services Management Interface

### Service Configuration Cards

**Configuration Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Plex Server Configuration                           │
│ ┌─────────────┐  Status: ✅ Connected              │
│ │ Plex Logo   │  URL: http://plex.local:32400       │
│ │   [Icon]    │  Token: ●●●●●●●●●●●●●●●●              │
│ └─────────────┘  Version: 1.32.5.7349              │
│                                                     │
│ [Test Connection] [Reconnect] [Configure] [Remove]  │
└─────────────────────────────────────────────────────┘
```

### Service Health Monitor

**Real-time Monitoring:**
- Response time graphs
- Uptime percentage
- Error rate tracking
- Historical performance data

**Health Indicators:**
- CPU and memory usage (if available)
- Active connections
- Request queue size
- Last successful response

### Integration Management

**Available Integrations:**
```
┌─ Available Services ─────────────────────────────┐
│ ✅ Plex Server       [Configured]                │
│ ⚠️ Overseerr         [Needs Setup]               │
│ ❌ Uptime Kuma       [Not Connected]             │
│ ⚡ YouTube-DL        [Optional]                   │
│ 📊 TMDB API          [Optional]                  │
└─────────────────────────────────────────────────┘
```

## Settings Interface

### General Settings Tab

**Basic Configuration:**
- Application name and branding
- Default language and timezone
- Interface theme (Light/Dark/Auto)
- Home page configuration

### Integration Settings Tab

**Service Configuration:**
- Plex server settings and authentication
- External service URLs and API keys
- Webhook configuration
- Service polling intervals

### User Management Tab

**User Administration:**
```
┌─ Users ──────────────────────────────────────────┐
│ Name     │ Email              │ Role    │ Status  │
├──────────┼────────────────────┼─────────┼─────────┤
│ admin    │ admin@local        │ Admin   │ Active  │
│ john.doe │ john@example.com   │ User    │ Active  │
│ jane.doe │ jane@example.com   │ User    │ Pending │
└──────────┴────────────────────┴─────────┴─────────┘
[Add User] [Import from Plex] [Bulk Actions ▼]
```

**User Roles:**
- **Admin**: Full system access and configuration
- **User**: Media browsing and personal settings
- **Viewer**: Read-only access to media library

### Security Settings Tab

**Security Configuration:**
- Authentication methods
- Session timeout settings
- API access controls
- Security audit logs

## Real-time Features

### WebSocket Status Indicator

**Connection States:**
- 🟢 **Connected**: Real-time updates active
- 🟡 **Reconnecting**: Attempting to reconnect
- 🔴 **Disconnected**: No real-time updates
- ⚪ **Disabled**: Real-time updates turned off

### Live Updates

**Real-time Elements:**
- Service status changes
- Download progress
- User activity feed
- System resource usage
- Error notifications

### Notification System

**Notification Types:**
```
┌─ Notifications ────────────────────────────────────┐
│ 🔔 New media request from john.doe                │
│ ⚠️ Plex server response time degraded              │  
│ ✅ Movie "Example Title" download completed        │
│ 🚨 Authentication failed for 192.168.1.50         │
└───────────────────────────────────────────────────┘
```

**Notification Settings:**
- Email notifications
- Browser notifications
- In-app notification preferences
- Notification history

## Mobile Interface

### Mobile Navigation

**Bottom Tab Bar:**
```
[📊 Home] [📺 Media] [🔧 Services] [⚙️ Settings] [👤 Profile]
```

### Touch Gestures

**Supported Gestures:**
- Swipe to refresh (pull down on lists)
- Swipe to navigate (media carousel)
- Long press for context menus
- Pinch to zoom (media posters)

### Mobile Optimizations

**Interface Adaptations:**
- Larger touch targets (minimum 44px)
- Simplified navigation
- Collapsible sections
- Full-screen media viewer
- Mobile-friendly forms

## Accessibility Features

### Keyboard Navigation

**Keyboard Shortcuts:**
- `Ctrl/Cmd + K`: Global search
- `Ctrl/Cmd + /`: Show keyboard shortcuts
- `Tab/Shift+Tab`: Navigate interface
- `Enter/Space`: Activate buttons
- `Esc`: Close dialogs/modals

### Screen Reader Support

**Accessibility Features:**
- ARIA labels and descriptions
- Semantic HTML structure
- Focus management
- Alternative text for images
- High contrast mode support

### Visual Accessibility

**Display Options:**
- Light and dark themes
- High contrast mode
- Font size adjustment
- Reduced motion option
- Color blind friendly indicators

## Customization Options

### Theme Configuration

**Available Themes:**
- **Light Mode**: Default light theme
- **Dark Mode**: Dark theme for low-light use
- **Auto Mode**: System preference following
- **High Contrast**: Enhanced visibility theme

### Layout Preferences

**Customizable Elements:**
- Dashboard widget arrangement
- Default view modes
- Information density
- Column visibility in lists

### Personal Settings

**User Preferences:**
- Default landing page
- Language/locale settings
- Notification preferences
- Privacy settings

## Performance Features

### Interface Optimizations

**Performance Enhancements:**
- Virtual scrolling for large lists
- Image lazy loading
- Component code splitting
- Caching of API responses
- Optimistic UI updates

### Loading States

**Loading Indicators:**
- Skeleton screens for content
- Progress bars for uploads
- Spinner animations
- Loading state messaging

## Troubleshooting Interface Issues

### Common Interface Problems

**Slow Loading:**
- Check network connection
- Clear browser cache
- Disable browser extensions
- Check system resources

**Layout Issues:**
- Refresh the page
- Check browser compatibility
- Clear browser cache
- Try different browser

**Real-time Updates Not Working:**
- Check WebSocket connection status
- Verify firewall settings
- Test with different browser
- Check server logs

### Browser Compatibility

**Supported Browsers:**
- Chrome 90+ ✅ Full support
- Firefox 88+ ✅ Full support
- Safari 14+ ✅ Full support
- Edge 90+ ✅ Full support

**Known Issues:**
- Internet Explorer: Not supported
- Very old mobile browsers: Limited functionality

---

**Last Updated**: September 2025  
**Interface Version**: 2.0 (Post-Cleanup)  
**Next Review**: After UI/UX improvements